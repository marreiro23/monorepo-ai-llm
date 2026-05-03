# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **npm workspaces monorepo** integrating Microsoft 365, SharePoint, and LLM Operations using NestJS, TypeScript, and PostgreSQL. The project follows domain-driven design with **isolated domain containers** managed by a Container Manager, plus a suite of **MCP servers** for AI assistant integration.

**Key Stack:**
- **Backend**: NestJS 11+ with TypeScript 7+ (`tsgo` native compiler via `@typescript/native-preview`)
- **Frontend**: React 19+ with Vite (`apps/web`)
- **Database**: PostgreSQL 14+ with TypeORM (schema-isolated per domain)
- **Vector/RAG**: AstraDB (collections: `knowledge_base`, `interactions`) + LangFlow
- **MCP Servers**: 5 domain servers in `apps/svcia/` + 1 diagnostic server in `tools/` using `@modelcontextprotocol/sdk` (stdio transport)
- **Infrastructure**: Docker multi-stage containers per domain, npm workspaces
- **Authentication**: API Key (`X-API-Key` header) + Microsoft Graph API (OAuth/certificate)
- **API Documentation**: Swagger/OpenAPI at `/api/docs`

**Workspaces:**
- `apps/api` – NestJS backend (shared modules + domain bootstrapping)
- `apps/web` – React 19 frontend with Vite
- `apps/svcia/mcp-*` – 5 MCP servers (stdio transport, read-only by design)
- `apps/mcp-awesome-copilot` – MCP skills discovery server
- `packages/shared` – Contracts, types, DTOs shared across all apps
- `tools/mcp-project-health` – Diagnostic/auto-fix MCP server (build, Dockerfile, compose, migrations, docs, smoke, DB)

## Container Architecture

The system runs as **4 isolated domain containers** orchestrated by a Container Manager:

| Container | Port | Domain | PostgreSQL Schema |
|-----------|------|--------|------------------|
| Container Manager | 3000 | Orchestration & routing | – |
| Users Domain | 3001 | User management & auth | `public` |
| LLM-Ops Domain | 3002 | Agents, prompts, topic flows, RAG | `llm_ops` |
| SharePoint Domain | 3003 | Microsoft Graph integration | – (stateless) |
| Sync Domain | 3004 | M365 sync & audit | `public` |

- Containers start **on-demand** and shut down after **10 minutes of inactivity** (`MANAGER_TIMEOUT`)
- All domains share one PostgreSQL instance but with **schema isolation**
- Health checks: 10s interval, 5s timeout, 15s start period, 5 retries

## MCP Servers (`apps/svcia/`)

The project ships **5 MCP servers** built with `@modelcontextprotocol/sdk`, all using **stdio transport**. They are strictly **read-only by design** — no mutations are allowed via MCP (except dry-run approval flows).

### Architecture Layers

```
User / AI Assistant
        │
        ▼
  Governance Layer (mcp-governance — future)
        │
        ▼
  Domain MCP Servers ──────────────────────────────────┐
  ├── mcp-users        → users-api (port 3001)         │
  ├── mcp-llm-ops      → llm-ops-api (port 3002)       │
  ├── mcp-sync         → sync-api (port 3004)          │
  ├── mcp-secrets      → Local/Cloud Vault (in-process)│
  └── mcp-awesome-copilot → filesystem                 │
        │                                              │
        ▼                                              ▼
  Internal APIs               External APIs
  (NestJS containers)         (Microsoft Graph, AstraDB, Langflow)
```

**Implementation Order (roadmap):** mcp-secrets → mcp-users → mcp-llm-ops → mcp-sync → mcp-graph (future) → mcp-rag (future) → mutant tools (future)

### Server Capabilities

| Server | API URL Env Var | Default Port | Tools |
|--------|----------------|-------------|-------|
| `mcp-users` | `USERS_API_URL` | 3001 | `users_list`, `users_get`, `users_search` |
| `mcp-llm-ops` | `LLM_OPS_API_URL` | 3002 | `agents_list`, `prompts_list`, `topic_flows_list`, `resources_catalog`, `ask_and_answer` |
| `mcp-sync` | `SYNC_API_URL` | 3004 | `sync_jobs_list`, `sync_status`, `sync_sites_list`, `sync_users_list` |
| `mcp-secrets` | (in-process) | – | `secrets_list`, `secrets_register_prepare`, `secrets_rotate_prepare`, `secrets_revoke_prepare` |
| `mcp-awesome-copilot` | `AWESOME_COPILOT_PLUGINS_ROOT` | – | `awesome_copilot_list_skills`, `awesome_copilot_recommend_for_project` |

### MCP Security Model

- **All tools are read-only** — no PUT/PATCH/DELETE called on any domain API
- `mcp-secrets`: values always returned as `[redacted]`; all mutation tools return `dryRun: true`, `mutationAllowed: false`, `approvalRequired: true`
- `mcp-llm-ops` `ask_and_answer`: only safe POST (RAG query, not a state mutation)
- No secrets in logs; all secret operations generate correlation IDs for audit trails
- Smoke tests in `scripts/smoke-tests/mcp-*-read-smoke.mjs` enforce read-only contract

### LangFlow + AstraDB Integration

The RAG pipeline uses AstraDB as primary vector storage with LangFlow in **context-only mode**:

```
mcp-llm-ops → llm-ops-api → AstraDB (knowledge_base/interactions) → LangFlow (input_value only)
```

- LangFlow flow definition: `apps/svcia/mcp-llm-ops/src/rag-langflow/Rag Loading.json`
- Flow ID: `f81c0124-ffc2-4458-b30d-4d588d393518`
- **Avoid**: native LangFlow Vector Store RAG (creates double indexing); Hybrid Search with Vectorize without review
- Key env vars: `ASTRA_DB_ENABLED`, `LANGFLOW_ENABLED`, `LANGFLOW_RAG_FLOW_ID`

### MCP Configuration

Copy `config/mcp/shp-local-mcp.example.json` to your MCP client config (e.g., VS Code settings):

```json
{
  "mcpServers": {
    "api-llm-embedded-llm-ops":        { "command": "npm", "args": ["run", "mcp:llm-ops:start"],  "env": { "LLM_OPS_API_URL": "http://localhost:3002" } },
    "api-llm-embedded-users":          { "command": "npm", "args": ["run", "mcp:users:start"],    "env": { "USERS_API_URL": "http://localhost:3001" } },
    "api-llm-embedded-sync":           { "command": "npm", "args": ["run", "mcp:sync:start"],     "env": { "SYNC_API_URL": "http://localhost:3004" } },
    "api-llm-embedded-secrets":        { "command": "npm", "args": ["run", "mcp:secrets:start"] },
    "api-llm-embedded-project-health": { "command": "node", "args": ["tools/mcp-project-health/dist/main.js"], "env": { "REPO_ROOT": "${workspaceFolder}" } }
  }
}
```

Each domain MCP server follows identical structure:
```
src/
├── main.ts                   # StdioServerTransport + tool registration
└── {domain}-api-client.ts    # API client class
```

Scripts: `build` (tsgo), `start` (compiled dist), `start:dev` (ts-node/esm).

## Diagnostic MCP Server (`tools/mcp-project-health`)

Auto-detects and corrects project health issues. Lives in `tools/mcp-project-health/` — separate from domain MCPs.

**Build:** `npm run -w tools/mcp-project-health build`

**Requires `REPO_ROOT` env var** (defaults to `process.cwd()`).

| Tool | O que faz | Auto-fix? |
|------|-----------|-----------|
| `health_check_all` | Roda todos os checks e grava `.copilot-tracking/runtime/health-<ts>.md` | ✅ via sub-tools |
| `build_check` | Compila todos os workspaces com `tsgo` | ❌ (erros requerem análise) |
| `dockerfile_fix` | Corrige path corrompido + tsc→tsgo + avisa `:latest` | ✅ (2 auto-fixes) |
| `docker_compose_check` | Valida 7 serviços e profiles do compose | ❌ |
| `migration_paths_fix` | Corrige `runtimeMigrationGlobs` com paths relativos ao CWD | ✅ |
| `docs_check` | Cria/patcha arquivos de doc obrigatórios | ✅ |
| `smoke_run` | Executa smoke tests por categoria: `static`, `mcp`, `typeorm`, `all` | ❌ |
| `database_check` | Testa conectividade PG + aplica migrations pendentes | ✅ |

**Execução em fases:** `build_check` primeiro → demais em paralelo → `database_check` por último (depende do dist).

**Audit trail:** cada correção é gravada com diff (before/after) no relatório markdown gerado em `.copilot-tracking/runtime/`.

**Estrutura:**
```
tools/mcp-project-health/src/
├── main.ts                          # McpServer + 8 tools registrados
├── types.ts                         # CheckResult, Finding, Correction, CheckStatus
├── checks/
│   ├── build.check.ts
│   ├── dockerfile.check.ts
│   ├── docker-compose.check.ts
│   ├── migration-paths.check.ts
│   ├── docs.check.ts
│   ├── smoke.check.ts
│   └── database.check.ts
└── runner/
    ├── check-runner.ts              # Orquestração em fases
    └── audit-writer.ts              # Grava health-<timestamp>.md
```

## Essential Commands

### Development
```bash
npm install                          # Install all workspace dependencies
npm run migration:run                # Run TypeORM migrations (before first start)
npm run dev                          # Start API in watch mode (hot-reload, port 3000)
npm run dev:api                      # API only
npm run dev:web                      # Frontend only (Vite, port 4173)
npm run dev:proxy                    # Start Dev Proxy for offline/mock mode
npm run dev:offline                  # Run with mocked Microsoft API responses
```

### Building & Validation
```bash
npm run -w apps/api build            # Build API workspace (required CI gate)
npm run build                        # Build all workspaces
npm run type-check                   # TypeScript check without emit
npm run lint                         # Lint codebase
```

### Validation Profiles
```bash
npm run validate:static              # Build + TypeScript + compose config checks
npm run validate:component           # Domain smokes with local dependencies
npm run validate:mocks               # External integrations with stubs
npm run validate:real                # Containers + AstraDB + Graph with real data
npm run validate:mcp                 # Build and test MCP servers
npm run validate:all                 # Full sequence (static → component → mocks → real → mcp)
```

Evidence is stored in `.copilot-tracking/runtime/test-logs/`.

### Testing
```bash
npm run test:smoke                   # Fast smoke tests (requires PostgreSQL configured)
npm run test:integration             # Integration test suite
npm run test:e2e                     # E2E tests
npm test                             # All tests
```

### Database Migrations
```bash
npm run migration:run                # Apply pending migrations
npm run migration:revert             # Revert last migration
npm run db:check                     # Verify DB connection
npm run db:reset                     # Reset database (destructive)
```

### Mock & Schema Pipeline
```bash
npm run mock:from-real-api           # Record + sanitize real API responses to mocks
npm run schema:from-mocks            # Generate schema from mocks
npm run test:integration:mocks       # Run integration tests against mocks
npm run test:divergence:gate         # CI divergence gate check
npm run validate:allowlist           # Validate divergence allowlist schema
npm run validate:mcp                 # Build and smoke test all MCP servers
```

## Architecture & Module Structure

### Folder Structure
```
apps/api/src/
├── main.ts                      # Bootstrap with Swagger + ValidationPipe config
├── app.module.ts                # Root AppModule importing all domain modules
├── config/                      # Environment validation (Zod-based buildAppEnv)
├── common/                      # Decorators, guards, filters, interceptors, types
│   ├── decorators/              # @CurrentUser(), @RequirePermissions(), @RequireApiKey()
│   ├── guards/                  # PermissionValidationGuard (global APP_GUARD)
│   ├── filters/                 # HttpExceptionFilter
│   └── interceptors/            # LoggingInterceptor
├── infra/database/
│   ├── database.module.ts       # DatabaseModule.forRoot()
│   ├── typeorm.config.ts        # TypeORM config with multi-schema support
│   ├── migrations/              # TypeORM migration files (timestamped)
│   └── astradb/                 # AstraDB client for vector/RAG operations
├── domains/                     # Domain bootstrap entry points (one per container)
│   ├── users/main.ts
│   ├── llm-ops/main.ts
│   ├── sharepoint/main.ts
│   └── sync/main.ts
└── modules/                     # Business domain modules
    ├── admin/                   # Admin operations
    ├── audit/                   # Audit logs & compliance
    ├── governance/              # Permissions & access control
    ├── graph/                   # Microsoft Graph API operations
    ├── health/                  # Health checks
    ├── llm-ops/                 # Agents, prompts, topic flows, chat/RAG
    ├── m365-migration/          # Tenant-to-tenant mailbox migrations
    ├── sharepoint/              # SharePoint drives, items, permissions
    ├── sync/                    # M365 sync (users, groups, sites, drives)
    └── users/                   # User management

apps/svcia/                      # MCP servers (Model Context Protocol)
├── mcp-users/                   # Users read-only server → port 3001
├── mcp-llm-ops/                 # LLM Ops + RAG chat server → port 3002
├── mcp-sync/                    # Sync monitoring server → port 3004
├── mcp-secrets/                 # Secret management (dry-run/approval only)
└── mcp-awesome-copilot/         # Skills discovery server (filesystem)

packages/shared/src/contracts/   # Source of truth for all API contracts
├── common/                      # Pagination, ApiResponse, ErrorResponse
├── users/                       # User request/response contracts
└── llm-ops/                     # Agent, PromptTemplate, PromptVersion, TopicFlow, Chat

support/                         # Reference copies of docs and plans
├── docs/                        # Mirror of project docs (for offline reference)
└── plan/                        # Mirror of project plans
```

### Key Architectural Patterns

**Domain Container Isolation:** Each domain has its own `domains/{domain}/main.ts` bootstrap. Each is independently deployable as a container with its own port.

**Global Permission Guard:** `PermissionValidationGuard` is registered as `APP_GUARD`, intercepting every request. Decorate controllers with `@RequirePermissions(['permission-name'])` or `@RequireApiKey()`.

**Shared Contracts Package:** All request/response shapes MUST be defined in `packages/shared/src/contracts/`. Never define locally in `apps/api` types that are shared with other apps or MCP clients.

**Environment Validation:** `buildAppEnv()` in `config/env.validation.ts` validates all env vars with Zod on startup. App will not start if required variables are missing.

**Audit Logging:** All state-changing operations emit events captured by `AuditModule`. Required for compliance.

**Dev Proxy Mocks:** Offline development against Microsoft APIs uses `.devproxy/mocks/` with pre-recorded sanitized responses. CI enforces a divergence gate against live API snapshots.

## LLM-Ops Domain: Entities & Relationships

**PostgreSQL Schema:** `llm_ops`

```
LlmOpsAgentEntity
  ├── 1:N → PromptTemplateEntity
  │         ├── 1:N → PromptVersionEntity
  │         │         ├── Status: DRAFT | APPROVED | DEPRECATED
  │         │         ├── 1:N → PromptUsageHistoryEntity  (execution tracking)
  │         │         └── 1:N → PromptValidationEntity    (validation results)
  │         └── N:N ←→ PromptDependencyEntity             (template dependencies)
  └── 1:N → TopicFlowEntity
            └── 1:N → TopicFlowVersionEntity
                      └── 1:N → InteractionLearningEventEntity  (analytics/learning)
```

**LLM-Ops API Endpoint Matrix:**

Wave A (foundational):
- `GET|POST /llm-ops/agents`
- `GET|POST /llm-ops/prompt-templates`
- `GET|POST|PATCH /llm-ops/prompt-versions` (PATCH updates status)

Wave B (advanced):
- `GET|POST /llm-ops/prompt-validations`
- `GET|POST /llm-ops/topic-flows`
- `GET|POST|PATCH /llm-ops/topic-flow-versions`
- `GET|POST /llm-ops/prompt-usage-history`
- `POST /llm-ops/chat` – Ask-and-Answer RAG endpoint

**Serialization Rules:**
- Datetime fields: ISO 8601 strings
- Nullable DB fields: `null` in contract (never `undefined`)
- Enum fields: string literals from `@api-llm-embedded/shared`; TypeORM enum conversion on write path

## Naming Conventions

### Files & Folders
- **kebab-case** for all file and folder names
- Required suffixes by responsibility:

| Suffix | Use Case |
|--------|----------|
| `.module.ts` | NestJS module class |
| `.controller.ts` | HTTP route handler |
| `.service.ts` | Business logic |
| `.entity.ts` | TypeORM database entity |
| `.dto.ts` | Data Transfer Object |
| `.decorator.ts` | Custom decorator |
| `.guard.ts` | NestJS guard |
| `.interceptor.ts` | NestJS interceptor |
| `.filter.ts` | Exception filter |
| `.type.ts` | TypeScript type/interface |
| `.contract.ts` | Shared API contract (in `packages/shared`) |
| `-api-client.ts` | MCP server API client (in `apps/svcia/mcp-*/src/`) |

**Before introducing new patterns:** document in `docs/architecture/naming-conventions.md` with justification and examples.

### Classes & Functions
- **PascalCase** for classes: `UsersController`, `LlmOpsAgentEntity`, `UsersApiClient`
- **camelCase** for service methods with Verb + Object: `createUser`, `listAgents`, `updatePromptVersionStatus`
- **UPPER_SNAKE_CASE** for enum values
- Controllers orchestrate input/output only — no complex business logic in controllers

### Routes
- Plural, lowercase prefixes: `@Controller('users')`, `@Controller('llm-ops/agents')`
- HTTP handler names: `findAll`, `findOne`, `create`, `update`, `remove`

### Database
- Table names: `snake_case`, plural (e.g., `users`, `llm_ops_agents`, `prompt_versions`)
- Column names: `snake_case` (e.g., `created_at`, `tenant_id`)
- Schema separation: `public` for users/sync; `llm_ops` for LLM entities

## Governance & Security Rules

### API Key Authentication
- Header: `x-api-key` (preferred), query param, or cookie
- Decorator: `@RequireApiKey()` on protected endpoints
- Key generation: `openssl rand -hex 32` (32+ chars minimum)
- Rotation: monthly (production), quarterly (development)
- Used for: mock/admin/internal endpoints — NOT for Microsoft Graph (use OAuth/certificate)

### Permission Exception Approval
When a new endpoint needs broader permissions than minimal:
1. Document alternatives considered and rejected
2. Create GitHub issue with labels: `governance`, `security-review`, `permission-exception`
3. Requires 2 reviewer approvals (API Architect + security expert) + Mentor Agent approval
4. Max 30-day validity; must explicitly renew

### Dev Proxy Mock Rules
Mock files: `.devproxy/mocks/{domain}/<method>-<route-normalized>-<scenario>.json`

Minimum resilience coverage per domain: 2xx, 4xx (404, 429), 5xx, 503 (with retry-after), 504 (with retry-after).

Divergence exceptions require: `endpointKey`, `owner`, `reason`, `expiresAt`, `renewalApproved`, `renewalReference`. Expired entries auto-fail CI gate.

### Retry + Jitter Pattern
All HTTP clients (Graph, SharePoint, LLM): exponential backoff + jitter, respect `Retry-After` header (seconds and HTTP-date formats).

### OpenAPI Compliance (CI Gate)
All endpoints MUST have:
- `@ApiTags()` on controller, `@ApiOperation()` on each handler
- `@ApiProperty()` with examples on all DTO properties
- `@ApiResponse()` for all response shapes
- `@ApiExtension('x-required-permissions', {...})` for permission specs

Missing docs = CI gate failure on new PRs.

## Development Workflow

### Adding a New Endpoint

1. Define the contract in `packages/shared/src/contracts/{domain}/` first
2. Create/update the DTO in `modules/{domain}/dto/`
3. Add service method in `{domain}.service.ts` (business logic only)
4. Add controller handler in `{domain}.controller.ts` with: `@RequirePermissions()` or `@RequireApiKey()`, `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`
5. Add a mock in `.devproxy/mocks/{domain}/`
6. Run `npm run type-check` — must be clean
7. Run `npm run test:smoke`

### Adding a New Domain Module

Follow the template in `docs/EXPANSION_GUIDE.md`:
1. Create `modules/{domain}/` with standard files
2. Create `domains/{domain}/main.ts` for container bootstrap
3. Add Docker service configuration (multi-stage: deps → builder → runtime-base → domain-target)
4. Register in Container Manager
5. (Optional) Create matching `apps/svcia/mcp-{domain}/` MCP server
6. Document in `docs/architecture/folder-structure.md`

### Docker Build Pattern

Recommended multi-stage Dockerfile structure (high value for API and MCP servers):
```dockerfile
FROM node:22-alpine AS deps          # Install production deps
FROM deps AS builder                 # Run npm build
FROM node:22-alpine AS runtime-base  # Minimal runtime
FROM runtime-base AS {domain}        # Target-specific stage
```

For LangFlow: use official `langflowai/langflow` base image; avoid custom Python rebuilds.

### Phase Gates

Before starting a phase:
- [ ] Dependencies satisfied, branch created, Git checkpoint registered
- [ ] Plan reviewed in `plan/SEQUENCIA-EXECUCAO-PLANOS.md`

After completing a phase:
- [ ] Clean build: `npm run -w apps/api build`
- [ ] Smoke tests passing (`npm run validate:component`)
- [ ] Rollback documented
- [ ] `plan/SEQUENCIA-EXECUCAO-PLANOS.md` updated with completion evidence in `.copilot-tracking/`

## Testing

| Test Type | Command | Requires |
|-----------|---------|----------|
| Smoke tests | `npm run test:smoke` | PostgreSQL configured |
| Integration | `npm run test:integration` | PostgreSQL + credentials |
| E2E | `npm run test:e2e` | Full stack running |
| MCP read-only | `scripts/smoke-tests/mcp-*-read-smoke.mjs` | Domain container running |
| Mock divergence | `npm run test:divergence:gate` | Mocks + live snapshots |
| Full validation | `npm run validate:all` | All dependencies |

MCP smoke tests verify: read-only contract, response schema, execution mode (`"read-only-recommendation"`), resource context shape.

## Environment Configuration

Copy `.env.example` to `.env` for local development.

**Server**
```
PORT=3000
NODE_ENV=development
```

**Microsoft Entra ID (required for Graph/SharePoint)**
```
TENANT_ID=your-tenant-id
CLIENT_ID=your-client-id
CERT_THUMBPRINT=your-cert-thumbprint
CERT_PRIVATE_KEY_PATH=./cert/your-cert.pem
PRIMARY_DOMAIN=your-domain.onmicrosoft.com
```

**PostgreSQL (Users/Sync — schema: `public`)**
```
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=api_llm_embedded_db
PG_USER=postgres
PG_PASSWORD=your-password
PG_SCHEMA=public
```

**PostgreSQL (LLM-Ops — schema: `llm_ops`, can reuse same DB)**
```
LLM_PG_DATABASE=api_llm_embedded_db
LLM_PG_SCHEMA=llm_ops
LLM_PG_HOST=localhost
LLM_PG_USER=postgres
LLM_PG_PASSWORD=your-password
```

**AstraDB + LangFlow (RAG pipeline)**
```
ASTRA_DB_ENABLED=true
LANGFLOW_ENABLED=true
LANGFLOW_RAG_FLOW_ID=f81c0124-ffc2-4458-b30d-4d588d393518
```

**API Keys**
```
LLM_API_KEY=your-openai-api-key
API_KEY_SECRET=your-internal-api-key-for-x-api-key-header
```

For Docker: use `.env.containers`. Container scripts (`npm run docker:*`) load this file automatically.

## Execution Roadmap

### MCP Roadmap Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ | Base operational: discovery server, read-only MCPs |
| 1 | ✅ | Safe read-only servers: users, llm-ops, sync |
| 2 | 🟡 | Orchestration with Container Manager (lazy container activation) |
| 3 | ⬜ | Controlled mutant tools with snapshot/rollback |
| 4 | ⬜ | Embedded assistant with MCP as tool layer |

### Feature Waves

**Wave 1 — Foundation & Governance (ONDA 1)**
- ✅ Dev Proxy + Offline Workflow
- ✅ Mocks + Schema Bridge (divergence < 5%)
- ✅ Permission Governance (matrix complete, CI gate active)
- ✅ API Key Authentication, Audit System, SharePoint Extended
- 🟡 LLM-Ops Observability (cost tracking by agent/prompt/workflow pending)
- 🟡 OpenAPI + CI Compliance (70% — 30% of controllers need docs, TASK-016)

**Wave 2 — SharePoint + RAG (ONDA 2)**
- ✅ SharePoint Extended (all phases)
- 🟡 RAG LLM-Ops Ask & Answer v2 (Phases 4-5 pending)

**Wave 3 — Advanced Integration (ONDA 3, planned)**
- ⬜ LangFlow + AstraDB full integration
- ⬜ 3 new agents: governance-audit, docs-architect, telemetry-analyst
- ⬜ MCP expansion: SharePoint MCP + governance MCP

### Immediate Priorities (P0 → P1)

**P0 (Unblock real AI testing):**
1. Configure PostgreSQL (unblocks 11 smoke tests)
2. Complete OpenAPI Phase 5 (30% controllers missing docs)
3. Recreate LangFlow container with local image
4. Execute smoke test: MCP → llm-ops-api → AstraDB → LangFlow

**P1 (Governance hardening):**
5. Implement durable history for admin intentions in mcp-secrets
6. Replace textual `[intention-key]` with structured metadata + audit backend

## Key Constraints for Claude Code

**Never:**
- Create files without kebab-case + correct suffix conventions
- Define API contracts locally in `apps/api` — always use `packages/shared`
- Add write operations to MCP servers — all MCP tools must be read-only (mutations require out-of-band approval flows)
- Use destructive git operations (`reset --hard`, `push --force`) without explicit authorization
- Commit credentials, tokens, or PII
- Skip `lint` + `type-check` before committing
- Add new Graph/SharePoint endpoints without documenting minimal permissions
- Merge without CI gate clearance evidence in `.copilot-tracking/`

**Always:**
- Run `npm run type-check` before any commit
- Add OpenAPI decorators to all new controller endpoints
- Follow schema isolation: `public` for users/sync, `llm_ops` for LLM entities
- Use `packages/shared` contracts as the source of truth for all API shapes
- Test new endpoints against mocks before live API calls
- Update phase completion evidence in `.copilot-tracking/`
- Register new naming patterns in `docs/architecture/naming-conventions.md`
- For new domain MCP tools: include smoke test in `scripts/smoke-tests/mcp-{domain}-read-smoke.mjs`
- To diagnose/fix project issues: use `tools/mcp-project-health` tools — `health_check_all` first, then specific tools
- Never commit `.env.containers` — it is gitignored; use `.env.containers.example` as template

## Key Files in This Repository

| File | Purpose |
|------|---------|
| `package.json` | Workspace root — defines npm workspaces and root dependencies |
| `tsconfig.base.json` | Base TypeScript config extended by all workspaces |
| `apps/api/src/main.ts` | Bootstrap: Swagger config, ValidationPipe, port setup |
| `apps/api/src/app.module.ts` | Root module — all domain module imports |
| `apps/api/src/infra/database/typeorm.config.ts` | TypeORM multi-schema connection config |
| `apps/svcia/mcp-*/src/main.ts` | Each domain MCP server entry point |
| `tools/mcp-project-health/src/main.ts` | Diagnostic MCP server (8 health/fix tools) |
| `tools/mcp-project-health/src/runner/check-runner.ts` | Orchestrates health checks in phases |
| `config/mcp/shp-local-mcp.example.json` | MCP client configuration template (all 6 servers) |
| `config/mcp/langflow-streamable.example.json` | LangFlow streamable MCP config template |
| `client.rest` | HTTP REST client for manual endpoint testing |
| `.env.example` | Environment configuration template (local dev) |
| `.env.containers.example` | Container environment template — copy to `.env.containers` (gitignored) |
| `cagent.example.yaml` | Agent configuration example |
| `scripts/smoke-tests/mcp-*-read-smoke.mjs` | MCP server read-only smoke tests |
| `scripts/smoke-tests/mcp-project-health-smoke.mjs` | Diagnostic MCP integration smoke test |
| `scripts/smoke-tests/*.mjs` | Domain-specific smoke tests |
