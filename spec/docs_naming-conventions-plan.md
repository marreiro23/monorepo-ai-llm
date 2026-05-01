# Plano de Convenção de Nomes e Organização de Artefatos (TS/NestJS-first)

Repo: `marreiro23/api-llm-embedded`  
Data: 2026-05-01

## 0) Premissas do seu projeto (observadas no repo)
- Monorepo com npm workspaces (`apps/*`, `packages/*`, `tools/*`)
- Backend NestJS em `apps/api`
- ESM (imports com `.js`)
- Build TypeScript via **tsgo** (não usar `tsc`)
- Docker multi-stage com targets por domínio (`apps/api/Dockerfile`)
- Scripts já organizados em `scripts/` (com `scripts/README.md`)
- MCP servers existentes (e `tools/mcp-project-health`)

---

## 1) Objetivo prático
Você quer:
1. Padronizar nomes/estrutura para **reaproveitar scripts e código**.
2. Ter **MCP servers** que revisem código e indiquem melhores práticas (sem “mutação” do projeto, ou com dry-run).
3. Suportar no dia a dia: **TS/JS + SQL/Postgres + Docker/Podman + um pouco de Python**.

> Estratégia: “poucas regras, muito consistentes” + automação (lint/test/checks) para manter padrão sem esforço.

---

## 2) Convenção de nomes (regras principais)

### 2.1 Pastas (diretórios)
**Sempre `kebab-case`**.
Ex.: `mcp-project-health/`, `llm-ops/`, `env-manager/`

### 2.2 Arquivos TypeScript/JavaScript
Recomendação para manter consistência no monorepo:
- Arquivos gerais: **`kebab-case.ts` / `kebab-case.mjs`**
- Arquivos Nest (opcional, mas recomendado): manter a convenção “nestjs” já comum:
  - `*.module.ts`
  - `*.controller.ts`
  - `*.service.ts`
  - `*.entity.ts`
  - `*.dto.ts`
  - `*.guard.ts`
  - `*.interceptor.ts`
  - `*.pipe.ts`

Regra simples:
- Se for artefato Nest “tipado”: **sufixo Nest** (ex.: `users.service.ts`)
- Se for utilitário/script: **kebab-case** (ex.: `generate-openapi.mjs` já está ótimo)

### 2.3 Símbolos TypeScript
- `camelCase` para funções/variáveis
- `PascalCase` para classes, types, interfaces, DTOs
- `UPPER_SNAKE_CASE` para constantes globais

### 2.4 SQL / Postgres
#### Migrations
Padronize em 100% do repo:

**Formato:**
- `YYYYMMDDHHMM__descricao-curta.sql` (kebab-case na descrição)

Ex.:
- `202605011230__create-users-table.sql`
- `202605011245__add-users-email-index.sql`

#### Queries salvas
- `sql/queries/<dominio>/<acao>__<objeto>.sql`

Ex.:
- `sql/queries/llm-ops/select__prompt-usage-by-day.sql`
- `sql/queries/users/select__users-by-email.sql`

### 2.5 Scripts
Você já tem `scripts/README.md`. Vamos “fechar” padrão:

- `scripts/<area>/<acao>-<objeto>.<ext>`
- `<area>`: `dev`, `db`, `ops`, `utils`, `smoke-tests`, `mcp`
- `<acao>`: `generate`, `check`, `sync`, `seed`, `backup`, `restore`, `verify`
- `<objeto>`: `openapi`, `env`, `db`, `docker`, `mcp-readonly`

Ex.:
- `scripts/db/backup-postgres.sh`
- `scripts/ops/build-users-domain-image.sh`
- `scripts/mcp/check-readonly-contract.mjs`

### 2.6 Containers: Docker/Podman
Você já usa `apps/api/Dockerfile`. Para Podman, duas opções:

**Opção A (recomendado): manter `Dockerfile` e usar Podman para build**
- Podman aceita Dockerfile normalmente.
- Você mantém 1 fonte de verdade.

**Opção B: padronizar `Containerfile`**
- Renomear para `Containerfile` onde fizer sentido (não obrigatório).

Nome de imagem/tag:
- Local dev: `api-llm-embedded-<component>:dev`
- CI/registry: `ghcr.io/marreiro23/api-llm-embedded/<component>:<version>`

Ex.:
- `api-llm-embedded-users-domain:dev`

---

## 3) “Instalação” do padrão (checklist de adoção no repo)

### 3.1 Criar um “contrato” humano + contrato automático
1) Documento de convenção:
- `docs/naming-conventions-plan.md` (este)

2) Template de novos artefatos:
- `docs/templates/`
  - `docs/templates/new-script.md`
  - `docs/templates/new-mcp-server.md`
  - `docs/templates/new-sql-migration.md`

3) Automação para impedir drift:
- “check de nomes” simples (Node script) validando:
  - migrations seguem regex
  - scripts seguem kebab-case
  - pastas-chave seguem padrão

Sugestão de arquivo:
- `tools/mcp-project-health/src/checks/naming.check.ts` (ou em `scripts/utils/` primeiro)

### 3.2 Adicionar “pontos únicos” (single source of truth)
- Centralizar SQL em `sql/` (mesmo que TypeORM gere algo, salve migrations e queries versionadas em um lugar padrão)
- Centralizar scripts em `scripts/` (você já faz isso)
- Centralizar docs de execução em `docs/runbooks/`

### 3.3 Padronizar comandos de desenvolvimento
No root `package.json`, garantir scripts previsíveis:

- `npm run lint`
- `npm run format`
- `npm run test`
- `npm run test:smoke`
- `npm run docker:build:<dominio>`
- `npm run podman:build:<dominio>` (ou alias pro mesmo comando)

> Observação: como você usa `tsgo`, seus comandos de “typecheck/build” precisam respeitar isso.

---

## 4) MCP servers para revisão de código (o que criar)

Você já tem:
- MCP servers de domínio em `apps/svcia/mcp-*`
- `tools/mcp-project-health` (diagnóstico/autofix) — excelente base

### 4.1 Estratégia recomendada (baixo custo e alta utilidade)
**Camada 1 (determinística, barata, rápida)**
- ESLint/Prettier
- checagem `tsgo`
- regras de naming via regex
- análise AST local (ts-morph) para anti-patterns

**Camada 2 (LLM “quando necessário”)**
- Só para explicar findings complexos, sugerir refactor, ou avaliar tradeoffs.

### 4.2 MCP server “code-reviewer” (novo)
Local sugerido:
- `apps/svcia/mcp-code-reviewer/`

Ferramentas (tools) iniciais:
- `review_files` (recebe lista de paths/diffs → retorna findings)
- `review_nest_module_boundaries` (checa imports cruzando camadas)
- `review_env_usage` (onde `process.env` é permitido vs não)

### 4.3 MCP server “sql-reviewer” (novo)
Local:
- `apps/svcia/mcp-sql-reviewer/`

Tools:
- `review_migration` (regras: transaction, idempotência, índices)
- `review_query` (padrões: N+1, falta índice, SELECT *)

### 4.4 MCP server “llm-evaluator” (novo ou evoluir llm-ops)
Tools:
- `eval_prompt_smoke` (avalia regressões simples)
- `eval_rag_retrieval` (top-k, recall heurístico, etc.)
- `summarize_findings` (explica resultados para humano)

---

## 5) Mapeamento para o que você já tem no repo (ajustes mínimos)
- `apps/api/Dockerfile`: já muito bom. Só padronizar naming de targets/imagens nos scripts.
- `scripts/utils/*`: já existe. Excelente lugar para adicionar:
  - `scripts/utils/check-naming.mjs`
  - `scripts/utils/list-artefacts.mjs`
- `tools/mcp-project-health`: já tem testes (ex.: dockerfile.check). Dá para adicionar checks de convenção aqui sem reinventar.

---

## 6) Referências e repositórios de exemplo (bons para aprender padrão)
### NestJS / TS
- https://github.com/nestjs/nest
- https://github.com/nestjs/typescript-starter

### Monorepo / Workspaces
- https://github.com/vercel/turborepo
- https://github.com/nrwl/nx

### MCP SDK
- https://github.com/modelcontextprotocol/sdk

### SQL/Postgres
- https://www.postgresql.org/docs/

### Docker/Podman
- https://podman.io/docs
- https://docs.docker.com/

---

## 7) Próximo passo (para eu fechar 100% do plano no seu padrão atual)
Me responda com 3 escolhas (rápido):
1) Onde estão hoje suas migrations? (TypeORM CLI? pasta específica?)  
2) Você quer padronizar SQL em `sql/migrations/` ou manter dentro de `apps/api`?  
3) Você quer que os MCP de “review” fiquem em `apps/svcia/` (como os outros) ou em `tools/`?