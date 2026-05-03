import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { LlmOpsAgentEntity } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops-agent.entity.js';
import { PromptTemplateEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-template.entity.js';
import { InvocationSourceEnum, PromptKindEnum } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops.enums.js';
import { createLlmOpsDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createLlmOpsDataSource([LlmOpsAgentEntity, PromptTemplateEntity]);

const agentsRepository = dataSource.getRepository(LlmOpsAgentEntity);
const promptTemplatesRepository = dataSource.getRepository(PromptTemplateEntity);

const slugSuffix = randomUUID().slice(0, 8);
const agentSlug = `smoke-agent-${slugSuffix}`;
const templateSlug = `smoke-template-${slugSuffix}`;

let agent;
let promptTemplate;

try {
  agent = await agentsRepository.save(
    agentsRepository.create({
      slug: agentSlug,
      displayName: 'Smoke Agent',
      description: 'Smoke test agent',
      primaryObjective: 'Validate llm_ops TypeORM flow',
      supportedSources: [InvocationSourceEnum.API],
      isActive: true
    })
  );

  promptTemplate = await promptTemplatesRepository.save(
    promptTemplatesRepository.create({
      agentId: agent.id,
      slug: templateSlug,
      name: 'Smoke Template',
      description: 'Smoke test prompt template',
      promptKind: PromptKindEnum.INSTRUCTION,
      targetScope: 'smoke',
      isActive: true
    })
  );

  const listedAgents = await agentsRepository.find({
    where: { slug: agentSlug }
  });
  const listedTemplates = await promptTemplatesRepository.find({
    where: { slug: templateSlug }
  });

  console.log(
    JSON.stringify(
      {
        agent: {
          id: agent.id,
          slug: agent.slug,
          supportedSources: agent.supportedSources
        },
        promptTemplate: {
          id: promptTemplate.id,
          slug: promptTemplate.slug,
          agentId: promptTemplate.agentId
        },
        counts: {
          agents: listedAgents.length,
          promptTemplates: listedTemplates.length
        }
      },
      null,
      2
    )
  );
} finally {
  if (promptTemplate) {
    await promptTemplatesRepository.delete({ id: promptTemplate.id });
  }

  if (agent) {
    await agentsRepository.delete({ id: agent.id });
  }

  await dataSource.destroy();
}
