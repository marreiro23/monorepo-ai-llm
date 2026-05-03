import type { ApiResponseContract } from '../common/api-response.contract.js';
import type { LlmOpsAgentContract } from './agent.contract.js';
import type { InteractionLearningEventContract } from './interaction-learning-event.contract.js';
import type { PromptUsageHistoryContract, PromptUsageHistoryStatusContract } from './prompt-usage-history.contract.js';
import type { PromptValidationContract } from './prompt-validation.contract.js';
import type { PromptTemplateContract } from './prompt-template.contract.js';
import type { PromptVersionStatusContract } from './prompt-version-status.contract.js';
import type { PromptVersionContract } from './prompt-version.contract.js';
import type { LlmOpsResourceCatalogContract } from './resource-catalog.contract.js';
import type { TopicFlowContract, TopicFlowVersionContract, TopicFlowVersionStatusContract } from './topic-flow.contract.js';
import type { TopicInteractionContract } from './topic-interaction.contract.js';

export type AgentsListResponseContract = ApiResponseContract<LlmOpsAgentContract[]>;
export type AgentMutationResponseContract = ApiResponseContract<LlmOpsAgentContract>;

export type PromptTemplatesListResponseContract = ApiResponseContract<PromptTemplateContract[]>;
export type PromptTemplateMutationResponseContract = ApiResponseContract<PromptTemplateContract>;

export type PromptVersionsListResponseContract = ApiResponseContract<PromptVersionContract[]>;
export type PromptVersionMutationResponseContract = ApiResponseContract<PromptVersionContract>;

export type PromptVersionStatusResponseContract = ApiResponseContract<PromptVersionStatusContract>;

export type PromptValidationsListResponseContract = ApiResponseContract<PromptValidationContract[]>;
export type PromptValidationMutationResponseContract = ApiResponseContract<PromptValidationContract>;

export type TopicFlowsListResponseContract = ApiResponseContract<TopicFlowContract[]>;
export type TopicFlowMutationResponseContract = ApiResponseContract<TopicFlowContract>;

export type TopicFlowVersionsListResponseContract = ApiResponseContract<TopicFlowVersionContract[]>;
export type TopicFlowVersionMutationResponseContract = ApiResponseContract<TopicFlowVersionContract>;
export type TopicFlowVersionStatusResponseContract = ApiResponseContract<TopicFlowVersionStatusContract>;

export type PromptUsageHistoryListResponseContract = ApiResponseContract<PromptUsageHistoryContract[]>;
export type PromptUsageHistoryMutationResponseContract = ApiResponseContract<PromptUsageHistoryContract>;
export type PromptUsageHistoryStatusResponseContract = ApiResponseContract<PromptUsageHistoryStatusContract>;

export type InteractionLearningEventsListResponseContract = ApiResponseContract<InteractionLearningEventContract[]>;
export type InteractionLearningEventMutationResponseContract = ApiResponseContract<InteractionLearningEventContract>;

export type TopicInteractionMutationResponseContract = ApiResponseContract<TopicInteractionContract>;
export type ResourceCatalogResponseContract = ApiResponseContract<LlmOpsResourceCatalogContract>;
