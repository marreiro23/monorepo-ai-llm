# MCP Secrets

Servidor MCP para gerenciamento seguro de metadados de chaves e segredos.

Esta fatia nao le valores secretos e nao executa mutacoes reais. As ferramentas retornam apenas metadados redigidos, planos dry-run e gates explicitos de aprovacao antes de qualquer operacao futura.

## Tools

- `secrets_list`: lista chaves logicas conhecidas e se o nome configurado existe no ambiente do processo, sem ler o valor.
- `secrets_register_prepare`: prepara plano dry-run para registrar uma nova chave logica.
- `secrets_rotate_prepare`: prepara plano dry-run para rotacionar uma chave logica existente.
- `secrets_revoke_prepare`: prepara plano dry-run para revogar uma chave logica existente.

## Garantias desta versao

- `dryRun: true` em todas as acoes de mutacao.
- `approvalRequired: true` em todas as acoes de mutacao.
- `mutationAllowed: false` em todas as acoes de mutacao.
- Nenhum valor secreto e retornado em `content` ou `structuredContent`.

## Gate de historico duravel

Esta versao implementa apenas o gate de seguranca para historico duravel. Cada
plano de operacao retorna `audit.durableHistoryRequired: true` e
`historyTarget: "persistent-operation-store"`.

Nenhuma mutacao real deve ser habilitada neste MCP ate existir um backend
auditavel com:

- registro duravel da operacao em banco;
- aprovacao explicita vinculada ao solicitante;
- rollback gravado antes da escrita no provider;
- permissao/RBAC para register, rotate e revoke;
- smoke real cobrindo register/rotate/revoke em objeto controlado.

O MCP nao deve armazenar valores secretos em arquivo, log, memoria persistente
ou resposta de tool. O caminho futuro recomendado e `MCP -> API administrativa
auditavel -> provider de segredo`, mantendo o MCP como camada de preparacao
dry-run e nao como executor direto de vault.
