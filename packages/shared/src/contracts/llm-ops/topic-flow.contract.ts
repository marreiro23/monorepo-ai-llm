import type { ApprovalStatusContract, InvocationSourceContract, RegressionStatusContract, TopicDomainContract } from './llm-ops.enums.contract.js';

export type TopicFlowContract = {
  id: string;
  agentId: string;
  slug: string;
  name: string;
  description: string;
  topicDomain: TopicDomainContract;
  invocationSource: InvocationSourceContract;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateTopicFlowRequestContract = {
  agentId: string;
  slug: string;
  name: string;
  description: string;
  topicDomain: TopicDomainContract;
  invocationSource: InvocationSourceContract;
  isActive: boolean;
};

export type TopicFlowVersionContract = {
  id: string;
  topicFlowId: string;
  versionNumber: number;
  approvalStatus: ApprovalStatusContract;
  regressionStatus: RegressionStatusContract;
  baselineVersionId: string | null;
  flowDefinition: Record<string, unknown>;
  validationNotes: string | null;
  createdBy: string;
  createdAt: string;
  approvedAt: string | null;
};

export type CreateTopicFlowVersionRequestContract = {
  topicFlowId: string;
  versionNumber: number;
  approvalStatus?: ApprovalStatusContract;
  regressionStatus?: RegressionStatusContract;
  baselineVersionId?: string | null;
  flowDefinition: Record<string, unknown>;
  validationNotes?: string | null;
  createdBy: string;
  approvedAt?: string | null;
};

export type UpdateTopicFlowVersionStatusRequestContract = {
  approvalStatus?: ApprovalStatusContract;
  regressionStatus?: RegressionStatusContract;
  approvedAt?: string | null;
};

export type TopicFlowVersionStatusContract = {
  id: string;
  topicFlowId: string;
  topicFlowSlug: string;
  agentId: string;
  agentSlug: string;
  versionNumber: number;
  approvalStatus: ApprovalStatusContract;
  regressionStatus: RegressionStatusContract;
  baselineVersionId: string | null;
  approvedAt: string | null;
  createdAt: string;
};
