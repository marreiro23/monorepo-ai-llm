# Design: tools/mcp-project-health

**Date:** 2026-04-29  
**Status:** Approved  
**Location:** `tools/mcp-project-health/`

## Overview

MCP server de diagnóstico e correção automática do projeto. Detecta problemas de build,
infraestrutura, migrations e documentação; aplica correções seguras automaticamente; gera
audit trail em `.copilot-tracking/` com exit code para uso em pipelines CI.

## Requisitos

- Totalmente corretivo: aplica correções sem confirmação quando a operação é segura e reversível
- Escopo completo: builds TypeScript, Dockerfile, docker-compose, migration paths, docs obrigatórios, smoke tests, PostgreSQL
- Integração CI: relatório em `.copilot-tracking/runtime/health-<timestamp>.md`, exit code `0` (ok/fixed) ou `1` (error)
- Audit trail: toda correção aplicada é registrada com diff (before/after)
- Localização: `tools/mcp-project-health/` — separado dos MCPs de domínio em `apps/svcia/`

## Arquitetura

```
tools/mcp-project-health/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts                     # McpServer + registro das 8 tools
│   ├── types.ts                    # CheckResult, Finding, Correction, CheckStatus
│   ├── checks/
│   │   ├── build.check.ts          # tsgo build em todos os workspaces
│   │   ├── dockerfile.check.ts     # Detecta/corrige bugs no Dockerfile
│   │   ├── docker-compose.check.ts # Valida config do compose
│   │   ├── migration-paths.check.ts# Verifica/corrige caminhos de migration
│   │   ├── docs.check.ts           # Verifica arquivos de doc obrigatórios
│   │   ├── smoke.check.ts          # Executa smoke tests por categoria
│   │   └── database.check.ts       # PostgreSQL + migrations pendentes
│   └── runner/
│       ├── check-runner.ts         # Orquestra checks (paralelo/série)
│       └── audit-writer.ts         # Grava relatório em .copilot-tracking/
```

## Tools MCP

| Tool | Input | O que faz |
|------|-------|-----------|
| `health_check_all` | `categories?: string[]` | Roda todos os checks, gera relatório CI |
| `build_check` | — | Compila todos os workspaces com tsgo |
| `dockerfile_fix` | `path?: string` | Detecta e corrige bugs no Dockerfile |
| `docker_compose_check` | — | Valida config do compose (serviços, profiles) |
| `migration_paths_fix` | — | Corrige caminhos de migration para absolutos |
| `docs_check` | — | Verifica e cria docs obrigatórios ausentes |
| `smoke_run` | `categories?: ('static'\|'mcp'\|'typeorm'\|'all')[]`, `timeout?: number` | Executa smoke tests filtráveis |
| `database_check` | — | Testa conectividade PG e aplica migrations pendentes |

## Tipos de Dados

```typescript
type CheckStatus = 'ok' | 'fixed' | 'warning' | 'error' | 'skipped';

interface CheckResult {
  tool: string;
  status: CheckStatus;
  durationMs: number;
  findings: Finding[];
  corrections: Correction[];
  reportPath?: string;   // apenas em health_check_all
}

interface Finding {
  severity: 'info' | 'warning' | 'error';
  file?: string;
  line?: number;
  message: string;
}

interface Correction {
  file: string;
  description: string;
  before: string;
  after: string;
}
```

## Lógica por Check

### build.check.ts
- Descobre workspaces via `package.json#workspaces`
- Executa `tsgo -p tsconfig.json` em cada workspace com `child_process.spawn`
- Timeout: 60s por workspace
- Sem correções automáticas (erros de build requerem análise humana)
- Retorna `ok` ou `error` com stdout/stderr por workspace

### dockerfile.check.ts
- Lê `apps/api/Dockerfile`
- Regra 1 (auto-fix): path corrompido em `node -e` — regex `api\.package\.\s+@json` → `api.package.json`
- Regra 2 (auto-fix): compilador `./node_modules/.bin/tsc` no builder stage → `./node_modules/.bin/tsgo`
- Regra 3 (warning only): imagem Docker sem tag fixa (`node:latest`, `alpine` sem versão)
- Grava arquivo corrigido apenas se houver mudanças

### docker-compose.check.ts
- Executa `docker compose --env-file .env.containers config --quiet`
- Valida presença de 7 serviços esperados: `postgres`, `container-manager`, `users-api`, `llm-ops-api`, `sharepoint-api`, `sync-api`, `langflow`
- Valida profiles: `persistent`, `always`, `demand`
- `LLM_API_KEY` ausente → warning (não erro)
- Read-only, sem correções automáticas

### migration-paths.check.ts
- Lê `apps/api/src/infra/database/typeorm.config.ts`
- Detecta se `runtimeMigrationGlobs` usa paths literais relativos ao CWD (strings como `'dist/infra/...'` sem `resolve(`)
- Auto-fix: substitui a implementação da função pelo padrão correto com `dirname(currentModulePath)` + `resolve`
- Rebuilda o workspace após correção

### docs.check.ts
Manifesto de docs obrigatórios:
```typescript
const REQUIRED_DOCS = [
  {
    path: 'docs/architecture/llm-ops-contract-matrix-final.md',
    mustContain: [
      'Wave A + Wave B',
      'GET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status'
    ]
  }
];
```
- Arquivo ausente → cria com conteúdo mínimo válido
- Arquivo presente sem conteúdo esperado → aplica patch com os strings obrigatórios

### smoke.check.ts
Mapeamento de categorias para arquivos:
```typescript
const SMOKE_CATEGORIES = {
  static: ['governance-smoke', 'retry-jitter-smoke', 'llm-ops-contracts-ab-smoke', 'graph-config-smoke'],
  mcp:    ['mcp-users-read-smoke', 'mcp-secrets-read-smoke', 'mcp-llm-ops-read-smoke', 'mcp-sync-read-smoke'],
  typeorm:['users-typeorm-smoke', 'llm-ops-typeorm-smoke', 'sync-typeorm-smoke']
};
```
- Executa cada smoke test com `node scripts/smoke-tests/<name>.mjs`
- Timeout configurável (default: 30s por test)
- Sem correções automáticas — reporta falhas para análise
- Categoria `all` = `static` + `mcp` + `typeorm`

### database.check.ts
1. Testa conectividade via `pg.Client` com env vars `PG_*`
2. Importa `AppDataSource` e `LlmOpsDataSource` do dist compilado (`apps/api/dist/...`)
3. `showMigrations() === true` → executa `runMigrations({ transaction: 'each' })` automaticamente
4. Retorna: conectividade, schemas encontrados, migrations aplicadas, tabelas por schema
- Depende de build concluído para importar o dist

### check-runner.ts
- `health_check_all`: executa `build_check` primeiro; demais em paralelo; `database_check` após build
- Cada check individual: executa isolado com timeout próprio
- Captura exceções não tratadas por check e converte em `CheckResult` com `status: 'error'`

### audit-writer.ts
Grava `.copilot-tracking/runtime/health-<timestamp>.md` com:
- Header: data, status geral, duração total
- Tabela resumo de cada check (status + duração)
- Seção "Correções Aplicadas" com diff (before/after) de cada `Correction`
- Rodapé: exit code sugerido e próximos passos

## Resolução de Caminhos

Todos os checks resolvem caminhos relativos a `REPO_ROOT`:
```typescript
const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd();
```
Cada check recebe `REPO_ROOT` e usa `path.resolve(REPO_ROOT, 'apps/api/Dockerfile')` etc.
Isso garante funcionamento correto independente do CWD do processo.

## Workspace Registration

Adicionar `"tools/*"` ao array `workspaces` no `package.json` raiz:
```json
"workspaces": ["apps/api", "apps/web", "apps/svcia/*", "packages/*", "tools/*"]
```
Isso permite `npm install` e `npm run -w tools/mcp-project-health build` a partir da raiz.

## Configuração MCP

Entrada a adicionar em `config/mcp/shp-local-mcp.example.json`:
```json
"api-llm-embedded-project-health": {
  "command": "node",
  "args": ["tools/mcp-project-health/dist/main.js"],
  "env": {
    "REPO_ROOT": "${workspaceFolder}"
  }
}
```

## Timeouts por Check

| Check | Timeout |
|-------|---------|
| build_check | 120s (total workspaces) |
| dockerfile_fix | 5s |
| docker_compose_check | 10s |
| migration_paths_fix | 30s (inclui rebuild) |
| docs_check | 5s |
| smoke_run (por test) | 30s |
| database_check | 15s |

## Dependências

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "pg": "^8.20.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@typescript/native-preview": "^7.0.0-dev.20260428.1",
    "typescript": "^6.0.3"
  }
}
```

Sem dependência de `@api-llm-embedded/shared` — este servidor é independente de domínio.

## Convenções do Projeto

- Arquivo de entrada: `src/main.ts` (padrão dos MCPs existentes)
- Build: `tsgo -p tsconfig.json`
- Módulo: `"type": "module"` com imports `.js`
- Nomes de arquivo: kebab-case + sufixo por responsabilidade (`.check.ts`, `.runner.ts`)
- Sem comentários além do necessário para regras não óbvias

## Smoke Test

Criar `scripts/smoke-tests/mcp-project-health-smoke.mjs` que:
1. Invoca `build_check` via cliente MCP (mock de fetch)
2. Verifica que o resultado tem `status` válido e `findings` array
3. Confirma que o server retorna `structuredContent` com `CheckResult`
