---
title: Microservice Packaging & Boundary Enforcement (NestJS Monorepo)
version: 1.0
date_created: 2026-05-01
last_updated: 2026-05-01
owner: marreiro23
tags: [architecture, containers, microservices, nestjs, typescript, operations]
---

# Introduction
Esta especificação define regras obrigatórias para garantir que cada serviço/container seja realmente “micro”: empacotado com o mínimo de código e dependências, com limites claros de domínio e baixo consumo de recursos em ambiente local (máquinas fracas).

## 1. Purpose & Scope
Padronizar e **enforçar**:
- limites de dependência entre domínios/componentes
- empacotamento mínimo em imagens Docker/Podman
- responsabilidade de agentes/MCPs em validar e documentar

Aplica-se a:
- `apps/*` (serviços)
- `tools/*` (MCPs de validação)
- `infra/containers/*` ou Dockerfiles existentes
- `docs/*` relacionados à operação/arquitetura

## 2. Definitions
- **Microservice**: serviço executável isolado (porta própria), com escopo de domínio e dependências mínimas.
- **Domain**: fronteira de negócio (users, llm-ops, sharepoint, sync…).
- **Boundary**: regra que impede imports/código cruzando domínios indevidamente.
- **Minimal artifact**: bundle/output que contém apenas o necessário para executar um domínio.

## 3. Requirements, Constraints & Guidelines

- **REQ-001 (Isolamento de build)**: cada domínio deve gerar um artefato de build separado e identificável.
- **REQ-002 (Docker minimal copy)**: cada imagem final deve copiar apenas o artefato do domínio que ela executa.
- **REQ-003 (Sem import cruzado)**: código de um domínio não deve importar diretamente código de outro domínio (exceto via `packages/shared` e contratos).
- **REQ-004 (Infra plugável)**: `infra/database` e demais infra não podem depender de módulos de domínio.
- **REQ-005 (Limites operacionais)**: compose deve aplicar limites de CPU/memória por serviço em ambiente local.
- **CON-001 (tsgo)**: builds e checks TS devem usar `tsgo`, nunca `tsc`.
- **GUD-001 (Docs sempre atualizados)**: mudanças de arquitetura/build/containers devem atualizar docs correspondentes.

## 4. Interfaces & Data Contracts
- Contratos compartilhados devem viver em `packages/shared` e ser consumidos pelos domínios.
- Integração com Postgres deve permitir seleção de entidades/migrations por domínio (por configuração).

## 5. Acceptance Criteria
- **AC-001**: Dado um Docker target de domínio, quando eu inspeciono a imagem, então ela não contém código/build output de outros domínios.
- **AC-002**: Dado um domínio, quando eu executo o check `check_micro_boundary`, então não existem imports proibidos.
- **AC-003**: Dado o ambiente local, quando eu subo todos os containers, então o consumo total não derruba o desktop.

## 6. Test Automation Strategy
- Checks determinísticos via MCP/Node scripts:
  - regex de paths copiados no Dockerfile
  - análise AST de imports (ts-morph)
  - verificação de `dist/` por domínio
- CI: rodar checks em PR.

## 7. Rationale & Context
Evitar que “microserviços” virem monólitos empacotados, o que aumenta custo operacional, consumo de memória/CPU e dificulta escalar/operar em máquinas limitadas.

## 8. Dependencies & External Integrations
- Postgres
- Docker/Podman
- GitHub Actions (CI)

## 9. Examples & Edge Cases
- Edge: um utilitário compartilhado pode viver em `packages/*`, mas não pode puxar dependências pesadas por default.
- Edge: scripts podem usar `process.env` direto fora do DI Nest (permitido em scripts/CLI).

## 10. Validation Criteria
- MCP checks passando
- CI green
- docs atualizados

## 11. Related Specifications / Further Reading
- docs/CONTAINER_ARCHITECTURE.md
- docs/OPERATIONAL_GUIDE.md