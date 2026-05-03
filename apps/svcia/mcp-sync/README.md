# MCP Sync

Servidor MCP somente leitura para consultar o modulo `sync` da API.

## Ferramentas

- `sync_jobs_list`: consulta `GET /sync/jobs`.
- `sync_status`: resume os jobs retornados por `GET /sync/jobs`.
- `sync_sites_list`: consulta `GET /sync/sites`.
- `sync_users_list`: consulta `GET /sync/users`.

Este servidor nao dispara sincronizacao e nao chama `POST /sync/jobs`.

## Execucao

```powershell
npm run mcp:sync:build
npm run mcp:sync:start
```

Por padrao, o servidor usa `SYNC_API_URL=http://localhost:3001`.
