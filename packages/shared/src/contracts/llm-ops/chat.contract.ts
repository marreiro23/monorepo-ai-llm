import type { ApiResponseContract } from '../common/api-response.contract.js';
import type { ApprovalStatusContract, InvocationSourceContract, RuntimeOutcomeContract } from './llm-ops.enums.contract.js';
import type { LlmOpsResourceDomainContract, ResourceExecutionModeContract } from './resource-catalog.contract.js';

export type AskAndAnswerRequestContract = {
  message: string;
  agentId?: string | null;
  promptTemplateId?: string | null;
  topicFlowId?: string | null;
  topicFlowVersionId?: string | null;
  invocationSource?: InvocationSourceContract | null;
  sessionFingerprint?: string | null;
};

export type AskAndAnswerContextContract = {
  agentId: string | null;
  agentSlug: string | null;
  promptTemplateId: string | null;
  promptTemplateSlug: string | null;
  promptVersionId: string | null;
  promptVersionStatus: ApprovalStatusContract | null;
  topicFlowId: string | null;
  topicFlowSlug: string | null;
  topicFlowVersionId: string | null;
  topicFlowVersionStatus: ApprovalStatusContract | null;
};

export type AskAndAnswerMessageContract = {
  role: 'assistant' | 'user';
  text: string;
};

export type AskAndAnswerLangflowContract = {
  enabled: boolean;
  attempted: boolean;
  reachable: boolean;
  ragFlowId: string | null;
  outputText: string | null;
  error: string | null;
};

export type AskAndAnswerAdministrativeTaskContract = {
  detected: boolean;
  action: string | null;
  target: string | null;
  mode: 'dry-run';
  nextStep: string;
};

export type AskAndAnswerResourceContextContract = {
  domain: LlmOpsResourceDomainContract;
  resource: string;
  consultedEndpoint: string | null;
  summary: string;
  snapshot: Record<string, unknown> | null;
};

export type AskAndAnswerRecommendedActionContract = {
  action: string;
  targetEndpoint: string;
  preconditions: string[];
  rationale: string;
};

export type AskAndAnswerResponseContract = ApiResponseContract<{
  answer: string;
  messages: AskAndAnswerMessageContract[];
  context: AskAndAnswerContextContract;
  runtimeOutcome: RuntimeOutcomeContract;
  retrievedContext: string[];
  resourceContext: AskAndAnswerResourceContextContract;
  recommendedActions: AskAndAnswerRecommendedActionContract[];
  executionMode: ResourceExecutionModeContract;
  orchestration?: {
    langflow: AskAndAnswerLangflowContract | null;
    administrativeTask: AskAndAnswerAdministrativeTaskContract;
  };
  correlationId?: string;
}>;
