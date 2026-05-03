import type { PromptUsageHistoryContract } from './prompt-usage-history.contract.js';
import type { TopicDomainContract } from './llm-ops.enums.contract.js';
import type { InteractionLearningEventContract, CreateInteractionLearningEventRequestContract } from './interaction-learning-event.contract.js';
import type { CreatePromptUsageHistoryRequestContract } from './prompt-usage-history.contract.js';

export type TopicRoutingDecisionContract = {
  capabilityFamily: TopicDomainContract;
  action: string;
  target: string;
  requiresNewEndpoint: boolean;
  proposedEndpoint: string | null;
  rationale: string;
  confidence: number | null;
};

export type TopicInteractionContract = {
  decision: TopicRoutingDecisionContract;
  interactionLearningEvent: InteractionLearningEventContract;
  promptUsageHistory: PromptUsageHistoryContract | null;
};

export type CreateTopicInteractionRequestContract = CreateInteractionLearningEventRequestContract &
  Partial<CreatePromptUsageHistoryRequestContract> & {
    decision: TopicRoutingDecisionContract;
  };
