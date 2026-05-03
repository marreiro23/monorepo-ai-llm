import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { LlmOpsAgentEntity } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops-agent.entity.js';
import { PromptTemplateEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-template.entity.js';
import { PromptVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-version.entity.js';
import { PromptUsageHistoryEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-usage-history.entity.js';
import { TopicFlowEntity } from '../../apps/api/dist/modules/llm-ops/entities/topic-flow.entity.js';
import { TopicFlowVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/topic-flow-version.entity.js';
import { ApprovalStatusEnum, InvocationSourceEnum, PromptKindEnum, RegressionStatusEnum, RuntimeOutcomeEnum, TopicDomainEnum } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops.enums.js';
import { createLlmOpsDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createLlmOpsDataSource([LlmOpsAgentEntity, PromptTemplateEntity, PromptVersionEntity, PromptUsageHistoryEntity, TopicFlowEntity, TopicFlowVersionEntity]);

const agentsRepository = dataSource.getRepository(LlmOpsAgentEntity);
const promptTemplatesRepository = dataSource.getRepository(PromptTemplateEntity);
const promptVersionsRepository = dataSource.getRepository(PromptVersionEntity);
const promptUsageHistoryRepository = dataSource.getRepository(PromptUsageHistoryEntity);
const topicFlowsRepository = dataSource.getRepository(TopicFlowEntity);
const topicFlowVersionsRepository = dataSource.getRepository(TopicFlowVersionEntity);

const suffix = randomUUID().slice(0, 8);
let agent;
let promptTemplate;
let promptVersion;
let topicFlow;
let topicFlowVersion;
let promptUsageHistory;

try {
  agent = await agentsRepository.save(
    agentsRepository.create({
      slug: `tf-agent-${suffix}`,
      displayName: 'Topic Flow Smoke Agent',
      description: 'Topic flow smoke test agent',
      primaryObjective: 'Validate topic flow and usage history',
      supportedSources: [InvocationSourceEnum.API],
      isActive: true
    })
  );

  promptTemplate = await promptTemplatesRepository.save(
    promptTemplatesRepository.create({
      agentId: agent.id,
      slug: `tf-template-${suffix}`,
      name: 'Topic Flow Smoke Template',
      description: 'Topic flow smoke template',
      promptKind: PromptKindEnum.INSTRUCTION,
      targetScope: 'topic-flow-smoke',
      isActive: true
    })
  );

  promptVersion = await promptVersionsRepository.save(
    promptVersionsRepository.create({
      promptTemplateId: promptTemplate.id,
      versionNumber: 1,
      invocationSource: InvocationSourceEnum.API,
      approvalStatus: ApprovalStatusEnum.DRAFT,
      isStable: false,
      contentMarkdown: '# Smoke prompt version',
      inputContract: {},
      outputContract: {},
      coherenceNotes: null,
      createdBy: 'smoke-test',
      approvedAt: null,
      deprecatedAt: null
    })
  );

  topicFlow = await topicFlowsRepository.save(
    topicFlowsRepository.create({
      agentId: agent.id,
      slug: `tf-flow-${suffix}`,
      name: 'Topic Flow Smoke Flow',
      description: 'Topic flow smoke flow',
      topicDomain: TopicDomainEnum.SHAREPOINT,
      invocationSource: InvocationSourceEnum.API,
      isActive: true
    })
  );

  topicFlowVersion = await topicFlowVersionsRepository.save(
    topicFlowVersionsRepository.create({
      topicFlowId: topicFlow.id,
      versionNumber: 1,
      approvalStatus: ApprovalStatusEnum.DRAFT,
      regressionStatus: RegressionStatusEnum.NOT_RUN,
      baselineVersionId: null,
      flowDefinition: { steps: ['a', 'b'] },
      validationNotes: null,
      createdBy: 'smoke-test',
      approvedAt: null
    })
  );

  promptUsageHistory = await promptUsageHistoryRepository.save(
    promptUsageHistoryRepository.create({
      agentId: agent.id,
      promptVersionId: promptVersion.id,
      topicFlowVersionId: topicFlowVersion.id,
      invocationSource: InvocationSourceEnum.API,
      runtimeOutcome: RuntimeOutcomeEnum.SUCCESS,
      adaptationRequired: false,
      latencyMs: 123,
      successfulHandoffCount: 1,
      failedHandoffCount: 0,
      tokenInputCount: 111,
      tokenOutputCount: 222,
      sessionFingerprint: `session-${suffix}`
    })
  );

  const counts = {
    topicFlows: (await topicFlowsRepository.find({ where: { id: topicFlow.id } })).length,
    topicFlowVersions: (await topicFlowVersionsRepository.find({ where: { id: topicFlowVersion.id } })).length,
    promptUsageHistory: (await promptUsageHistoryRepository.find({ where: { id: promptUsageHistory.id } })).length
  };

  console.log(
    JSON.stringify(
      {
        topicFlow: {
          id: topicFlow.id,
          slug: topicFlow.slug,
          topicDomain: topicFlow.topicDomain
        },
        topicFlowVersion: {
          id: topicFlowVersion.id,
          topicFlowId: topicFlowVersion.topicFlowId,
          approvalStatus: topicFlowVersion.approvalStatus,
          regressionStatus: topicFlowVersion.regressionStatus
        },
        promptUsageHistory: {
          id: promptUsageHistory.id,
          promptVersionId: promptUsageHistory.promptVersionId,
          topicFlowVersionId: promptUsageHistory.topicFlowVersionId,
          runtimeOutcome: promptUsageHistory.runtimeOutcome
        },
        counts
      },
      null,
      2
    )
  );
} finally {
  if (promptUsageHistory) {
    await promptUsageHistoryRepository.delete({ id: promptUsageHistory.id });
  }
  if (topicFlowVersion) {
    await topicFlowVersionsRepository.delete({ id: topicFlowVersion.id });
  }
  if (topicFlow) {
    await topicFlowsRepository.delete({ id: topicFlow.id });
  }
  if (promptVersion) {
    await promptVersionsRepository.delete({ id: promptVersion.id });
  }
  if (promptTemplate) {
    await promptTemplatesRepository.delete({ id: promptTemplate.id });
  }
  if (agent) {
    await agentsRepository.delete({ id: agent.id });
  }

  await dataSource.destroy();
}
