import type { InvocationSourceContract, RuntimeOutcomeContract } from './llm-ops.enums.contract.js';

export type PromptUsageHistoryContract = {
  id: string;
  agentId: string;
  promptVersionId: string;
  topicFlowVersionId: string | null;
  invocationSource: InvocationSourceContract;
  runtimeOutcome: RuntimeOutcomeContract;
  adaptationRequired: boolean;
  latencyMs: number | null;
  successfulHandoffCount: number;
  failedHandoffCount: number;
  tokenInputCount: number | null;
  tokenOutputCount: number | null;
  sessionFingerprint: string | null;
  createdAt: string;
};

export type CreatePromptUsageHistoryRequestContract = {
  agentId: string;
  promptVersionId: string;
  topicFlowVersionId?: string | null;
  invocationSource: InvocationSourceContract;
  runtimeOutcome: RuntimeOutcomeContract;
  adaptationRequired?: boolean;
  latencyMs?: number | null;
  successfulHandoffCount?: number;
  failedHandoffCount?: number;
  tokenInputCount?: number | null;
  tokenOutputCount?: number | null;
  sessionFingerprint?: string | null;
};

export type PromptUsageHistoryStatusContract = {
  id: string;
  agentId: string;
  agentSlug: string;
  promptVersionId: string;
  promptTemplateId: string;
  promptTemplateSlug: string;
  topicFlowVersionId: string | null;
  topicFlowSlug: string | null;
  topicFlowAgentSlug: string | null;
  invocationSource: InvocationSourceContract;
  runtimeOutcome: RuntimeOutcomeContract;
  adaptationRequired: boolean;
  latencyMs: number | null;
  successfulHandoffCount: number;
  failedHandoffCount: number;
  tokenInputCount: number | null;
  tokenOutputCount: number | null;
  sessionFingerprint: string | null;
  createdAt: string;
};