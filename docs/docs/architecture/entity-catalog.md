# Catalogo de Entidades

Gerado em: 2026-04-30T11:56:49.459Z
Total de entidades: 28

## Escopo
- Fonte: `apps/api/src/**/entities/*.entity.ts`
- Objetivo: inventario de entidades TypeORM atuais para documentacao tecnica.

## Schema: llm_ops

| Entidade | Tabela | Colunas* | Arquivo |
|---|---|---:|---|
| InteractionLearningEventEntity | interaction_learning_events | 9 | `apps/api/src/modules/llm-ops/entities/interaction-learning-event.entity.ts` |
| LlmOpsAgentEntity | agents | 7 | `apps/api/src/modules/llm-ops/entities/llm-ops-agent.entity.ts` |
| PromptDependencyEntity | prompt_dependencies | 9 | `apps/api/src/modules/llm-ops/entities/prompt-dependency.entity.ts` |
| PromptTemplateEntity | prompt_templates | 8 | `apps/api/src/modules/llm-ops/entities/prompt-template.entity.ts` |
| PromptUsageHistoryEntity | prompt_usage_history | 13 | `apps/api/src/modules/llm-ops/entities/prompt-usage-history.entity.ts` |
| PromptValidationEntity | prompt_validations | 11 | `apps/api/src/modules/llm-ops/entities/prompt-validation.entity.ts` |
| PromptVersionEntity | prompt_versions | 13 | `apps/api/src/modules/llm-ops/entities/prompt-version.entity.ts` |
| TopicFlowEntity | topic_flows | 8 | `apps/api/src/modules/llm-ops/entities/topic-flow.entity.ts` |
| TopicFlowVersionEntity | topic_flow_versions | 10 | `apps/api/src/modules/llm-ops/entities/topic-flow-version.entity.ts` |

## Schema: m365_migration

| Entidade | Tabela | Colunas* | Arquivo |
|---|---|---:|---|
| M365ObjectOperationEntity | m365_object_operations | 13 | `apps/api/src/modules/m365-migration/entities/m365-object-operation.entity.ts` |
| M365ObjectPermissionSnapshotEntity | m365_object_permission_snapshots | 10 | `apps/api/src/modules/m365-migration/entities/m365-object-permission-snapshot.entity.ts` |
| MigrationEventEntity | migration_events | 6 | `apps/api/src/modules/m365-migration/entities/migration-event.entity.ts` |
| MigrationJobEntity | migration_jobs | 6 | `apps/api/src/modules/m365-migration/entities/migration-job.entity.ts` |
| MigrationMailboxEntity | migration_mailboxes | 9 | `apps/api/src/modules/m365-migration/entities/migration-mailbox.entity.ts` |
| MigrationMailboxMappingEntity | migration_mailbox_mappings | 7 | `apps/api/src/modules/m365-migration/entities/migration-mailbox-mapping.entity.ts` |
| MigrationReadinessCheckEntity | migration_readiness_checks | 6 | `apps/api/src/modules/m365-migration/entities/migration-readiness-check.entity.ts` |
| MigrationTenantEntity | migration_tenants | 9 | `apps/api/src/modules/m365-migration/entities/migration-tenant.entity.ts` |

## Schema: public

| Entidade | Tabela | Colunas* | Arquivo |
|---|---|---:|---|
| UserEntity | users | 3 | `apps/api/src/modules/users/entities/user.entity.ts` |

## Schema: sync

| Entidade | Tabela | Colunas* | Arquivo |
|---|---|---:|---|
| SyncedDriveEntity | synced_drives | 7 | `apps/api/src/modules/sync/entities/synced-drive.entity.ts` |
| SyncedGroupEntity | synced_groups | 5 | `apps/api/src/modules/sync/entities/synced-group.entity.ts` |
| SyncedMailboxEntity | synced_mailboxes | 6 | `apps/api/src/modules/sync/entities/synced-mailbox.entity.ts` |
| SyncedOneDriveEntity | synced_onedrives | 8 | `apps/api/src/modules/sync/entities/synced-onedrive.entity.ts` |
| SyncedSiteEntity | synced_sites | 6 | `apps/api/src/modules/sync/entities/synced-site.entity.ts` |
| SyncedTeamChannelEntity | synced_team_channels | 8 | `apps/api/src/modules/sync/entities/synced-team-channel.entity.ts` |
| SyncedTeamChannelMessageEntity | synced_team_channel_messages | 14 | `apps/api/src/modules/sync/entities/synced-team-channel-message.entity.ts` |
| SyncedTeamEntity | synced_teams | 6 | `apps/api/src/modules/sync/entities/synced-team.entity.ts` |
| SyncedUserEntity | synced_users | 6 | `apps/api/src/modules/sync/entities/synced-user.entity.ts` |
| SyncJobEntity | sync_jobs | 8 | `apps/api/src/modules/sync/entities/sync-job.entity.ts` |

## Observacoes
- `Colunas*` conta decorators `@Column`, `@PrimaryGeneratedColumn` e `@PrimaryColumn`.
- Quando `schema` nao esta explicito no decorator `@Entity`, a classificacao acima usa o modulo como heuristica.
