# Project Structure Blueprint (api-llm-embedded)

> Monorepo npm workspaces com NestJS (backend), React (web), packages compartilhados e MCP servers para validação e automação de qualidade.

## Diretórios principais (intenção)
- `apps/`: aplicações executáveis (APIs, web, MCPs “serviço”)
- `packages/`: bibliotecas compartilhadas e contratos
- `tools/`: ferramentas e MCPs de validação/auto-fix (ex.: project-health)
- `scripts/`: automações de dev/ops
- `docs/`: documentação viva (operação, arquitetura, runbooks)
- `spec/`: especificações “AI-ready” (regras e contratos do repo)

## Padrão para microserviços
- Cada serviço deve ter:
  - entrypoint próprio
  - módulo Nest mínimo
  - build output isolado
  - Docker target que copia apenas esse output

## Onde colocar coisas novas
- Nova API de domínio: `apps/<domain>-api/`
- Novo pacote compartilhado: `packages/<name>/`
- Novo MCP check: `tools/mcp-project-health/src/checks/<name>.check.ts`
- Nova spec: `spec/spec-<slug>.md`
- Novo runbook: `docs/runbooks/<topic>.md`