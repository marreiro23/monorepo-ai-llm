#!/usr/bin/env node

import '../utils/load-env.mjs';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { LlmOpsService } from '../../apps/api/dist/modules/llm-ops/llm-ops.service.js';
import { AstraRagService } from '../../apps/api/dist/modules/llm-ops/astra-rag.service.js';
import { LlmOpsAgentEntity } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops-agent.entity.js';
import { PromptTemplateEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-template.entity.js';
import { PromptVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-version.entity.js';
import { PromptValidationEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-validation.entity.js';
import { PromptUsageHistoryEntity } from '../../apps/api/dist/modules/llm-ops/entities/prompt-usage-history.entity.js';
import { InteractionLearningEventEntity } from '../../apps/api/dist/modules/llm-ops/entities/interaction-learning-event.entity.js';
import { TopicFlowEntity } from '../../apps/api/dist/modules/llm-ops/entities/topic-flow.entity.js';
import { TopicFlowVersionEntity } from '../../apps/api/dist/modules/llm-ops/entities/topic-flow-version.entity.js';
import { InvocationSourceEnum, PromptKindEnum, ApprovalStatusEnum } from '../../apps/api/dist/modules/llm-ops/entities/llm-ops.enums.js';
import { createAstraDbConnection, readAstraDbConnectionConfig } from '../../apps/api/dist/infra/database/astradb/astra-client.js';
import { createLlmOpsDataSource } from '../utils/typeorm-env.mjs';

if (process.env.ASTRA_DB_ENABLED !== 'true') {
  throw new Error('ASTRA_DB_ENABLED must be true for the real Astra RAG smoke test');
}

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

const configService = new ConfigService();
const astraRagService = new AstraRagService(configService);
const service = new LlmOpsService(
  dataSource.getRepository(LlmOpsAgentEntity),
  dataSource.getRepository(InteractionLearningEventEntity),
  dataSource.getRepository(PromptTemplateEntity),
  dataSource.getRepository(PromptVersionEntity),
  dataSource.getRepository(PromptValidationEntity),
  dataSource.getRepository(TopicFlowEntity),
  dataSource.getRepository(TopicFlowVersionEntity),
  dataSource.getRepository(PromptUsageHistoryEntity),
  astraRagService
);

const agentsRepository = dataSource.getRepository(LlmOpsAgentEntity);
const promptTemplatesRepository = dataSource.getRepository(PromptTemplateEntity);
const promptVersionsRepository = dataSource.getRepository(PromptVersionEntity);
const promptUsageHistoryRepository = dataSource.getRepository(PromptUsageHistoryEntity);
const interactionLearningEventsRepository = dataSource.getRepository(InteractionLearningEventEntity);

const suffix = randomUUID().slice(0, 8);
const probeTerm = `ragprobe-${suffix}`;
let agent;
let promptTemplate;
let promptVersion;

const { db } = createAstraDbConnection(
  readAstraDbConnectionConfig({
    endpoint: process.env.ASTRA_DB_API_ENDPOINT,
    token: process.env.ASTRA_DB_APPLICATION_TOKEN,
    keyspace: process.env.ASTRA_DB_KEYSPACE
  })
);
const knowledgeCollection = db.collection(process.env.ASTRA_COLLECTION_KNOWLEDGE_BASE);
const interactionsCollection = db.collection(process.env.ASTRA_COLLECTION_INTERACTIONS);

try {
  agent = await agentsRepository.save(
    agentsRepository.create({
      slug: `rag-agent-${suffix}`,
      displayName: 'RAG Smoke Agent',
      description: 'Real Astra RAG smoke test agent',
      primaryObjective: 'Validate Astra-backed retrieval',
      supportedSources: [InvocationSourceEnum.API],
      isActive: true
    })
  );

  promptTemplate = await promptTemplatesRepository.save(
    promptTemplatesRepository.create({
      agentId: agent.id,
      slug: `rag-template-${suffix}`,
      name: 'RAG Smoke Template',
      description: 'Ask and Answer RAG smoke template',
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
      contentMarkdown: 'Use retrieved context from AstraDB when available.',
      inputContract: { message: 'string' },
      outputContract: { answer: 'string', retrievedContext: 'string[]' },
      coherenceNotes: 'real Astra smoke',
      createdBy: 'smoke-test'
    })
  );

  const insertedIds = await astraRagService.ingestKnowledgeDocuments([
    {
      title: `Documento RAG ${probeTerm}`,
      content: `Este documento confirma que o fluxo Ask and Answer recupera contexto real da Astra para ${probeTerm}.`,
      source: 'scripts/smoke-tests/llm-ops-rag-e2e-smoke.mjs',
      tags: ['smoke-test', 'rag', probeTerm],
      metadata: { testId: suffix }
    }
  ]);

  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await service.askAndAnswer({
      message: `Explique o contexto ${probeTerm}`,
      agentId: agent.id,
      promptTemplateId: promptTemplate.id,
      invocationSource: InvocationSourceEnum.API,
      sessionFingerprint: `rag-smoke-${suffix}`
    });

    if (response.data.retrievedContext.join(' ').includes(probeTerm)) {
      break;
    }

    if (attempt < 3) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
  }

  const retrievedText = response.data.retrievedContext.join(' ');
  if (!response.success || !retrievedText.includes(probeTerm)) {
    throw new Error(`Astra RAG context was not retrieved for ${probeTerm}`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        probeTerm,
        astra: {
          keyspace: process.env.ASTRA_DB_KEYSPACE ?? 'llm_ops',
          knowledgeCollection: process.env.ASTRA_COLLECTION_KNOWLEDGE_BASE,
          interactionsCollection: process.env.ASTRA_COLLECTION_INTERACTIONS,
          insertedKnowledgeIds: insertedIds
        },
        response: {
          correlationId: response.data.correlationId,
          retrievedContextCount: response.data.retrievedContext.length,
          answerIncludesAstraContext: response.data.answer.includes('Contexto recuperado do AstraDB')
        },
        postgres: {
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
  await interactionsCollection.deleteMany({ sessionFingerprint: `rag-smoke-${suffix}` }).catch(() => {});
  await knowledgeCollection.deleteMany({ 'metadata.testId': suffix }).catch(() => {});
  if (agent) {
    await interactionLearningEventsRepository.delete({ agentId: agent.id });
  }
  if (promptVersion) {
    await promptUsageHistoryRepository.delete({ promptVersionId: promptVersion.id });
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
