# Env Manager Local

O projeto usa `scripts/powershell/Invoke-EnvManager.ps1` para reduzir edicao manual de `.env`.

## Objetivo

- Validar variaveis antes de criar imagens ou containers.
- Gerar arquivos `.env.generated.*` a partir de uma fonte local.
- Separar configuracao por dominio operacional.
- Evitar que cada task Docker tenha uma regra propria de ambiente.

## Fonte de Dados

Fonte recomendada:

```text
secrets/local.secrets.json
```

Esse arquivo e local, ignorado pelo Git. Se ele ainda nao existir, o script tenta criar uma copia local a partir do bootstrap privado:

```text
secrets/local.secrets.example.json.bak
```

Esse `.bak` tambem e ignorado pelo Git e pode conter dados sensiveis locais. O arquivo de exemplo versionavel continua separado e deve ficar sem segredo real:

```text
secrets/local.secrets.example.json
```

Enquanto `secrets/local.secrets.json` nao existir e o bootstrap `.bak` tambem nao existir, o script usa fallback:

- target `containers`: `.env.containers`
- target `local`: `.env`

Esse fallback existe apenas para transicao.

## Arquivos de Controle

```text
config/env/env.schema.json
config/docker/domains.json
```

- `env.schema.json`: define variaveis, obrigatoriedade por escopo, defaults e secrets.
- `domains.json`: define dominio, app service, MCP service e imagem.

## Comandos

Validar ambiente de containers para um dominio:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/powershell/Invoke-EnvManager.ps1 -Action validate -Target containers -Domain llm-ops
```

Gerar `.env.generated.containers`:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/powershell/Invoke-EnvManager.ps1 -Action render -Target containers -Domain llm-ops -OutputPath .env.generated.containers
```

As acoes `validate` e `render` registram logs incrementais em `logs-docker/`, limitados a 2 MB por arquivo:

```text
logs-docker/env-validate-containers-llm-ops.log
logs-docker/env-render-containers-llm-ops.log
```

Esses logs registram status, fonte usada e erros de variaveis ausentes, mas nao imprimem valores de secrets.

Executar fluxo completo de dominio:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/powershell/Invoke-DomainDockerFlow.ps1 -Action up-full -Domain llm-ops
```

## MCP Secrets

O `mcp-secrets` pode ajudar com auditoria e diagnostico, mas nao deve ser a fonte primaria de bootstrap dos containers. Containers precisam das variaveis antes de subir; por isso a fonte local continua sendo `secrets/local.secrets.json` e o Env Manager gera os envs usados pelo Compose.
