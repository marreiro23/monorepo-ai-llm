# Referência de Endpoints — Microsoft Entra ID & Graph API

> Documento técnico para desenvolvedores júnior a pleno.
> Cobre todos os endpoints da API que se comunicam com produtos Microsoft via Entra ID.

---

## Sumário

1. [Como funciona a autenticação](#como-funciona-a-autenticação)
2. [Permissões necessárias no Azure](#permissões-necessárias-no-azure)
3. [Formato padrão de resposta](#formato-padrão-de-resposta)
4. [Módulo Graph — Sites e Drives](#módulo-graph--sites-e-drives)
5. [Módulo Graph — Usuários M365](#módulo-graph--usuários-m365)
6. [Módulo Graph — Grupos](#módulo-graph--grupos)
7. [Módulo Graph — Microsoft Teams](#módulo-graph--microsoft-teams)
8. [Módulo Graph — Configuração e Status](#módulo-graph--configuração-e-status)
9. [Módulo Graph — Provisionamento](#módulo-graph--provisionamento)
10. [Módulo SharePoint — Drive Items](#módulo-sharepoint--drive-items)
11. [Módulo SharePoint — List Items](#módulo-sharepoint--list-items)
12. [Módulo Sync — Jobs e Dados Sincronizados](#módulo-sync--jobs-e-dados-sincronizados)
13. [Tabela de permissões por endpoint](#tabela-de-permissões-por-endpoint)

---

## Como funciona a autenticação

Todos os endpoints desta documentação precisam de um token do **Microsoft Entra ID** para funcionar. A API obtém esse token automaticamente — você não precisa gerenciá-lo.

### Fluxo interno

```
Sua request chega na API
         │
         ▼
PermissionValidationGuard (valida permissões internas)
         │
         ▼
GraphService / SharePointService
         │
         │ 1. Verifica se tem token em cache (válido por 45 min)
         │ 2. Se não, chama EntraRegistrationService.authenticate()
         ▼
EntraRegistrationService
         │
         │ Método 1 (preferido): Certificado X.509
         │ → ClientCertificateCredential(@azure/identity)
         │ → TENANT_ID + CLIENT_ID + CERT_PRIVATE_KEY_PATH + CERT_THUMBPRINT
         │
         │ Método 2 (fallback): Client Secret
         │ → ClientSecretCredential(@azure/identity)
         │ → TENANT_ID + CLIENT_ID + CLIENT_SECRET
         ▼
Microsoft Entra ID (login.microsoftonline.com)
         │ Retorna: Bearer token JWT (~60 min)
         ▼
EntraRegistrationService (armazena token em cache)
         │
         ▼
Microsoft Graph API (graph.microsoft.com/v1.0)
         │ Retorna: dados SharePoint, Teams, Users, etc.
         ▼
API responde ao seu cliente
```

### Variáveis de ambiente necessárias

```dotenv
TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx     # ID do tenant Azure
CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx     # ID da aplicação registrada

# Método 1 — Certificado (produção)
CERT_PRIVATE_KEY_PATH=./cert/seu-certificado.pem
CERT_THUMBPRINT=ABCDEF1234567890...

# Método 2 — Secret (desenvolvimento)
# CLIENT_SECRET=sua-secret-aqui

GRAPH_SCOPE=https://graph.microsoft.com/.default   # não alterar
```

### Cache de token

| Configuração | Valor |
|-------------|-------|
| Validade máxima | 60 minutos |
| Buffer de renovação | 2 minutos antes de expirar |
| Armazenamento | Em memória (reinicia com a API) |

---

## Permissões necessárias no Azure

Configure no portal Azure em **App Registrations → sua-app → API Permissions → Add permission → Microsoft Graph → Application permissions**.

| Permissão | Tipo | Usada por |
|-----------|------|-----------|
| `Sites.Read.All` | Application | GET sites, drives, libraries, permissions |
| `Sites.ReadWrite.All` | Application | POST/PATCH/DELETE em drives e list items |
| `Files.Read.All` | Application | GET drive items, files em Teams |
| `Files.ReadWrite.All` | Application | Upload, criação de pastas, delete de itens |
| `User.Read.All` | Application | GET usuários M365 |
| `Group.Read.All` | Application | GET grupos, membros, owners |
| `Group.ReadWrite.All` | Application | POST/DELETE grupos, membros, owners |
| `GroupMember.Read.All` | Application | GET membros de grupo |
| `GroupMember.ReadWrite.All` | Application | POST/DELETE membros de grupo |
| `Directory.Read.All` | Application | GET usuários, grupos, diretório |
| `Directory.ReadWrite.All` | Application | Provisionamento de grupos/teams |
| `Team.Read.All` | Application | GET teams, canais, membros |
| `Team.Create` | Application | Criar teams |
| `Team.ReadWrite.All` | Application | POST/DELETE membros de team |
| `Channel.Read.All` | Application | GET canais |
| `Channel.Create` | Application | Criar canais |
| `Channel.ReadWrite.All` | Application | Gerenciar membros de canal |
| `TeamMember.Read.All` | Application | GET membros de team/canal |
| `TeamMember.ReadWrite.All` | Application | POST/DELETE membros de team/canal |
| `ChatMessage.Read.All` | Application | GET mensagens de canal |
| `List.Read.All` | Application | GET list items SharePoint |
| `List.ReadWrite.All` | Application | POST/PATCH/DELETE list items |

> Após adicionar as permissões, clique em **Grant admin consent** para ativá-las.

---

## Formato padrão de resposta

Todos os endpoints retornam no mesmo formato:

**Sucesso:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Erro / Não encontrado:**
```json
{
  "success": false,
  "message": "Descrição do erro",
  "correlationId": "uuid-para-auditoria"
}
```

---

## Módulo Graph — Sites e Drives

Base URL interna: `/graph`
Graph API base: `https://graph.microsoft.com/v1.0`

---

### GET /graph/sites

Lista os sites SharePoint do tenant.

**Query parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| `search` | string | Não | Filtra por nome, URL ou descrição |
| `top` | string | Não | Número de resultados (máx 50, padrão 25) |

**Exemplo:**
```http
GET /graph/sites?search=vendas&top=10
X-API-Key: sua-chave
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "empresa.sharepoint.com,abc123,def456",
      "name": "vendas",
      "displayName": "Portal de Vendas",
      "webUrl": "https://empresa.sharepoint.com/sites/vendas"
    }
  ]
}
```

**Graph API chamada:** `GET /sites?$search="vendas"&$top=10`
**Permissões:** `Sites.Read.All`

---

### GET /graph/sites/:siteId

Retorna um site específico.

**Path parameters:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `siteId` | string | ID do site (formato: `hostname,siteId,webId`) |

**Exemplo:**
```http
GET /graph/sites/empresa.sharepoint.com,abc123,def456
X-API-Key: sua-chave
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "empresa.sharepoint.com,abc123,def456",
    "name": "vendas",
    "displayName": "Portal de Vendas",
    "webUrl": "https://empresa.sharepoint.com/sites/vendas"
  }
}
```

**Graph API chamada:** `GET /sites/{siteId}`
**Permissões:** `Sites.Read.All`

---

### GET /graph/sites/:siteId/drives

Lista os drives (bibliotecas de documentos) de um site.

**Exemplo:**
```http
GET /graph/sites/empresa.sharepoint.com,abc123,def456/drives
X-API-Key: sua-chave
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "b!abc123",
      "name": "Documents",
      "driveType": "documentLibrary",
      "webUrl": "https://empresa.sharepoint.com/sites/vendas/Shared%20Documents"
    }
  ]
}
```

**Graph API chamada:** `GET /sites/{siteId}/drives`
**Permissões:** `Sites.Read.All`, `Files.Read.All`

---

### GET /graph/sites/:siteId/permissions

Lista as permissões de um site.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "perm-id",
      "grantedToV2": {
        "user": { "displayName": "João Silva", "email": "joao@empresa.com" }
      },
      "roles": ["write"]
    }
  ]
}
```

**Graph API chamada:** `GET /sites/{siteId}/permissions`
**Permissões:** `Sites.Read.All`, `Directory.Read.All`

---

### GET /graph/sites/:siteId/libraries

Lista as bibliotecas de documentos (listas do tipo documentLibrary) de um site.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "list-id",
      "name": "Shared Documents",
      "displayName": "Documentos Compartilhados",
      "description": "",
      "webUrl": "https://empresa.sharepoint.com/sites/vendas/Shared%20Documents",
      "createdDateTime": "2026-01-01T00:00:00Z",
      "lastModifiedDateTime": "2026-04-01T10:00:00Z",
      "template": "documentLibrary",
      "drive": {
        "id": "b!abc123",
        "name": "Documentos Compartilhados",
        "driveType": "documentLibrary",
        "webUrl": "https://empresa.sharepoint.com/..."
      }
    }
  ]
}
```

**Graph API chamada:** `GET /sites/{siteId}/lists?$expand=drive`
**Permissões:** `Sites.Read.All`, `Files.Read.All`

---

### GET /graph/sites/:siteId/libraries/:listId

Retorna uma biblioteca específica com seu drive associado.

**Graph API chamada:** `GET /sites/{siteId}/lists/{listId}?$expand=drive`
**Permissões:** `Sites.Read.All`, `Files.Read.All`

---

### GET /graph/drives/:driveId/root/permissions

Lista as permissões na raiz de um drive.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "perm-id",
      "grantedToV2": {
        "user": { "displayName": "Maria Souza", "email": "maria@empresa.com" }
      },
      "roles": ["owner"],
      "inheritedFrom": null
    }
  ]
}
```

**Graph API chamada:** `GET /drives/{driveId}/root/permissions`
**Permissões:** `Files.Read.All`, `Sites.Read.All`

---

## Módulo Graph — Usuários M365

---

### GET /graph/users

Lista usuários do Microsoft 365.

**Query parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| `search` | string | Não | Busca por displayName, email ou UPN |
| `top` | string | Não | Máx 50, padrão 25 |

**Exemplo:**
```http
GET /graph/users?search=joao&top=5
X-API-Key: sua-chave
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-guid",
      "displayName": "João Silva",
      "mail": "joao.silva@empresa.com",
      "userPrincipalName": "joao.silva@empresa.onmicrosoft.com",
      "jobTitle": "Desenvolvedor",
      "accountEnabled": true
    }
  ]
}
```

**Graph API chamada:** `GET /users?$select=id,displayName,mail,userPrincipalName,jobTitle,accountEnabled`
**Permissões:** `User.Read.All`, `Directory.Read.All`

---

## Módulo Graph — Grupos

---

### GET /graph/groups

Lista grupos do Microsoft 365.

**Query parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| `search` | string | Não | Busca por displayName |
| `top` | string | Não | Máx 50, padrão 25 |

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "group-guid",
      "displayName": "Time de Vendas",
      "description": "Grupo do time comercial",
      "mail": "vendas@empresa.com",
      "mailNickname": "vendas",
      "visibility": "Private",
      "createdDateTime": "2026-01-15T10:00:00Z",
      "securityEnabled": false,
      "mailEnabled": true,
      "groupTypes": ["Unified"]
    }
  ]
}
```

**Graph API chamada:** `GET /groups?$select=...`
**Permissões:** `Group.Read.All`, `Directory.Read.All`

---

### GET /graph/groups/:groupId

Retorna um grupo específico.

**Graph API chamada:** `GET /groups/{groupId}`
**Permissões:** `Group.Read.All`, `Directory.Read.All`

---

### POST /graph/groups

Cria um novo grupo Microsoft 365.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `displayName` | string | Sim | Nome exibido do grupo |
| `mailNickname` | string | Sim | Alias de email (sem espaços) |
| `description` | string | Sim | Descrição do grupo |
| `visibility` | `'Public'` \| `'Private'` | Não | Padrão: `'Private'` |
| `mailEnabled` | boolean | Não | Padrão: `true` |
| `securityEnabled` | boolean | Não | Padrão: `false` |

**Exemplo:**
```http
POST /graph/groups
X-API-Key: sua-chave
Content-Type: application/json

{
  "displayName": "Projeto Alpha",
  "mailNickname": "projetoalpha",
  "description": "Grupo do projeto Alpha",
  "visibility": "Private"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "novo-group-guid",
    "displayName": "Projeto Alpha",
    "mailNickname": "projetoalpha",
    "visibility": "Private"
  }
}
```

**Graph API chamada:** `POST /groups` com `groupTypes: ['Unified']`
**Permissões:** `Group.ReadWrite.All`, `Directory.ReadWrite.All`

---

### GET /graph/groups/:groupId/members

Lista membros de um grupo.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-guid",
      "displayName": "Ana Lima",
      "mail": "ana@empresa.com",
      "userPrincipalName": "ana@empresa.onmicrosoft.com"
    }
  ]
}
```

**Graph API chamada:** `GET /groups/{groupId}/members`
**Permissões:** `Group.Read.All`, `GroupMember.Read.All`

---

### POST /graph/groups/:groupId/members

Adiciona um membro ao grupo.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `memberId` | string | Sim | ID do usuário a adicionar |

**Graph API chamada:** `POST /groups/{groupId}/members/$ref`
**Permissões:** `Group.ReadWrite.All`, `GroupMember.ReadWrite.All`

---

### DELETE /graph/groups/:groupId/members/:memberId

Remove um membro do grupo.

**Graph API chamada:** `DELETE /groups/{groupId}/members/{memberId}/$ref`
**Permissões:** `Group.ReadWrite.All`, `GroupMember.ReadWrite.All`

---

### GET /graph/groups/:groupId/owners

Lista owners (proprietários) de um grupo.

**Graph API chamada:** `GET /groups/{groupId}/owners`
**Permissões:** `Group.Read.All`, `Directory.Read.All`

---

### POST /graph/groups/:groupId/owners

Adiciona um owner ao grupo.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `ownerId` | string | Sim | ID do usuário a tornar owner |

**Graph API chamada:** `POST /groups/{groupId}/owners/$ref`
**Permissões:** `Group.ReadWrite.All`, `Directory.ReadWrite.All`

---

### DELETE /graph/groups/:groupId/owners/:ownerId

Remove um owner do grupo.

**Graph API chamada:** `DELETE /groups/{groupId}/owners/{ownerId}/$ref`
**Permissões:** `Group.ReadWrite.All`, `Directory.ReadWrite.All`

---

## Módulo Graph — Microsoft Teams

---

### GET /graph/teams

Lista os teams do tenant.

**Query parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| `search` | string | Não | Busca por displayName |
| `top` | string | Não | Máx 50, padrão 25 |

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "team-guid",
      "displayName": "Time de Engenharia",
      "description": "Canal técnico do time de eng",
      "visibility": "Private"
    }
  ]
}
```

**Graph API chamada:** `GET /teams?$select=id,displayName,description,visibility`
**Permissões:** `Team.Read.All`, `Directory.Read.All`

---

### GET /graph/teams/:teamId

Retorna um team específico.

**Graph API chamada:** `GET /teams/{teamId}`
**Permissões:** `Team.Read.All`

---

### GET /graph/teams/:teamId/members

Lista membros de um team.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "member-id",
      "displayName": "Carlos Pereira",
      "roles": ["owner"],
      "@odata.type": "#microsoft.graph.aadUserConversationMember"
    }
  ]
}
```

**Graph API chamada:** `GET /teams/{teamId}/members`
**Permissões:** `Team.Read.All`, `TeamMember.Read.All`

---

### POST /graph/teams/:teamId/members

Adiciona um membro ao team.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `userId` | string | Sim | ID do usuário |
| `roles` | string[] | Não | Ex: `['owner']`. Padrão: `[]` (membro) |

**Graph API chamada:** `POST /teams/{teamId}/members`
**Permissões:** `Team.ReadWrite.All`, `TeamMember.ReadWrite.All`

---

### DELETE /graph/teams/:teamId/members/:memberId

Remove um membro do team.

**Graph API chamada:** `DELETE /teams/{teamId}/members/{memberId}`
**Permissões:** `Team.ReadWrite.All`, `TeamMember.ReadWrite.All`

---

### GET /graph/teams/:teamId/channels

Lista os canais de um team.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "channel-id",
      "displayName": "General",
      "description": "Canal padrão",
      "membershipType": "standard",
      "webUrl": "https://teams.microsoft.com/...",
      "createdDateTime": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Graph API chamada:** `GET /teams/{teamId}/channels`
**Permissões:** `Team.Read.All`, `Channel.Read.All`

---

### POST /graph/teams/:teamId/channels

Cria um novo canal no team.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `displayName` | string | Sim | Nome do canal |
| `description` | string | Não | Descrição |
| `membershipType` | `'standard'` \| `'private'` \| `'shared'` | Não | Padrão: `'standard'` |

**Exemplo:**
```http
POST /graph/teams/team-guid/channels
X-API-Key: sua-chave
Content-Type: application/json

{
  "displayName": "Projeto Alpha",
  "description": "Canal do projeto Alpha",
  "membershipType": "private"
}
```

**Graph API chamada:** `POST /teams/{teamId}/channels`
**Permissões:** `Team.Create`, `Channel.Create`, `Team.ReadWrite.All`

---

### GET /graph/teams/:teamId/channels/:channelId

Retorna um canal específico.

**Graph API chamada:** `GET /teams/{teamId}/channels/{channelId}`
**Permissões:** `Team.Read.All`, `Channel.Read.All`

---

### GET /graph/teams/:teamId/channels/:channelId/members

Lista membros de um canal.

**Observação:** Canais do tipo `standard` herdam membros do team. Canais `private` e `shared` têm membros próprios.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "member-id",
      "displayName": "Fernanda Costa",
      "roles": [],
      "@odata.type": "#microsoft.graph.aadUserConversationMember"
    }
  ]
}
```

**Graph API chamada:** `GET /teams/{teamId}/channels/{channelId}/members`
**Permissões:** `Team.Read.All`, `TeamMember.Read.All`, `Channel.ReadWrite.All`

---

### POST /graph/teams/:teamId/channels/:channelId/members

Adiciona membro a um canal (apenas canais `private` ou `shared`).

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `userId` | string | Sim | ID do usuário |
| `roles` | string[] | Não | Ex: `['owner']`. Padrão: `[]` |

**Validação:** Retorna erro se o canal for do tipo `standard`.

**Graph API chamada:** `POST /teams/{teamId}/channels/{channelId}/members`
**Permissões:** `Team.ReadWrite.All`, `Channel.ReadWrite.All`, `TeamMember.ReadWrite.All`

---

### DELETE /graph/teams/:teamId/channels/:channelId/members/:memberId

Remove membro de um canal (apenas canais `private` ou `shared`).

**Graph API chamada:** `DELETE /teams/{teamId}/channels/{channelId}/members/{memberId}`
**Permissões:** `Team.ReadWrite.All`, `Channel.ReadWrite.All`, `TeamMember.ReadWrite.All`

---

### GET /graph/teams/:teamId/channels/:channelId/messages

Lista mensagens de um canal.

**Query parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| `top` | string | Não | Máx 50, padrão 25 |

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "message-id",
      "subject": "Reunião de sprint",
      "body": {
        "contentType": "text",
        "content": "Olá time, reunião amanhã às 10h."
      },
      "from": {
        "user": {
          "id": "user-guid",
          "displayName": "Roberto Alves"
        }
      },
      "createdDateTime": "2026-05-01T08:00:00Z"
    }
  ]
}
```

**Graph API chamada:** `GET /teams/{teamId}/channels/{channelId}/messages`
**Permissões:** `Team.Read.All`, `ChatMessage.Read.All`

---

### GET /graph/teams/:teamId/channels/:channelId/messages/:messageId/replies

Lista respostas a uma mensagem de canal.

**Query parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| `top` | string | Não | Máx 50, padrão 25 |

**Graph API chamada:** `GET /teams/{teamId}/channels/{channelId}/messages/{messageId}/replies`
**Permissões:** `Team.Read.All`, `ChatMessage.Read.All`

---

### GET /graph/teams/:teamId/channels/:channelId/files-folder

Retorna a pasta de arquivos de um canal no SharePoint.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "item-id",
    "parentReference": { "driveId": "b!abc123" },
    "name": "Projeto Alpha",
    "webUrl": "https://empresa.sharepoint.com/..."
  }
}
```

**Graph API chamada:** `GET /teams/{teamId}/channels/{channelId}/filesFolder`
**Permissões:** `Team.Read.All`, `Files.Read.All`

---

### GET /graph/teams/:teamId/channels/:channelId/files

Lista os arquivos de um canal (combina filesFolder + drive children).

**Graph API chamada:** `GET /teams/{teamId}/channels/{channelId}/filesFolder` + `GET /drives/{driveId}/items/{itemId}/children`
**Permissões:** `Team.Read.All`, `Files.Read.All`

---

### GET /graph/groups/:groupId/team

Retorna o team associado a um grupo.

**Graph API chamada:** `GET /groups/{groupId}/team`
**Permissões:** `Team.Read.All`, `Group.Read.All`

---

### PUT /graph/groups/:groupId/team

Cria um team a partir de um grupo existente (teamifica o grupo).

**Sem request body** — usa template padrão internamente.

**Graph API chamada:** `PUT /groups/{groupId}/team`
**Permissões:** `Team.Create`, `Group.ReadWrite.All`

---

## Módulo Graph — Configuração e Status

---

### GET /graph/config

Retorna a configuração atual do módulo Graph (sem expor secrets).

**Não requer Entra ID** — lê apenas variáveis de ambiente.

**Resposta:**
```json
{
  "success": true,
  "data": {
    "tenantIdConfigured": true,
    "clientIdConfigured": true,
    "certificatePathConfigured": true,
    "certificateThumbprintConfigured": true,
    "clientSecretConfigured": false,
    "authMethod": "client-certificate",
    "graphBaseUrl": "https://graph.microsoft.com/v1.0",
    "scope": "https://graph.microsoft.com/.default",
    "isAuthenticated": true,
    "lastAuthTime": "2026-05-01T10:00:00.000Z",
    "certificatePath": "./cert/certificado.pem",
    "certificateThumbprint": "ABC123..."
  }
}
```

**Valores de `authMethod`:**
- `client-certificate` — usando certificado (recomendado)
- `client-secret` — usando secret
- `not-authenticated` — nenhuma credencial configurada

---

### GET /graph/auth/status

Testa a autenticação com o Entra ID e retorna o status.

**Diferença do /graph/config:** Este endpoint realmente tenta obter um token.

**Resposta:** Mesmo formato do `/graph/config` com `isAuthenticated` atualizado.

---

## Módulo Graph — Provisionamento

---

### POST /graph/provisioning/team-site

Provisiona um grupo M365 + team em uma única operação.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `displayName` | string | Sim | Nome do grupo/team |
| `mailNickname` | string | Sim | Alias de email |
| `description` | string | Sim | Descrição |
| `visibility` | `'Public'` \| `'Private'` | Não | Padrão: `'Private'` |
| `ownerUserIds` | string[] | Não | IDs de usuários que serão owners |
| `memberUserIds` | string[] | Não | IDs de usuários que serão membros |

**Processo interno (sequencial):**
1. Cria grupo M365 (`POST /groups`)
2. Adiciona owners (1 segundo de delay entre cada)
3. Adiciona membros (1 segundo de delay entre cada)
4. Transforma em team (`PUT /groups/{groupId}/team`)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "group": {
      "id": "group-guid",
      "displayName": "Projeto Alpha",
      "mailNickname": "projetoalpha"
    },
    "team": {
      "id": "team-guid",
      "displayName": "Projeto Alpha"
    },
    "siteHint": "https://empresa.sharepoint.com/sites/projetoalpha"
  }
}
```

**Observação:** O site SharePoint associado ao team leva alguns minutos para ser provisionado pelo Microsoft após a criação.

**Permissões:** `Group.ReadWrite.All`, `Team.Create`, `Directory.ReadWrite.All`, `TeamMember.ReadWrite.All`

---

## Módulo SharePoint — Drive Items

Base URL: `/sharepoint`

---

### GET /sharepoint/drives/:driveId/items

Lista itens na raiz de um drive.

**Exemplo:**
```http
GET /sharepoint/drives/b!abc123xyz/items
X-API-Key: sua-chave
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "item-id",
      "name": "Proposta Comercial.docx",
      "size": 245120,
      "webUrl": "https://empresa.sharepoint.com/.../Proposta%20Comercial.docx",
      "parentReference": { "driveId": "b!abc123xyz" },
      "file": { "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      "folder": null
    },
    {
      "id": "folder-id",
      "name": "Contratos",
      "size": 0,
      "folder": { "childCount": 12 },
      "file": null
    }
  ]
}
```

**Graph API chamada:** `GET /drives/{driveId}/root/children`
**Permissões:** `Files.Read.All`, `Sites.Read.All`

---

### GET /sharepoint/drives/:driveId/items/:itemId

Retorna um item específico do drive.

**Graph API chamada:** `GET /drives/{driveId}/items/{itemId}`
**Permissões:** `Files.Read.All`

---

### GET /sharepoint/drives/:driveId/items/:itemId/children

Lista filhos de uma pasta.

**Graph API chamada:** `GET /drives/{driveId}/items/{itemId}/children`
**Permissões:** `Files.Read.All`

---

### GET /sharepoint/drives/:driveId/items/:itemId/permissions

Lista permissões de um item.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "perm-id",
      "grantedToV2": {
        "user": { "displayName": "João Silva", "email": "joao@empresa.com" }
      },
      "roles": ["write"],
      "inheritedFrom": null
    }
  ]
}
```

**Graph API chamada:** `GET /drives/{driveId}/items/{itemId}/permissions`
**Permissões:** `Files.Read.All`

---

### POST /sharepoint/drives/:driveId/items/:parentItemId/children

Cria uma pasta dentro de outra pasta.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `name` | string | Sim | Nome da pasta (não pode ser vazio) |

**Exemplo:**
```http
POST /sharepoint/drives/b!abc123/items/root/children
X-API-Key: sua-chave
Content-Type: application/json

{
  "name": "Contratos 2026"
}
```

**Graph API chamada:** `POST /drives/{driveId}/items/{parentItemId}/children`
**Permissões:** `Files.ReadWrite.All`, `Sites.ReadWrite.All`

---

### PUT /sharepoint/drives/:driveId/items/:parentItemId/:fileName

Faz upload de um arquivo.

**Path parameters:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `driveId` | string | ID do drive |
| `parentItemId` | string | ID da pasta de destino |
| `fileName` | string | Nome do arquivo (URL-encoded) |

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `content` | string | Sim | Conteúdo do arquivo em Base64 |
| `mimeType` | string | Não | MIME type. Padrão: `application/octet-stream` |

**Exemplo:**
```http
PUT /sharepoint/drives/b!abc123/items/folder-id/relatorio.pdf
X-API-Key: sua-chave
Content-Type: application/json

{
  "content": "JVBERi0xLjQK...",
  "mimeType": "application/pdf"
}
```

**Graph API chamada:** `PUT /drives/{driveId}/items/{parentItemId}:/{fileName}:/content`
**Permissões:** `Files.ReadWrite.All`, `Sites.ReadWrite.All`

---

### PATCH /sharepoint/drives/:driveId/items/:itemId

Renomeia ou move um item.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `name` | string | Não | Novo nome do item |
| `parentReference` | object | Não | Para mover: `{ "id": "nova-pasta-id" }` |

**Exemplo — renomear:**
```json
{ "name": "Contrato Revisado.docx" }
```

**Exemplo — mover:**
```json
{ "parentReference": { "id": "nova-pasta-id", "driveId": "b!abc123" } }
```

**Graph API chamada:** `PATCH /drives/{driveId}/items/{itemId}`
**Permissões:** `Files.ReadWrite.All`

---

### DELETE /sharepoint/drives/:driveId/items/:itemId

Remove um item do drive.

**Observação:** Se o item não existir (404), a API retorna `success: true` sem erro.

**Resposta:**
```json
{
  "success": true,
  "data": { "driveId": "b!abc123", "itemId": "item-id" }
}
```

**Graph API chamada:** `DELETE /drives/{driveId}/items/{itemId}`
**Permissões:** `Files.ReadWrite.All`

---

### POST /sharepoint/drives/:driveId/items/:itemId/invite

Compartilha um item com usuários externos ou internos.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `emails` | string[] | Sim | Lista de emails para compartilhar |
| `roles` | string[] | Sim | `['read']` ou `['write']` |
| `message` | string | Não | Mensagem do convite |

**Exemplo:**
```http
POST /sharepoint/drives/b!abc123/items/item-id/invite
X-API-Key: sua-chave
Content-Type: application/json

{
  "emails": ["parceiro@externo.com"],
  "roles": ["read"],
  "message": "Segue o documento para revisão."
}
```

**Graph API chamada:** `POST /drives/{driveId}/items/{itemId}/invite`
**Permissões:** `Files.ReadWrite.All`, `Sites.ReadWrite.All`

---

### DELETE /sharepoint/drives/:driveId/items/:itemId/permissions/:permissionId

Remove uma permissão específica de um item.

**Observação:** Se a permissão não existir (404), retorna `success: true`.

**Graph API chamada:** `DELETE /drives/{driveId}/items/{itemId}/permissions/{permissionId}`
**Permissões:** `Files.ReadWrite.All`

---

## Módulo SharePoint — List Items

---

### GET /sharepoint/sites/:siteId/lists/:listId/items

Lista itens de uma lista SharePoint com todos os campos expandidos.

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "fields": {
        "Title": "Item de exemplo",
        "Status": "Ativo",
        "DataCriacao": "2026-01-15"
      },
      "webUrl": "https://empresa.sharepoint.com/...",
      "createdDateTime": "2026-01-15T10:00:00Z",
      "lastModifiedDateTime": "2026-04-01T08:30:00Z"
    }
  ]
}
```

**Graph API chamada:** `GET /sites/{siteId}/lists/{listId}/items?$expand=fields`
**Permissões:** `Sites.Read.All`, `List.Read.All`

---

### GET /sharepoint/sites/:siteId/lists/:listId/items/:itemId

Retorna um item específico com campos expandidos.

**Graph API chamada:** `GET /sites/{siteId}/lists/{listId}/items/{itemId}?$expand=fields`
**Permissões:** `Sites.Read.All`, `List.Read.All`

---

### POST /sharepoint/sites/:siteId/lists/:listId/items

Cria um item em uma lista SharePoint.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `fields` | object | Sim | Campos da lista como chave-valor |

**Exemplo:**
```http
POST /sharepoint/sites/site-id/lists/list-id/items
X-API-Key: sua-chave
Content-Type: application/json

{
  "fields": {
    "Title": "Nova tarefa",
    "Status": "Pendente",
    "Responsavel": "joao@empresa.com"
  }
}
```

**Graph API chamada:** `POST /sites/{siteId}/lists/{listId}/items`
**Permissões:** `Sites.ReadWrite.All`, `List.ReadWrite.All`

---

### PATCH /sharepoint/sites/:siteId/lists/:listId/items/:itemId

Atualiza campos de um item.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `fields` | object | Sim | Campos a atualizar (parcial) |

**Exemplo:**
```json
{
  "fields": {
    "Status": "Concluído"
  }
}
```

**Graph API chamada:** `PATCH /sites/{siteId}/lists/{listId}/items/{itemId}/fields`
**Permissões:** `Sites.ReadWrite.All`, `List.ReadWrite.All`

---

### DELETE /sharepoint/sites/:siteId/lists/:listId/items/:itemId

Remove um item da lista.

**Observação:** 404 é tratado silenciosamente (retorna `success: true`).

**Graph API chamada:** `DELETE /sites/{siteId}/lists/{listId}/items/{itemId}`
**Permissões:** `Sites.ReadWrite.All`, `List.ReadWrite.All`

---

## Módulo Sync — Jobs e Dados Sincronizados

O módulo Sync persiste dados do Microsoft 365 no PostgreSQL local para consultas rápidas sem chamar o Graph a cada request.

---

### POST /sync/jobs

Dispara um job de sincronização.

**Request body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `type` | string | Sim | Tipo do job (ver tabela abaixo) |
| `context` | string | Condicional | Obrigatório para alguns tipos |

**Tipos disponíveis:**

| `type` | `context` | Sincroniza |
|--------|-----------|-----------|
| `sites` | — | Todos os sites SharePoint |
| `drives` | `siteId` | Drives de um site específico |
| `users` | — | Todos os usuários M365 |
| `groups` | — | Todos os grupos M365 |
| `teams` | — | Todos os teams |
| `team-channels` | `teamId` (opcional) | Canais de um team (ou todos recentes) |
| `team-channel-messages` | `teamId` ou `teamId:channelId` (opcional) | Mensagens de canais |
| `mailboxes` | — | Caixas de email |
| `onedrives` | `userId` (opcional) | OneDrives de usuários |

**Exemplo — sincronizar drives de um site:**
```http
POST /sync/jobs
X-API-Key: sua-chave
Content-Type: application/json

{
  "type": "drives",
  "context": "empresa.sharepoint.com,abc123,def456"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "job-uuid",
    "type": "drives",
    "status": "pending",
    "context": "empresa.sharepoint.com,abc123,def456",
    "createdAt": "2026-05-01T11:00:00.000Z"
  }
}
```

---

### GET /sync/jobs

Lista todos os jobs de sincronização (do mais recente para o mais antigo).

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "job-uuid",
      "type": "sites",
      "status": "completed",
      "itemCount": 42,
      "createdAt": "2026-05-01T10:00:00.000Z",
      "startedAt": "2026-05-01T10:00:01.000Z",
      "finishedAt": "2026-05-01T10:00:15.000Z"
    }
  ]
}
```

**Status possíveis:** `pending` | `running` | `completed` | `failed`

---

### GET /sync/jobs/:id

Retorna detalhes de um job específico incluindo `errorMessage` se falhou.

---

### GET /sync/sites

Retorna sites sincronizados do banco local (sem chamar o Graph).

---

### GET /sync/drives

Retorna drives sincronizados do banco local.

---

### GET /sync/users

Retorna usuários M365 sincronizados do banco local.

---

### GET /sync/groups

Retorna grupos sincronizados do banco local.

---

### GET /sync/teams

Retorna teams sincronizados do banco local.

---

### GET /sync/team-channels

Retorna canais sincronizados do banco local.

---

### GET /sync/team-channel-messages

Retorna mensagens sincronizadas do banco local (máximo 200, ordenadas da mais recente).

---

### GET /sync/mailboxes

Retorna caixas de email sincronizadas do banco local.

---

### GET /sync/onedrives

Retorna OneDrives sincronizados do banco local.

---

## Tabela de permissões por endpoint

Referência rápida de quais permissões do Azure configurar para cada grupo de endpoints.

| Grupo de endpoints | Permissões mínimas |
|-------------------|-------------------|
| GET sites, drives, libraries | `Sites.Read.All`, `Files.Read.All` |
| GET site permissions | `Sites.Read.All`, `Directory.Read.All` |
| GET drive item permissions | `Files.Read.All` |
| POST pasta, PUT arquivo | `Files.ReadWrite.All`, `Sites.ReadWrite.All` |
| DELETE item, PATCH item | `Files.ReadWrite.All` |
| POST/DELETE permissão de item | `Files.ReadWrite.All`, `Sites.ReadWrite.All` |
| GET/POST/PATCH/DELETE list items | `Sites.ReadWrite.All`, `List.ReadWrite.All` |
| GET usuários M365 | `User.Read.All`, `Directory.Read.All` |
| GET grupos | `Group.Read.All`, `Directory.Read.All` |
| POST grupo, POST/DELETE membros/owners | `Group.ReadWrite.All`, `Directory.ReadWrite.All` |
| GET teams, canais | `Team.Read.All`, `Channel.Read.All` |
| POST team, POST canal | `Team.Create`, `Channel.Create`, `Team.ReadWrite.All` |
| POST/DELETE membros de team/canal | `Team.ReadWrite.All`, `Channel.ReadWrite.All`, `TeamMember.ReadWrite.All` |
| GET mensagens de canal | `Team.Read.All`, `ChatMessage.Read.All` |
| POST provisionamento team-site | `Group.ReadWrite.All`, `Team.Create`, `Directory.ReadWrite.All` |
| Sync jobs (todos os tipos) | Depende do tipo (agrega todas as permissões acima) |

---

**Total de endpoints documentados:** 67
- Graph (sites/drives): 8 endpoints
- Graph (usuários): 1 endpoint
- Graph (grupos): 7 endpoints
- Graph (teams/canais): 16 endpoints
- Graph (config/status): 2 endpoints
- Graph (provisionamento): 1 endpoint
- SharePoint (drive items): 10 endpoints
- SharePoint (list items): 5 endpoints
- Sync (jobs): 3 endpoints
- Sync (dados): 9 endpoints

---

**Última atualização:** 2026-05-01
**Mantido por:** Time de desenvolvimento — Projeto MANDRAK
