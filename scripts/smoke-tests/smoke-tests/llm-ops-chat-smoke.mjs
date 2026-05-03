import '../utils/load-env.mjs';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { LlmOpsService } from '../../apps/api/dist/modules/llm-ops/llm-ops.service.js';
import { LlmOpsAgentEntity } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops-agent.entity.js';
import { PromptTemplateEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-template.entity.js';
import { PromptVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-version.entity.js';
import { PromptValidationEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-validation.entity.js';
import { PromptUsageHistoryEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-usage-history.entity.js';
import { InteractionLearningEventEntity } from '../../apps/api/dist/modules/llm-ops/entities/interaction-learning-event.entity.js';
import { TopicFlowEntity } from '../../apps/api/dist/modules/llm-ops/entities/topic-flow.entity.js';
import { TopicFlowVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/topic-flow-version.entity.js';
import { InvocationSourceEnum, PromptKindEnum, ApprovalStatusEnum } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops.enums.js';
import { createLlmOpsDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createLlmOpsDataSource([
  LlmOpsAgentEntity,
  PromptTemplateEntity,
  PromptVersionEntity,
  PromptValidationEntity,
  PromptUsageHistoryEntity,
  InteractionLearningEventEntity,
  TopicFlowEntity,
  TopicFlowVersionEntity
]);

const service = new LlmOpsService(
  dataSource.getRepository(LlmOpsAgentEntity),
  dataSource.getRepository(InteractionLearningEventEntity),
  dataSource.getRepository(PromptTemplateEntity),
  dataSource.getRepository(PromptVersionEntity),
  dataSource.getRepository(PromptValidationEntity),
  dataSource.getRepository(TopicFlowEntity),
  dataSource.getRepository(TopicFlowVersionEntity),
  dataSource.getRepository(PromptUsageHistoryEntity),
  {
    retrieveContext: async () => [],
    recordInteraction: async () => {}
  },
  {
    runRagFlow: async (_message, _sessionId, context) => ({
      enabled: true,
      reachable: true,
      version: null,
      ragFlowId: 'smoke-rag-flow',
      attempted: true,
      outputText: `Langflow smoke recebeu ${context.length} contexto(s).`,
      error: null
    })
  }
);

const agentsRepository = dataSource.getRepository(LlmOpsAgentEntity);
const promptTemplatesRepository = dataSource.getRepository(PromptTemplateEntity);
const promptVersionsRepository = dataSource.getRepository(PromptVersionEntity);
const interactionLearningEventsRepository = dataSource.getRepository(InteractionLearningEventEntity);
const promptUsageHistoryRepository = dataSource.getRepository(PromptUsageHistoryEntity);

const suffix = randomUUID().slice(0, 8);
let agent;
let promptTemplate;
let promptVersion;

try {
  agent = await agentsRepository.save(
    agentsRepository.create({
      slug: `chat-agent-${suffix}`,
      displayName: 'Chat Smoke Agent',
      description: 'Ask and Answer smoke test agent',
      primaryObjective: 'Validate chat flow',
      supportedSources: [InvocationSourceEnum.API],
      isActive: true
    })
  );

  promptTemplate = await promptTemplatesRepository.save(
    promptTemplatesRepository.create({
      agentId: agent.id,
      slug: `chat-template-${suffix}`,
      name: 'Chat Smoke Template',
      description: 'Ask and Answer smoke template',
      promptKind: PromptKindEnum.INSTRUCTION,
      targetScope: 'ask-and-answer',
      isActive: true
    })
  );

  promptVersion = await promptVersionsRepository.save(
    promptVersionsRepository.create({
      promptTemplateId: promptTemplate.id,
      versionNumber: 1,
      invocationSource: InvocationSourceEnum.API,
      approvalStatus: ApprovalStatusEnum.APPROVED,
      isStable: true,
      contentMarkdown: 'Smoke chat prompt',
      inputContract: { message: 'string' },
      outputContract: { answer: 'string' },
      coherenceNotes: 'smoke',
      createdBy: 'smoke-test'
    })
  );

  const response = await service.askAndAnswer({
    message: 'Como validamos o fluxo Ask and Answer?',
    agentId: agent.id,
    promptTemplateId: promptTemplate.id,
    invocationSource: InvocationSourceEnum.API,
    sessionFingerprint: `smoke-${suffix}`
  });

if (!response.success || !response.data.answer.includes('Ask and Answer recebeu')) {
  throw new Error('Unexpected Ask and Answer response');
}

if (response.data.executionMode !== 'read-only-recommendation') {
  throw new Error('Expected read-only recommendation execution mode');
}

if (!response.data.resourceContext || !Array.isArray(response.data.recommendedActions)) {
  throw new Error('Expected resource context and recommended actions in Ask and Answer response');
}

  if (response.data.orchestration?.langflow?.attempted !== true) {
    throw new Error('Langflow RAG orchestration was not attempted by Ask and Answer');
  }

  const administrativeResponse = await service.askAndAnswer({
    message: '[intencao-chave] acao=rotate; alvo=ASTRA_DB_APPLICATION_TOKEN; nao coletar nem exibir valor secreto na conversa. Rotacionar a chave do Astra.',
    agentId: agent.id,
    promptTemplateId: promptTemplate.id,
    invocationSource: InvocationSourceEnum.API,
    sessionFingerprint: `smoke-admin-${suffix}`
  });

  if (administrativeResponse.data.orchestration?.administrativeTask?.detected !== true) {
    throw new Error('Administrative dry-run intent was not detected by Ask and Answer');
  }

  if (administrativeResponse.data.answer.includes('registrou a solicitação')) {
    throw new Error('Administrative dry-run answer still overstates durable operation registration');
  }

  const disabledValidationResponse = await service.askAndAnswer({
    message: '[intencao-chave] acao=validate; alvo=ASTRA_DB_APPLICATION_TOKEN; nao coletar nem exibir valor secreto na conversa. Validar a chave do Astra.',
    agentId: agent.id,
    promptTemplateId: promptTemplate.id,
    invocationSource: InvocationSourceEnum.API,
    sessionFingerprint: `smoke-admin-validate-disabled-${suffix}`
  });

  if (disabledValidationResponse.data.orchestration?.administrativeTask?.detected !== false) {
    throw new Error('Disabled secret validation intent was still detected as an administrative task');
  }

  const administrativeEvents = await interactionLearningEventsRepository
    .createQueryBuilder('event')
    .where('event.agent_id = :agentId', { agentId: agent.id })
    .andWhere("event.event_payload -> 'administrativeTask' ->> 'detected' = 'true'")
    .andWhere("event.event_payload -> 'administrativeTask' ->> 'target' = :target", { target: 'ASTRA_DB_APPLICATION_TOKEN' })
    .getCount();

  if (administrativeEvents < 1) {
    throw new Error('Administrative dry-run intent was not persisted in interaction_learning_events');
  }

  console.log(
    JSON.stringify(
      {
        response: response.data,
        administrativeTask: administrativeResponse.data.orchestration.administrativeTask,
        administrativeEvents,
        ids: {
          agentId: agent.id,
          promptTemplateId: promptTemplate.id,
          promptVersionId: promptVersion.id
        }
      },
      null,
      2
    )
  );
} finally {
  if (agent) {
    await interactionLearningEventsRepository.delete({ agentId: agent?.id });
  }
  if (promptVersion) {
    await promptUsageHistoryRepository.delete({ promptVersionId: promptVersion?.id });
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
