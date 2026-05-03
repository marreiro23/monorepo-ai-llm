# PR Draft — Consolidacao Geral (worktrees + dashboards + scripts)

## Titulo sugerido
Consolida worktrees do Claude + dashboards web + scripts de integracao real

## Contexto
Esta PR consolida alteracoes espalhadas entre `master`, worktrees do Claude e a branch `feat/env-containers-mcp`, incluindo tambem mudancas locais nao commitadas que estavam fora de uma linha unica de entrega.

## Branch
`ready/pr-consolidated-2026-04-30`

## Commits incluidos
- `7ee9a27` merge: consolidate feat/env-containers-mcp into master baseline
- `eafc7ef` chore(consolidation): apply uncommitted worktree changes from feat/env-containers-mcp
- `5b54ec7` feat(web+ops): consolidate new dashboards and real integration scripts
- `be671b8` fix(consolidation): restore root npm scripts in package.json
- `4a3908a` fix(consolidation): restore apps/api npm scripts

## Escopo

### 1) Consolidacao de infraestrutura e backend
- Merge completo de `feat/env-containers-mcp` sobre baseline de `master`.
- Inclusao de ajustes locais nao commitados:
  - `apps/api/src/domains/sharepoint/main.ts`
  - `apps/api/src/modules/graph/services/entra-registration.service.ts`
  - `docker-compose.yml`

### 2) Web (novos dashboards)
- Roteamento hash atualizado em `apps/web/src/app/App.tsx` para:
  - `#ask-and-answer`
  - `#links`
  - `#roadmap`
  - `#database`
- Novas features:
  - `apps/web/src/features/delivery-plan/*`
  - `apps/web/src/features/database-viewer/*`
- Atualizacao do dashboard de navegacao:
  - `apps/web/src/features/navigation-dashboard/components/navigation-dashboard-page.tsx`

### 3) Operacao e testes reais
- Novo monitor local:
  - `scripts/monitor.mjs`
- Novo smoke de integracao real:
  - `scripts/smoke-tests/integration-real-smoke.mjs`
- Script auxiliar de inicializacao de bancos:
  - `scripts/postgres/init-databases.sh`

### 4) Correcao de scripts npm na consolidacao
- Restaurado bloco `scripts` em `package.json` (raiz).
- Restaurados scripts em `apps/api/package.json`.

## Validacao executada
- `npm run` (raiz): OK (scripts disponiveis).
- `npm test` (raiz): executa sem erro na worktree consolidada, mas retorna `0 tests` no padrao atual desta arvore.
- Validacao funcional anterior (fora da worktree consolidada) indicou:
  - users API responde
  - llm-ops/sync bloqueados por schemas ausentes no banco (`llm_ops`, `sync`)

## Riscos / atencoes
- `smoke:real` pode falhar enquanto schemas `llm_ops` e `sync` nao forem provisionados/migrados.
- Alteracoes amplas de consolidacao podem exigir review por area (web, docker/env, backend).

## Checklist de revisao
- [ ] Confirmar build dos workspaces principais (`apps/api`, `apps/web`).
- [ ] Validar rotas web (`#links`, `#roadmap`, `#database`).
- [ ] Subir stack local e rerodar `npm run smoke:real` apos provisionar schemas.
- [ ] Revisar `docker-compose.yml` e envs associados.
- [ ] Revisar alteracoes de clientes REST e MCP secrets.

## Como publicar quando existir repositorio remoto
1. Adicionar remoto (exemplo):
   - `git remote add origin <URL_DO_REPO>`
2. Publicar branch:
   - `git push -u origin ready/pr-consolidated-2026-04-30`
3. Abrir PR com este conteudo como base.
