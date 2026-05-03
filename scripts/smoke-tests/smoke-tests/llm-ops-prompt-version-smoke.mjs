import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { LlmOpsAgentEntity } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops-agent.entity.js';
import { PromptTemplateEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-template.entity.js';
import { PromptVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-version.entity.js';
import { PromptValidationEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-validation.entity.js';
import { ApprovalStatusEnum, InvocationSourceEnum, PromptKindEnum, ValidationStatusEnum } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops.enums.js';
import { createLlmOpsDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createLlmOpsDataSource([LlmOpsAgentEntity, PromptTemplateEntity, PromptVersionEntity, PromptValidationEntity]);

const agentsRepository = dataSource.getRepository(LlmOpsAgentEntity);
const promptTemplatesRepository = dataSource.getRepository(PromptTemplateEntity);
const promptVersionsRepository = dataSource.getRepository(PromptVersionEntity);
const promptValidationsRepository = dataSource.getRepository(PromptValidationEntity);

const suffix = randomUUID().slice(0, 8);
let agent;
let promptTemplate;
let promptVersion;
let promptValidation;

try {
  agent = await agentsRepository.save(
    agentsRepository.create({
      slug: `pv-agent-${suffix}`,
      displayName: 'Prompt Version Smoke Agent',
      description: 'Prompt version smoke test agent',
      primaryObjective: 'Validate prompt version flow',
      supportedSources: [InvocationSourceEnum.API],
      isActive: true
    })
  );

  promptTemplate = await promptTemplatesRepository.save(
    promptTemplatesRepository.create({
      agentId: agent.id,
      slug: `pv-template-${suffix}`,
      name: 'Prompt Version Smoke Template',
      description: 'Prompt version smoke template',
      promptKind: PromptKindEnum.INSTRUCTION,
      targetScope: 'prompt-version-smoke',
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

  promptValidation = await promptValidationsRepository.save(
    promptValidationsRepository.create({
      promptVersionId: promptVersion.id,
      validatorName: 'smoke-validator',
      validatorPhase: 'unit',
      validationStatus: ValidationStatusEnum.PASSED,
      criticalAmbiguityCount: 0,
      warningCount: 0,
      coherenceScore: '100.00',
      findings: [],
      summary: 'smoke validation passed',
      validatedBy: 'smoke-test'
    })
  );

  const verifiedVersion = await promptVersionsRepository.findOneByOrFail({ id: promptVersion.id });
  const verifiedValidation = await promptValidationsRepository.findOneByOrFail({ id: promptValidation.id });

  console.log(
    JSON.stringify(
      {
        promptVersion: {
          id: verifiedVersion.id,
          promptTemplateId: verifiedVersion.promptTemplateId,
          versionNumber: verifiedVersion.versionNumber,
          approvalStatus: verifiedVersion.approvalStatus
        },
        promptValidation: {
          id: verifiedValidation.id,
          promptVersionId: verifiedValidation.promptVersionId,
          validationStatus: verifiedValidation.validationStatus,
          validatorName: verifiedValidation.validatorName
        }
      },
      null,
      2
    )
  );
} finally {
  if (promptValidation) {
    await promptValidationsRepository.delete({ id: promptValidation.id });
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
