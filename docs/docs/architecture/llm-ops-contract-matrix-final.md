# LLM-Ops Contract Matrix — Wave A + Wave B

## Status: Complete (Wave A + Wave B)

This document is the source-of-truth matrix for all LLM-Ops API contracts,
covering foundational (Wave A) and advanced (Wave B) endpoints.

## Wave A — Foundational Endpoints

| Method | Endpoint | Request Contract | Response Contract |
|--------|----------|-----------------|-------------------|
| GET | /llm-ops/agents | – | AgentsListResponseContract |
| POST | /llm-ops/agents | CreateAgentRequestContract | AgentMutationResponseContract |
| GET | /llm-ops/prompt-templates | – | PromptTemplatesListResponseContract |
| POST | /llm-ops/prompt-templates | CreatePromptTemplateRequestContract | PromptTemplateMutationResponseContract |
| GET | /llm-ops/prompt-versions | – | PromptVersionsListResponseContract |
| POST | /llm-ops/prompt-versions | CreatePromptVersionRequestContract | PromptVersionMutationResponseContract |
| PATCH | /llm-ops/prompt-versions/:promptVersionId/status | UpdatePromptVersionStatusRequestContract | PromptVersionMutationResponseContract |
| GET | /llm-ops/prompt-versions/:promptVersionId/status | – | PromptVersionStatusResponseContract |

## Wave B — Advanced Endpoints

| Method | Endpoint | Request Contract | Response Contract |
|--------|----------|-----------------|-------------------|
| GET | /llm-ops/prompt-validations | – | PromptValidationsListResponseContract |
| POST | /llm-ops/prompt-validations | CreatePromptValidationRequestContract | PromptValidationMutationResponseContract |
| GET | /llm-ops/topic-flows | – | TopicFlowsListResponseContract |
| POST | /llm-ops/topic-flows | CreateTopicFlowRequestContract | TopicFlowMutationResponseContract |
| GET | /llm-ops/topic-flow-versions | – | TopicFlowVersionsListResponseContract |
| POST | /llm-ops/topic-flow-versions | CreateTopicFlowVersionRequestContract | TopicFlowVersionMutationResponseContract |
| PATCH | /llm-ops/topic-flow-versions/:topicFlowVersionId/status | UpdateTopicFlowVersionStatusRequestContract | TopicFlowVersionMutationResponseContract |
| GET | /llm-ops/topic-flow-versions/:topicFlowVersionId/status | – | TopicFlowVersionStatusResponseContract |
| GET | /llm-ops/prompt-usage-history | – | PromptUsageHistoryListResponseContract |
| POST | /llm-ops/prompt-usage-history | CreatePromptUsageHistoryRequestContract | PromptUsageHistoryMutationResponseContract |
| GET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status | – | PromptUsageHistoryStatusResponseContract |
| POST | /llm-ops/interaction-learning-events | CreateInteractionLearningEventRequestContract | InteractionLearningEventMutationResponseContract |
| POST | /llm-ops/topic-interactions | CreateTopicInteractionRequestContract | TopicInteractionMutationResponseContract |
| POST | /llm-ops/chat | AskAndAnswerRequestContract | AskAndAnswerResponseContract |
| POST | /llm-ops/knowledge-base/documents | IngestKnowledgeBaseRequestContract | { success: true; data: { insertedIds: string[] } } |
| GET | /llm-ops/resources/catalog | – | ResourceCatalogResponseContract |

## Enum Contracts

All enum contracts are defined in `packages/shared/src/contracts/llm-ops/llm-ops.enums.contract.ts`:

- `InvocationSourceContract`
- `ApprovalStatusContract`
- `PromptKindContract`
- `ValidationStatusContract`
- `RuntimeOutcomeContract`
- `RegressionStatusContract`
- `TopicDomainContract`
- `ResourceExecutionModeContract`

## Schema Isolation

All LLM-Ops entities reside in the `llm_ops` PostgreSQL schema.

## Notes

- All contracts are defined in `packages/shared/src/contracts/llm-ops/`
- DTOs in `apps/api/src/modules/llm-ops/dto/` implement the request contracts
- Service mappers (e.g. `toPromptValidationContract`) serialize entities → contracts
