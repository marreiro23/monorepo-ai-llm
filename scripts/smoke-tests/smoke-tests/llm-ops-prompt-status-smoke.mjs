import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { LlmOpsAgentEntity } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops-agent.entity.js';
import { PromptTemplateEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-template.entity.js';
import { PromptVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-version.entity.js';
import { ApprovalStatusEnum, InvocationSourceEnum, PromptKindEnum } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops.enums.js';
import { createLlmOpsDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createLlmOpsDataSource([LlmOpsAgentEntity, PromptTemplateEntity, PromptVersionEntity]);

const agentsRepository = dataSource.getRepository(LlmOpsAgentEntity);
const promptTemplatesRepository = dataSource.getRepository(PromptTemplateEntity);
const promptVersionsRepository = dataSource.getRepository(PromptVersionEntity);

const suffix = randomUUID().slice(0, 8);
let agent;
let promptTemplate;
let promptVersion;

try {
  agent = await agentsRepository.save(
    agentsRepository.create({
      slug: `status-agent-${suffix}`,
      displayName: 'Status Smoke Agent',
      description: 'Status smoke test agent',
      primaryObjective: 'Validate prompt version status updates',
      supportedSources: [InvocationSourceEnum.API],
      isActive: true
    })
  );

  promptTemplate = await promptTemplatesRepository.save(
    promptTemplatesRepository.create({
      agentId: agent.id,
      slug: `status-template-${suffix}`,
      name: 'Status Smoke Template',
      description: 'Status smoke template',
      promptKind: PromptKindEnum.INSTRUCTION,
      targetScope: 'status-smoke',
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
      contentMarkdown: '# Status prompt version',
      inputContract: {},
      outputContract: {},
      coherenceNotes: null,
      createdBy: 'smoke-test',
      approvedAt: null,
      deprecatedAt: null
    })
  );

  const updated = await promptVersionsRepository.save(
    promptVersionsRepository.merge(promptVersion, {
      approvalStatus: ApprovalStatusEnum.APPROVED,
      approvedAt: new Date('2026-04-22T12:00:00.000Z'),
      deprecatedAt: null
    })
  );

  const verified = await promptVersionsRepository.findOneByOrFail({ id: updated.id });

  console.log(
    JSON.stringify(
      {
        promptVersion: {
          id: verified.id,
          approvalStatus: verified.approvalStatus,
          approvedAt: verified.approvedAt?.toISOString() ?? null,
          deprecatedAt: verified.deprecatedAt
        }
      },
      null,
      2
    )
  );
} finally {
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
