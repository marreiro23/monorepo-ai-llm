import type { ApprovalStatusContract, InvocationSourceContract } from './llm-ops.enums.contract.js';

export type PromptVersionContract = {
  id: string;
  promptTemplateId: string;
  versionNumber: number;
  invocationSource: InvocationSourceContract;
  approvalStatus: ApprovalStatusContract;
  isStable: boolean;
  contentMarkdown: string;
  inputContract: Record<string, unknown>;
  outputContract: Record<string, unknown>;
  coherenceNotes: string | null;
  createdBy: string;
  createdAt: string;
  approvedAt: string | null;
  deprecatedAt: string | null;
};

export type CreatePromptVersionRequestContract = {
  promptTemplateId: string;
  versionNumber: number;
  invocationSource: InvocationSourceContract;
  approvalStatus?: ApprovalStatusContract;
  isStable?: boolean;
  contentMarkdown: string;
  inputContract?: Record<string, unknown>;
  outputContract?: Record<string, unknown>;
  coherenceNotes?: string | null;
  createdBy: string;
};