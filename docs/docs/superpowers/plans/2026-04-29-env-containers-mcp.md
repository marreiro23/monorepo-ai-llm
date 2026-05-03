# Env, Containers & MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o stack completo subir corretamente — desde o env gerado canonicamente até containers healthy, MCPs funcionando e mcp-secrets completo.

**Architecture:** Bottom-up sequencial: ConfigService migration → Env Manager → container fixes → LangFlow/Astra → MCP smoke → mcp-secrets. Cada fase valida a anterior antes de avançar.

**Tech Stack:** NestJS 11 + ConfigService, PowerShell (Invoke-EnvManager.ps1), Docker Compose, Node.js MCP stdio, TypeScript 7 via tsgo.

---

## File Map

| Arquivo | Ação | Tarefa |
|---------|------|--------|
| `apps/api/src/modules/graph/services/entra-registration.service.ts` | Modificar | Task 1 |
| `apps/api/src/modules/m365-migration/m365-migration.service.ts` | Modificar | Task 2 |
| `scripts/utils/container-manager.mjs` | Modificar | Task 3 |
| `docker-compose.yml` | Modificar | Task 4 + Task 5 |
| `apps/svcia/mcp-secrets/src/secrets-registry.ts` | Modificar | Task 8 |
| `scripts/smoke-tests/mcp-secrets-read-smoke.mjs` | Criar | Task 9 |

---

## Task 1: ConfigService — entra-registration.service.ts

**Files:**
- Modify: `apps/api/src/modules/graph/services/entra-registration.service.ts`

> `ConfigModule.forRoot({ isGlobal: true })` está ativo em `app.module.ts`, então `ConfigService` está disponível em qualquer serviço sem importar `ConfigModule` explicitamente.

- [ ] **Step 1: Substituir imports e adicionar injeção de ConfigService**

Substitua o topo do arquivo — adicione o import de `ConfigService` e injete no constructor:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientCertificateCredential, ClientSecretCredential } from '@azure/identity';
import { X509Certificate } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_ROOT = resolve(__dirname, '../../../../../..');

function getNonEmptyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeThumbprint(value: unknown): string {
  return getNonEmptyValue(value).replace(/[^a-fA-F0-9]/g, '').toUpperCase();
}

function readCertificateThumbprint(certificatePath: string): string {
  const pemContent = readFileSync(certificatePath, 'utf8');
  const certificateMatch = pemContent.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);

  if (!certificateMatch) {
    throw new Error('O PEM informado em CERT_PRIVATE_KEY_PATH precisa conter o certificado publico alem da chave privada.');
  }

  const certificate = new X509Certificate(certificateMatch[0]);
  return normalizeThumbprint(certificate.fingerprint);
}

@Injectable()
export class EntraRegistrationService {
  private credential: ClientCertificateCredential | ClientSecretCredential | null = null;
  private cachedToken: string | null = null;
  private cachedTokenExpiresOn = 0;
  private lastAuthTime: string | null = null;
  private authMethod: string | null = null;
  private certificatePath: string | null = null;
  private certificateThumbprint: string | null = null;

  constructor(private readonly configService: ConfigService) {}
```

- [ ] **Step 2: Substituir process.env em getConfig()**

```typescript
  getConfig() {
    const certPath = getNonEmptyValue(this.configService.get<string>('CERT_PRIVATE_KEY_PATH'));
    const clientSecret = getNonEmptyValue(this.configService.get<string>('CLIENT_SECRET'));
    const graphScope = getNonEmptyValue(this.configService.get<string>('GRAPH_SCOPE')) || DEFAULT_GRAPH_SCOPE;

    return {
      tenantIdConfigured: Boolean(this.configService.get<string>('TENANT_ID')),
      clientIdConfigured: Boolean(this.configService.get<string>('CLIENT_ID')),
      certificatePathConfigured: Boolean(certPath),
      certificateThumbprintConfigured: Boolean(getNonEmptyValue(this.configService.get<string>('CERT_THUMBPRINT'))),
      clientSecretConfigured: Boolean(clientSecret),
      authMethod: this.authMethod || 'not-authenticated',
      graphBaseUrl: 'https://graph.microsoft.com/v1.0',
      scope: graphScope,
      isAuthenticated: Boolean(this.cachedToken && Date.now() < this.cachedTokenExpiresOn),
      lastAuthTime: this.lastAuthTime,
      certificatePath: this.certificatePath,
      certificateThumbprint: this.certificateThumbprint
    };
  }
```

- [ ] **Step 3: Substituir process.env em getCredential()**

```typescript
  getCredential() {
    const tenantId = getNonEmptyValue(this.configService.get<string>('TENANT_ID'));
    const clientId = getNonEmptyValue(this.configService.get<string>('CLIENT_ID'));
    const clientSecret = getNonEmptyValue(this.configService.get<string>('CLIENT_SECRET'));
    const certificateRelativePath = getNonEmptyValue(this.configService.get<string>('CERT_PRIVATE_KEY_PATH'));
    const expectedThumbprint = normalizeThumbprint(this.configService.get<string>('CERT_THUMBPRINT'));

    if (!tenantId || !clientId) {
      throw new Error('Configure TENANT_ID e CLIENT_ID no ambiente para usar Microsoft Graph.');
    }

    if (!certificateRelativePath && !clientSecret) {
      throw new Error('Configure CLIENT_SECRET ou CERT_PRIVATE_KEY_PATH/CERT_THUMBPRINT para autenticar no Microsoft Graph.');
    }

    if (!this.credential) {
      if (certificateRelativePath) {
        const certificatePath = resolve(API_ROOT, certificateRelativePath);

        if (!existsSync(certificatePath)) {
          throw new Error(`Certificado não encontrado em ${certificatePath}. Verifique CERT_PRIVATE_KEY_PATH.`);
        }

        if (!expectedThumbprint) {
          throw new Error('Configure CERT_THUMBPRINT para autenticar no Microsoft Graph com certificado.');
        }

        const actualThumbprint = readCertificateThumbprint(certificatePath);
        if (actualThumbprint !== expectedThumbprint) {
          throw new Error(`O thumbprint configurado em CERT_THUMBPRINT nao corresponde ao certificado em ${certificatePath}.`);
        }

        this.credential = new ClientCertificateCredential(tenantId, clientId, { certificatePath });
        this.authMethod = 'client-certificate';
        this.certificatePath = certificatePath;
        this.certificateThumbprint = actualThumbprint;
      } else {
        this.credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        this.authMethod = 'client-secret';
        this.certificatePath = null;
        this.certificateThumbprint = null;
      }
    }

    return this.credential;
  }
```

- [ ] **Step 4: Substituir process.env em authenticate()**

```typescript
  async authenticate() {
    const scope = getNonEmptyValue(this.configService.get<string>('GRAPH_SCOPE')) || DEFAULT_GRAPH_SCOPE;
    const token = await this.getCredential().getToken([scope]);
    if (!token?.token) {
      throw new Error('Falha ao obter token de acesso do Microsoft Graph.');
    }

    this.cachedToken = token.token;
    this.cachedTokenExpiresOn = token.expiresOnTimestamp || Date.now() + 45 * 60 * 1000;
    this.lastAuthTime = new Date().toISOString();

    return true;
  }
```

`getAccessToken()` não usa `process.env` — não precisa de mudança.

- [ ] **Step 5: Verificar que não sobrou nenhum process.env**

```bash
grep "process\.env" apps/api/src/modules/graph/services/entra-registration.service.ts
```

Saída esperada: nenhuma linha.

- [ ] **Step 6: Type-check**

```bash
npm run type-check
```

Saída esperada: sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/graph/services/entra-registration.service.ts
git commit -m "refactor(graph): migrate EntraRegistrationService to ConfigService"
```

---

## Task 2: ConfigService — m365-migration.service.ts

**Files:**
- Modify: `apps/api/src/modules/m365-migration/m365-migration.service.ts`

- [ ] **Step 1: Adicionar import de ConfigService e injetar no constructor**

Adicione `ConfigService` ao import do NestJS e ao constructor. O constructor já tem muitas injeções — adicione `ConfigService` no final:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
// ... demais imports inalterados
```

No constructor, adicione `private readonly configService: ConfigService` como último parâmetro:

```typescript
  constructor(
    @InjectRepository(MigrationTenantEntity)
    private readonly tenantRepo: Repository<MigrationTenantEntity>,
    @InjectRepository(MigrationMailboxEntity)
    private readonly mailboxRepo: Repository<MigrationMailboxEntity>,
    @InjectRepository(MigrationMailboxMappingEntity)
    private readonly mappingRepo: Repository<MigrationMailboxMappingEntity>,
    @InjectRepository(MigrationReadinessCheckEntity)
    private readonly readinessRepo: Repository<MigrationReadinessCheckEntity>,
    @InjectRepository(MigrationJobEntity)
    private readonly jobRepo: Repository<MigrationJobEntity>,
    @InjectRepository(MigrationEventEntity)
    private readonly eventRepo: Repository<MigrationEventEntity>,
    private readonly entraRegistrationService: EntraRegistrationService,
    private readonly graphService: GraphService,
    private readonly configService: ConfigService
  ) {}
```

- [ ] **Step 2: Substituir process.env em createDryRunJob()**

```typescript
  async createDryRunJob() {
    const mappings = await this.mappingRepo.find();
    const blocked = mappings.filter((mapping) => mapping.status !== 'valid');
    const failedReadiness = await this.readinessRepo.count({ where: { status: 'failed' } });
    const enableExchangeMigration = this.configService.get<string>('M365_ENABLE_EXCHANGE_MIGRATION') === 'true';

    const job = await this.jobRepo.save(this.jobRepo.create({
      mode: 'dry-run',
      status: blocked.length > 0 || failedReadiness > 0 || enableExchangeMigration ? 'blocked' : 'planned',
      mappingCount: mappings.length,
      blockedReason: blocked.length > 0
        ? `${blocked.length} mappings bloqueados.`
        : failedReadiness > 0
          ? `${failedReadiness} readiness checks falharam.`
        : enableExchangeMigration
          ? 'Dry-run nao executa migracao real; use endpoint dedicado futuro com readiness completo.'
          : undefined,
      rawPlan: {
        migrationMode: this.configService.get<string>('M365_MIGRATION_MODE') || 'inventory-only',
        exchangeMigrationEnabled: enableExchangeMigration,
        validMappings: mappings.length - blocked.length,
        blockedMappings: blocked.length,
        failedReadinessChecks: failedReadiness
      }
    }));

    await this.eventRepo.save(this.eventRepo.create({
      jobId: job.id,
      type: 'dry_run_created',
      severity: blocked.length > 0 ? 'warning' : 'info',
      message: `Dry-run criado com ${mappings.length} mappings e ${blocked.length} bloqueios.`,
      details: job.rawPlan
    }));

    return { success: true, data: job };
  }
```

- [ ] **Step 3: Substituir process.env em buildCurrentTenantReadiness()**

Altere apenas o check `exchange_migration_feature_flag`:

```typescript
      {
        checkKey: 'exchange_migration_feature_flag',
        status: this.configService.get<string>('M365_ENABLE_EXCHANGE_MIGRATION') === 'true' ? 'warning' : 'passed',
        message: this.configService.get<string>('M365_ENABLE_EXCHANGE_MIGRATION') === 'true'
          ? 'Feature flag de migracao Exchange esta ligada, mas este modulo ainda so executa dry-run.'
          : 'Migracao real Exchange permanece bloqueada por feature flag.'
      },
```

- [ ] **Step 4: Substituir process.env em buildTargetTenantReadiness()**

```typescript
  private buildTargetTenantReadiness(): ReadinessCheck[] {
    const configured = Boolean(
      this.configService.get<string>('TARGET_TENANT_ID') &&
      this.configService.get<string>('TARGET_CLIENT_ID')
    );
    return [
      {
        checkKey: 'target_tenant_config',
        status: configured ? 'warning' : 'failed',
        message: configured
          ? 'TARGET_TENANT_ID/TARGET_CLIENT_ID configurados; falta validar token target dedicado.'
          : 'TARGET_TENANT_ID/TARGET_CLIENT_ID ainda nao configurados.'
      },
      // ... demais checks inalterados
    ];
  }
```

- [ ] **Step 5: Substituir process.env em upsertTenantStatus()**

```typescript
  private async upsertTenantStatus(tenantRole: MigrationTenantRole, status: MigrationTenantStatus, checks: ReadinessCheck[]) {
    const currentConfig = this.entraRegistrationService.getConfig();
    const tenantData = tenantRole === 'source'
      ? {
          role: tenantRole,
          tenantId: this.configService.get<string>('SOURCE_TENANT_ID') || this.configService.get<string>('TENANT_ID'),
          clientId: this.configService.get<string>('SOURCE_CLIENT_ID') || this.configService.get<string>('CLIENT_ID'),
          authMethod: currentConfig.authMethod,
          certificateThumbprint: this.configService.get<string>('SOURCE_CERT_THUMBPRINT') || this.configService.get<string>('CERT_THUMBPRINT'),
          status,
          lastValidatedAt: new Date(),
          rawStatus: { checks: checks.map(({ checkKey, status }) => ({ checkKey, status })) }
        }
      : {
          role: tenantRole,
          tenantId: this.configService.get<string>('TARGET_TENANT_ID'),
          clientId: this.configService.get<string>('TARGET_CLIENT_ID'),
          authMethod: this.configService.get<string>('TARGET_CERT_PRIVATE_KEY_PATH') ? 'client-certificate' : undefined,
          certificateThumbprint: this.configService.get<string>('TARGET_CERT_THUMBPRINT'),
          status,
          lastValidatedAt: new Date(),
          rawStatus: { checks: checks.map(({ checkKey, status }) => ({ checkKey, status })) }
        };

    await this.tenantRepo.upsert(tenantData, { conflictPaths: ['role'], skipUpdateIfNoValuesChanged: false });
    return this.tenantRepo.findOneByOrFail({ role: tenantRole });
  }
```

- [ ] **Step 6: Verificar que não sobrou nenhum process.env**

```bash
grep "process\.env" apps/api/src/modules/m365-migration/m365-migration.service.ts
```

Saída esperada: nenhuma linha.

- [ ] **Step 7: Type-check**

```bash
npm run type-check
```

Saída esperada: sem erros.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/m365-migration/m365-migration.service.ts
git commit -m "refactor(m365-migration): migrate M365MigrationService to ConfigService"
```

---

## Task 3: Env Manager — Validar e gerar .env.containers

> Esta tarefa é operacional. Nenhum código é alterado a menos que `env.schema.json` precise de ajuste.

**Files:**
- Read: `config/env/env.schema.json`
- Read/Modify: `secrets/local.secrets.json`

- [ ] **Step 1: Executar validate para mapear vars faltando**

```powershell
pwsh scripts/powershell/Invoke-EnvManager.ps1 -Action validate -Target containers
```

Saída esperada: lista de vars com status `ok` ou `missing`. Anotar todas as `missing`.

- [ ] **Step 2: Preencher vars faltando em secrets/local.secrets.json**

Para cada var marcada como `missing` e `secret: true` no schema, preencher em `secrets/local.secrets.json`. O arquivo já existe em `secrets/local.secrets.json`. Estrutura esperada:

```json
{
  "POSTGRES_PASSWORD": "valor-real",
  "TENANT_ID": "valor-real",
  "CLIENT_ID": "valor-real",
  "CERT_THUMBPRINT": "valor-real",
  "PG_PASSWORD": "valor-real",
  "LLM_PG_PASSWORD": "valor-real",
  "LLM_API_KEY": "valor-real-ou-vazio",
  "ASTRA_DB_APPLICATION_TOKEN": "valor-real-ou-vazio"
}
```

Vars não-secretas com `default` no schema serão preenchidas automaticamente pelo Env Manager.

- [ ] **Step 3: Executar render para gerar .env.containers**

```powershell
pwsh scripts/powershell/Invoke-EnvManager.ps1 -Action render -Target containers
```

Saída esperada: `.env.containers` gerado em raiz do projeto, log gravado em `logs-docker/`.

- [ ] **Step 4: Verificar o .env.containers gerado**

```bash
# Contar quantas vars foram geradas
grep -c "=" .env.containers

# Confirmar vars críticas estão presentes
grep "POSTGRES_PASSWORD\|TENANT_ID\|PG_HOST\|LLM_PG_HOST\|COMPOSE_PROJECT" .env.containers
```

Saída esperada: `PG_HOST=postgres`, `LLM_PG_HOST=postgres`, `COMPOSE_PROJECT=api-llm-embedded`.

- [ ] **Step 5: Validar com docker compose config**

```bash
docker compose --env-file .env.containers -p api-llm-embedded config --services
```

Saída esperada: lista de serviços sem warnings de variável indefinida.

---

## Task 4: Corrigir container-manager — adicionar rota /health

**Files:**
- Modify: `scripts/utils/container-manager.mjs`

> O healthcheck do `container-manager` no `docker-compose.yml` aponta para `/health`, mas o código só tem `/status`. A subida do container vai travar sem essa rota.

- [ ] **Step 1: Localizar o bloco do handler /status**

Abra `scripts/utils/container-manager.mjs` e localize a linha:

```javascript
    else if (req.method === 'GET' && pathname === '/status') {
```

- [ ] **Step 2: Adicionar handler /health imediatamente antes do /status**

Adicione o bloco abaixo logo antes do `else if` do `/status`:

```javascript
    // GET /health — used by docker compose healthcheck
    else if (req.method === 'GET' && pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    }
```

- [ ] **Step 3: Verificar que /health e /status coexistem**

```bash
grep -n "'/health'\|'/status'\|\"/health\"\|\"/status\"\|pathname === '/health'\|pathname === '/status'" scripts/utils/container-manager.mjs
```

Saída esperada: ambas as rotas aparecem.

- [ ] **Step 4: Commit**

```bash
git add scripts/utils/container-manager.mjs
git commit -m "fix(container-manager): add /health route for docker compose healthcheck"
```

---

## Task 5: Corrigir docker-compose — DOCKER_COMPOSE_BIN e vars Astra + LangFlow

**Files:**
- Modify: `docker-compose.yml`

> Dois bugs: (1) `DOCKER_COMPOSE_BIN: docker-compose` falha dentro do Alpine que usa `docker compose` como plugin. (2) `llm-ops-api` não repassa vars Astra e `LANGFLOW_RAG_FLOW_ID` para o container.

- [ ] **Step 1: Corrigir DOCKER_COMPOSE_BIN no serviço container-manager**

Localize no `docker-compose.yml`:
```yaml
      DOCKER_COMPOSE_BIN: docker-compose
```

Substitua por:
```yaml
      DOCKER_COMPOSE_BIN: docker compose
```

- [ ] **Step 2: Adicionar vars Astra e LangFlow ao serviço llm-ops-api**

Localize no `docker-compose.yml`, dentro do `environment` de `llm-ops-api`:
```yaml
      ASTRA_DB_ENABLED: ${ASTRA_DB_ENABLED:-false}
```

Substitua por:
```yaml
      ASTRA_DB_ENABLED: ${ASTRA_DB_ENABLED:-false}
      ASTRA_DB_API_ENDPOINT: ${ASTRA_DB_API_ENDPOINT:-}
      ASTRA_DB_APPLICATION_TOKEN: ${ASTRA_DB_APPLICATION_TOKEN:-}
      ASTRA_DB_KEYSPACE: ${ASTRA_DB_KEYSPACE:-llm_ops}
      ASTRA_COLLECTION_KNOWLEDGE_BASE: ${ASTRA_COLLECTION_KNOWLEDGE_BASE:-knowledge_base}
      ASTRA_COLLECTION_INTERACTIONS: ${ASTRA_COLLECTION_INTERACTIONS:-interactions}
      LANGFLOW_RAG_FLOW_ID: ${LANGFLOW_RAG_FLOW_ID:-f81c0124-ffc2-4458-b30d-4d588d393518}
```

- [ ] **Step 3: Pinar versão da imagem LangFlow**

Localize:
```yaml
    image: langflowai/langflow:latest
```

Verifique a última versão estável em https://hub.docker.com/r/langflowai/langflow/tags e substitua por versão pinada, ex:
```yaml
    image: langflowai/langflow:1.3.4
```

- [ ] **Step 4: Validar compose config**

```bash
docker compose --env-file .env.containers -p api-llm-embedded config --services
```

Saída esperada: sem warnings de variável indefinida.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "fix(docker): DOCKER_COMPOSE_BIN, Astra vars in llm-ops-api, pin LangFlow image"
```

---

## Task 6: Subir containers e criar banco shp_langflow

> Tarefa operacional. Nenhum arquivo de código é alterado.

- [ ] **Step 1: Subir postgres + container-manager**

```bash
docker compose --env-file .env.containers -p api-llm-embedded --profile persistent up -d
```

- [ ] **Step 2: Aguardar postgres healthy**

```bash
docker compose -p api-llm-embedded ps postgres
```

Saída esperada: `STATUS` = `healthy`. Se não, aguardar 30s e repetir.

- [ ] **Step 3: Criar banco shp_langflow (uma única vez)**

```bash
docker exec api-llm-embedded-postgres psql -U postgres -c "CREATE DATABASE shp_langflow;"
```

Saída esperada: `CREATE DATABASE` ou `ERROR: database "shp_langflow" already exists` (ambos são ok).

- [ ] **Step 4: Verificar container-manager healthy**

```bash
docker compose -p api-llm-embedded ps container-manager
```

Saída esperada: `STATUS` = `healthy`. Se `starting`, aguardar o entrypoint instalar deps (pode levar 2-3 min na primeira vez).

Se falhar, verificar logs:
```bash
docker compose -p api-llm-embedded logs container-manager --tail 50
```

- [ ] **Step 5: Subir domain apis para validação**

```bash
docker compose --env-file .env.containers -p api-llm-embedded --profile demand up -d users-api llm-ops-api sync-api
```

- [ ] **Step 6: Verificar saúde dos domains**

```bash
docker compose -p api-llm-embedded ps
```

Saída esperada: `users-api`, `llm-ops-api`, `sync-api` com `STATUS` = `healthy`.

Se algum falhar:
```bash
docker compose -p api-llm-embedded logs <service> --tail 50
```

- [ ] **Step 7: Subir LangFlow**

```bash
docker compose --env-file .env.containers -p api-llm-embedded --profile demand up -d langflow
```

Aguardar healthcheck (start_period: 30s). Verificar:
```bash
docker compose -p api-llm-embedded ps langflow
```

---

## Task 7: MCP Servers — build e smoke

> Tarefa operacional + possíveis fixes de build. Nenhum código de produção deve precisar de alteração se os builds estavam passando anteriormente.

- [ ] **Step 1: Build de todos os MCPs**

```bash
npm run validate:mcp
```

Saída esperada: todos os workspaces MCP compilam sem erro. Se falhar, verificar qual workspace e corrigir o erro de compilação reportado antes de continuar.

- [ ] **Step 2: Smoke test mcp-users (requer users-api healthy)**

```bash
node scripts/smoke-tests/mcp-users-read-smoke.mjs
```

Saída esperada: nenhum erro lançado. Processo termina com exit 0.

- [ ] **Step 3: Smoke test mcp-llm-ops (requer llm-ops-api healthy)**

```bash
node scripts/smoke-tests/mcp-llm-ops-read-smoke.mjs
```

Saída esperada: exit 0.

- [ ] **Step 4: Smoke test mcp-sync (requer sync-api healthy)**

```bash
node scripts/smoke-tests/mcp-sync-read-smoke.mjs
```

Saída esperada: exit 0.

---

## Task 8: mcp-secrets — expandir catálogo

**Files:**
- Modify: `apps/svcia/mcp-secrets/src/secrets-registry.ts`

> `listSecrets()` e `prepareOperation()` já estão implementados. O catálogo `DEFAULT_SECRET_CATALOG` precisa ser expandido com as vars marcadas `secret: true` em `config/env/env.schema.json`.

- [ ] **Step 1: Expandir DEFAULT_SECRET_CATALOG**

No arquivo `apps/svcia/mcp-secrets/src/secrets-registry.ts`, localize `const DEFAULT_SECRET_CATALOG` e substitua pelo catálogo expandido:

```typescript
const DEFAULT_SECRET_CATALOG: SecretCatalogEntry[] = [
  {
    logicalKey: 'graph.client.secret',
    targetName: 'GRAPH_CLIENT_SECRET',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description: 'Microsoft Graph client secret.',
    rotationSupported: true
  },
  {
    logicalKey: 'graph.certificate.pem',
    targetName: 'GRAPH_CERTIFICATE_PEM',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description: 'Microsoft Graph certificate PEM.',
    rotationSupported: true
  },
  {
    logicalKey: 'postgres.primary.url',
    targetName: 'POSTGRES_URL',
    provider: 'process-env',
    requiredBy: ['apps/api', 'typeorm'],
    description: 'Primary PostgreSQL connection URL.',
    rotationSupported: true
  },
  {
    logicalKey: 'postgres.password',
    targetName: 'POSTGRES_PASSWORD',
    provider: 'process-env',
    requiredBy: ['apps/api', 'typeorm', 'docker-compose'],
    description: 'PostgreSQL superuser password.',
    rotationSupported: true
  },
  {
    logicalKey: 'azure.tenant.id',
    targetName: 'TENANT_ID',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth', 'm365-migration'],
    description: 'Microsoft Entra tenant ID.',
    rotationSupported: false
  },
  {
    logicalKey: 'azure.client.id',
    targetName: 'CLIENT_ID',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description: 'Microsoft Entra app client ID.',
    rotationSupported: false
  },
  {
    logicalKey: 'azure.cert.thumbprint',
    targetName: 'CERT_THUMBPRINT',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description: 'Certificate thumbprint for Graph authentication.',
    rotationSupported: true
  },
  {
    logicalKey: 'pg.password',
    targetName: 'PG_PASSWORD',
    provider: 'process-env',
    requiredBy: ['apps/api', 'typeorm'],
    description: 'PostgreSQL password for the public schema connection.',
    rotationSupported: true
  },
  {
    logicalKey: 'llm.pg.password',
    targetName: 'LLM_PG_PASSWORD',
    provider: 'process-env',
    requiredBy: ['apps/api', 'typeorm', 'llm-ops'],
    description: 'PostgreSQL password for the llm_ops schema connection.',
    rotationSupported: true
  },
  {
    logicalKey: 'llm.api.key',
    targetName: 'LLM_API_KEY',
    provider: 'process-env',
    requiredBy: ['apps/api', 'llm-ops'],
    description: 'OpenAI / LLM provider API key.',
    rotationSupported: true
  },
  {
    logicalKey: 'astra.application.token',
    targetName: 'ASTRA_DB_APPLICATION_TOKEN',
    provider: 'process-env',
    requiredBy: ['apps/api', 'llm-ops-rag'],
    description: 'Astra DB application token for the Data API.',
    rotationSupported: true
  },
  {
    logicalKey: 'langflow.api.key',
    targetName: 'LANGFLOW_API_KEY',
    provider: 'process-env',
    requiredBy: ['apps/api', 'llm-ops-rag'],
    description: 'LangFlow API key.',
    rotationSupported: true
  }
];
```

- [ ] **Step 2: Verificar que não quebrou nada**

```bash
grep -n "DEFAULT_SECRET_CATALOG\|listSecrets\|prepareOperation" apps/svcia/mcp-secrets/src/secrets-registry.ts
```

Saída esperada: as referências continuam presentes.

- [ ] **Step 3: Build mcp-secrets**

```bash
npm run -w apps/svcia/mcp-secrets build
```

Saída esperada: sem erros, `dist/` gerado.

- [ ] **Step 4: Commit**

```bash
git add apps/svcia/mcp-secrets/src/secrets-registry.ts
git commit -m "feat(mcp-secrets): expand secret catalog with all env.schema secrets"
```

---

## Task 9: mcp-secrets — criar e executar smoke test

**Files:**
- Create: `scripts/smoke-tests/mcp-secrets-read-smoke.mjs`

- [ ] **Step 1: Criar o smoke test**

Crie o arquivo `scripts/smoke-tests/mcp-secrets-read-smoke.mjs`:

```javascript
#!/usr/bin/env node

// Smoke test: mcp-secrets read-only contract
// Verifica que SecretsRegistry retorna metadados sem valores reais
// e que operações de mutação retornam dry-run

const { SecretsRegistry } = await import('../../apps/svcia/mcp-secrets/dist/secrets-registry.js');

// Env mock com algumas vars configuradas, outras não
const mockEnv = {
  POSTGRES_PASSWORD: 'should-never-appear-in-output',
  TENANT_ID: 'mock-tenant-id',
  LLM_API_KEY: 'mock-llm-key'
};

const registry = new SecretsRegistry(mockEnv);

// --- Test 1: listSecrets retorna array ---
const all = registry.listSecrets();
if (!Array.isArray(all) || all.length === 0) {
  throw new Error(`Expected non-empty array from listSecrets, got: ${JSON.stringify(all)}`);
}

// --- Test 2: nenhum item expõe valor real ---
for (const entry of all) {
  if (entry.valuePreview !== '[redacted]') {
    throw new Error(`Secret ${entry.logicalKey} leaked value: ${entry.valuePreview}`);
  }
  if (entry.valueStatus !== 'redacted') {
    throw new Error(`Expected valueStatus "redacted" for ${entry.logicalKey}, got: ${entry.valueStatus}`);
  }
  if (typeof entry.configured !== 'boolean') {
    throw new Error(`Expected boolean "configured" for ${entry.logicalKey}, got: ${typeof entry.configured}`);
  }
}

// --- Test 3: configured reflete o mockEnv ---
const postgresEntry = all.find((e) => e.targetName === 'POSTGRES_PASSWORD');
if (!postgresEntry) throw new Error('Expected POSTGRES_PASSWORD in catalog');
if (!postgresEntry.configured) throw new Error('POSTGRES_PASSWORD should be configured in mock env');

const astraEntry = all.find((e) => e.targetName === 'ASTRA_DB_APPLICATION_TOKEN');
if (!astraEntry) throw new Error('Expected ASTRA_DB_APPLICATION_TOKEN in catalog');
if (astraEntry.configured) throw new Error('ASTRA_DB_APPLICATION_TOKEN should NOT be configured in mock env');

// --- Test 4: listSecrets com filter provider ---
const processEnvSecrets = registry.listSecrets({ provider: 'process-env' });
if (processEnvSecrets.some((e) => e.provider !== 'process-env')) {
  throw new Error('provider filter did not work correctly');
}

// --- Test 5: listSecrets com limit ---
const limited = registry.listSecrets({ limit: 3 });
if (limited.length > 3) {
  throw new Error(`Expected at most 3 results with limit:3, got ${limited.length}`);
}

// --- Test 6: prepareOperation retorna dry-run plan ---
const plan = registry.prepareOperation({
  action: 'rotate',
  logicalKey: 'postgres.password',
  requestedBy: 'smoke-test',
  reason: 'routine rotation smoke test'
});

if (plan.dryRun !== true) throw new Error('Expected dryRun: true');
if (plan.mutationAllowed !== false) throw new Error('Expected mutationAllowed: false');
if (plan.approvalRequired !== true) throw new Error('Expected approvalRequired: true');
if (plan.approvalGate.approved !== false) throw new Error('Expected approvalGate.approved: false');
if (!plan.audit.correlationId) throw new Error('Expected correlationId to be present');
if (!Array.isArray(plan.safetyChecks) || plan.safetyChecks.length === 0) {
  throw new Error('Expected non-empty safetyChecks array');
}
if (!Array.isArray(plan.rollbackPlan) || plan.rollbackPlan.length === 0) {
  throw new Error('Expected non-empty rollbackPlan array');
}

// --- Test 7: prepareOperation com logicalKey não catalogado ---
const unknownPlan = registry.prepareOperation({
  action: 'register',
  logicalKey: 'custom.unknown.key',
  targetName: 'CUSTOM_UNKNOWN_VAR'
});

if (unknownPlan.dryRun !== true) throw new Error('Unknown key plan must still be dry-run');
if (unknownPlan.targetName !== 'CUSTOM_UNKNOWN_VAR') {
  throw new Error(`Expected targetName CUSTOM_UNKNOWN_VAR, got ${unknownPlan.targetName}`);
}

console.log(`✓ mcp-secrets smoke: ${all.length} secrets listed, all redacted, dry-run contract verified`);
```

- [ ] **Step 2: Executar o smoke test**

```bash
node scripts/smoke-tests/mcp-secrets-read-smoke.mjs
```

Saída esperada:
```
✓ mcp-secrets smoke: 12 secrets listed, all redacted, dry-run contract verified
```

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-tests/mcp-secrets-read-smoke.mjs
git commit -m "test(mcp-secrets): add read-only smoke test for SecretsRegistry"
```

---

## Critérios de conclusão

- [ ] `grep "process\.env" apps/api/src/modules/graph/services/entra-registration.service.ts` — sem resultado
- [ ] `grep "process\.env" apps/api/src/modules/m365-migration/m365-migration.service.ts` — sem resultado
- [ ] `npm run type-check` — sem erros
- [ ] `pwsh scripts/powershell/Invoke-EnvManager.ps1 -Action validate -Target containers` — sem vars missing
- [ ] `docker compose -p api-llm-embedded ps` — `postgres` e `container-manager` com `STATUS: healthy`
- [ ] `docker compose -p api-llm-embedded ps` — `users-api`, `llm-ops-api`, `sync-api` com `STATUS: healthy`
- [ ] `npm run validate:mcp` — sem erros de build
- [ ] `node scripts/smoke-tests/mcp-users-read-smoke.mjs` — exit 0
- [ ] `node scripts/smoke-tests/mcp-llm-ops-read-smoke.mjs` — exit 0
- [ ] `node scripts/smoke-tests/mcp-sync-read-smoke.mjs` — exit 0
- [ ] `node scripts/smoke-tests/mcp-secrets-read-smoke.mjs` — exit 0 com mensagem de sucesso
