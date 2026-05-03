# Design: Env, Containers & MCP Servers

**Date:** 2026-04-29  
**Status:** Approved  
**Approach:** Bottom-up sequencial (A)

## Overview

Resolver os problemas de ambiente, sequenciamento de containers e MCP servers para que o stack completo suba corretamente. O trabalho é dividido em 4 fases sequenciais onde cada fase valida a anterior antes de avançar.

## Escopo

1. **Fase 0 — ConfigService**: migrar leituras de `process.env` em services NestJS para `ConfigService`
2. **Fase 1 — Env Manager**: tornar `Invoke-EnvManager.ps1` a fonte canônica do `.env.containers`
3. **Fase 2 — Containers & Container Manager**: subida correta de postgres → container-manager → domains on-demand
4. **Fase 3 — MCP Servers**: build e smoke de todos os 5 MCPs contra containers healthy
5. **Fase 4 — mcp-secrets**: completar implementação, build e smoke test

## Fase 0: Migração `process.env` → `ConfigService`

### Contexto

43 ocorrências de `process.env` no código-fonte da API. A maioria é legítima (bootstrap, TypeORM CLI), mas os NestJS services devem usar `ConfigService` para que a validação Zod de `buildAppEnv()` em `config/env.validation.ts` seja efetiva e centralizada.

### Regra de decisão

| Localização | Ação |
|-------------|------|
| `typeorm.config.ts` | **Manter `process.env`** — TypeORM CLI roda fora do DI, não pode injetar `ConfigService` |
| `domains/*/main.ts`, `main.ts` | **Manter `process.env`** — código de bootstrap antes do app inicializar |
| `modules/**/*.service.ts` | **Migrar para `ConfigService`** |

### Arquivos a migrar

- `apps/api/src/modules/graph/services/entra-registration.service.ts` — 8 ocorrências (`TENANT_ID`, `CLIENT_ID`, `CERT_THUMBPRINT`, `CLIENT_SECRET`, `CERT_PRIVATE_KEY_PATH`, `GRAPH_SCOPE`)
- `apps/api/src/modules/m365-migration/m365-migration.service.ts` — 13 ocorrências (vars M365 source/target + migration mode)

### Padrão de migração

```typescript
// Antes
const tenantId = process.env.TENANT_ID;

// Depois — injetar ConfigService no constructor
constructor(private readonly configService: ConfigService) {}

const tenantId = this.configService.get<string>('TENANT_ID');
```

### Resultado esperado

Services NestJS não leem `process.env` diretamente. Todas as leituras de config passam por `ConfigService`, beneficiando da validação Zod no startup.

## Fase 1: Env Manager & `.env.containers`

### Fluxo

```
secrets/local.secrets.json   ──┐
config/env/env.schema.json   ──┼──► Invoke-EnvManager.ps1 render ──► .env.containers
(defaults + derivações)      ──┘
```

### Capacidades existentes do Env Manager

- Lê `env.schema.json` com campos `secret`, `requiredFor`, `default`, `defaultFrom`
- Carrega `secrets/local.secrets.json` para vars marcadas `secret: true`
- Resolve `defaultFrom` (ex: `PG_PASSWORD` ← `POSTGRES_PASSWORD`)
- Valida obrigatoriedade por target (`containers`, `local`, `llm-ops`, `astra`)
- Grava log incremental em `logs-docker/env-<action>-<target>-<domain>.log`

### Passos

1. Executar `validate` para mapear vars faltando:
   ```powershell
   pwsh scripts/powershell/Invoke-EnvManager.ps1 -Action validate -Target containers
   ```
2. Preencher vars faltantes em `secrets/local.secrets.json`
3. Executar `render` para gerar `.env.containers`:
   ```powershell
   pwsh scripts/powershell/Invoke-EnvManager.ps1 -Action render -Target containers
   ```
4. Comparar com `.env.containers` manual atual — confirmar que nenhuma var real foi perdida
5. O `.env.containers` gerado passa a ser o arquivo canônico; nunca editar manualmente

### Resultado esperado

`.env.containers` gerado pelo Env Manager, reproduzível, sem edição manual.

## Fase 2: Containers, Container Manager & Sequenciamento

### Sequência de subida

```
1. postgres          (profile: persistent) → healthcheck: pg_isready
        └──► 2. container-manager  (profile: persistent) → depends_on: postgres healthy
                      └──► 3. domains  (profile: demand — iniciados on-demand via HTTP)
```

### Pontos críticos

| Ponto | Situação | Ação |
|-------|----------|------|
| `.env.containers` como volume `:ro` no container-manager | Deve existir antes de subir | Gerado na Fase 1 |
| Entrypoint instala deps a cada start | Lento, pode falhar offline | Investigar pré-build via `Dockerfile.manager` |
| `DOCKER_COMPOSE_BIN: docker-compose` | Alpine usa `docker compose` (plugin), não `docker-compose` | Corrigir var ou entrypoint |
| `/var/run/docker.sock` montado | Requer Docker Desktop socket habilitado no Windows | Verificar configuração |
| Healthcheck do manager aponta para `/health` | `container-manager.mjs` deve ter rota `/health` | Verificar implementação |

### Comandos canônicos

```bash
# Subir postgres + container-manager
docker compose --env-file .env.containers -p api-llm-embedded --profile persistent up -d

# Verificar saúde
docker compose -p api-llm-embedded ps

# Subir domain específico (dev/smoke — em produção o manager faz isso on-demand)
docker compose --env-file .env.containers -p api-llm-embedded --profile demand up -d users-api
```

### Resultado esperado

`postgres` healthy → `container-manager` healthy na porta 3000 → domains iniciados on-demand via HTTP request ao manager.

## Fase 2.5: LLM / LangFlow / AstraDB

### Bugs a corrigir no `docker-compose.yml`

**`llm-ops-api`** — faltam vars Astra no serviço:

```yaml
# Adicionar ao environment de llm-ops-api:
ASTRA_DB_API_ENDPOINT: ${ASTRA_DB_API_ENDPOINT}
ASTRA_DB_APPLICATION_TOKEN: ${ASTRA_DB_APPLICATION_TOKEN}
ASTRA_DB_KEYSPACE: ${ASTRA_DB_KEYSPACE:-llm_ops}
ASTRA_COLLECTION_KNOWLEDGE_BASE: ${ASTRA_COLLECTION_KNOWLEDGE_BASE:-knowledge_base}
ASTRA_COLLECTION_INTERACTIONS: ${ASTRA_COLLECTION_INTERACTIONS:-interactions}
LANGFLOW_RAG_FLOW_ID: ${LANGFLOW_RAG_FLOW_ID:-f81c0124-ffc2-4458-b30d-4d588d393518}
```

**`langflow`** — fixar versão da imagem:
- Substituir `langflowai/langflow:latest` por versão pinada (ex: `langflowai/langflow:1.3.4`)
- Motivo: `:latest` muda sem aviso e pode quebrar o flow RAG existente

### `env.schema.json` — verificar cobertura Astra

As vars Astra já estão no schema com `requiredFor: ["astra"]`. Verificar que `secrets/local.secrets.json` tem `ASTRA_DB_APPLICATION_TOKEN` e `ASTRA_DB_API_ENDPOINT` preenchidos para o target `astra` funcionar no Env Manager.

### Banco LangFlow

LangFlow usa um banco PostgreSQL separado (`LANGFLOW_DATABASE`, padrão `shp_langflow`). Este banco precisa existir antes de LangFlow subir. Opções:
- Criar via migration/init script no startup do postgres
- Ou criar manualmente na primeira vez: `CREATE DATABASE shp_langflow;`

### Pipeline RAG — smoke end-to-end

Após LangFlow + llm-ops-api healthy:
```
mcp-llm-ops → POST /llm-ops/chat → llm-ops-api → AstraDB → LangFlow (flow f81c0124)
```

Validar com smoke existente ou criar `scripts/smoke-tests/rag-e2e-smoke.mjs`.

### Resultado esperado

- `llm-ops-api` container recebe todas as vars Astra e LangFlow
- LangFlow sobe com imagem pinada e banco `shp_langflow` criado
- Smoke RAG end-to-end passa (mesmo que com `ASTRA_DB_ENABLED=false` inicialmente — validar pelo menos o fluxo de request)

## Fase 3: MCP Servers

### Dependências de URL

```
mcp-users        → USERS_API_URL=http://localhost:3001
mcp-llm-ops      → LLM_OPS_API_URL=http://localhost:3002
mcp-sync         → SYNC_API_URL=http://localhost:3004
mcp-secrets      → (in-process, sem API externa)
mcp-awesome-copilot → AWESOME_COPILOT_PLUGINS_ROOT (filesystem)
```

### Validação

1. Build de todos os MCPs:
   ```bash
   npm run validate:mcp
   ```
2. Com containers healthy, rodar smoke tests individualmente:
   ```bash
   node scripts/smoke-tests/mcp-users-read-smoke.mjs
   node scripts/smoke-tests/mcp-llm-ops-read-smoke.mjs
   node scripts/smoke-tests/mcp-sync-read-smoke.mjs
   ```
3. Verificar que todos os responses têm `"read-only-recommendation"` e schema correto

### Resultado esperado

Todos os MCPs compilam, conectam às APIs de domínio e smoke tests passam com contrato read-only validado.

## Fase 4: mcp-secrets

### Estado atual

- `apps/svcia/mcp-secrets/src/main.ts` — 4 tools registradas: `secrets_list`, `secrets_register_prepare`, `secrets_rotate_prepare`, `secrets_revoke_prepare`
- `apps/svcia/mcp-secrets/src/secrets-registry.ts` — tipos e catálogo hardcoded definidos; métodos `listSecrets()` e `prepareOperation()` incompletos

### O que implementar

**`listSecrets(options)`:**
- Iterar `DEFAULT_SECRET_CATALOG`
- Para cada entrada, verificar `process.env[entry.targetName]` para status `configured/unconfigured`
- Retornar `SecretMetadata[]` com `valuePreview: '[redacted]'` — nunca o valor real
- Respeitar filtros: `includeUnconfigured`, `limit`, `provider`

**`prepareOperation(input)`:**
- Gerar `SecretOperationPlan` com:
  - `dryRun: true`
  - `mutationAllowed: false`
  - `approvalRequired: true`
  - `correlationId`: UUID v4 gerado em runtime
  - `safetyChecks`: lista de verificações que seriam feitas
  - `rollbackPlan`: lista de passos de rollback
  - `status: 'prepared'`

**Catálogo a expandir** com vars do `env.schema.json` marcadas `secret: true`:
- `POSTGRES_PASSWORD`, `TENANT_ID`, `CLIENT_ID`, `CERT_THUMBPRINT`, `PG_PASSWORD`, `LLM_PG_PASSWORD`, `LLM_API_KEY`, `ASTRA_DB_APPLICATION_TOKEN`

### Build e teste

```bash
npm run -w apps/svcia/mcp-secrets build
node scripts/smoke-tests/mcp-secrets-read-smoke.mjs   # a criar
```

### Smoke test a criar (`mcp-secrets-read-smoke.mjs`)

Verificar:
- `secrets_list` retorna lista com `valuePreview: '[redacted]'` em todos os itens
- `secrets_register_prepare` retorna `dryRun: true`, `mutationAllowed: false`
- Nenhum valor real de secret aparece em nenhum response

### Resultado esperado

`mcp-secrets` builda limpo, `secrets_list` retorna metadados sem valores reais, todas as operações de mutação retornam dry-run com correlationId.

## Ordem de execução

```
Fase 0 (ConfigService)
    │ services migrados, type-check limpo
    ▼
Fase 1 (Env Manager)
    │ .env.containers gerado e validado (inclui vars Astra)
    ▼
Fase 2 (Containers)
    │ postgres + container-manager healthy
    │ domains sobem on-demand
    ▼
Fase 2.5 (LLM / LangFlow / AstraDB)
    │ docker-compose bugs corrigidos
    │ LangFlow sobe com imagem pinada
    │ smoke RAG end-to-end passa
    ▼
Fase 3 (MCPs)
    │ build + smoke de mcp-users, mcp-llm-ops, mcp-sync
    ▼
Fase 4 (mcp-secrets)
    │ implementação + build + smoke
    ▼
Stack completo validado
```

## Critérios de sucesso

- [ ] Nenhum `process.env` nos services NestJS (`entra-registration.service.ts`, `m365-migration.service.ts`)
- [ ] `npm run type-check` limpo após migração para `ConfigService`
- [ ] `Invoke-EnvManager.ps1 -Action validate` passa sem erros
- [ ] `Invoke-EnvManager.ps1 -Action render` gera `.env.containers` válido
- [ ] `docker compose ps` mostra `postgres` e `container-manager` com status `healthy`
- [ ] Container Manager responde em `http://localhost:3000/health`
- [ ] `llm-ops-api` container recebe todas as vars Astra e LangFlow
- [ ] LangFlow sobe com imagem pinada e banco `shp_langflow` existente
- [ ] `npm run validate:mcp` passa para todos os MCPs
- [ ] Smoke tests de mcp-users, mcp-llm-ops e mcp-sync passam
- [ ] Smoke RAG end-to-end passa pelo menos com `ASTRA_DB_ENABLED=false`
- [ ] `mcp-secrets` builda e smoke test passa com contrato dry-run validado
