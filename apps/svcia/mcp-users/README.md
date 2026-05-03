# Users MCP

Servidor MCP somente leitura para o dominio `users`.

## Tools

- `users_list`: lista usuarios retornados por `GET /users`.
- `users_get`: busca um usuario por id via `GET /users/:id`.
- `users_search`: filtra localmente por nome ou email usando os dados de `GET /users`.

## Configuracao

```powershell
$env:USERS_API_URL="http://localhost:3001"
npm run -w apps/svcia/mcp-users build
npm run -w apps/svcia/mcp-users start
```

O servidor nao implementa criacao, atualizacao ou remocao. Mutacoes futuras devem passar por dry-run, auditoria e rollback.
