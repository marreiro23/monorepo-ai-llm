# LLM Ops MCP

Servidor MCP de leitura para o dominio `llm-ops`.

## Tools

- `agents_list`: lista agentes por `GET /llm-ops/agents`.
- `prompts_list`: lista templates de prompt por `GET /llm-ops/prompt-templates`.
- `topic_flows_list`: lista topic flows por `GET /llm-ops/topic-flows`.
- `ask_and_answer`: chama `POST /llm-ops/chat` para consulta RAG/chat auditada.

## Configuracao

```powershell
$env:LLM_OPS_API_URL="http://localhost:3002"
npm run -w apps/svcia/mcp-llm-ops build
npm run -w apps/svcia/mcp-llm-ops start
```

## Cliente MCP

Use `config/mcp/shp-local-mcp.example.json` como base para registrar este servidor em um cliente MCP local.

O caminho recomendado para RAG e:

```text
MCP client -> mcp-llm-ops -> llm-ops-api -> AstraDB -> Langflow
```

Neste modo, o MCP nao recebe token da AstraDB. A API `llm-ops` recupera contexto na collection `knowledge_base` e envia esse contexto ao flow Langflow configurado em `LANGFLOW_RAG_FLOW_ID`.

## Flow Langflow

O export `src/rag-langflow/Rag Loading.json` esta configurado como flow `context-only`:

```text
Chat Input -> Agent
```

Nao use componente `Knowledge Base` do Langflow nesse flow. A base de conhecimento oficial para o chat da aplicacao e a AstraDB acessada pela API.

Este servidor nao cria, altera, aprova ou remove artefatos `llm-ops`. Mutacoes futuras devem passar por dry-run, aprovacao, auditoria e rollback.
