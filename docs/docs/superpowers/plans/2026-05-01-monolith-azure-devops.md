# Monolith + Azure DevOps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o projeto de arquitetura multi-container em aplicação NestJS monolítica, mantendo apenas PostgreSQL e LangFlow em Docker, e integrar com Azure DevOps (Azure Repos + pipeline CI).

**Architecture:** O `AppModule` já importa todos os domínios — o app já é monolítico por design. A mudança remove os serviços de API do `docker-compose.yml`, adiciona dependências explícitas que estavam implícitas, e cria o `azure-pipelines.yml` para CI no Azure DevOps.

**Tech Stack:** NestJS 11, TypeScript 7 (tsgo), PostgreSQL 16 (Docker), Azure DevOps Pipelines, npm workspaces

**Azure DevOps:** `https://dev.azure.com/OKTA7Technologies/Projeto_MANDRAK/_git/AcessSharepoint`

---

## Task 1: Git Checkpoint em master + criar branch dev

**Files:**
- Nenhum arquivo modificado — apenas git ops

- [ ] **Step 1: Fazer o commit inicial (checkpoint) em master**

```powershell
cd c:\workdir\api-llm-embedded

git init
git add `
  .gitignore `
  .agents/ `
  .claude/ `
  .vscode/ `
  AGENTS.md `
  CLAUDE.md `
  README.md `
  START_HERE.md `
  apps/ `
  cagent.example.yaml `
  client.rest `
  clients/ `
  config/ `
  cspell.json `
  datasets/ `
  docker-compose.yml `
  docs/ `
  package-lock.json `
  package.json `
  packages/ `
  scripts/ `
  tests/ `
  tools/ `
  tsconfig.base.json

git commit -m "chore: checkpoint master - TypeScript 7 + NestJS monolith + Docker infra ready"
```

Resultado esperado: `[master (root-commit) xxxxxxx] chore: checkpoint master ...`

- [ ] **Step 2: Criar e entrar na branch dev**

```powershell
git checkout -b dev
```

Resultado esperado: `Switched to a new branch 'dev'`

- [ ] **Step 3: Verificar que estamos em dev**

```powershell
git branch
```

Resultado esperado:
```
* dev
  master
```

---

## Task 2: Adicionar `dotenv` como dependência explícita

**Files:**
- Modify: `apps/api/package.json`

**Contexto:** `dotenv` era resolvido como dependência transitiva (hoisteada). Isso quebra em installs isolados como o Docker build. Precisa ser declarado explicitamente.

- [ ] **Step 1: Verificar versão atualmente hoisteada**

```powershell
node -e "console.log(require('./node_modules/dotenv/package.json').version)"
```

Resultado esperado: algo como `16.x.x` ou `17.x.x`

- [ ] **Step 2: Adicionar dotenv às dependencies de apps/api**

Editar `apps/api/package.json` — adicionar `"dotenv"` em `dependencies` (logo após `"class-validator"`):

```json
{
  "dependencies": {
    "@api-llm-embedded/shared": "*",
    "@azure/identity": "^4.13.1",
    "@datastax/astra-db-ts": "^2.2.1",
    "@nestjs/common": "^11.1.19",
    "@nestjs/config": "^4.0.4",
    "@nestjs/core": "^11.1.19",
    "@nestjs/event-emitter": "^3.0.1",
    "@nestjs/platform-express": "^11.1.19",
    "@nestjs/swagger": "^11.4.2",
    "@nestjs/typeorm": "^11.0.1",
    "axios": "^1.15.2",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "dotenv": "^16.5.0",
    "express": "^5.2.1",
    "pg": "^8.20.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "tslib": "^2.8.1",
    "typeorm": "^0.3.28"
  }
}
```

Nota: `"express": "^5.2.1"` também foi adicionado (C2 do code review).

- [ ] **Step 3: Verificar que o install não quebra**

```powershell
npm install
```

Resultado esperado: sem erros, `package-lock.json` atualizado.

- [ ] **Step 4: Commitar**

```powershell
git add apps/api/package.json package-lock.json
git commit -m "fix: declare dotenv and express as explicit dependencies in apps/api"
```

---

## Task 3: Simplificar docker-compose.yml — remover serviços de API

**Files:**
- Modify: `docker-compose.yml`

**O que remover:** `container-manager`, `users-api`, `llm-ops-api`, `sharepoint-api`, `sync-api`

**O que manter:** `postgres` (sempre ativo, sem profile) e `langflow` (profile `langflow`, opcional)

- [ ] **Step 1: Substituir o docker-compose.yml pelo conteúdo simplificado**

Reescrever `docker-compose.yml` com o seguinte conteúdo:

```yaml
# Docker Compose — API LLM Embedded (monolith mode)
#
# A API NestJS roda localmente (npm run dev).
# Este compose gerencia apenas infraestrutura de suporte.
#
# Uso:
#   docker compose --env-file .env.containers up -d postgres
#   docker compose --env-file .env.containers --profile langflow up -d langflow
#   docker compose down

services:
  postgres:
    image: postgres:16-alpine
    container_name: api-llm-embedded-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-api_llm_embedded}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-api_llm_embedded}']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  langflow:
    image: langflowai/langflow:1.3.4
    container_name: api-llm-embedded-langflow
    restart: on-failure
    profiles:
      - langflow
    environment:
      - LANGFLOW_DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/${LANGFLOW_DATABASE:-shp_langflow}
      - LANGFLOW_CONFIG_DIR=/app/langflow_config
      - LANGFLOW_PORT=7860
    ports:
      - '7860:7860'
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - langflow-data:/app/langflow_config
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:7860/health']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  postgres-data:
    driver: local
  langflow-data:
    driver: local
```

- [ ] **Step 2: Validar sintaxe do compose**

```powershell
docker compose --env-file .env.containers config --quiet 2>&1
```

Se `.env.containers` não existir ainda (próxima task), criar temporariamente:
```powershell
"POSTGRES_USER=postgres`nPOSTGRES_PASSWORD=postgres`nPOSTGRES_DB=api_llm_embedded`nLANGFLOW_DATABASE=shp_langflow" | Out-File -FilePath .env.containers -Encoding utf8
docker compose --env-file .env.containers config --quiet
```

Resultado esperado: sem erros (apenas warnings opcionais são OK).

- [ ] **Step 3: Verificar que apenas 2 serviços existem**

```powershell
docker compose --env-file .env.containers config --services
```

Resultado esperado:
```
langflow
postgres
```

- [ ] **Step 4: Commitar**

```powershell
git add docker-compose.yml
git commit -m "refactor: simplify docker-compose to infra-only (postgres + langflow), remove domain API containers"
```

---

## Task 4: Criar arquivos de exemplo de variáveis de ambiente

**Files:**
- Create: `.env.example`
- Create: `.env.containers.example`

- [ ] **Step 1: Criar `.env.example` para desenvolvimento local**

Criar arquivo `.env.example` na raiz com:

```dotenv
# ============================================================
# API LLM Embedded — Variáveis de ambiente para dev local
# Copie para .env e preencha os valores
# ============================================================

# Server
PORT=3000
NODE_ENV=development

# ---- PostgreSQL — conexão principal (schema: public) ----
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=api_llm_embedded
PG_USER=postgres
PG_PASSWORD=change-me
PG_SCHEMA=public

# ---- PostgreSQL — conexão LLM Ops (schema: llm_ops) ----
LLM_PG_HOST=localhost
LLM_PG_PORT=5432
LLM_PG_DATABASE=api_llm_embedded
LLM_PG_USER=postgres
LLM_PG_PASSWORD=change-me
LLM_PG_SCHEMA=llm_ops
LLM_PG_SSL=false

# ---- Microsoft Entra ID (obrigatório para Graph/SharePoint) ----
TENANT_ID=your-tenant-id
CLIENT_ID=your-client-id
CERT_THUMBPRINT=your-cert-thumbprint
CERT_PRIVATE_KEY_PATH=./cert/your-cert.pem
PRIMARY_DOMAIN=your-domain.onmicrosoft.com
GRAPH_SCOPE=https://graph.microsoft.com/.default

# ---- Segurança da API ----
# gerar com: openssl rand -hex 32
API_KEY_SECRET=change-me-use-openssl-rand-hex-32

# ---- LangFlow (opcional — RAG pipeline) ----
LANGFLOW_ENABLED=false
LANGFLOW_URL=http://localhost:7860
LANGFLOW_RAG_FLOW_ID=f81c0124-ffc2-4458-b30d-4d588d393518
# LANGFLOW_API_KEY=
# LANGFLOW_SVCACT_KEY=

# ---- AstraDB (opcional — vector search) ----
ASTRA_DB_ENABLED=false
# ASTRA_DB_API_ENDPOINT=https://xxx.apps.astra.datastax.com
# ASTRA_DB_APPLICATION_TOKEN=AstraCS:xxx
ASTRA_DB_KEYSPACE=llm_ops
ASTRA_COLLECTION_KNOWLEDGE_BASE=knowledge_base
ASTRA_COLLECTION_INTERACTIONS=interactions
```

- [ ] **Step 2: Criar `.env.containers.example` para o Docker Compose**

Criar arquivo `.env.containers.example` na raiz com:

```dotenv
# ============================================================
# API LLM Embedded — Variáveis para Docker Compose
# Copie para .env.containers (gitignored) e preencha
# ============================================================

# PostgreSQL container
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me
POSTGRES_DB=api_llm_embedded

# LangFlow container (usado com --profile langflow)
LANGFLOW_DATABASE=shp_langflow
```

- [ ] **Step 3: Verificar que .gitignore já ignora os arquivos corretos**

```powershell
Select-String -Path .gitignore -Pattern "\.env"
```

Resultado esperado: linhas com `.env`, `.env.local`, `.env.*.local`, `.env.containers` (sem o `.example`).

- [ ] **Step 4: Commitar**

```powershell
git add .env.example .env.containers.example
git commit -m "docs: add .env.example and .env.containers.example with all required variables"
```

---

## Task 5: Criar azure-pipelines.yml

**Files:**
- Create: `azure-pipelines.yml`

**Objetivo:** Pipeline CI que roda em toda push para `dev` e `master`. Faz install, build de todos os workspaces e testes.

- [ ] **Step 1: Criar `azure-pipelines.yml` na raiz**

```yaml
# Azure Pipelines — API LLM Embedded
# CI rodado em push para dev e master

trigger:
  branches:
    include:
      - master
      - dev

pr:
  branches:
    include:
      - master
      - dev

pool:
  vmImage: ubuntu-latest

variables:
  NODE_VERSION: '22.x'

stages:
  - stage: CI
    displayName: 'Build & Validate'
    jobs:
      - job: Build
        displayName: 'Install, Build & Test'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(NODE_VERSION)
            displayName: 'Use Node.js $(NODE_VERSION)'

          - script: npm ci
            displayName: 'Install dependencies (npm ci)'

          - script: npm run -ws --if-present build
            displayName: 'Build all workspaces (tsgo)'

          - script: npm test
            displayName: 'Run tests'
            continueOnError: true
            env:
              CI: true
```

- [ ] **Step 2: Verificar que o YAML é válido (lint básico)**

```powershell
node -e "
const fs = require('fs');
const content = fs.readFileSync('azure-pipelines.yml', 'utf8');
console.log('Lines:', content.split('\n').length);
console.log('Has trigger:', content.includes('trigger:'));
console.log('Has pool:', content.includes('pool:'));
console.log('Has npm ci:', content.includes('npm ci'));
console.log('OK');
"
```

Resultado esperado: todas as linhas `true` + `OK`.

- [ ] **Step 3: Commitar**

```powershell
git add azure-pipelines.yml
git commit -m "ci: add azure-pipelines.yml with build and test stages for dev and master branches"
```

---

## Task 6: Configurar Azure Repos como remote e fazer push

**Files:**
- Nenhum arquivo — apenas git ops

**Remote:** `https://dev.azure.com/OKTA7Technologies/Projeto_MANDRAK/_git/AcessSharepoint`

- [ ] **Step 1: Adicionar o remote origin**

```powershell
git remote add origin https://dev.azure.com/OKTA7Technologies/Projeto_MANDRAK/_git/AcessSharepoint
```

- [ ] **Step 2: Verificar o remote**

```powershell
git remote -v
```

Resultado esperado:
```
origin  https://dev.azure.com/OKTA7Technologies/Projeto_MANDRAK/_git/AcessSharepoint (fetch)
origin  https://dev.azure.com/OKTA7Technologies/Projeto_MANDRAK/_git/AcessSharepoint (push)
```

- [ ] **Step 3: Push da branch master**

```powershell
git push -u origin master
```

Resultado esperado: `Branch 'master' set up to track remote branch 'master' from 'origin'.`

- [ ] **Step 4: Push da branch dev**

```powershell
git push -u origin dev
```

Resultado esperado: `Branch 'dev' set up to track remote branch 'dev' from 'origin'.`

- [ ] **Step 5: Verificar no Azure DevOps**

Abrir no browser: `https://dev.azure.com/OKTA7Technologies/Projeto_MANDRAK/_git/AcessSharepoint`

Verificar:
- Branches `master` e `dev` aparecem
- O arquivo `azure-pipelines.yml` está visível
- O pipeline foi detectado automaticamente (Azure DevOps detecta o arquivo na raiz)

---

## Checklist de Validação Final

Após completar todas as tasks:

- [ ] `git log --oneline` mostra commits organizados em `dev`
- [ ] `docker compose --env-file .env.containers config --services` retorna apenas `postgres` e `langflow`
- [ ] `npm run -ws --if-present build` compila todos os workspaces sem erro
- [ ] `.env.example` e `.env.containers.example` existem na raiz
- [ ] `azure-pipelines.yml` existe na raiz
- [ ] Azure DevOps mostra o repositório com as duas branches
- [ ] Pipeline CI aparece em `Pipelines > Pipelines` no Azure DevOps

---

## Próximos Passos (fora do escopo deste plano)

1. **Ativar o pipeline**: No Azure DevOps, ir em `Pipelines > New Pipeline`, apontar para `AcessSharepoint`, selecionar `azure-pipelines.yml`
2. **Criar `.env`** a partir de `.env.example` para desenvolvimento local
3. **Subir PostgreSQL**: `docker compose --env-file .env.containers up -d postgres`
4. **Rodar migrations**: `npm run -w apps/api migration:run`
5. **Iniciar API**: `npm run -w apps/api start:dev`
