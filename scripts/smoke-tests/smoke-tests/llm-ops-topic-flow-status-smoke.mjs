import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { LlmOpsAgentEntity } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops-agent.entity.js';
import { PromptTemplateEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-template.entity.js';
import { TopicFlowEntity } from '../../apps/api/dist/modules/llm-ops/entities/topic-flow.entity.js';
import { TopicFlowVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/topic-flow-version.entity.js';
import { ApprovalStatusEnum, InvocationSourceEnum, PromptKindEnum, RegressionStatusEnum, TopicDomainEnum } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops.enums.js';
import { createLlmOpsDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createLlmOpsDataSource([LlmOpsAgentEntity, PromptTemplateEntity, TopicFlowEntity, TopicFlowVersionEntity]);

const agentsRepository = dataSource.getRepository(LlmOpsAgentEntity);
const promptTemplatesRepository = dataSource.getRepository(PromptTemplateEntity);
const topicFlowsRepository = dataSource.getRepository(TopicFlowEntity);
const topicFlowVersionsRepository = dataSource.getRepository(TopicFlowVersionEntity);

const suffix = randomUUID().slice(0, 8);
let agent;
let promptTemplate;
let topicFlow;
let topicFlowVersion;

try {
  agent = await agentsRepository.save(
    agentsRepository.create({
      slug: `status-tf-agent-${suffix}`,
      displayName: 'Status Topic Flow Agent',
      description: 'Status topic flow test agent',
      primaryObjective: 'Validate topic flow status updates',
      supportedSources: [InvocationSourceEnum.API],
      isActive: true
    })
  );

  promptTemplate = await promptTemplatesRepository.save(
    promptTemplatesRepository.create({
      agentId: agent.id,
      slug: `status-tf-template-${suffix}`,
      name: 'Status Topic Flow Template',
      description: 'Status topic flow template',
      promptKind: PromptKindEnum.INSTRUCTION,
      targetScope: 'status-topic-flow',
      isActive: true
    })
  );

  topicFlow = await topicFlowsRepository.save(
    topicFlowsRepository.create({
      agentId: agent.id,
      slug: `status-tf-flow-${suffix}`,
      name: 'Status Topic Flow',
      description: 'Status topic flow',
      topicDomain: TopicDomainEnum.ENDPOINT_CREATION,
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
      flowDefinition: { steps: ['status'] },
      validationNotes: null,
      createdBy: 'smoke-test',
      approvedAt: null
    })
  );

  const updated = await topicFlowVersionsRepository.save(
    topicFlowVersionsRepository.merge(topicFlowVersion, {
      approvalStatus: ApprovalStatusEnum.APPROVED,
      regressionStatus: RegressionStatusEnum.PASSED,
      approvedAt: new Date('2026-04-22T12:00:00.000Z')
    })
  );

  const verified = await topicFlowVersionsRepository.findOneByOrFail({ id: updated.id });

  console.log(
    JSON.stringify(
      {
        topicFlowVersion: {
          id: verified.id,
          approvalStatus: verified.approvalStatus,
          regressionStatus: verified.regressionStatus,
          approvedAt: verified.approvedAt?.toISOString() ?? null
        }
      },
      null,
      2
    )
  );
} finally {
  if (topicFlowVersion) {
    await topicFlowVersionsRepository.delete({ id: topicFlowVersion.id });
  }
  if (topicFlow) {
    await topicFlowsRepository.delete({ id: topicFlow.id });
  }
  if (promptTemplate) {
    await promptTemplatesRepository.delete({ id: promptTemplate.id });
  }
  if (agent) {
    await agentsRepository.delete({ id: agent.id });
  }

  await dataSource.destroy();
}
