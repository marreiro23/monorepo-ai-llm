# Plano de Migração: api-llm-embedded → monorepo-ai-llm

**Data de criação:** 2026-05-02  
**Status:** Rascunho  
**Origem:** `/mnt/repositorio/workdir/repostorios/api-llm-embedded`  
**Destino:** `/mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm`

---

## 1. Contexto e Objetivos

### Projetos Envolvidos

| Aspecto | api-llm-embedded (origem) | monorepo-ai-llm (destino) |
|---|---|---|
| **Build system** | npm workspaces + `tsgo` | NestJS CLI monorepo + webpack |
| **TypeScript** | 6.0.3 (tsgo nativo) | 5.7.3 (ts-node) |
| **Apps** | `apps/api` (monolito multi-domínio) | 5 NestJS apps independentes |
| **Shared** | `packages/shared` (contratos) | Sem shared packages |
| **MCP** | 5 servidores em `apps/svcia/` + `tools/` | MCP experimental em `tools/mcp/` |
| **Frontend** | React 19 + Vite em `apps/web` | Não existe |
| **DB** | TypeORM, migrations, PostgreSQL multi-schema | Sem banco de dados |
| **Auth** | Microsoft Entra ID + API Keys | Sem autenticação |
| **Docker** | postgres + langflow | 5 serviços multi-stage |
| **Módulos de negócio** | 11 módulos NestJS completos | Stubs vazios |

### Objetivo

Migrar o código de produção do `api-llm-embedded` para o `monorepo-ai-llm`, adaptando a arquitetura de **monolito com domínios isolados** para **apps NestJS independentes** já definidos no monorepo de destino, mantendo todas as funcionalidades.

---

## 2. Decisão Arquitetural

### Abordagem Escolhida: Híbrida NestJS CLI + npm Workspaces

O `monorepo-ai-llm` usa NestJS CLI monorepo mode com 5 apps separadas. A migração irá **manter essa estrutura** e adicionar:

- **npm workspaces** para compartilhar `packages/shared` entre os apps
- **TypeORM** por app (cada app com seu próprio schema)
- **Infra comum** extraída para `packages/` (guards, interceptors, filters, decorators)
- **apps/svcia/*** para os servidores MCP (mesma estrutura do projeto origem)
- **TypeScript 5.7.3** mantido (sem tsgo, que é experimental)

### Mapeamento de Domínios

| App (destino) | Módulo(s) de origem | Schema PG | Porta |
|---|---|---|---|
| `monorepo-ai-llm` | Orquestração + health + routing | — | 3000 |
| `users-api` | `modules/users` + `modules/admin` + `modules/governance` + `modules/api-keys` | `public` | 3001 |
| `llm-ops-api` | `modules/llm-ops` + `modules/audit` | `llm_ops` | 3002 |
| `sharepoint-api` | `modules/sharepoint` + `modules/graph` | — (stateless) | 3003 |
| `sync-api` | `modules/sync` + `modules/m365-migration` | `public` | 3004 |

### Novo Mapeamento de Pastas

```
monorepo-ai-llm/
├── apps/
│   ├── monorepo-ai-llm/     # Container manager / health / routing
│   ├── users-api/           # Users, admin, governance, api-keys
│   ├── llm-ops-api/         # LLM Ops, RAG, audit
│   ├── sharepoint-api/      # SharePoint + Microsoft Graph
│   ├── sync-api/            # Sync M365 + migrations
│   └── svcia/               # ← NOVO: 5 MCP servers
│       ├── mcp-users/
│       ├── mcp-llm-ops/
│       ├── mcp-sync/
│       ├── mcp-secrets/
│       └── mcp-awesome-copilot/
├── packages/                # ← NOVO: workspaces compartilhados
│   ├── shared/              # Contratos, tipos, DTOs
│   └── infra/               # Guards, interceptors, filters, decorators
├── tools/
│   ├── mcp/                 # Ferramentas mermaid (existente)
│   └── mcp-project-health/  # ← NOVO: Servidor MCP diagnóstico
├── scripts/                 # ← NOVO: smoke tests, bootstrap, utils
├── config/                  # ← NOVO: MCP configs, env schemas
└── docs/                    # ← NOVO: Architecture docs
```

---

## 3. Pré-requisitos

Antes de iniciar qualquer fase:

- [ ] Branch `feat/migracao-api-llm-embedded` criada no monorepo-ai-llm
- [ ] Leitura confirmada do `CLAUDE.md` do projeto origem
- [ ] Acesso ao `.env.example` do projeto origem para referência
- [ ] Node.js 22 e npm 10+ instalados
- [ ] PostgreSQL 16+ disponível (local ou container)
- [ ] `npm run build` limpo no monorepo atual antes de iniciar

---

## 4. Fases de Migração

### Fase 1 — Fundação: npm Workspaces + Shared Packages

**Duração estimada:** 1 dia  
**Bloqueio:** Todas as fases seguintes dependem desta.

#### 1.1 Configurar npm Workspaces no root

Editar `package.json` raiz para adicionar:

```json
{
  "workspaces": [
    "apps/*",
    "apps/svcia/*",
    "packages/*",
    "tools/mcp-project-health"
  ]
}
```

**Cuidado:** O NestJS CLI continua funcional com workspaces npm; os dois sistemas coexistem.

#### 1.2 Criar `packages/shared`

Copiar de `api-llm-embedded/packages/shared/` para `packages/shared/`:

```
packages/shared/
├── src/
│   ├── index.ts
│   └── contracts/
│       ├── common/          (pagination, ApiResponse, ErrorResponse)
│       ├── users/           (user request/response)
│       └── llm-ops/         (agent, prompt, topic-flow, chat)
├── package.json             (name: @monorepo-ai-llm/shared)
└── tsconfig.json
```

Renomear pacote de `@api-llm-embedded/shared` → `@monorepo-ai-llm/shared`.  
Atualizar todos os imports nos arquivos copiados.

#### 1.3 Criar `packages/infra`

Extrair do `api-llm-embedded/apps/api/src/common/` para `packages/infra/src/`:

```
packages/infra/src/
├── decorators/
│   ├── current-user.decorator.ts
│   ├── require-permissions.decorator.ts
│   └── require-api-key.decorator.ts
├── guards/
│   └── permission-validation.guard.ts
├── filters/
│   └── http-exception.filter.ts
├── interceptors/
│   └── logging.interceptor.ts
└── index.ts
```

#### 1.4 Atualizar tsconfig.json raiz

Adicionar path aliases:

```json
{
  "compilerOptions": {
    "paths": {
      "@monorepo-ai-llm/shared": ["packages/shared/src/index.ts"],
      "@monorepo-ai-llm/infra": ["packages/infra/src/index.ts"]
    }
  }
}
```

#### 1.5 Adicionar dependências base ao root package.json

```bash
npm install @nestjs/typeorm typeorm pg zod @nestjs/swagger swagger-ui-express \
  @nestjs/config class-validator class-transformer
npm install --save-dev @types/pg
```

#### Critério de aceite
- [ ] `npm install` sem erros
- [ ] `packages/shared` e `packages/infra` importáveis via alias
- [ ] `npm run build:users-api` ainda compila (regressão zero)

---

### Fase 2 — Infraestrutura de Banco de Dados

**Duração estimada:** 1 dia  
**Depende de:** Fase 1

#### 2.1 Copiar módulo de database

De `api-llm-embedded/apps/api/src/infra/database/` para cada app que precisa de DB:

```
apps/{domain-app}/src/infra/database/
├── database.module.ts
├── typeorm.config.ts          # Adaptado para as envs do app específico
└── migrations/                # Copiar apenas as migrations do domínio
```

**Mapeamento de migrations por domínio:**

| App | Migrations (prefixo no nome) |
|---|---|
| `users-api` | `*User*`, `*ApiKey*`, `*Permission*` |
| `llm-ops-api` | `*LlmOps*`, `*Prompt*`, `*TopicFlow*`, `*Agent*`, `*Interaction*` |
| `sync-api` | `*Sync*`, `*Migration*` (m365) |

#### 2.2 Configurar docker-compose.yml local

Criar `docker-compose.yml` no root do monorepo:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: monorepo_ai_llm_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    ports: ["5432:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]

  langflow:
    image: langflowai/langflow:1.3.4
    profiles: [langflow]
    ports: ["7860:7860"]
    depends_on: [postgres]

volumes:
  postgres-data:
```

#### 2.3 Criar `.env.example` no root

Baseado no `api-llm-embedded/.env.example`, adaptado para monorepo:

```env
# Servidor
PORT=3000
NODE_ENV=development

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=monorepo_ai_llm_db
PG_USER=postgres
PG_PASSWORD=your-password
PG_SCHEMA=public

# LLM-Ops PostgreSQL (mesmo DB, schema separado)
LLM_PG_DATABASE=monorepo_ai_llm_db
LLM_PG_SCHEMA=llm_ops
LLM_PG_HOST=localhost
LLM_PG_USER=postgres
LLM_PG_PASSWORD=your-password

# Microsoft Entra ID
TENANT_ID=
CLIENT_ID=
CERT_THUMBPRINT=
CERT_PRIVATE_KEY_PATH=

# Security
API_KEY_SECRET=   # openssl rand -hex 32

# LangFlow (opcional)
LANGFLOW_ENABLED=false
LANGFLOW_URL=http://localhost:7860
LANGFLOW_RAG_FLOW_ID=f81c0124-ffc2-4458-b30d-4d588d393518

# AstraDB (opcional)
ASTRA_DB_ENABLED=false
```

#### Critério de aceite
- [ ] `docker compose up -d postgres` sobe sem erros
- [ ] `npm run migration:run` (em users-api) aplica migrations

---

### Fase 3 — Migração: `users-api`

**Duração estimada:** 2 dias  
**Depende de:** Fases 1 e 2

#### O que migrar

De `api-llm-embedded/apps/api/src/modules/`:

| Módulo origem | Destino |
|---|---|
| `users/` | `apps/users-api/src/modules/users/` |
| `admin/` | `apps/users-api/src/modules/admin/` |
| `governance/` | `apps/users-api/src/modules/governance/` |
| `api-keys/` | `apps/users-api/src/modules/api-keys/` |
| `health/` | `apps/users-api/src/modules/health/` |

#### Estrutura final esperada

```
apps/users-api/src/
├── main.ts                     # Bootstrap: Swagger, ValidationPipe, porta 3001
├── users-api.module.ts         # Root module (substituir stub)
├── config/
│   └── env.validation.ts       # Zod validation para envs do app
├── infra/
│   └── database/               # TypeORM, schema: public
└── modules/
    ├── users/
    ├── admin/
    ├── governance/
    ├── api-keys/
    └── health/
```

#### Passos

1. Substituir `users-api.module.ts` stub pelo módulo real (importar DatabaseModule, todos os módulos de domínio)
2. Atualizar `main.ts` para configurar Swagger e ValidationPipe
3. Migrar entities e DTOs de users
4. Configurar `APP_GUARD` com `PermissionValidationGuard` de `@monorepo-ai-llm/infra`
5. Atualizar imports de `@api-llm-embedded/shared` → `@monorepo-ai-llm/shared`
6. Adicionar migrations do domínio users

#### Critério de aceite
- [ ] `npm run build:users-api` compila sem erros
- [ ] `GET /users` responde 200 com PostgreSQL rodando
- [ ] `npm run type-check` limpo

---

### Fase 4 — Migração: `llm-ops-api`

**Duração estimada:** 3 dias  
**Depende de:** Fases 1, 2 e 3 (padrão estabelecido)

#### O que migrar

| Módulo origem | Destino |
|---|---|
| `llm-ops/` (10 entities, 14 DTOs) | `apps/llm-ops-api/src/modules/llm-ops/` |
| `audit/` | `apps/llm-ops-api/src/modules/audit/` |
| `infra/astradb/` | `apps/llm-ops-api/src/infra/astradb/` |

#### Atenção Especial: RAG Pipeline

O módulo `llm-ops` tem integração com AstraDB + LangFlow:

```
llm-ops-api → AstraDB (knowledge_base/interactions) → LangFlow (context-only)
```

- Copiar `apps/svcia/mcp-llm-ops/src/rag-langflow/Rag Loading.json` para `apps/llm-ops-api/src/rag-langflow/`
- Manter Flow ID: `f81c0124-ffc2-4458-b30d-4d588d393518`
- Variáveis: `ASTRA_DB_ENABLED`, `LANGFLOW_ENABLED`, `LANGFLOW_RAG_FLOW_ID`

#### Entidades do domínio llm-ops (schema: `llm_ops`)

```
LlmOpsAgentEntity
  ├── PromptTemplateEntity
  │     ├── PromptVersionEntity (DRAFT|APPROVED|DEPRECATED)
  │     │     ├── PromptUsageHistoryEntity
  │     │     └── PromptValidationEntity
  │     └── PromptDependencyEntity
  └── TopicFlowEntity
        └── TopicFlowVersionEntity
              └── InteractionLearningEventEntity
```

#### Critério de aceite
- [ ] `npm run build:llm-ops-api` limpo
- [ ] `GET /llm-ops/agents` responde 200
- [ ] `POST /llm-ops/chat` executa RAG (com AstraDB configurado)
- [ ] Migrations do schema `llm_ops` aplicadas

---

### Fase 5 — Migração: `sharepoint-api`

**Duração estimada:** 2 dias  
**Depende de:** Fase 1

#### O que migrar

| Módulo origem | Destino |
|---|---|
| `sharepoint/` | `apps/sharepoint-api/src/modules/sharepoint/` |
| `graph/` | `apps/sharepoint-api/src/modules/graph/` |
| `health/` | `apps/sharepoint-api/src/modules/health/` |

#### Atenção: App Stateless

`sharepoint-api` não tem banco de dados — integração pura com Microsoft Graph API via OAuth/certificado. Não incluir DatabaseModule.

#### Critério de aceite
- [ ] `npm run build:sharepoint-api` limpo
- [ ] `GET /sharepoint/sites` com credenciais válidas retorna dados
- [ ] Retry + jitter para chamadas Graph implementado

---

### Fase 6 — Migração: `sync-api`

**Duração estimada:** 2 dias  
**Depende de:** Fases 1 e 2

#### O que migrar

| Módulo origem | Destino |
|---|---|
| `sync/` | `apps/sync-api/src/modules/sync/` |
| `m365-migration/` (8 entities) | `apps/sync-api/src/modules/m365-migration/` |
| `health/` | `apps/sync-api/src/modules/health/` |

#### Critério de aceite
- [ ] `npm run build:sync-api` limpo
- [ ] Migrations do domínio sync aplicadas no schema `public`

---

### Fase 7 — Migração: MCP Servers

**Duração estimada:** 2 dias  
**Depende de:** Fases 3–6

#### 7.1 Criar `apps/svcia/`

Copiar de `api-llm-embedded/apps/svcia/` para `apps/svcia/` no monorepo:

```
apps/svcia/
├── mcp-users/
│   ├── src/
│   │   ├── main.ts
│   │   └── users-api-client.ts
│   ├── package.json            (name: @monorepo-ai-llm/mcp-users)
│   └── tsconfig.json
├── mcp-llm-ops/
├── mcp-sync/
├── mcp-secrets/
└── mcp-awesome-copilot/
```

#### 7.2 Atualizar package names

Renomear `@api-llm-embedded/mcp-*` → `@monorepo-ai-llm/mcp-*` em todos os `package.json`.

#### 7.3 Atualizar scripts no root package.json

```json
{
  "scripts": {
    "mcp:users:start": "node apps/svcia/mcp-users/dist/main.js",
    "mcp:llm-ops:start": "node apps/svcia/mcp-llm-ops/dist/main.js",
    "mcp:sync:start": "node apps/svcia/mcp-sync/dist/main.js",
    "mcp:secrets:start": "node apps/svcia/mcp-secrets/dist/main.js",
    "mcp:build:all": "npm run mcp:users:build && npm run mcp:llm-ops:build && ..."
  }
}
```

#### 7.4 Migrar `tools/mcp-project-health/`

Copiar de `api-llm-embedded/tools/mcp-project-health/` para `tools/mcp-project-health/` no monorepo.  
Atualizar `REPO_ROOT` default e referências de paths.

#### Critério de aceite
- [ ] `npm run mcp:build:all` sem erros
- [ ] `mcp:users:start` lista usuários via MCP
- [ ] Smoke tests MCP passando: `scripts/smoke-tests/mcp-*-read-smoke.mjs`

---

### Fase 8 — Migração: Scripts, Config e Docs

**Duração estimada:** 1 dia  
**Depende de:** Fase 7

#### 8.1 Copiar scripts

```bash
cp -r api-llm-embedded/scripts/ monorepo-ai-llm/scripts/
```

Atualizar caminhos hardcoded nos `.mjs` que referenciam `api-llm-embedded`.

#### 8.2 Copiar configurações MCP

```bash
cp -r api-llm-embedded/config/ monorepo-ai-llm/config/
```

Atualizar `config/mcp/shp-local-mcp.example.json` com os novos caminhos do monorepo.

#### 8.3 Adicionar scripts ao root package.json

```json
{
  "scripts": {
    "migration:run": "typeorm migration:run -d apps/users-api/src/infra/database/typeorm.config.ts",
    "db:check": "node scripts/utils/check-db-connection.mjs",
    "validate:mcp": "npm run mcp:build:all && node scripts/smoke-tests/mcp-users-read-smoke.mjs",
    "test:smoke": "node scripts/smoke-tests/run-all.mjs"
  }
}
```

#### Critério de aceite
- [ ] `npm run test:smoke` executa sem crashes
- [ ] `config/mcp/` com configs válidas para todos os 5 servidores

---

### Fase 9 — CLAUDE.md e Documentação

**Duração estimada:** 0.5 dia  
**Depende de:** Fase 8

Criar `CLAUDE.md` no root do monorepo baseado no `api-llm-embedded/CLAUDE.md`, adaptando:

- Nomes de pacotes (`@monorepo-ai-llm/` em vez de `@api-llm-embedded/`)
- Caminhos de arquivos
- Comandos de build (NestJS CLI em vez de tsgo)
- Estrutura de apps (5 NestJS apps separados)

#### Critério de aceite
- [ ] `CLAUDE.md` reflete a arquitetura real do monorepo após migração

---

### Fase 10 — Validação e Testes Finais

**Duração estimada:** 1 dia

#### Checklist de validação

```bash
# Build completo
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Smoke tests
npm run test:smoke

# MCP servers
npm run validate:mcp

# Docker
docker compose up -d postgres
docker compose build
```

#### Critério de aceite final
- [ ] `npm run build` limpo (todos os 5 apps + svcia + packages)
- [ ] `npx tsc --noEmit` sem erros
- [ ] Todos os smoke tests passando com PostgreSQL
- [ ] Todos os MCP servers respondendo via stdio
- [ ] Docker build sem erros para todos os serviços

---

## 5. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Conflitos de versão de TypeScript (6.0 tsgo vs 5.7.3) | Alta | Manter TypeScript 5.7.3 no destino; não usar tsgo |
| Imports circulares ao extrair `packages/infra` | Média | Extrair somente decorators e guards sem dependências de domínio |
| Migrations duplicadas entre domínios | Média | Separar migrations por app antes de copiar; revisar timestamps |
| Microsoft Graph auth não disponível localmente | Alta | Criar mocks via Dev Proxy antes de testar sharepoint-api |
| AstraDB/LangFlow offline durante migração | Média | Usar `ASTRA_DB_ENABLED=false` e `LANGFLOW_ENABLED=false` para validação inicial |
| NestJS CLI não reconhecer novos apps `svcia/*` | Baixa | Adicionar no `nest-cli.json` apenas os apps principais; MCP usa ts-node/tsgo próprio |

---

## 6. O que NÃO Migrar

| Item | Motivo |
|---|---|
| `apps/web` (React frontend) | Monorepo destino não tem infraestrutura frontend; avaliar em fase futura separada |
| `.devproxy/mocks/` | Dependem de ferramenta Microsoft Dev Proxy; recriar se necessário |
| `.copilot-tracking/` | Runtime de outro projeto; não relevante |
| `secrets/` | Credenciais; nunca migrar diretamente |
| `logs-docker/` | Logs de runtime; não migrar |
| `datasets/` | Dados de seed específicos de ambiente |

---

## 7. Ordem de Execução Resumida

```
Fase 1: Foundation (workspaces + packages/shared + packages/infra)
    ↓
Fase 2: Database (TypeORM + docker-compose + .env.example)
    ↓
Fase 3: users-api  →  Fase 4: llm-ops-api  →  Fase 5: sharepoint-api  →  Fase 6: sync-api
                   (podem ser paralelas com cuidado)
    ↓
Fase 7: MCP Servers (svcia + project-health)
    ↓
Fase 8: Scripts + Config + Docs
    ↓
Fase 9: CLAUDE.md
    ↓
Fase 10: Validação Final
```

**Duração total estimada:** 12–15 dias de trabalho  
**Fases 3–6 podem ser paralelizadas** por desenvolvedor/agente diferente.

---

## 8. Referências

- Projeto origem CLAUDE.md: `/mnt/repositorio/workdir/repostorios/api-llm-embedded/CLAUDE.md`
- Projeto origem package.json: `/mnt/repositorio/workdir/repostorios/api-llm-embedded/package.json`
- Destino nest-cli.json: `/mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm/nest-cli.json`
- Destino package.json: `/mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm/package.json`
- Guia de expansão origem: `/mnt/repositorio/workdir/repostorios/api-llm-embedded/docs/EXPANSION_GUIDE.md`
