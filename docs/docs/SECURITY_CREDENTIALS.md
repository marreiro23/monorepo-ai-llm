# 🔒 Segurança de Credenciais e API Keys em Docker

## ⚠️ CRÍTICO: Proteção de Secrets

### O Problema

Credenciais e API keys **NUNCA** devem ser:
- ✗ Embarcadas em imagens Docker
- ✗ Copiadas com `COPY .env* ./` no Dockerfile
- ✗ Commitadas no git
- ✗ Loggadas em logs de build
- ✗ Expostas em variáveis de ambiente não protegidas

### Solução: Injeção via Volumes (Read-Only)

**Correto:** Injetar credenciais em runtime via volumes:

```yaml
# docker-compose.yml
services:
  container-manager:
    image: node:22-alpine
    volumes:
      - ./.env.containers:/app/.env.containers:ro  # ✅ Read-only
    environment:
      # NUNCA fazer isso: ENV CREDENTIALS_FILE=/app/.env (expõe caminho)
      # Deixar em volume apenas
```

**Docker CLI:**
```bash
docker run -v $(pwd)/.env.containers:/app/.env.containers:ro image-name
```

**Node.js Inside Container:**
```javascript
// Ler credenciais do volume montado
const dotenv = require('dotenv');
dotenv.config({ path: '/app/.env.containers' });

const apiKey = process.env.LLM_API_KEY;
```

## 🚨 Problemas Encontrados no Projeto

### 1. Dockerfile.manager (CORRIGIDO ✅)

**ANTES (INSEGURO):**
```dockerfile
COPY .env.containers ./  # ❌ Embarca credenciais na imagem!
```

**DEPOIS (SEGURO):**
```dockerfile
# ✅ NÃO copiar .env.containers
# Injetar via volume no docker-compose.yml
```

### 2. .dockerignore (CORRIGIDO ✅)

**ANTES (INSEGURO):**
```
.env.*
!.env.containers  # ❌ Força inclusão!
```

**DEPOIS (SEGURO):**
```
.env
.env.*  # Exclui todos os .env files
# ✅ Sem exceção para .env.containers
```

## ✅ Dockerfiles Seguros Verificados

| Dockerfile | Status | Detalhes |
|---|---|---|
| `apps/api/Dockerfile` | ✅ Seguro | Não copia .env |
| `Dockerfile.mcp` | ✅ Seguro | Não copia .env |
| `Dockerfile.langflow` | ✅ Seguro | Não copia .env |
| `scripts/utils/Dockerfile.manager` | ✅ Corrigido | Removido COPY .env.containers |

## 📋 Checklist de Segurança

Antes de fazer `docker build`:

- [ ] `.dockerignore` exclui `**/.env*`
- [ ] Nenhum Dockerfile tem `COPY .env* ./`
- [ ] Nenhum ARG/ENV com valores de secrets hardcoded
- [ ] `.env.containers` está no `.gitignore`
- [ ] Credenciais injetadas APENAS via volumes ou variáveis de runtime
- [ ] Volumes de env são montados como `:ro` (read-only)

## 🔐 Padrão Seguro para MCP/APIs

### Dockerfile correto:
```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY src ./src

RUN npm install --omit=dev

# ✅ Nenhum .env copiado aqui

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
```

### Docker-compose correto:
```yaml
services:
  my-service:
    build: .
    image: my-image:latest
    environment:
      # ✅ Opção 1: Ler de .env.containers
      - USERS_API_URL=http://users-api:3001
      # ✅ Opção 2: Variáveis seguras via env_file
      # env_file: .env.containers
      # ✅ Opção 3: Volumes read-only
    volumes:
      - ./.env.containers:/app/.env.containers:ro
    depends_on:
      - postgres
```

## 🛑 O Que NÃO Fazer

```dockerfile
# ❌ NUNCA: Copiar .env
COPY .env.production ./

# ❌ NUNCA: ARG com secrets
ARG API_KEY=my-secret-key

# ❌ NUNCA: ENV com secrets hardcoded
ENV DATABASE_PASSWORD=password123

# ❌ NUNCA: Secrets em logs
RUN echo "Connecting with key: $API_KEY"
```

## 📚 Referências

- [Docker Secrets Best Practices](https://docs.docker.com/engine/swarm/secrets/)
- [12-Factor App - Config](https://12factor.net/config)
- [OWASP: Secrets Management](https://owasp.org/www-community/Sensitive_Data_Exposure)
- [Docker Compose: env_file](https://docs.docker.com/compose/environment-variables/set-environment-variables/)

## 🔄 Fluxo Correto de Deploy

1. **Build** (sem credenciais):
   ```bash
   docker build -t my-image:latest .
   ```

2. **Run** (injetar credenciais):
   ```bash
   docker run --env-file .env.containers my-image:latest
   # OU
   docker compose --env-file .env.containers up
   ```

3. **Registry** (imagem sem secrets):
   ```bash
   docker push my-registry/my-image:latest
   ```

4. **Production** (credenciais via Docker Secrets/Vault):
   ```yaml
   services:
     api:
       image: my-registry/my-image:latest
       secrets:
         - db_password
         - api_key
   secrets:
     db_password:
       external: true  # Gerenciado por Docker Swarm/Kubernetes
     api_key:
       external: true
   ```

## 🎯 Status do Projeto

**Segurança de Credenciais: ✅ CORRIGIDO**

- ✅ `.dockerignore` limpo (sem `!.env.containers`)
- ✅ `Dockerfile.manager` corrigido (removido COPY)
- ✅ Todos os Dockerfiles seguem padrão seguro
- ✅ `.env.containers` injetado via volume read-only

**Próximos passos:**
- [ ] Documentar em DEPLOYMENT.md o fluxo de credenciais
- [ ] Revisar CI/CD pipeline (GitHub Actions) para não expor secrets
- [ ] Configurar Docker Secrets em produção (Swarm mode)

---

**Última Atualização**: 2026-04-29
**Status**: ✅ Segurança de Credenciais Implementada
