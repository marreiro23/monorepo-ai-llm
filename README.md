<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Projeto MONOREPO

- Sob controle PRs

## Governanca de Issues e PRs

Este repositorio possui configuracao padrao para abertura de issues e rotulacao de PRs:

- Templates de issue em `.github/ISSUE_TEMPLATE/`
- Template de PR em `.github/pull_request_template.md`
- Catalogo de labels em `.github/labels.yml`
- Auto-label por alteracao de arquivos em `.github/labeler.yml`
- Workflow de auto-label para PRs em `.github/workflows/pr-labeler.yml`
- Workflow de sincronizacao de labels em `.github/workflows/sync-labels.yml`

Fluxo recomendado:

1. Abra issue pelo template adequado.
2. Crie PR vinculando o issue.
3. O GitHub Actions aplicara labels de area/tipo automaticamente com base nos arquivos alterados.
4. Se atualizar `.github/labels.yml`, rode o workflow "Sync Labels" para alinhar labels do repositorio.

## Regra obrigatoria para implementacao e migracao

Todo processo de implementacao ou migracao de codigo deve incluir obrigatoriamente:

1. Um arquivo Notebook (`.ipynb`) com o passo a passo tecnico.
2. Um arquivo Markdown (`.md`) explicando como fazer, como testar e como executar.

Sem esses dois artefatos, a entrega deve ser considerada incompleta.

## Padrao de organizacao de artefatos

Estrutura padrao para manter implementacoes, migracoes e evidencias:

1. `spec/fases/` para planos e documentos `.md`.
2. `spec/execucao/` para notebooks `.ipynb` de execucao e migracao.
3. `spec/testes/` para notebooks de validacao e testes.
4. `scripts/smoke-tests/` para scripts operacionais de smoke test.

## Raiz obrigatoria do projeto

O repositorio deve permanecer sob a raiz:

`/mnt/repositorio/workdir/repostorios/<repositorio>`

## MCP de organizacao

Este projeto possui um MCP utilitario para padronizar arquivos e runbooks:

1. `npm run mcp:org:check` valida a organizacao.
2. `npm run mcp:org:fix` cria/move artefatos para os locais padrao.
3. `npm run mcp:org:new-runbook` cria um par runbook (`.md` + `.ipynb`) padrao.
4. `npm run mcp:org:check` tambem valida se cada celula de codigo dos runbooks comeca com:
  - `# O que faz: ...`
  - `# Onde executa: ...`

Para criar runbook de uma operacao especifica:

`node tools/mcp/project-artifacts-organizer.mjs --action=new-runbook --operation="nome-da-operacao"`

Arquivos do MCP:

- `tools/mcp/project-artifacts-organizer.mjs`
- `spec/execucao/runbook-operacao-desenvolvimento.ipynb`
- `spec/fases/runbook-operacao-desenvolvimento.md`
