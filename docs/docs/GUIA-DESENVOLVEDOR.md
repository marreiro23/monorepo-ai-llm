# Guia do Desenvolvedor — Endpoints e Autenticação

> Público-alvo: desenvolvedor júnior a pleno que precisa entender e operar a API.

---

## Sumário

1. [Como a API funciona](#como-a-api-funciona)
2. [Autenticação — API Key](#autenticação--api-key)
3. [Autenticação — Microsoft Entra ID](#autenticação--microsoft-entra-id)
4. [Endpoints por domínio](#endpoints-por-domínio)
   - [Health](#health)
   - [Users](#users)
   - [LLM Ops](#llm-ops)
   - [SharePoint](#sharepoint)
   - [Graph](#graph)
   - [Sync](#sync)
   - [Audit](#audit)
   - [Admin](#admin)
5. [Como testar os endpoints](#como-testar-os-endpoints)
6. [Erros comuns](#erros-comuns)

---

## Como a API funciona

A API é uma aplicação NestJS **monolítica** — todos os domínios (users, sharepoint, llm-ops, sync) rodam no mesmo processo na **porta 3000**.

```
Cliente (browser, curl, MCP)
         │
         ▼
    PORT 3000
         │
    PermissionValidationGuard  ← verifica permissões em TODOS os requests
         │
    ┌────┴────────────────────────┐
    │         AppModule           │
    │  ┌─────────────────────┐   │
    │  │ UsersModule         │   │
    │  │ LlmOpsModule        │   │
    │  │ SharePointModule    │   │
    │  │ SyncModule          │   │
    │  │ GraphModule         │   │
    │  │ AuditModule         │   │
    │  └─────────────────────┘   │
    └────────────────────────────┘
         │
    PostgreSQL (porta 5432)
    ├── schema: public   (users, sync, audit)
    └── schema: llm_ops  (agentes, prompts, topic flows)
```

O Swagger com todos os endpoints disponíveis está em: `http://localhost:3000/api/docs`

---

## Autenticação — API Key

Usada para endpoints internos, administrativos e de teste.

### Como funciona

1. Você gera uma chave com `openssl rand -hex 32`
2. Coloca no `.env` como `API_KEY_SECRET=sua-chave`
3. Envia no header de cada request

### Como usar

```http
GET /users HTTP/1.1
Host: localhost:3000
X-API-Key: sua-chave-aqui
```

Também funciona via:
- Query param: `GET /users?apiKey=sua-chave`
- Cookie: `api_key=sua-chave`

### Como identificar endpoints que exigem API Key

No código, procure o decorator `@RequireApiKey()` no controller:

```typescript
@Get()
@RequireApiKey()
findAll() { ... }
```

### Erro quando a chave está errada

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## Autenticação — Microsoft Entra ID

Usada para todas as operações que chamam o Microsoft Graph API (SharePoint, usuários M365, etc).

### O que é o Microsoft Entra ID

É o sistema de identidade da Microsoft (antes chamado Azure AD). Quando a API precisa acessar dados do SharePoint ou M365, ela precisa se autenticar primeiro com o Entra ID e obter um **token de acesso**.

### Fluxo de autenticação

```
API NestJS
    │
    │ 1. Envia credenciais (certificado ou client secret)
    ▼
Microsoft Entra ID
(login.microsoftonline.com)
    │
    │ 2. Retorna token Bearer (JWT, válido por ~60 min)
    ▼
API NestJS
    │
    │ 3. Usa o token em cada chamada Graph
    ▼
Microsoft Graph API
(graph.microsoft.com)
    │
    │ 4. Retorna dados do SharePoint/M365
    ▼
API NestJS → responde ao cliente
```

### Variáveis de ambiente necessárias

```dotenv
# Identifica sua aplicação no Azure
TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Método 1: Certificado (mais seguro, recomendado para produção)
CERT_PRIVATE_KEY_PATH=./cert/seu-certificado.pem
CERT_THUMBPRINT=ABC123...

# Método 2: Client Secret (mais simples, para desenvolvimento)
# CLIENT_SECRET=sua-secret-aqui

# Escopo de acesso ao Graph (não mude isso)
GRAPH_SCOPE=https://graph.microsoft.com/.default
```

### Como obter essas credenciais

1. Acesse o [portal Azure](https://portal.azure.com)
2. Vá em **Microsoft Entra ID → App registrations**
3. Selecione (ou crie) sua aplicação
4. **Tenant ID**: está na tela Overview da app registration
5. **Client ID**: também na tela Overview
6. **Certificado**: em **Certificates & secrets → Upload certificate**

### Gerenciamento de token

A API gerencia o token automaticamente:
- Token fica em cache por até 45 minutos
- Renovado automaticamente 2 minutos antes de expirar
- Você não precisa fazer nada — é transparente

### Permissões necessárias no Azure

A aplicação precisa das seguintes permissões no Entra ID:

| Permissão | Tipo | Para que serve |
|-----------|------|----------------|
| `User.Read.All` | Application | Listar usuários M365 |
| `Sites.ReadWrite.All` | Application | Ler/escrever SharePoint |
| `Files.ReadWrite.All` | Application | Gerenciar arquivos |
| `Group.Read.All` | Application | Listar grupos |
| `Directory.Read.All` | Application | Leitura de diretório |

---

## Endpoints por domínio

### Health

Verificação de saúde da API. Não requer autenticação.

```http
GET /health
```

**Resposta:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-01T11:00:00.000Z"
}
```

---

### Users

Gerenciamento de usuários da plataforma.

**Base URL:** `/users`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/users` | Lista todos os usuários |
| GET | `/users/:id` | Busca usuário por ID |
| POST | `/users` | Cria novo usuário |
| PATCH | `/users/:id` | Atualiza usuário |
| DELETE | `/users/:id` | Remove usuário |

**Exemplo — listar usuários:**
```http
GET /users HTTP/1.1
Host: localhost:3000
X-API-Key: sua-chave
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "uuid-aqui",
      "email": "usuario@empresa.com",
      "name": "Nome Completo",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

**Exemplo — criar usuário:**
```http
POST /users HTTP/1.1
Host: localhost:3000
X-API-Key: sua-chave
Content-Type: application/json

{
  "email": "novo@empresa.com",
  "name": "Novo Usuário"
}
```

---

### LLM Ops

Gerenciamento de agentes de IA, prompts e fluxos de conversação.

**Base URL:** `/llm-ops`

#### Agentes

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/llm-ops/agents` | Lista agentes |
| POST | `/llm-ops/agents` | Cria agente |

#### Prompt Templates

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/llm-ops/prompt-templates` | Lista templates |
| POST | `/llm-ops/prompt-templates` | Cria template |

#### Prompt Versions

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/llm-ops/prompt-versions` | Lista versões |
| POST | `/llm-ops/prompt-versions` | Cria versão |
| PATCH | `/llm-ops/prompt-versions/:id/status` | Atualiza status (DRAFT/APPROVED/DEPRECATED) |

#### Topic Flows

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/llm-ops/topic-flows` | Lista fluxos |
| POST | `/llm-ops/topic-flows` | Cria fluxo |
| GET | `/llm-ops/topic-flow-versions` | Lista versões |
| POST | `/llm-ops/topic-flow-versions` | Cria versão |

#### RAG — Perguntas e Respostas

```http
POST /llm-ops/chat
Content-Type: application/json
X-API-Key: sua-chave

{
  "question": "O que é o projeto Mandrak?",
  "context": "opcional"
}
```

**Resposta:**
```json
{
  "answer": "O projeto Mandrak é...",
  "sources": ["documento1.pdf", "documento2.md"],
  "confidence": 0.92
}
```

#### Catálogo de recursos

```http
GET /llm-ops/resources/catalog
```

---

### SharePoint

Operações em drives e itens do SharePoint via Microsoft Graph.

> Requer Entra ID configurado (TENANT_ID, CLIENT_ID, certificado ou secret).

**Base URL:** `/sharepoint`

#### Drive Items

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/sharepoint/drives/:driveId/items` | Lista itens do drive |
| GET | `/sharepoint/drives/:driveId/items/:itemId` | Busca item por ID |
| GET | `/sharepoint/drives/:driveId/items/:itemId/children` | Lista filhos de um item |
| POST | `/sharepoint/drives/:driveId/items/:parentId/children` | Cria pasta |
| PUT | `/sharepoint/drives/:driveId/items/:parentId/:fileName` | Upload de arquivo |
| PATCH | `/sharepoint/drives/:driveId/items/:itemId` | Atualiza metadados |
| DELETE | `/sharepoint/drives/:driveId/items/:itemId` | Remove item |

**Exemplo — listar itens de um drive:**
```http
GET /sharepoint/drives/b!abc123/items
X-API-Key: sua-chave
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "item-id",
      "name": "Documento.docx",
      "size": 12345,
      "webUrl": "https://empresa.sharepoint.com/...",
      "lastModifiedDateTime": "2026-04-01T10:00:00Z"
    }
  ]
}
```

#### Permissões de itens

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/sharepoint/drives/:driveId/items/:itemId/permissions` | Lista permissões |
| POST | `/sharepoint/drives/:driveId/items/:itemId/invite` | Compartilha item |
| DELETE | `/sharepoint/drives/:driveId/items/:itemId/permissions/:permId` | Remove permissão |

#### List Items (SharePoint Lists)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/sharepoint/sites/:siteId/lists/:listId/items` | Lista itens |
| GET | `/sharepoint/sites/:siteId/lists/:listId/items/:itemId` | Busca item |
| POST | `/sharepoint/sites/:siteId/lists/:listId/items` | Cria item |
| PATCH | `/sharepoint/sites/:siteId/lists/:listId/items/:itemId` | Atualiza |
| DELETE | `/sharepoint/sites/:siteId/lists/:listId/items/:itemId` | Remove |

---

### Graph

Acesso direto ao Microsoft Graph para operações M365.

> Requer Entra ID configurado.

**Base URL:** `/graph`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/graph/users` | Lista usuários M365 |
| GET | `/graph/users/:id` | Busca usuário M365 |
| GET | `/graph/sites` | Lista sites SharePoint |
| GET | `/graph/drives` | Lista drives disponíveis |

---

### Sync

Monitoramento e controle de sincronização M365.

**Base URL:** `/sync`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/sync/jobs` | Lista jobs de sync |
| GET | `/sync/status` | Status geral da sync |
| POST | `/sync/trigger` | Dispara sync manual |

---

### Audit

Logs de auditoria de todas as operações.

**Base URL:** `/audit`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/audit/logs` | Lista logs de auditoria |
| GET | `/audit/logs/:id` | Detalhe de um log |
| DELETE | `/audit/logs` | Limpa logs antigos (admin) |

---

### Admin

Operações administrativas internas.

**Base URL:** `/admin`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/status` | Status interno do sistema |

---

## Como testar os endpoints

### Opção 1 — Swagger UI (mais fácil)

Acesse `http://localhost:3000/api/docs` com a API rodando.

1. Clique em **Authorize** (canto superior direito)
2. No campo `api_key`, cole sua API Key
3. Clique em qualquer endpoint → **Try it out** → **Execute**

### Opção 2 — curl

```bash
# Health check (sem auth)
curl http://localhost:3000/health

# Com API Key
curl -H "X-API-Key: sua-chave" http://localhost:3000/users

# POST com body
curl -X POST http://localhost:3000/users \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@empresa.com","name":"Teste"}'
```

### Opção 3 — arquivo client.rest

O projeto tem um arquivo `client.rest` na raiz com exemplos prontos. Use com a extensão **REST Client** do VS Code.

---

## Erros comuns

| Código | Mensagem | Causa | Solução |
|--------|----------|-------|---------|
| `401` | `Unauthorized` | API Key inválida ou ausente | Verificar header `X-API-Key` |
| `403` | `Forbidden` | Sem permissão para o endpoint | Verificar permissões no `.env` |
| `404` | `Not Found` | Recurso não existe | Verificar ID/rota |
| `422` | `Unprocessable Entity` | Body inválido | Verificar campos obrigatórios |
| `500` | `Internal Server Error` | Erro inesperado | Ver logs da API |
| `503` | `Service Unavailable` | Banco ou Graph fora | Verificar PostgreSQL e Entra ID |

### Erro de autenticação Entra ID

Se as chamadas Graph retornam `401`, verifique:

```bash
# Checar se as variáveis estão no .env
grep TENANT_ID .env
grep CLIENT_ID .env
grep CERT_THUMBPRINT .env

# Checar se o certificado existe
ls -la cert/
```

### Erro de banco de dados

```bash
# Verificar se o postgres está saudável
docker compose ps

# Ver logs do postgres
docker compose logs postgres

# Testar conexão manualmente
docker exec -it api-llm-embedded-postgres psql -U postgres -c "\l"
```

---

## Convenções de código

Ao adicionar um endpoint novo, siga estas regras:

**Nomes de arquivo:**
- `kebab-case` com sufixo correto: `users.controller.ts`, `users.service.ts`

**Decorators obrigatórios em todo controller:**
```typescript
@ApiTags('users')                    // agrupa no Swagger
@Controller('users')
export class UsersController {

  @Get()
  @ApiOperation({ summary: 'Lista usuários' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  findAll() { ... }
}
```

**Contratos:**
- Sempre definir request/response em `packages/shared/src/contracts/{dominio}/`
- Nunca criar tipos locais em `apps/api` que são compartilhados

**Antes de commitar:**
```bash
npm run -ws --if-present build   # deve compilar sem erros
```

---

**Última atualização:** 2026-05-01
**Mantido por:** Time de desenvolvimento — Projeto MANDRAK
