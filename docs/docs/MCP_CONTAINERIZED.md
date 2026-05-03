# Model Context Protocol (MCP) Servers - Guia Containerizado

## 📋 Visão Geral

Os 5 servidores MCP do projeto foram containerizados com **profiles por domínio** e resource limits otimizados:

### MCPs de Domínio (ativam com suas APIs)
- **mcp-users**: Interface MCP para Users API (3001) → profile `mcp-users-domain`
- **mcp-llm-ops**: Interface MCP para LLM Ops API (3002) → profile `mcp-llm-ops-domain`
- **mcp-sync**: Interface MCP para Sync API (3004) → profile `mcp-sync-domain`

### MCPs Standalone (sem API dependente)
- **mcp-secrets**: Gerenciador de secrets → profile `mcp-secrets-standalone`
- **mcp-project-health**: Health check e status → profile `mcp-project-health-standalone`

## 🏗️ Arquitetura

### Comunicação
MCPs usam **stdio (JSON-RPC)**, não HTTP:
- Entrada: stdin (JSON-RPC requests)
- Saída: stdout (JSON-RPC responses)
- Sem portas expostas

### Dependências por Profile
```
--profile persistent (obrigatório)
├── postgres (container DB)
└── container-manager (orquestrador)

--profile demand (todos os domínios + MCPs)
├── users-api → mcp-users (automático)
├── llm-ops-api → mcp-llm-ops (automático)
├── sync-api → mcp-sync (automático)
└── sharepoint-api (sem MCP)

--profile mcp-users-domain (users apenas)
└── users-api → mcp-users

--profile mcp-llm-ops-domain (llm-ops apenas)
└── llm-ops-api → mcp-llm-ops

--profile mcp-sync-domain (sync apenas)
└── sync-api → mcp-sync

--profile mcp-secrets-standalone
└── mcp-secrets (sem deps)

--profile mcp-project-health-standalone
└── mcp-project-health → postgres
```

## 🚀 Início Rápido

### Opção 1: Todos os domínios + MCPs (dev completo)

```bash
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile demand up -d
```

Containers: postgres, container-manager, users-api, mcp-users, llm-ops-api, mcp-llm-ops, sharepoint-api, sync-api, mcp-sync, langflow

### Opção 2: Apenas users-api + seu MCP

```bash
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-users-domain up -d users-api mcp-users
```

### Opção 3: Apenas LLM Ops + seu MCP

```bash
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent --profile mcp-llm-ops-domain up -d llm-ops-api mcp-llm-ops
```

### Opção 4: MCPs auxiliares (sem APIs)

```bash
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent \
  --profile mcp-project-health-standalone \
  --profile mcp-secrets-standalone up -d
```

### Opção 5: Via Container Manager (ativação dinâmica)

```bash
# Subir apenas infra
docker compose --env-file .env.containers -p api-llm-embedded \
  --profile persistent up -d

# Depois ativar domínios sob demanda
curl -X POST http://localhost:3000/activate/users
# Inicia users-api (e seu MCP automático via profile demand)
```

## 📊 Resource Limits

Cada MCP foi otimizado para **ultra-low overhead**:

| Métrica | Limite | Reserva |
|---|---|---|
| CPU | 0.1 (100m) | 0.05 (50m) |
| Memória | 128M | 64M |
| Reinício | on-failure | |

**Total de 5 MCPs:**
- Máx: 640M memória, 0.5 CPU
- Mín (reserva): 320M memória, 0.25 CPU

## 🔧 Uso em Clientes MCP

### Claude Desktop (macOS/Windows)

**Arquivo**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "api-llm-embedded-users": {
      "command": "docker",
      "args": [
        "compose",
        "-p", "api-llm-embedded",
        "exec", "mcp-users",
        "node", "dist/main.js"
      ],
      "cwd": "/path/to/api-llm-embedded"
    },
    "api-llm-embedded-llm-ops": {
      "command": "docker",
      "args": [
        "compose",
        "-p", "api-llm-embedded",
        "exec", "mcp-llm-ops",
        "node", "dist/main.js"
      ],
      "cwd": "/path/to/api-llm-embedded"
    }
  }
}
```

### Cursor IDE

Configuração similar em `.cursor/mcp_config.json`

### Node.js SDK Direto

```javascript
import { spawn } from 'child_process';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { Client } from '@modelcontextprotocol/sdk/client/index';

const process = spawn('docker', [
  'compose', '-p', 'api-llm-embedded',
  'exec', 'mcp-users',
  'node', 'dist/main.js'
]);

const transport = new StdioClientTransport({ stdio: [process.stdin, process.stdout, process.stderr] });
const client = new Client({ name: 'my-client', version: '1.0' }, { capabilities: {} });

await client.connect(transport);
const tools = await client.listTools();
```

## 🔍 Verificar Status

```bash
# Ver todos os containers
docker compose -p api-llm-embedded ps

# Ver apenas MCPs
docker compose -p api-llm-embedded ps | grep mcp

# Logs de um MCP
docker compose -p api-llm-embedded logs -f mcp-users

# Resources em tempo real
docker stats api-llm-embedded-mcp-users --no-stream
```

## 🐛 Troubleshooting

### MCP não inicia
```bash
docker compose -p api-llm-embedded logs mcp-users
```

**Causas:**
- Dependência não healthy: aguarde 15-30s
- Erro de build: `docker compose build --no-cache mcp-users`

### Testar MCP via stdio
```bash
docker compose -p api-llm-embedded exec mcp-users sh << 'EOF'
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/main.js
EOF
```

### Memory/CPU alto
```bash
docker stats api-llm-embedded-mcp-* --no-stream
```

Se usar >128M, revisar código em `apps/svcia/mcp-*/src/`

## 📝 Build Customizado

```bash
# Reconstruir um MCP
docker compose -p api-llm-embedded build --no-cache mcp-users

# Build manual
docker build -f Dockerfile.mcp \
  -t api-llm-embedded-mcp-users:latest \
  apps/svcia/mcp-users
```

## 📋 Profiles Resumo

| Profile | Containers | Recursos | Uso |
|---|---|---|---|
| `persistent` | postgres, manager | 700MB | Infra mínima |
| `persistent` + `demand` | + all APIs + all MCPs | 2.5GB | Dev completo |
| `persistent` + `mcp-users-domain` | + users-api + mcp-users | 1.0GB | Users dev |
| `persistent` + `mcp-llm-ops-domain` | + llm-ops-api + mcp-llm-ops | 1.0GB | LLM dev |
| `persistent` + `mcp-sync-domain` | + sync-api + mcp-sync | 1.0GB | Sync dev |
| `persistent` + `mcp-secrets-standalone` | + mcp-secrets | 600MB | Secrets only |
| `persistent` + `mcp-project-health-standalone` | + mcp-project-health | 600MB | Health only |

Ver: [`docs/MCP_PROFILES_GUIDE.md`](MCP_PROFILES_GUIDE.md) para mais detalhes e combinações.

---

**Última Atualização**: 2026-04-29
**Status**: Production Ready (MCPs por demanda de domínio ✅)
