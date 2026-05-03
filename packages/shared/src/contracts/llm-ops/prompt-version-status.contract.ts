import type { ApprovalStatusContract, InvocationSourceContract } from './llm-ops.enums.contract.js';

export type UpdatePromptVersionStatusRequestContract = {
  approvalStatus: ApprovalStatusContract;
  approvedAt?: string | null;
  deprecatedAt?: string | null;
};

export type PromptVersionStatusContract = {
  id: string;
  promptTemplateId: string;
  promptTemplateSlug: string;
  agentId: string;
  agentSlug: string;
  versionNumber: number;
  invocationSource: InvocationSourceContract;
  approvalStatus: ApprovalStatusContract;
  isStable: boolean;
  approvedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string;
};