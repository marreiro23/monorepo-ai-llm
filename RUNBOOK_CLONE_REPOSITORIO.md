# Runbook: clonar e posicionar o repositorio monorepo-ai-llm

Este documento registra os comandos usados para clonar o repositorio
`https://github.com/marreiro23/monorepo-ai-llm.git` no servidor e mover o
conteudo para o diretorio correto:

```bash
/mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm
```

## Fase 1: validar o diretorio inicial

Objetivo: confirmar onde a sessao esta executando e verificar se a pasta atual
tem algum conteudo antes de clonar.

```bash
pwd
```

Resultado esperado:

```bash
/home/daniel/monorepo-template
```

Depois liste o conteudo:

```bash
ls
```

Se a pasta estiver vazia, o clone pode ser feito ali temporariamente sem
misturar com outros arquivos.

## Fase 2: clonar o repositorio do GitHub

Objetivo: baixar o repositorio remoto para o servidor.

```bash
git clone https://github.com/marreiro23/monorepo-ai-llm.git
```

O Git cria uma pasta chamada:

```bash
monorepo-ai-llm
```

Se aparecer erro parecido com este:

```bash
fatal: unable to access 'https://github.com/marreiro23/monorepo-ai-llm.git/': Could not resolve host: github.com
```

significa que a sessao atual nao conseguiu resolver ou acessar o GitHub. Nesse
caso, e necessario executar novamente com acesso de rede liberado no ambiente.

## Fase 3: conferir se o clone ficou correto

Objetivo: validar que o repositorio foi baixado e esta sem alteracoes locais.

Entre na pasta clonada:

```bash
cd /home/daniel/monorepo-template/monorepo-ai-llm
```

Verifique o status:

```bash
git status --short
```

Resultado esperado: nenhuma saida. Isso significa que a working tree esta limpa.

Liste os arquivos principais:

```bash
ls
```

Exemplo de saida esperada:

```bash
README.md
apps
eslint.config.mjs
nest-cli.json
package-lock.json
package.json
spec
tsconfig.build.json
tsconfig.json
```

## Fase 4: validar o destino definitivo

Objetivo: confirmar que o diretorio onde o repositorio deve ficar existe e esta
pronto para receber o clone.

```bash
ls /mnt/repositorio/workdir/repostorios
```

Resultado esperado:

```bash
monorepo
```

Depois confira se o destino esta vazio:

```bash
ls /mnt/repositorio/workdir/repostorios/monorepo
```

Se nao aparecer nada, a pasta esta vazia.

## Fase 5: mover o clone para o destino correto

Objetivo: retirar o clone da pasta temporaria do perfil e colocar no caminho
definitivo em `/mnt`.

```bash
mv /home/daniel/monorepo-template/monorepo-ai-llm \
  /mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm
```

Destino final:

```bash
/mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm
```

## Fase 6: tratar arquivos Zone.Identifier, se necessario

Durante a movimentacao, o filesystem de `/mnt` pode recusar arquivos com `:` no
nome, como:

```bash
arquivo.md:Zone.Identifier
notebook.ipynb:Zone.Identifier
```

Esses arquivos sao metadados normalmente criados pelo Windows e podem causar
erro parecido com:

```bash
mv: cannot create regular file '...:Zone.Identifier': Invalid argument
```

Para localizar esses arquivos que sobraram no clone temporario:

```bash
find /home/daniel/monorepo-template/monorepo-ai-llm -name '*Zone.Identifier' -print
```

Como o destino `/mnt` nao aceita esses nomes, marque esses caminhos no indice do
Git como `skip-worktree`, dentro do repositorio no destino:

```bash
cd /mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm
```

```bash
git update-index --skip-worktree -- \
  'apps/users-api/src/notebooks_01_nest_monorepo_bootstrap_exec.ipynb:Zone.Identifier' \
  'apps/users-api/src/notebooks_nest-monorepo-guidelines.ipynb:Zone.Identifier' \
  'spec/docs_architecture_project-structure-blueprint (1).md:Zone.Identifier' \
  'spec/docs_architecture_project-structure-blueprint.md:Zone.Identifier' \
  'spec/docs_naming-conventions-plan.md:Zone.Identifier' \
  'spec/fri_may_01_2026_node_version_manager_nvm_e_uma.zip:Zone.Identifier' \
  'spec/notebooks_01_conventions_and_bootstrap.ipynb:Zone.Identifier' \
  'spec/notebooks_01_nest_monorepo_bootstrap_exec (1).ipynb:Zone.Identifier' \
  'spec/notebooks_02_validate_current_config_state (1).ipynb:Zone.Identifier' \
  'spec/spec_spec-microservice-packaging-and-boundaries.md:Zone.Identifier'
```

Depois confira:

```bash
git status --short
```

Resultado esperado: nenhuma saida.

## Fase 7: remover a copia temporaria antiga

Objetivo: limpar a pasta do perfil depois que o repositorio ja esta no destino
correto.

Antes de remover, confirme que o destino existe:

```bash
ls /mnt/repositorio/workdir/repostorios/monorepo
```

Resultado esperado:

```bash
monorepo-ai-llm
```

Remova a copia antiga:

```bash
rm -rf /home/daniel/monorepo-template/monorepo-ai-llm
```

## Fase 8: validacao final

Objetivo: garantir que sobrou apenas a copia correta em `/mnt`.

Confira que a pasta temporaria ficou vazia:

```bash
ls /home/daniel/monorepo-template
```

Confira que o repositorio existe no destino:

```bash
ls /mnt/repositorio/workdir/repostorios/monorepo
```

Confira que o Git esta limpo:

```bash
cd /mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm
git status --short
```

Resultado esperado: nenhuma saida.

## Sequencia resumida

Use esta sequencia quando quiser repetir o processo em outro ambiente:

```bash
cd /home/daniel/monorepo-template
git clone https://github.com/marreiro23/monorepo-ai-llm.git
git -C /home/daniel/monorepo-template/monorepo-ai-llm status --short
ls /mnt/repositorio/workdir/repostorios/monorepo
mv /home/daniel/monorepo-template/monorepo-ai-llm /mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm
cd /mnt/repositorio/workdir/repostorios/monorepo/monorepo-ai-llm
git status --short
rm -rf /home/daniel/monorepo-template/monorepo-ai-llm
```

Se aparecerem erros com `:Zone.Identifier`, execute a fase 6 antes da limpeza
final.
