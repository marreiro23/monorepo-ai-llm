# Plano de Implementacao - Debian Remoto com Docker

Data de atualizacao: 2026-05-02
Escopo: monorepo NestJS com 5 servicos executados em containers Docker no servidor Debian remoto.

## 1. Objetivo
Padronizar build, execucao, validacao e evolucao operacional em ambiente remoto containerizado, mantendo limites de recursos e fronteiras de dominio.

## 2. Baseline tecnico vigente
- Dockerfile unico com parametro APP_NAME para build por servico.
- docker-compose.remote.yml com stack completa de APIs.
- .env.remote.example com portas e limites de recursos.
- Scripts npm para operacao da stack remota.

## 3. Fases

### Fase 1 - Validacao remota inicial
- Gerar imagens de todos os servicos.
- Subir stack completa.
- Validar disponibilidade via endpoints de health.
- Registrar baseline de uso de CPU e memoria.

### Fase 2 - Hardening operacional
- Definir healthchecks do compose por servico.
- Revisar politicas de restart e stop grace period.
- Ajustar limites por comportamento real observado.

### Fase 3 - Governanca de boundaries
- Incluir checks de boundary no pipeline.
- Garantir imagem minima por dominio.
- Falhar CI em caso de import cruzado proibido.

### Fase 4 - Otimizacao continua
- Reduzir tempo de build e tamanho de imagem.
- Padronizar logs e troubleshooting.
- Consolidar runbook operacional final.

## 4. Comandos base

```bash
cp .env.remote.example .env.remote
npm run docker:build:all
npm run docker:up:remote
npm run docker:ps:remote
npm run docker:logs:remote
npm run docker:down:remote
```

## 5. Criterios de pronto por fase
- Fase 1 pronta: stack sobe e responde health para todos os servicos.
- Fase 2 pronta: compose com politicas de resiliencia e limites validados.
- Fase 3 pronta: CI bloqueia violacao de boundary.
- Fase 4 pronta: runbook final publicado e metricas operacionais estabilizadas.
