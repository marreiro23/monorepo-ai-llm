# API Keys & Docker Secrets — Design Spec

**Date:** 2026-04-30
**Status:** Approved

## Context

Dois problemas distintos a resolver:

1. **Application-level API Keys:** O `ApiKeyAuthService` atual lê chaves de `API_KEY` (env var, comma-separated Set em memória). Sem suporte a múltiplos clientes com escopos, rotação agendada ou histórico auditável.

2. **Container Secret Injection:** Segredos externos (PG_PASSWORD, LLM_API_KEY, ASTRA_DB_APPLICATION_TOKEN, CERT_THUMBPRINT etc.) são injetados como env vars via `.env.containers`. Ficam expostos em `docker inspect`.

**Objetivo:** (A) Novo módulo `api-keys` com entidade PostgreSQL + rotação agendada + admin HTTP + MCP como aprovação. (B) Migrar segredos externos para Docker Compose `secrets:` stanza com padrão `_FILE`, invisíveis ao `docker inspect`.

---

## PARTE A — Módulo `api-keys`

### Arquitetura

Novo módulo `modules/api-keys/` seguindo o padrão de domínio existente. `ApiKeyAuthService` vira thin wrapper que delega ao novo `ApiKeysService`. Sem quebra de interface no guard.

### Modelo de dados — tabela `api_keys` (schema `public`)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | varchar | Label descritivo |
| `key_prefix` | varchar(12) | Primeiros 8 chars para identificação sem expor valor |
| `key_hash` | varchar(64) | SHA-256 do plaintext — nunca armazenar plaintext |
| `owner` | varchar | Serviço ou cliente |
| `owner_type` | enum | `internal` \| `external` |
| `scopes` | text[] | ex: `['users:read', 'llm-ops:write', 'admin:api-keys']` |
| `status` | enum | `active` \| `rotating` \| `revoked` \| `expired` |
| `expires_at` | timestamptz | null = sem expiração |
| `scheduled_rotation_at` | timestamptz | Data em que predecessor é desativado |
| `successor_key_id` | UUID FK | Próxima chave na cadeia |
| `predecessor_key_id` | UUID FK | Chave anterior |
| `last_used_at` | timestamptz | Atualizado assincronamente por request |
| `metadata` | jsonb | Dados extras livres |
| `created_at`, `updated_at` | timestamptz | |

**Formato da key:** `aki_<32-byte-hex>` (internal) / `ake_<32-byte-hex>` (external).
Plaintext retornado **uma única vez** na criação/rotação.

### Fluxo de validação por request

```
Request (x-api-key: ake_...)
  → ApiKeyAuthGuard (sem mudança de interface)
  → ApiKeyAuthService.validateApiKey(rawKey)  ← delega ao ApiKeysService
  → ApiKeysService.validate(rawKey)
      ├─ hash(rawKey) SHA-256
      ├─ Cache hit? → retorna ApiKeyRecord (TTL 60s válidas, 10s inválidas)
      └─ Cache miss → DB:
           WHERE key_hash=? AND status IN ('active','rotating')
             AND (expires_at IS NULL OR expires_at > NOW())
          ├─ Não encontrado → UnauthorizedException
          └─ Encontrado → verifica scopes requeridos pelo endpoint
              ├─ Escopos insuficientes → ForbiddenException
              └─ OK → audit.api_key.validated (async) + atualiza last_used_at
```

**Cache:** in-memory Map por processo. Adequado para containers domínio-isolados.

**Fallback de compatibilidade:** se tabela `api_keys` vazia, `ApiKeyAuthService` mantém leitura de `API_KEY` env var — sem breaking change no primeiro deploy.

**Escopo no decorator:**
```typescript
@RequireApiKey({ scopes: ['users:read'] })   // escopo obrigatório
@RequireApiKey()                              // só valida existência e status ativo
```

### Rotação agendada

```
PATCH /admin/api-keys/:id/rotate
  body: { scheduledAt: ISO8601, dryRun?: boolean }

  1. Cria successor key (status: active)
  2. Marca predecessor: status='rotating', scheduled_rotation_at=scheduledAt
  3. Retorna { successorKey: plaintext, scheduledAt, predecessorId }

  Período de coexistência: guard aceita ambas (status IN ('active','rotating'))

  Lazy eviction: na próxima tentativa de uso da key 'rotating' após scheduledAt:
    → status='expired', successor permanece active
```

Sem scheduler externo — lazy eviction resolve na validação. Sem dependência de cron.

### Admin HTTP Endpoints

Todos protegidos com `@RequireApiKey({ scopes: ['admin:api-keys'] })` + `@ApiTags('Admin - API Keys')`.

| Método | Rota | Ação |
|--------|------|------|
| `POST` | `/admin/api-keys` | Cria key — retorna plaintext uma vez |
| `GET` | `/admin/api-keys` | Lista metadados (sem valores) |
| `GET` | `/admin/api-keys/:id` | Detalhe de uma key |
| `PATCH` | `/admin/api-keys/:id/rotate` | Agenda rotação |
| `DELETE` | `/admin/api-keys/:id` | Revogação imediata |

### Camada MCP (`mcp-secrets`) — novos tools

MCP nunca executa mutações. Apenas dry-run + correlationId.

| Tool | Chamada HTTP | Resultado |
|------|-------------|-----------|
| `api_key_list` | `GET /admin/api-keys` | Metadados sem valores |
| `api_key_rotate_prepare` | `PATCH /admin/api-keys/:id/rotate?dryRun=true` | Preview + correlationId |
| `api_key_revoke_prepare` | `DELETE /admin/api-keys/:id?dryRun=true` | Preview + correlationId |

Execução real sempre via chamada HTTP direta com header `x-api-key` admin.

**Env vars adicionais no mcp-secrets:**
```
ADMIN_API_URL=http://localhost:3000
ADMIN_API_KEY=aki_<chave-interna-com-scope-admin:api-keys>
```

### Auditoria (via `AuditEventsService` existente)

| Evento | Gatilho |
|--------|---------|
| `audit.api_key.created` | Criação |
| `audit.api_key.rotated` | Rotação agendada executada |
| `audit.api_key.revoked` | Revogação imediata |
| `audit.api_key.expired` | Lazy eviction do predecessor |
| `audit.api_key.validated` | Request autenticado com sucesso |
| `audit.api_key.rejected` | Tentativa com key inválida/expirada |

---

## PARTE B — Docker Compose Secrets

### Problema

`docker inspect <container>` expõe `PG_PASSWORD`, `LLM_API_KEY`, `ASTRA_DB_APPLICATION_TOKEN` em plaintext. Qualquer usuário com acesso ao Docker daemon lê todos os segredos.

### Solução: `secrets:` stanza + padrão `_FILE`

Segredos sensíveis montados como arquivos em `/run/secrets/` — não aparecem em `docker inspect`. NestJS usa convenção `*_FILE`:

```typescript
// apps/api/src/config/env.validation.ts — nova helper
function readSecret(name: string, env: NodeJS.ProcessEnv): string | undefined {
  const filePath = env[`${name}_FILE`];
  if (filePath) return fs.readFileSync(filePath, 'utf8').trim();
  return env[name];  // fallback para dev local sem Docker secrets
}
```

### Segredos migrados para arquivos

| Arquivo | Env var atual | Domínios que recebem |
|---------|--------------|----------------------|
| `secrets/pg_password.txt` | `PG_PASSWORD` | users, sync |
| `secrets/llm_pg_password.txt` | `LLM_PG_PASSWORD` | llm-ops |
| `secrets/postgres_password.txt` | `POSTGRES_PASSWORD` | postgres service |
| `secrets/astra_db_token.txt` | `ASTRA_DB_APPLICATION_TOKEN` | llm-ops |
| `secrets/langflow_api_key.txt` | `LANGFLOW_API_KEY` | llm-ops |
| `secrets/llm_api_key.txt` | `LLM_API_KEY` | llm-ops |
| `secrets/graph_client_secret.txt` | `GRAPH_CLIENT_SECRET` | sharepoint |
| `secrets/cert.pem` | `CERT_PRIVATE_KEY_PATH` (já é arquivo) | sharepoint |

**IDs não-sensíveis** (`TENANT_ID`, `CLIENT_ID`, `CERT_THUMBPRINT`) permanecem como env vars — são identificadores, não credenciais.

### Estrutura de arquivos

```
secrets/                              ← diretório gitignored
├── pg_password.txt
├── llm_pg_password.txt
├── postgres_password.txt
├── astra_db_token.txt
├── langflow_api_key.txt
├── llm_api_key.txt
├── graph_client_secret.txt
└── cert.pem

secrets/local.secrets.example.json   ← já existe, documenta o esquema (permanece)
scripts/bootstrap/check-secrets.sh   ← novo: pré-flight check antes do compose up
```

### Padrão no docker-compose.yml (por domínio — exemplo llm-ops)

```yaml
services:
  llm-ops:
    secrets:
      - llm_pg_password
      - astra_db_token
      - langflow_api_key
      - llm_api_key
    environment:
      LLM_PG_PASSWORD_FILE: /run/secrets/llm_pg_password
      ASTRA_DB_APPLICATION_TOKEN_FILE: /run/secrets/astra_db_token
      LANGFLOW_API_KEY_FILE: /run/secrets/langflow_api_key
      LLM_API_KEY_FILE: /run/secrets/llm_api_key

secrets:
  llm_pg_password:
    file: ./secrets/llm_pg_password.txt
  astra_db_token:
    file: ./secrets/astra_db_token.txt
  langflow_api_key:
    file: ./secrets/langflow_api_key.txt
  llm_api_key:
    file: ./secrets/llm_api_key.txt
```

### Script de bootstrap

`scripts/bootstrap/check-secrets.sh` — valida que todos os arquivos existem antes do `docker compose up`. Deve ser chamado no Makefile / CI antes de subir os serviços.

---

## Arquivos a Criar

```
apps/api/src/modules/api-keys/
├── api-keys.module.ts
├── api-keys.service.ts
├── api-keys.controller.ts
├── entities/
│   └── api-key.entity.ts
└── dto/
    ├── create-api-key.dto.ts
    ├── rotate-api-key.dto.ts
    └── api-key-response.dto.ts

packages/shared/src/contracts/admin/
├── api-key-create.contract.ts
├── api-key-rotate.contract.ts
└── api-key-response.contract.ts

apps/api/src/infra/database/migrations/
└── <timestamp>-create-api-keys-table.ts

apps/svcia/mcp-secrets/src/
└── admin-api-client.ts

scripts/bootstrap/
└── check-secrets.sh
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `apps/api/src/common/guards/api-key-auth.service.ts` | Delega `validateApiKey()` ao `ApiKeysService`; mantém fallback env var se banco vazio |
| `apps/api/src/common/guards/guards.module.ts` | Importa `ApiKeysModule` |
| `apps/api/src/app.module.ts` | Adiciona `ApiKeysModule` |
| `apps/api/src/config/env.validation.ts` | Adiciona `readSecret()` helper com suporte a `_FILE` vars |
| `docker-compose.yml` | Adiciona `secrets:` stanza por serviço + seção global `secrets:` |
| `.gitignore` | Garante `secrets/*.txt` e `secrets/*.pem` ignorados |
| `apps/svcia/mcp-secrets/src/main.ts` | Registra 3 novos tools |
| `apps/svcia/mcp-secrets/src/secrets-registry.ts` | Adiciona entradas `api_key.*` ao catálogo |

---

## Verificação (pós-implementação)

### Parte A — api-keys module
1. `npm run type-check` limpo
2. `npm run migration:run` aplica migration sem erros
3. `POST /admin/api-keys` → plaintext retornado; confirmar no DB que só `key_hash` gravado
4. Usar key retornada em endpoint protegido → 200 OK
5. `PATCH /admin/api-keys/:id/rotate` com `scheduledAt` futuro → ambas as keys válidas; após `scheduledAt` → predecessor expira na próxima tentativa
6. `DELETE /admin/api-keys/:id` → key rejeitada imediatamente
7. Key com scope incorreto → 403 Forbidden
8. `npm run validate:mcp` → novos tools respondem com `dryRun: true`

### Parte B — Docker secrets
1. `bash scripts/bootstrap/check-secrets.sh` → passa com todos os arquivos presentes
2. `docker compose up llm-ops` → container sobe, app conecta ao banco
3. `docker inspect <container-id>` → `PG_PASSWORD`, `LLM_API_KEY` etc. **não aparecem** em `Env`
4. `docker exec <container> cat /run/secrets/llm_pg_password` → valor correto legível pelo app
5. Dev local sem Docker (apenas `npm run dev`) → fallback para env vars funciona normalmente
