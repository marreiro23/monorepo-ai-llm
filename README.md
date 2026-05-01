# monorepo-ai-llm

> Monorepo template (TS/NestJS-first) para microserviços por domínio + MCP quality gates + operação em máquina com poucos recursos.

## Objetivos
- Microserviços por domínio (artefatos pequenos, containers leves)
- Reutilização via `packages/*`
- Enforcements via MCP/CI: boundaries + docker minimal copy + docs freshness
- Docker/Podman-friendly

## Estrutura
- `apps/*`: serviços (APIs por domínio) e MCP servers
- `packages/*`: libs reutilizáveis (shared, config, db, observability)
- `tools/*`: ferramentas e MCP checks (ex.: project-health)
- `spec/*`: especificações (regras do repo)
- `docs/*`: documentação viva
- `scripts/*`: automação (dev/db/ops)

## Como começar (local)
1. Ajuste `.env.containers.example` -> `.env.containers` (NÃO commitar)
2. Suba infra:
   ```bash
   docker compose --env-file .env.containers -p monorepo-ai-llm --profile persistent up -d
