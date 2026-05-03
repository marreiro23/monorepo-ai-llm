import type { InvocationSourceContract } from './llm-ops.enums.contract.js';

export type LlmOpsAgentContract = {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  primaryObjective: string;
  supportedSources: InvocationSourceContract[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAgentRequestContract = {
  slug: string;
  displayName: string;
  description: string;
  primaryObjective: string;
  supportedSources: InvocationSourceContract[];
  isActive: boolean;
};