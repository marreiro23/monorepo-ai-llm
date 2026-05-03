import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  const fullPath = resolve(root, relativePath);
  assert.ok(existsSync(fullPath), `Missing file: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

function assertContains(content, expected, label) {
  assert.ok(content.includes(expected), `Missing ${label}: ${expected}`);
}

const matrix = read('docs/architecture/llm-ops-contract-matrix-final.md');
assertContains(matrix, 'Wave A + Wave B', 'matrix title');
assertContains(matrix, 'GET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status', 'matrix endpoint');

const sharedRootIndex = read('packages/shared/src/index.ts');
assertContains(sharedRootIndex, "./contracts/llm-ops/index.js", 'shared root llm-ops export');

const llmOpsIndex = read('packages/shared/src/contracts/llm-ops/index.ts');
[
  './llm-ops.enums.contract.js',
  './agent.contract.js',
  './prompt-template.contract.js',
  './prompt-version.contract.js',
  './prompt-version-status.contract.js',
  './prompt-validation.contract.js',
  './topic-flow.contract.js',
  './prompt-usage-history.contract.js',
  './llm-ops-response.contract.js'
].forEach((expected) => assertContains(llmOpsIndex, expected, 'llm-ops contract export'));

const enumsContract = read('packages/shared/src/contracts/llm-ops/llm-ops.enums.contract.ts');
[
  'InvocationSourceContract',
  'ApprovalStatusContract',
  'PromptKindContract',
  'ValidationStatusContract',
  'RuntimeOutcomeContract',
  'RegressionStatusContract'
].forEach((expected) => assertContains(enumsContract, expected, 'enum contract'));

const controller = read('apps/api/src/modules/llm-ops/llm-ops.controller.ts');
[
  'PromptVersionStatusResponseContract',
  'PromptValidationsListResponseContract',
  'PromptValidationMutationResponseContract',
  'TopicFlowsListResponseContract',
  'TopicFlowMutationResponseContract',
  'TopicFlowVersionsListResponseContract',
  'TopicFlowVersionMutationResponseContract',
  'TopicFlowVersionStatusResponseContract',
  'PromptUsageHistoryListResponseContract',
  'PromptUsageHistoryMutationResponseContract',
  'PromptUsageHistoryStatusResponseContract'
].forEach((expected) => assertContains(controller, expected, 'controller response typing'));

const service = read('apps/api/src/modules/llm-ops/llm-ops.service.ts');
[
  'toPromptValidationContract',
  'toTopicFlowContract',
  'toTopicFlowVersionContract',
  'toPromptUsageHistoryContract',
  'PromptValidationsListResponseContract',
  'TopicFlowVersionsListResponseContract',
  'PromptUsageHistoryStatusResponseContract'
].forEach((expected) => assertContains(service, expected, 'service contract mapping'));

const dtoChecks = [
  ['apps/api/src/modules/llm-ops/dto/create-prompt-validation.dto.ts', 'implements CreatePromptValidationRequestContract'],
  ['apps/api/src/modules/llm-ops/dto/create-topic-flow.dto.ts', 'implements CreateTopicFlowRequestContract'],
  ['apps/api/src/modules/llm-ops/dto/create-topic-flow-version.dto.ts', 'implements CreateTopicFlowVersionRequestContract'],
  ['apps/api/src/modules/llm-ops/dto/create-prompt-usage-history.dto.ts', 'implements CreatePromptUsageHistoryRequestContract'],
  ['apps/api/src/modules/llm-ops/dto/update-prompt-version-status.dto.ts', 'implements UpdatePromptVersionStatusRequestContract'],
  ['apps/api/src/modules/llm-ops/dto/update-topic-flow-version-status.dto.ts', 'implements UpdateTopicFlowVersionStatusRequestContract']
];

for (const [path, expected] of dtoChecks) {
  const content = read(path);
  assertContains(content, expected, `dto contract implementation in ${path}`);
}

console.log('OK: llm-ops-contracts-ab-smoke validated A+B contract hardening successfully.');