import type { PromptKindContract } from './llm-ops.enums.contract.js';

export type PromptTemplateContract = {
  id: string;
  agentId: string;
  slug: string;
  name: string;
  description: string;
  promptKind: PromptKindContract;
  targetScope: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreatePromptTemplateRequestContract = {
  agentId: string;
  slug: string;
  name: string;
  description: string;
  promptKind: PromptKindContract;
  targetScope: string;
  isActive: boolean;
};