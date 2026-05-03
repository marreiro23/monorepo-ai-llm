import type { ApiResponseContract } from '../common/api-response.contract.js';

export type ResourceExecutionModeContract = 'read-only-recommendation';

export type LlmOpsResourceDomainContract =
  | 'users'
  | 'graph'
  | 'sharepoint'
  | 'sync'
  | 'governance'
  | 'audit'
  | 'llm-ops';

export type LlmOpsResourceCatalogItemContract = {
  domain: LlmOpsResourceDomainContract;
  description: string;
  readableEndpoints: string[];
  writeEndpoints: string[];
  llmAccess: ResourceExecutionModeContract;
};

export type LlmOpsResourceCatalogContract = {
  executionMode: ResourceExecutionModeContract;
  resources: LlmOpsResourceCatalogItemContract[];
};

export type LlmOpsResourceCatalogResponseContract = ApiResponseContract<LlmOpsResourceCatalogContract>;

