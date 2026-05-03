# Runbook de Operacao: operacao-desenvolvimento

## Objetivo
Documentar como executar, testar e validar a operacao de desenvolvimento.

## Regras obrigatorias
1. Toda operacao deve possuir este arquivo `.md` e um notebook `.ipynb` correspondente.
2. Cada celula do notebook deve explicar o que faz e onde e executada.
3. O repositorio deve permanecer sob `/mnt/repositorio/workdir/repostorios/<repositorio>`.

## Notebook associado
- spec/execucao/runbook-operacao-desenvolvimento.ipynb

## Como executar
1. Abrir o notebook associado.
2. Executar as celulas na ordem.
3. Registrar saidas e evidencias no PR.

## Como testar
1. Rodar `npm run lint`.
2. Rodar `npm run test`.
3. Rodar `npm run build`.

## Como validar organizacao
1. `node tools/mcp/project-artifacts-organizer.mjs --action=check`
2. Se houver pendencias: `node tools/mcp/project-artifacts-organizer.mjs --action=fix`
