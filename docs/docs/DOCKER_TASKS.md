# Docker Tasks

As tasks de `.vscode/tasks.json` executam Docker Compose por meio dos wrappers:

- `scripts/powershell/Invoke-EnvManager.ps1`
- `scripts/powershell/Invoke-DomainDockerFlow.ps1`
- `scripts/powershell/Invoke-DockerComposeTask.ps1`

O fluxo recomendado e usar as tasks `Docker Flow:*`, que validam o ambiente,
geram `.env.generated.containers` e so entao executam Docker Compose.

## Logs

- Todos os logs ficam em `logs-docker/`.
- Cada arquivo e incremental: novas execucoes acrescentam conteudo ao final.
- Cada arquivo e limitado a 2 MB. Ao passar do limite, o wrapper preserva o fim do arquivo.
- Os logs sao locais e nao devem ser versionados.
- Validacoes e renders de ambiente tambem geram logs, sem imprimir valores de secrets.

## Padrao de nomes

- Build de imagem selecionada:
  - `sync-api` -> `logs-docker/sync-image.log`
  - `mcp-sync` -> `logs-docker/mcp-sync-image.log`
- Operacoes de container selecionado:
  - `sync-api` -> `logs-docker/cont-sync-image.log`
  - `mcp-sync` -> `logs-docker/cont-mcp-sync-image.log`
- Operacoes agregadas:
  - compose config -> `logs-docker/compose-config.log`
  - compose ps -> `logs-docker/compose-status.log`
  - stack persistente -> `logs-docker/cont-persistent-stack.log`
- Ambiente:
  - validate `llm-ops` -> `logs-docker/env-validate-containers-llm-ops.log`
  - render `users` -> `logs-docker/env-render-containers-users.log`

## Tasks Disponiveis

| Task | Uso | Log |
| --- | --- | --- |
| `Docker: compose config` | Valida/renderiza o Compose com todos os profiles relevantes. | `compose-config.log` |
| `Env: validate containers` | Valida o ambiente para o dominio selecionado. | `env-validate-containers-<dominio>.log` |
| `Env: render containers` | Gera `.env.generated.containers`. | `env-render-containers-<dominio>.log` |
| `Docker Flow: build domain app` | Valida, renderiza e builda a imagem app do dominio. | Por servico |
| `Docker Flow: up domain app` | Valida, renderiza, sobe Postgres e app do dominio. | Por servico |
| `Docker Flow: up domain mcp` | Valida, renderiza, sobe app e MCP do dominio. | Por servico |
| `Docker Flow: up domain full` | Fluxo completo app + MCP quando existir. | Por servico |
| `Docker Flow: diagnose domain` | Captura status e logs curtos do dominio. | Por servico |
| `Docker: up persistent stack` | Sobe PostgreSQL e Container Manager. | `cont-persistent-stack.log` |
| `Docker: ps` | Lista containers do projeto Compose. | `compose-status.log` |
| `Docker: logs selected service` | Acompanha logs do servico escolhido. | Por servico |
| `MCP Secrets: build image` | Builda o MCP de secrets standalone. | `mcp-secrets-image.log` |
| `MCP Secrets: up standalone` | Sobe o MCP de secrets standalone. | `cont-mcp-secrets-image.log` |

## Observacoes

- As tasks de fluxo usam `.env.generated.containers`.
- O arquivo `.env.generated.containers` e gerado pelo Env Manager.
- Builds com servicos `demand` tambem habilitam `persistent` e `always`, pois varios servicos dependem de `postgres`.
- Tasks de logs usam `-f`; finalize a task no terminal do VS Code quando nao quiser mais acompanhar a saida.
