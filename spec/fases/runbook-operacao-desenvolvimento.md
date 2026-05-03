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

## Registro tecnico: estabilizacao TS6 + Auth + Docker (2026-05-03)

### Contexto
Durante a migracao para TypeScript 6.0.3 e adocao de pacote de autenticacao compartilhado (`packages/auth`), os builds das apps passaram a falhar com erros de compilacao relacionados a `rootDir`, `baseUrl` e imports ESM em `NodeNext`.

### Erros observados
1. `TS5101`: deprecacao de `baseUrl` no TS6.
2. `TS5011`: `rootDir` nao explicito no `tsconfig.app.json` de cada app.
3. `TS6059`: import de `packages/auth` fora do escopo do `rootDir` das apps.
4. `TS2307`: imports relativos sem extensao em arquivos ESM (`NodeNext`) no pacote `auth`.

### Correcoes aplicadas
1. Compatibilidade TS6 no arquivo raiz `tsconfig.json`:
	- `ignoreDeprecations: "6.0"`
2. `rootDir` explicito para todas as apps em `apps/*/tsconfig.app.json`:
	- `rootDir: "../../"`
3. Ajuste ESM no pacote `auth` com extensao `.js` em imports relativos:
	- `packages/auth/src/index.ts`
	- `packages/auth/src/auth.module.ts`
	- `packages/auth/src/api-auth.guard.ts`
4. `nest-cli.json` atualizado para registrar libs do monorepo:
	- `shared`
	- `auth`

### Validacao executada
Comandos executados na raiz do projeto (`/mnt/repositorio/workdir/repostorios/monorepo-ai-llm`):

```bash
npm run build:monorepo-ai-llm
npm run build:users-api
npm run build:llm-ops-api
npm run build:sharepoint-api
npm run build:sync-api
```

Resultado: todas as cinco builds compilaram com sucesso.

### Padrao obrigatorio para novas alteracoes
1. Se houver import de pacote compartilhado (`packages/*`) dentro de app (`apps/*`), manter `rootDir: "../../"` no `tsconfig.app.json` da app.
2. Em `moduleResolution: "nodenext"`, usar extensao `.js` nos imports relativos de arquivos TypeScript que serao emitidos como ESM.
3. Ao atualizar major de TypeScript, rodar build de todas as apps e nao apenas da app alterada.
