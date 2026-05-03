# Guia de Uso dos MCPs por Domínio

## 📋 Estrutura de Profiles

Os MCPs agora seguem **profiles por domínio**, ativados conforme necessário:

| MCP | Profiles | Ativação |
|---|---|---|
| **mcp-users** | `demand`, `mcp-users-domain` | Automático com users-api OU manual |
| **mcp-llm-ops** | `demand`, `mcp-llm-ops-domain` | Automático com llm-ops-api OU manual |
| **mcp-sync** | `demand`, `mcp-sync-domain` | Automático com sync-api OU manual |
| **mcp-secrets** | `mcp-secrets-standalone` | Manual apenas |
| **mcp-project-health** | `mcp-project-health-standalone` | Manual apenas |

## 🚀 Cenários de Uso

### Cenário 1: Todos os domínios + MCPs associados (dev completo)

```bash
# Subir tudo (persistent + demand + MCPs de domínio)
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile demand up -d
```

Containers iniciados:
- postgres, container-manager (persistent)
- users-api, mcp-users
- llm-ops-api, mcp-llm-ops
- sharepoint-api
- sync-api, mcp-sync
- langflow

### Cenário 2: Apenas users-api com seu MCP

```bash
# Subir infrastructure + users + mcp-users
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-users-domain up -d users-api mcp-users
```

### Cenário 3: LLM Ops com seu MCP (sem sync, sharepoint)

```bash
# Subir apenas llm-ops + seu MCP
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-llm-ops-domain up -d llm-ops-api mcp-llm-ops
```

### Cenário 4: MCPs standalone (sem APIs de domínio)

```bash
# Secrets MCP (gerenciamento de credenciais)
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-secrets-standalone up -d mcp-secrets

# Project Health MCP (health check)
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-project-health-standalone up -d mcp-project-health

# Ambos
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-secrets-standalone --profile mcp-project-health-standalone up -d
```

### Cenário 5: Usar Container Manager para ativar MCPs dinamicamente

```bash
# Subir apenas infra crítica
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent up -d

# Depois, via Container Manager, ativar domínio
curl -X POST http://localhost:3000/activate/users

# Isso inicia users-api e seu MCP automático (profile demand)
```

## 📊 Combinações de Profiles Recomendadas

### Dev completo (tudo)
```bash
--profile persistent --profile demand
```
**Containers**: postgres, manager, users-api, mcp-users, llm-ops-api, mcp-llm-ops, sharepoint-api, sync-api, mcp-sync, langflow
**Recursos**: ~2.5 GB RAM total

### Dev seletivo (domínios específicos)
```bash
--profile persistent --profile mcp-users-domain --profile mcp-llm-ops-domain
```
**Containers**: postgres, manager, users-api, mcp-users, llm-ops-api, mcp-llm-ops
**Recursos**: ~1.5 GB RAM

### MCPs auxiliares (sem APIs)
```bash
--profile persistent --profile mcp-secrets-standalone --profile mcp-project-health-standalone
```
**Containers**: postgres, manager, mcp-secrets, mcp-project-health
**Recursos**: ~600 MB RAM

### Mínimo (só infra)
```bash
--profile persistent
```
**Containers**: postgres, container-manager
**Recursos**: ~700 MB RAM

## 🔍 Verificar Status

```bash
# Ver todos os containers do projeto
docker compose -p api-llm-embedded ps

# Ver apenas MCPs ativos
docker compose -p api-llm-embedded ps | grep mcp

# Logs de um MCP específico
docker compose -p api-llm-embedded logs -f mcp-users

# Status de recursos
docker stats --no-stream \
  api-llm-embedded-mcp-users \
  api-llm-embedded-mcp-llm-ops \
  api-llm-embedded-mcp-sync
```

## ⚙️ Uso Prático com Claude Desktop

### Ativar apenas o que você precisa

**Caso 1**: Trabalhando com Users API
```bash
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-users-domain up -d users-api mcp-users
```

Configure Claude para usar apenas `mcp-users`:
```json
{
  "mcpServers": {
    "api-llm-embedded-users": {
      "command": "docker",
      "args": ["compose", "-p", "api-llm-embedded", "exec", "mcp-users", "node", "dist/main.js"],
      "cwd": "/path/to/api-llm-embedded"
    }
  }
}
```

**Caso 2**: Trabalhando com LLM Ops
```bash
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-llm-ops-domain up -d llm-ops-api mcp-llm-ops
```

Configure Claude para usar apenas `mcp-llm-ops`:
```json
{
  "mcpServers": {
    "api-llm-embedded-llm-ops": {
      "command": "docker",
      "args": ["compose", "-p", "api-llm-embedded", "exec", "mcp-llm-ops", "node", "dist/main.js"],
      "cwd": "/path/to/api-llm-embedded"
    }
  }
}
```

## 🎯 Resumo: Perfis por Caso de Uso

| Caso de Uso | Profiles | Recursos | Uso |
|---|---|---|---|
| Full dev (tudo) | `persistent`, `demand` | ~2.5GB | Teste completo, integração |
| Users work | `persistent`, `mcp-users-domain` | ~1.0GB | Desenvolvimento de users |
| LLM work | `persistent`, `mcp-llm-ops-domain` | ~1.0GB | Desenvolvimento LLM |
| Sync work | `persistent`, `mcp-sync-domain` | ~1.0GB | Desenvolvimento sync |
| Health check | `persistent`, `mcp-project-health-standalone` | ~600MB | Monitoramento |
| Secrets mgmt | `persistent`, `mcp-secrets-standalone` | ~600MB | Credenciais |
| Minimal | `persistent` | ~700MB | Apenas infra |

---

**Última Atualização**: 2026-04-29
**Status**: MCPs por demanda de domínio ✅
