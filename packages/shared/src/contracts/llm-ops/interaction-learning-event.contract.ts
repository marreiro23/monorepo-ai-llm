import type { InvocationSourceContract, LearningEventTypeContract } from './llm-ops.enums.contract.js';

export type InteractionLearningEventContract = {
  id: string;
  agentId: string;
  promptVersionId: string | null;
  topicFlowVersionId: string | null;
  invocationSource: InvocationSourceContract;
  eventType: LearningEventTypeContract;
  severity: string;
  eventPayload: Record<string, unknown>;
  humanResolution: string | null;
  observedAt: string;
};

export type CreateInteractionLearningEventRequestContract = {
  agentId: string;
  promptVersionId?: string | null;
  topicFlowVersionId?: string | null;
  invocationSource: InvocationSourceContract;
  eventType: LearningEventTypeContract;
  severity: string;
  eventPayload: Record<string, unknown>;
  humanResolution?: string | null;
};
