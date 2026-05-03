import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { LlmOpsAgentEntity } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops-agent.entity.js';
import { PromptTemplateEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-template.entity.js';
import { InvocationSourceEnum, PromptKindEnum } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops.enums.js';
import { createLlmOpsDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createLlmOpsDataSource([LlmOpsAgentEntity, PromptTemplateEntity]);

const agentsRepository = dataSource.getRepository(LlmOpsAgentEntity);
const promptTemplatesRepository = dataSource.getRepository(PromptTemplateEntity);

const suffix = randomUUID().slice(0, 8);
const agentSlug = `write-agent-${suffix}`;
const templateSlug = `write-template-${suffix}`;

let agent;
let promptTemplate;

try {
  agent = await agentsRepository.save(
    agentsRepository.create({
      slug: agentSlug,
      displayName: 'Write Smoke Agent',
      description: 'Write smoke test agent',
      primaryObjective: 'Validate llm_ops write API',
      supportedSources: [InvocationSourceEnum.API],
      isActive: true
    })
  );

  promptTemplate = await promptTemplatesRepository.save(
    promptTemplatesRepository.create({
      agentId: agent.id,
      slug: templateSlug,
      name: 'Write Smoke Template',
      description: 'Write smoke test template',
      promptKind: PromptKindEnum.INSTRUCTION,
      targetScope: 'write-smoke',
      isActive: true
    })
  );

  const verifiedAgent = await agentsRepository.findOneByOrFail({ id: agent.id });
  const verifiedTemplate = await promptTemplatesRepository.findOneByOrFail({ id: promptTemplate.id });

  console.log(
    JSON.stringify(
      {
        agent: {
          id: verifiedAgent.id,
          slug: verifiedAgent.slug,
          supportedSources: verifiedAgent.supportedSources
        },
        promptTemplate: {
          id: verifiedTemplate.id,
          slug: verifiedTemplate.slug,
          agentId: verifiedTemplate.agentId,
          promptKind: verifiedTemplate.promptKind
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
