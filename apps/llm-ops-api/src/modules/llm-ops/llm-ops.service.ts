import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import type {
  AgentMutationResponseContract,
  AskAndAnswerAdministrativeTaskContract,
  AgentsListResponseContract,
  AskAndAnswerContextContract,
  AskAndAnswerLangflowContract,
  AskAndAnswerMessageContract,
  AskAndAnswerRecommendedActionContract,
  AskAndAnswerRequestContract,
  AskAndAnswerResourceContextContract,
  AskAndAnswerResponseContract,
  ApprovalStatusContract,
  CreateInteractionLearningEventRequestContract,
  InvocationSourceContract,
  LlmOpsAgentContract,
  InteractionLearningEventContract,
  InteractionLearningEventMutationResponseContract,
  InteractionLearningEventsListResponseContract,
  PromptUsageHistoryContract,
  PromptUsageHistoryListResponseContract,
  PromptUsageHistoryMutationResponseContract,
  PromptUsageHistoryStatusResponseContract,
  PromptValidationContract,
  PromptValidationMutationResponseContract,
  PromptValidationsListResponseContract,
  PromptTemplateContract,
  PromptTemplateMutationResponseContract,
  PromptTemplatesListResponseContract,
  PromptVersionContract,
  PromptVersionMutationResponseContract,
  PromptVersionStatusResponseContract,
  ResourceCatalogResponseContract,
  ResourceExecutionModeContract,
  TopicFlowContract,
  TopicFlowMutationResponseContract,
  TopicFlowsListResponseContract,
  TopicFlowVersionContract,
  TopicFlowVersionMutationResponseContract,
  TopicFlowVersionStatusResponseContract,
  TopicFlowVersionsListResponseContract,
  TopicInteractionContract,
  TopicInteractionMutationResponseContract,
  PromptVersionsListResponseContract,
} from '@api-llm-embedded/shared';
import type { CreateAgentDto } from './dto/create-agent.dto.js';
import type { AskAndAnswerDto } from './dto/ask-and-answer.dto.js';
import type { CreatePromptTemplateDto } from './dto/create-prompt-template.dto.js';
import type { IngestKnowledgeBaseDto } from './dto/ingest-knowledge-base.dto.js';
import type { CreateTopicInteractionDto } from './dto/create-topic-interaction.dto.js';
import type { CreatePromptUsageHistoryDto } from './dto/create-prompt-usage-history.dto.js';
import type { CreatePromptValidationDto } from './dto/create-prompt-validation.dto.js';
import type { CreatePromptVersionDto } from './dto/create-prompt-version.dto.js';
import type { CreateTopicFlowDto } from './dto/create-topic-flow.dto.js';
import type { CreateTopicFlowVersionDto } from './dto/create-topic-flow-version.dto.js';
import type { UpdatePromptVersionStatusDto } from './dto/update-prompt-version-status.dto.js';
import type { UpdateTopicFlowVersionStatusDto } from './dto/update-topic-flow-version-status.dto.js';
import { LlmOpsAgentEntity } from './entities/llm-ops-agent.entity.js';
import { InteractionLearningEventEntity } from './entities/interaction-learning-event.entity.js';
import { PromptTemplateEntity } from './entities/prompt-template.entity.js';
import { PromptUsageHistoryEntity } from './entities/prompt-usage-history.entity.js';
import { PromptValidationEntity } from './entities/prompt-validation.entity.js';
import { PromptVersionEntity } from './entities/prompt-version.entity.js';
import { TopicFlowEntity } from './entities/topic-flow.entity.js';
import { TopicFlowVersionEntity } from './entities/topic-flow-version.entity.js';
import {
  ApprovalStatusEnum,
  InvocationSourceEnum,
  LearningEventTypeEnum,
  RegressionStatusEnum,
  RuntimeOutcomeEnum,
  TopicDomainEnum,
  ValidationStatusEnum,
} from './entities/llm-ops.enums.js';
import { LLM_OPS_DATABASE_CONNECTION_NAME } from '../../infra/database/typeorm.config.js';
import { AstraRagService } from './astra-rag.service.js';
import { LangflowClientService } from './langflow-client.service.js';
import {
  detectResourceIntent,
  RESOURCE_EXECUTION_MODE,
} from './resource-catalog.js';
import { ResourceReadonlyAdapterService } from './resource-readonly-adapter.service.js';

@Injectable()
export class LlmOpsService {
  constructor(
    @InjectRepository(LlmOpsAgentEntity, LLM_OPS_DATABASE_CONNECTION_NAME)
    private readonly agentsRepository: Repository<LlmOpsAgentEntity>,
    @InjectRepository(
      InteractionLearningEventEntity,
      LLM_OPS_DATABASE_CONNECTION_NAME,
    )
    private readonly interactionLearningEventsRepository: Repository<InteractionLearningEventEntity>,
    @InjectRepository(PromptTemplateEntity, LLM_OPS_DATABASE_CONNECTION_NAME)
    private readonly promptTemplatesRepository: Repository<PromptTemplateEntity>,
    @InjectRepository(PromptVersionEntity, LLM_OPS_DATABASE_CONNECTION_NAME)
    private readonly promptVersionsRepository: Repository<PromptVersionEntity>,
    @InjectRepository(PromptValidationEntity, LLM_OPS_DATABASE_CONNECTION_NAME)
    private readonly promptValidationsRepository: Repository<PromptValidationEntity>,
    @InjectRepository(TopicFlowEntity, LLM_OPS_DATABASE_CONNECTION_NAME)
    private readonly topicFlowsRepository: Repository<TopicFlowEntity>,
    @InjectRepository(TopicFlowVersionEntity, LLM_OPS_DATABASE_CONNECTION_NAME)
    private readonly topicFlowVersionsRepository: Repository<TopicFlowVersionEntity>,
    @InjectRepository(
      PromptUsageHistoryEntity,
      LLM_OPS_DATABASE_CONNECTION_NAME,
    )
    private readonly promptUsageHistoryRepository: Repository<PromptUsageHistoryEntity>,
    private readonly astraRagService: AstraRagService,
    private readonly langflowClientService?: LangflowClientService,
    private readonly resourceReadonlyAdapterService?: ResourceReadonlyAdapterService,
  ) {}

  private readonly executionMode: ResourceExecutionModeContract =
    RESOURCE_EXECUTION_MODE;

  private toAgentContract(agent: LlmOpsAgentEntity): LlmOpsAgentContract {
    return {
      id: agent.id,
      slug: agent.slug,
      displayName: agent.displayName,
      description: agent.description,
      primaryObjective: agent.primaryObjective,
      supportedSources: agent.supportedSources,
      isActive: agent.isActive,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };
  }

  private toPromptTemplateContract(
    promptTemplate: PromptTemplateEntity,
  ): PromptTemplateContract {
    return {
      id: promptTemplate.id,
      agentId: promptTemplate.agentId,
      slug: promptTemplate.slug,
      name: promptTemplate.name,
      description: promptTemplate.description,
      promptKind: promptTemplate.promptKind,
      targetScope: promptTemplate.targetScope,
      isActive: promptTemplate.isActive,
      createdAt: promptTemplate.createdAt.toISOString(),
      updatedAt: promptTemplate.updatedAt.toISOString(),
    };
  }

  private toPromptVersionContract(
    promptVersion: PromptVersionEntity,
  ): PromptVersionContract {
    return {
      id: promptVersion.id,
      promptTemplateId: promptVersion.promptTemplateId,
      versionNumber: promptVersion.versionNumber,
      invocationSource: promptVersion.invocationSource,
      approvalStatus: promptVersion.approvalStatus,
      isStable: promptVersion.isStable,
      contentMarkdown: promptVersion.contentMarkdown,
      inputContract: promptVersion.inputContract,
      outputContract: promptVersion.outputContract,
      coherenceNotes: promptVersion.coherenceNotes,
      createdBy: promptVersion.createdBy,
      createdAt: promptVersion.createdAt.toISOString(),
      approvedAt: promptVersion.approvedAt?.toISOString() ?? null,
      deprecatedAt: promptVersion.deprecatedAt?.toISOString() ?? null,
    };
  }

  private toPromptValidationContract(
    promptValidation: PromptValidationEntity,
  ): PromptValidationContract {
    return {
      id: promptValidation.id,
      promptVersionId: promptValidation.promptVersionId,
      validatorName: promptValidation.validatorName,
      validatorPhase: promptValidation.validatorPhase,
      validationStatus: promptValidation.validationStatus,
      criticalAmbiguityCount: promptValidation.criticalAmbiguityCount,
      warningCount: promptValidation.warningCount,
      coherenceScore: promptValidation.coherenceScore,
      findings: promptValidation.findings,
      summary: promptValidation.summary,
      validatedAt: promptValidation.validatedAt.toISOString(),
      validatedBy: promptValidation.validatedBy,
    };
  }

  private toTopicFlowContract(topicFlow: TopicFlowEntity): TopicFlowContract {
    return {
      id: topicFlow.id,
      agentId: topicFlow.agentId,
      slug: topicFlow.slug,
      name: topicFlow.name,
      description: topicFlow.description,
      topicDomain: topicFlow.topicDomain,
      invocationSource: topicFlow.invocationSource,
      isActive: topicFlow.isActive,
      createdAt: topicFlow.createdAt.toISOString(),
      updatedAt: topicFlow.updatedAt.toISOString(),
    };
  }

  private toTopicFlowVersionContract(
    topicFlowVersion: TopicFlowVersionEntity,
  ): TopicFlowVersionContract {
    return {
      id: topicFlowVersion.id,
      topicFlowId: topicFlowVersion.topicFlowId,
      versionNumber: topicFlowVersion.versionNumber,
      approvalStatus: topicFlowVersion.approvalStatus,
      regressionStatus: topicFlowVersion.regressionStatus,
      baselineVersionId: topicFlowVersion.baselineVersionId,
      flowDefinition: topicFlowVersion.flowDefinition,
      validationNotes: topicFlowVersion.validationNotes,
      createdBy: topicFlowVersion.createdBy,
      createdAt: topicFlowVersion.createdAt.toISOString(),
      approvedAt: topicFlowVersion.approvedAt?.toISOString() ?? null,
    };
  }

  private toPromptUsageHistoryContract(
    promptUsageHistory: PromptUsageHistoryEntity,
  ): PromptUsageHistoryContract {
    return {
      id: promptUsageHistory.id,
      agentId: promptUsageHistory.agentId,
      promptVersionId: promptUsageHistory.promptVersionId,
      topicFlowVersionId: promptUsageHistory.topicFlowVersionId,
      invocationSource: promptUsageHistory.invocationSource,
      runtimeOutcome: promptUsageHistory.runtimeOutcome,
      adaptationRequired: promptUsageHistory.adaptationRequired,
      latencyMs: promptUsageHistory.latencyMs,
      successfulHandoffCount: promptUsageHistory.successfulHandoffCount,
      failedHandoffCount: promptUsageHistory.failedHandoffCount,
      tokenInputCount: promptUsageHistory.tokenInputCount,
      tokenOutputCount: promptUsageHistory.tokenOutputCount,
      sessionFingerprint: promptUsageHistory.sessionFingerprint,
      createdAt: promptUsageHistory.createdAt.toISOString(),
    };
  }

  private toInteractionLearningEventContract(
    interactionLearningEvent: InteractionLearningEventEntity,
  ): InteractionLearningEventContract {
    return {
      id: interactionLearningEvent.id,
      agentId: interactionLearningEvent.agentId,
      promptVersionId: interactionLearningEvent.promptVersionId,
      topicFlowVersionId: interactionLearningEvent.topicFlowVersionId,
      invocationSource: interactionLearningEvent.invocationSource,
      eventType: interactionLearningEvent.eventType,
      severity: interactionLearningEvent.severity,
      eventPayload: interactionLearningEvent.eventPayload,
      humanResolution: interactionLearningEvent.humanResolution,
      observedAt: interactionLearningEvent.observedAt.toISOString(),
    };
  }

  private buildTopicDecisionContract(
    payload: CreateTopicInteractionDto,
  ): TopicInteractionContract['decision'] {
    return {
      capabilityFamily: payload.decisionCapabilityFamily,
      action: payload.decisionAction,
      target: payload.decisionTarget,
      requiresNewEndpoint: payload.decisionRequiresNewEndpoint ?? false,
      proposedEndpoint: payload.decisionProposedEndpoint ?? null,
      rationale: payload.decisionRationale,
      confidence: payload.decisionConfidence ?? null,
    };
  }

  private buildAskAndAnswerContext(
    agent: LlmOpsAgentEntity | null,
    promptVersion: PromptVersionEntity | null,
    topicFlowVersion: TopicFlowVersionEntity | null,
  ): AskAndAnswerContextContract {
    return {
      agentId: agent?.id ?? null,
      agentSlug: agent?.slug ?? null,
      promptTemplateId: promptVersion?.promptTemplateId ?? null,
      promptTemplateSlug: promptVersion?.promptTemplate.slug ?? null,
      promptVersionId: promptVersion?.id ?? null,
      promptVersionStatus:
        (promptVersion?.approvalStatus as ApprovalStatusContract | undefined) ??
        null,
      topicFlowId: topicFlowVersion?.topicFlowId ?? null,
      topicFlowSlug: topicFlowVersion?.topicFlow.slug ?? null,
      topicFlowVersionId: topicFlowVersion?.id ?? null,
      topicFlowVersionStatus:
        (topicFlowVersion?.approvalStatus as
          | ApprovalStatusContract
          | undefined) ?? null,
    };
  }

  private async validateUsageScope(
    agentId: string,
    promptVersionId: string,
    topicFlowVersionId: string | null | undefined,
    invocationSource: InvocationSourceContract,
  ): Promise<{
    promptVersion: PromptVersionEntity;
    topicFlowVersion: TopicFlowVersionEntity | null;
  }> {
    const promptVersion = await this.promptVersionsRepository.findOne({
      where: { id: promptVersionId },
      relations: {
        promptTemplate: true,
      },
    });
    if (!promptVersion) {
      throw new NotFoundException(
        `Prompt version not found: ${promptVersionId}`,
      );
    }

    if (promptVersion.promptTemplate.agentId !== agentId) {
      throw new BadRequestException(
        'Prompt version must belong to the topic interaction agent',
      );
    }

    if (String(promptVersion.invocationSource) !== String(invocationSource)) {
      throw new BadRequestException(
        'Prompt version invocation source must match the topic interaction invocation source',
      );
    }

    let topicFlowVersion: TopicFlowVersionEntity | null = null;
    if (topicFlowVersionId) {
      topicFlowVersion = await this.topicFlowVersionsRepository.findOne({
        where: { id: topicFlowVersionId },
        relations: {
          topicFlow: true,
        },
      });

      if (!topicFlowVersion) {
        throw new NotFoundException(
          `Topic flow version not found: ${topicFlowVersionId}`,
        );
      }

      if (topicFlowVersion.topicFlow.agentId !== agentId) {
        throw new BadRequestException(
          'Topic flow version must belong to the topic interaction agent',
        );
      }

      if (
        String(topicFlowVersion.topicFlow.invocationSource) !==
        String(invocationSource)
      ) {
        throw new BadRequestException(
          'Topic flow invocation source must match the topic interaction invocation source',
        );
      }
    }

    return { promptVersion, topicFlowVersion };
  }

  async listAgents(): Promise<AgentsListResponseContract> {
    const agents = await this.agentsRepository.find({
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: agents.map((item) => this.toAgentContract(item)),
    };
  }

  async createAgent(
    payload: CreateAgentDto,
  ): Promise<AgentMutationResponseContract> {
    const existingAgent = await this.agentsRepository.findOneBy({
      slug: payload.slug,
    });
    if (existingAgent) {
      throw new ConflictException(`Agent slug already exists: ${payload.slug}`);
    }

    const agent = this.agentsRepository.create({
      ...payload,
      isActive: payload.isActive ?? true,
    });
    const savedAgent = await this.agentsRepository.save(agent);

    return {
      success: true,
      data: this.toAgentContract(savedAgent),
    };
  }

  async listPromptTemplates(): Promise<PromptTemplatesListResponseContract> {
    const promptTemplates = await this.promptTemplatesRepository.find({
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: promptTemplates.map((item) => this.toPromptTemplateContract(item)),
    };
  }

  async listPromptTemplatesByAgent(
    agentId: string,
  ): Promise<PromptTemplatesListResponseContract> {
    const promptTemplates = await this.promptTemplatesRepository.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: promptTemplates.map((item) => this.toPromptTemplateContract(item)),
    };
  }

  async createPromptTemplate(
    payload: CreatePromptTemplateDto,
  ): Promise<PromptTemplateMutationResponseContract> {
    const agent = await this.agentsRepository.findOneBy({
      id: payload.agentId,
    });
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${payload.agentId}`);
    }

    const promptTemplate = this.promptTemplatesRepository.create({
      ...payload,
      isActive: payload.isActive ?? true,
    });
    const savedPromptTemplate =
      await this.promptTemplatesRepository.save(promptTemplate);

    return {
      success: true,
      data: this.toPromptTemplateContract(savedPromptTemplate),
    };
  }

  async listPromptVersions(): Promise<PromptVersionsListResponseContract> {
    const promptVersions = await this.promptVersionsRepository.find({
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: promptVersions.map((item) => this.toPromptVersionContract(item)),
    };
  }

  async listPromptVersionsByTemplate(
    promptTemplateId: string,
  ): Promise<PromptVersionsListResponseContract> {
    const promptVersions = await this.promptVersionsRepository.find({
      where: { promptTemplateId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: promptVersions.map((item) => this.toPromptVersionContract(item)),
    };
  }

  async createPromptVersion(
    payload: CreatePromptVersionDto,
  ): Promise<PromptVersionMutationResponseContract> {
    const promptTemplate = await this.promptTemplatesRepository.findOneBy({
      id: payload.promptTemplateId,
    });
    if (!promptTemplate) {
      throw new NotFoundException(
        `Prompt template not found: ${payload.promptTemplateId}`,
      );
    }

    const promptVersion = this.promptVersionsRepository.create({
      ...payload,
      invocationSource:
        payload.invocationSource as unknown as InvocationSourceEnum,
      approvalStatus: payload.approvalStatus as ApprovalStatusEnum | undefined,
      isStable: payload.isStable ?? false,
      inputContract: payload.inputContract ?? {},
      outputContract: payload.outputContract ?? {},
      coherenceNotes: payload.coherenceNotes ?? null,
    });
    const savedPromptVersion =
      await this.promptVersionsRepository.save(promptVersion);

    return {
      success: true,
      data: this.toPromptVersionContract(savedPromptVersion),
    };
  }

  async listPromptValidations(): Promise<PromptValidationsListResponseContract> {
    const promptValidations = await this.promptValidationsRepository.find({
      order: { validatedAt: 'DESC' },
    });

    return {
      success: true,
      data: promptValidations.map((item) =>
        this.toPromptValidationContract(item),
      ),
    };
  }

  async createPromptValidation(
    payload: CreatePromptValidationDto,
  ): Promise<PromptValidationMutationResponseContract> {
    const promptVersion = await this.promptVersionsRepository.findOneBy({
      id: payload.promptVersionId,
    });
    if (!promptVersion) {
      throw new NotFoundException(
        `Prompt version not found: ${payload.promptVersionId}`,
      );
    }

    const promptValidation = this.promptValidationsRepository.create({
      ...payload,
      validationStatus:
        payload.validationStatus as unknown as ValidationStatusEnum,
      criticalAmbiguityCount: payload.criticalAmbiguityCount ?? 0,
      warningCount: payload.warningCount ?? 0,
      coherenceScore: payload.coherenceScore ?? null,
      findings: payload.findings ?? [],
      summary: payload.summary ?? null,
    });
    const savedPromptValidation =
      await this.promptValidationsRepository.save(promptValidation);

    return {
      success: true,
      data: this.toPromptValidationContract(savedPromptValidation),
    };
  }

  async updatePromptVersionStatus(
    promptVersionId: string,
    payload: UpdatePromptVersionStatusDto,
  ): Promise<PromptVersionMutationResponseContract> {
    const promptVersion = await this.promptVersionsRepository.findOneBy({
      id: promptVersionId,
    });
    if (!promptVersion) {
      throw new NotFoundException(
        `Prompt version not found: ${promptVersionId}`,
      );
    }

    promptVersion.approvalStatus =
      payload.approvalStatus as unknown as ApprovalStatusEnum;
    promptVersion.approvedAt = payload.approvedAt
      ? new Date(payload.approvedAt)
      : null;
    promptVersion.deprecatedAt = payload.deprecatedAt
      ? new Date(payload.deprecatedAt)
      : null;

    const savedPromptVersion =
      await this.promptVersionsRepository.save(promptVersion);

    return {
      success: true,
      data: this.toPromptVersionContract(savedPromptVersion),
    };
  }

  async getPromptVersionStatus(
    promptVersionId: string,
  ): Promise<PromptVersionStatusResponseContract> {
    const promptVersion = await this.promptVersionsRepository.findOne({
      where: { id: promptVersionId },
      relations: {
        promptTemplate: {
          agent: true,
        },
      },
    });

    if (!promptVersion) {
      throw new NotFoundException(
        `Prompt version not found: ${promptVersionId}`,
      );
    }

    return {
      success: true,
      data: {
        id: promptVersion.id,
        promptTemplateId: promptVersion.promptTemplateId,
        promptTemplateSlug: promptVersion.promptTemplate.slug,
        agentId: promptVersion.promptTemplate.agentId,
        agentSlug: promptVersion.promptTemplate.agent.slug,
        versionNumber: promptVersion.versionNumber,
        invocationSource: promptVersion.invocationSource,
        approvalStatus: promptVersion.approvalStatus,
        isStable: promptVersion.isStable,
        approvedAt: promptVersion.approvedAt?.toISOString() ?? null,
        deprecatedAt: promptVersion.deprecatedAt?.toISOString() ?? null,
        createdAt: promptVersion.createdAt.toISOString(),
      },
    };
  }

  async listTopicFlowsByAgent(
    agentId: string,
    topicDomain?: string,
  ): Promise<TopicFlowsListResponseContract> {
    const topicFlows = await this.topicFlowsRepository.find({
      where: {
        agentId,
        ...(topicDomain ? { topicDomain: topicDomain as TopicDomainEnum } : {}),
      },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: topicFlows.map((item) => this.toTopicFlowContract(item)),
    };
  }

  async listTopicFlows(
    topicDomain?: string,
  ): Promise<TopicFlowsListResponseContract> {
    const topicFlows = await this.topicFlowsRepository.find({
      where: topicDomain
        ? { topicDomain: topicDomain as TopicDomainEnum }
        : undefined,
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: topicFlows.map((item) => this.toTopicFlowContract(item)),
    };
  }

  async createTopicFlow(
    payload: CreateTopicFlowDto,
  ): Promise<TopicFlowMutationResponseContract> {
    const agent = await this.agentsRepository.findOneBy({
      id: payload.agentId,
    });
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${payload.agentId}`);
    }

    const topicFlow = this.topicFlowsRepository.create({
      agentId: payload.agentId,
      slug: payload.slug,
      name: payload.name,
      description: payload.description,
      topicDomain: payload.topicDomain as TopicDomainEnum,
      invocationSource: payload.invocationSource as InvocationSourceEnum,
      isActive: payload.isActive ?? true,
    });
    const savedTopicFlow = await this.topicFlowsRepository.save(topicFlow);

    return {
      success: true,
      data: this.toTopicFlowContract(savedTopicFlow),
    };
  }

  async listTopicFlowVersions(): Promise<TopicFlowVersionsListResponseContract> {
    const topicFlowVersions = await this.topicFlowVersionsRepository.find({
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: topicFlowVersions.map((item) =>
        this.toTopicFlowVersionContract(item),
      ),
    };
  }

  async createTopicFlowVersion(
    payload: CreateTopicFlowVersionDto,
  ): Promise<TopicFlowVersionMutationResponseContract> {
    const topicFlow = await this.topicFlowsRepository.findOneBy({
      id: payload.topicFlowId,
    });
    if (!topicFlow) {
      throw new NotFoundException(
        `Topic flow not found: ${payload.topicFlowId}`,
      );
    }

    if (payload.baselineVersionId) {
      const baselineVersion = await this.topicFlowVersionsRepository.findOneBy({
        id: payload.baselineVersionId,
      });
      if (!baselineVersion) {
        throw new NotFoundException(
          `Baseline topic flow version not found: ${payload.baselineVersionId}`,
        );
      }

      if (baselineVersion.topicFlowId !== payload.topicFlowId) {
        throw new BadRequestException(
          'Baseline topic flow version must belong to the same topic flow',
        );
      }
    }

    const topicFlowVersion = this.topicFlowVersionsRepository.create({
      ...payload,
      approvalStatus: payload.approvalStatus as ApprovalStatusEnum | undefined,
      regressionStatus: payload.regressionStatus as
        | RegressionStatusEnum
        | undefined,
      baselineVersionId: payload.baselineVersionId ?? null,
      validationNotes: payload.validationNotes ?? null,
      approvedAt: payload.approvedAt ? new Date(payload.approvedAt) : null,
    });
    const savedTopicFlowVersion =
      await this.topicFlowVersionsRepository.save(topicFlowVersion);

    return {
      success: true,
      data: this.toTopicFlowVersionContract(savedTopicFlowVersion),
    };
  }

  async updateTopicFlowVersionStatus(
    topicFlowVersionId: string,
    payload: UpdateTopicFlowVersionStatusDto,
  ): Promise<TopicFlowVersionMutationResponseContract> {
    const topicFlowVersion = await this.topicFlowVersionsRepository.findOneBy({
      id: topicFlowVersionId,
    });
    if (!topicFlowVersion) {
      throw new NotFoundException(
        `Topic flow version not found: ${topicFlowVersionId}`,
      );
    }

    if (payload.approvalStatus) {
      topicFlowVersion.approvalStatus =
        payload.approvalStatus as unknown as ApprovalStatusEnum;
    }

    if (payload.regressionStatus) {
      topicFlowVersion.regressionStatus =
        payload.regressionStatus as unknown as RegressionStatusEnum;
    }

    if (payload.approvedAt !== undefined) {
      topicFlowVersion.approvedAt = payload.approvedAt
        ? new Date(payload.approvedAt)
        : null;
    }

    const savedTopicFlowVersion =
      await this.topicFlowVersionsRepository.save(topicFlowVersion);

    return {
      success: true,
      data: this.toTopicFlowVersionContract(savedTopicFlowVersion),
    };
  }

  async getTopicFlowVersionStatus(
    topicFlowVersionId: string,
  ): Promise<TopicFlowVersionStatusResponseContract> {
    const topicFlowVersion = await this.topicFlowVersionsRepository.findOne({
      where: { id: topicFlowVersionId },
      relations: {
        topicFlow: {
          agent: true,
        },
      },
    });

    if (!topicFlowVersion) {
      throw new NotFoundException(
        `Topic flow version not found: ${topicFlowVersionId}`,
      );
    }

    return {
      success: true,
      data: {
        id: topicFlowVersion.id,
        topicFlowId: topicFlowVersion.topicFlowId,
        topicFlowSlug: topicFlowVersion.topicFlow.slug,
        agentId: topicFlowVersion.topicFlow.agentId,
        agentSlug: topicFlowVersion.topicFlow.agent.slug,
        versionNumber: topicFlowVersion.versionNumber,
        approvalStatus: topicFlowVersion.approvalStatus,
        regressionStatus: topicFlowVersion.regressionStatus,
        baselineVersionId: topicFlowVersion.baselineVersionId,
        approvedAt: topicFlowVersion.approvedAt?.toISOString() ?? null,
        createdAt: topicFlowVersion.createdAt.toISOString(),
      },
    };
  }

  async listTopicFlowVersionsByTopicFlow(
    topicFlowId: string,
  ): Promise<TopicFlowVersionsListResponseContract> {
    const topicFlowVersions = await this.topicFlowVersionsRepository.find({
      where: { topicFlowId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: topicFlowVersions.map((item) =>
        this.toTopicFlowVersionContract(item),
      ),
    };
  }

  async listPromptUsageHistory(): Promise<PromptUsageHistoryListResponseContract> {
    const promptUsageHistory = await this.promptUsageHistoryRepository.find({
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: promptUsageHistory.map((item) =>
        this.toPromptUsageHistoryContract(item),
      ),
    };
  }

  async createPromptUsageHistory(
    payload: CreatePromptUsageHistoryDto,
  ): Promise<PromptUsageHistoryMutationResponseContract> {
    await this.validateUsageScope(
      payload.agentId,
      payload.promptVersionId,
      payload.topicFlowVersionId,
      payload.invocationSource,
    );

    const promptUsageHistory = this.promptUsageHistoryRepository.create({
      ...payload,
      invocationSource:
        payload.invocationSource as unknown as InvocationSourceEnum,
      runtimeOutcome: payload.runtimeOutcome as unknown as RuntimeOutcomeEnum,
      topicFlowVersionId: payload.topicFlowVersionId ?? null,
      adaptationRequired: payload.adaptationRequired ?? false,
      latencyMs: payload.latencyMs ?? null,
      successfulHandoffCount: payload.successfulHandoffCount ?? 0,
      failedHandoffCount: payload.failedHandoffCount ?? 0,
      tokenInputCount: payload.tokenInputCount ?? null,
      tokenOutputCount: payload.tokenOutputCount ?? null,
      sessionFingerprint: payload.sessionFingerprint ?? null,
    });
    const savedPromptUsageHistory =
      await this.promptUsageHistoryRepository.save(promptUsageHistory);

    return {
      success: true,
      data: this.toPromptUsageHistoryContract(savedPromptUsageHistory),
    };
  }

  async listInteractionLearningEvents(): Promise<InteractionLearningEventsListResponseContract> {
    const interactionLearningEvents =
      await this.interactionLearningEventsRepository.find({
        order: { observedAt: 'DESC' },
      });

    return {
      success: true,
      data: interactionLearningEvents.map((item) =>
        this.toInteractionLearningEventContract(item),
      ),
    };
  }

  async createInteractionLearningEvent(
    payload: CreateInteractionLearningEventRequestContract,
  ): Promise<InteractionLearningEventMutationResponseContract> {
    const agent = await this.agentsRepository.findOneBy({
      id: payload.agentId,
    });
    if (!agent) {
      throw new NotFoundException(`Agent not found: ${payload.agentId}`);
    }

    if (payload.promptVersionId) {
      await this.validateUsageScope(
        payload.agentId,
        payload.promptVersionId,
        payload.topicFlowVersionId,
        payload.invocationSource,
      );
    }

    const interactionLearningEvent =
      this.interactionLearningEventsRepository.create({
        agentId: payload.agentId,
        promptVersionId: payload.promptVersionId ?? null,
        topicFlowVersionId: payload.topicFlowVersionId ?? null,
        invocationSource:
          payload.invocationSource as unknown as InvocationSourceEnum,
        eventType: payload.eventType as LearningEventTypeEnum,
        severity: payload.severity,
        eventPayload: payload.eventPayload,
        humanResolution: payload.humanResolution ?? null,
      });
    const savedInteractionLearningEvent =
      await this.interactionLearningEventsRepository.save(
        interactionLearningEvent,
      );

    return {
      success: true,
      data: this.toInteractionLearningEventContract(
        savedInteractionLearningEvent,
      ),
    };
  }

  async createTopicInteraction(
    payload: CreateTopicInteractionDto,
  ): Promise<TopicInteractionMutationResponseContract> {
    const decision = this.buildTopicDecisionContract(payload);

    return this.interactionLearningEventsRepository.manager.transaction(
      async (manager) => {
        const agentsRepository = manager.getRepository(LlmOpsAgentEntity);
        const interactionLearningEventsRepository = manager.getRepository(
          InteractionLearningEventEntity,
        );
        const promptUsageHistoryRepository = manager.getRepository(
          PromptUsageHistoryEntity,
        );
        const promptVersionsRepository =
          manager.getRepository(PromptVersionEntity);
        const topicFlowVersionsRepository = manager.getRepository(
          TopicFlowVersionEntity,
        );

        const agent = await agentsRepository.findOneBy({ id: payload.agentId });
        if (!agent) {
          throw new NotFoundException(`Agent not found: ${payload.agentId}`);
        }

        let promptVersion: PromptVersionEntity | null = null;
        let topicFlowVersion: TopicFlowVersionEntity | null = null;

        if (payload.promptVersionId) {
          promptVersion = await promptVersionsRepository.findOne({
            where: { id: payload.promptVersionId },
            relations: {
              promptTemplate: true,
            },
          });
          if (!promptVersion) {
            throw new NotFoundException(
              `Prompt version not found: ${payload.promptVersionId}`,
            );
          }
          if (promptVersion.promptTemplate.agentId !== payload.agentId) {
            throw new BadRequestException(
              'Prompt version must belong to the topic interaction agent',
            );
          }
          if (promptVersion.invocationSource !== payload.invocationSource) {
            throw new BadRequestException(
              'Prompt version invocation source must match the topic interaction invocation source',
            );
          }
        }

        if (payload.topicFlowVersionId) {
          topicFlowVersion = await topicFlowVersionsRepository.findOne({
            where: { id: payload.topicFlowVersionId },
            relations: {
              topicFlow: true,
            },
          });
          if (!topicFlowVersion) {
            throw new NotFoundException(
              `Topic flow version not found: ${payload.topicFlowVersionId}`,
            );
          }
          if (topicFlowVersion.topicFlow.agentId !== payload.agentId) {
            throw new BadRequestException(
              'Topic flow version must belong to the topic interaction agent',
            );
          }
          if (
            topicFlowVersion.topicFlow.invocationSource !==
            payload.invocationSource
          ) {
            throw new BadRequestException(
              'Topic flow invocation source must match the topic interaction invocation source',
            );
          }
        }

        const interactionLearningEvent =
          interactionLearningEventsRepository.create({
            agentId: payload.agentId,
            promptVersionId: payload.promptVersionId ?? null,
            topicFlowVersionId: payload.topicFlowVersionId ?? null,
            invocationSource: payload.invocationSource,
            eventType: payload.eventType,
            severity: payload.severity,
            eventPayload: {
              ...payload.eventPayload,
              decision,
            },
            humanResolution: payload.humanResolution ?? null,
          });
        const savedInteractionLearningEvent =
          await interactionLearningEventsRepository.save(
            interactionLearningEvent,
          );

        let promptUsageHistory: PromptUsageHistoryEntity | null = null;
        if (payload.promptVersionId && payload.runtimeOutcome) {
          promptUsageHistory = promptUsageHistoryRepository.create({
            agentId: payload.agentId,
            promptVersionId: payload.promptVersionId,
            topicFlowVersionId: payload.topicFlowVersionId ?? null,
            invocationSource: payload.invocationSource,
            runtimeOutcome: payload.runtimeOutcome,
            adaptationRequired: payload.adaptationRequired ?? false,
            latencyMs: payload.latencyMs ?? null,
            successfulHandoffCount: payload.successfulHandoffCount ?? 0,
            failedHandoffCount: payload.failedHandoffCount ?? 0,
            tokenInputCount: payload.tokenInputCount ?? null,
            tokenOutputCount: payload.tokenOutputCount ?? null,
            sessionFingerprint: payload.sessionFingerprint ?? null,
          });
          promptUsageHistory =
            await promptUsageHistoryRepository.save(promptUsageHistory);
        }

        return {
          success: true,
          data: {
            decision,
            interactionLearningEvent: this.toInteractionLearningEventContract(
              savedInteractionLearningEvent,
            ),
            promptUsageHistory: promptUsageHistory
              ? this.toPromptUsageHistoryContract(promptUsageHistory)
              : null,
          },
        };
      },
    );
  }

  private detectAdministrativeTask(
    message: string,
  ): AskAndAnswerAdministrativeTaskContract {
    const explicitKeyIntent = message.match(
      /\[intencao-chave\]\s*acao=([^;]+);\s*alvo=([^;]+);/i,
    );
    if (explicitKeyIntent) {
      const explicitAction = explicitKeyIntent[1]?.trim() || 'manage-secret';
      if (explicitAction.toLowerCase() === 'validate') {
        return {
          detected: false,
          action: null,
          target: null,
          mode: 'dry-run',
          nextStep:
            'Validacao de chaves foi desativada no Ask and Answer; use apenas rotacao, cadastro ou revogacao por endpoint administrativo auditavel.',
        };
      }

      return {
        detected: true,
        action: explicitAction,
        target: explicitKeyIntent[2]?.trim() || 'secret',
        mode: 'dry-run',
        nextStep:
          'Registrar a intenção, validar escopo/permissão e executar somente por endpoint administrativo auditável.',
      };
    }

    const normalized = message.toLowerCase();
    const administrativePatterns = [
      {
        action: 'rotate-secret',
        pattern:
          /\b(rotacionar|rotacione|trocar|renovar)\b.*\b(chave|token|secret|segredo)\b/i,
      },
      {
        action: 'manage-user',
        pattern:
          /\b(criar|remover|bloquear|desativar|reativar)\b.*\b(usuario|usuário|membro|permiss[aã]o)\b/i,
      },
      {
        action: 'manage-m365-object',
        pattern:
          /\b(teams|sharepoint|onedrive|mailbox|grupo|canal)\b.*\b(criar|remover|incluir|alterar|migrar)\b/i,
      },
    ];
    const match = administrativePatterns.find((item) =>
      item.pattern.test(message),
    );

    return {
      detected: Boolean(match),
      action: match?.action ?? null,
      target: match ? this.inferAdministrativeTarget(normalized) : null,
      mode: 'dry-run',
      nextStep: match
        ? 'Gerar plano de execução e persistir dry-run antes de qualquer mutação real.'
        : 'Responder como consulta operacional sem executar mutação administrativa.',
    };
  }

  private inferAdministrativeTarget(normalizedMessage: string): string | null {
    const candidates = [
      'ASTRA_DB_APPLICATION_TOKEN',
      'LANGFLOW_API_KEY',
      'OPENAI_API_KEY',
      'LLM_API_KEY',
      'SOURCE_TENANT_ID',
      'TARGET_TENANT_ID',
    ];
    const matchedEnv = candidates.find((candidate) =>
      normalizedMessage.includes(candidate.toLowerCase()),
    );
    if (matchedEnv) {
      return matchedEnv;
    }

    if (normalizedMessage.includes('astra')) {
      return 'astra';
    }
    if (normalizedMessage.includes('langflow')) {
      return 'langflow';
    }
    if (normalizedMessage.includes('teams')) {
      return 'teams';
    }
    if (normalizedMessage.includes('sharepoint')) {
      return 'sharepoint';
    }
    if (normalizedMessage.includes('onedrive')) {
      return 'onedrive';
    }
    if (normalizedMessage.includes('mailbox')) {
      return 'mailbox';
    }

    return 'application';
  }

  private toLangflowContract(
    run: Awaited<ReturnType<LangflowClientService['runRagFlow']>> | undefined,
  ): AskAndAnswerLangflowContract | null {
    if (!run) {
      return null;
    }

    return {
      enabled: run.enabled,
      attempted: run.attempted,
      reachable: run.reachable,
      ragFlowId: run.ragFlowId,
      outputText: run.outputText,
      error: run.error,
    };
  }

  private buildRecommendedActions(
    resourceContext: AskAndAnswerResourceContextContract,
  ): AskAndAnswerRecommendedActionContract[] {
    const sharedPreconditions = [
      'Confirmar escopo funcional',
      'Validar permissões mínimas',
      'Executar smoke test do domínio',
    ];

    switch (resourceContext.domain) {
      case 'users':
        return [
          {
            action: 'Revisar lista de usuários e identificar inconsistências',
            targetEndpoint: '/users',
            preconditions: sharedPreconditions,
            rationale: 'Permite diagnóstico inicial sem mutações.',
          },
          {
            action: 'Inspecionar usuário específico por identificador',
            targetEndpoint: '/users/:id',
            preconditions: [
              'Informar id de usuário válido',
              ...sharedPreconditions,
            ],
            rationale: 'Gera recomendação direcionada para correção posterior.',
          },
        ];
      case 'graph':
        return [
          {
            action: 'Validar autenticação e saúde do Graph',
            targetEndpoint: '/graph/auth/status',
            preconditions: sharedPreconditions,
            rationale: 'Evita recomendações sobre recursos inacessíveis.',
          },
          {
            action: 'Listar recursos principais do tenant',
            targetEndpoint: '/graph/sites',
            preconditions: sharedPreconditions,
            rationale: 'Ajuda a priorizar ações com base em inventário real.',
          },
        ];
      case 'sharepoint':
        return [
          {
            action:
              'Coletar identificadores do recurso alvo (drive/site/lista)',
            targetEndpoint: '/sharepoint/drives/:driveId/items',
            preconditions: [
              'Informar driveId/siteId/listId válidos',
              ...sharedPreconditions,
            ],
            rationale:
              'SharePoint exige ids concretos para consulta detalhada.',
          },
        ];
      case 'sync':
        return [
          {
            action: 'Auditar fila e status de jobs de sincronização',
            targetEndpoint: '/sync/jobs',
            preconditions: sharedPreconditions,
            rationale: 'Mostra backlog e falhas antes de novas execuções.',
          },
        ];
      case 'governance':
        return [
          {
            action: 'Revalidar compliance de permissões',
            targetEndpoint: '/governance/permissions/validation',
            preconditions: sharedPreconditions,
            rationale: 'Mantém o assistente alinhado à política de acesso.',
          },
        ];
      case 'audit':
        return [
          {
            action: 'Consultar estatísticas e eventos recentes',
            targetEndpoint: '/audit/stats',
            preconditions: sharedPreconditions,
            rationale: 'Fornece evidência objetiva para priorização.',
          },
        ];
      case 'llm-ops':
      default:
        return [
          {
            action: 'Conferir agentes e templates ativos',
            targetEndpoint: '/llm-ops/agents',
            preconditions: sharedPreconditions,
            rationale: 'Garante que o pipeline de resposta está configurado.',
          },
          {
            action: 'Executar validação de RAG com termo conhecido',
            targetEndpoint: '/llm-ops/chat',
            preconditions: [
              'Ingerir documento em /llm-ops/knowledge-base/documents',
              ...sharedPreconditions,
            ],
            rationale: 'Confirma recuperação contextual e orquestração.',
          },
        ];
    }
  }

  getResourcesCatalog(): ResourceCatalogResponseContract {
    const catalog = this.resourceReadonlyAdapterService?.getCatalog() ?? {
      executionMode: this.executionMode,
      resources: [],
    };

    return {
      success: true,
      data: catalog,
    };
  }

  async ingestKnowledgeBaseDocuments(
    payload: IngestKnowledgeBaseDto,
  ): Promise<{ success: true; data: { insertedIds: string[] } }> {
    const insertedIds = await this.astraRagService.ingestKnowledgeDocuments(
      payload.documents,
    );

    return {
      success: true,
      data: {
        insertedIds,
      },
    };
  }

  async listPromptUsageHistoryByPromptVersion(
    promptVersionId: string,
  ): Promise<PromptUsageHistoryListResponseContract> {
    const promptUsageHistory = await this.promptUsageHistoryRepository.find({
      where: { promptVersionId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: promptUsageHistory.map((item) =>
        this.toPromptUsageHistoryContract(item),
      ),
    };
  }

  async getPromptUsageHistoryStatus(
    promptUsageHistoryId: string,
  ): Promise<PromptUsageHistoryStatusResponseContract> {
    const promptUsageHistory = await this.promptUsageHistoryRepository.findOne({
      where: { id: promptUsageHistoryId },
      relations: {
        agent: true,
        promptVersion: {
          promptTemplate: {
            agent: true,
          },
        },
        topicFlowVersion: {
          topicFlow: {
            agent: true,
          },
        },
      },
    });

    if (!promptUsageHistory) {
      throw new NotFoundException(
        `Prompt usage history not found: ${promptUsageHistoryId}`,
      );
    }

    return {
      success: true,
      data: {
        id: promptUsageHistory.id,
        agentId: promptUsageHistory.agentId,
        agentSlug: promptUsageHistory.agent.slug,
        promptVersionId: promptUsageHistory.promptVersionId,
        promptTemplateId: promptUsageHistory.promptVersion.promptTemplateId,
        promptTemplateSlug:
          promptUsageHistory.promptVersion.promptTemplate.slug,
        topicFlowVersionId: promptUsageHistory.topicFlowVersionId,
        topicFlowSlug:
          promptUsageHistory.topicFlowVersion?.topicFlow.slug ?? null,
        topicFlowAgentSlug:
          promptUsageHistory.topicFlowVersion?.topicFlow.agent.slug ?? null,
        invocationSource: promptUsageHistory.invocationSource,
        runtimeOutcome: promptUsageHistory.runtimeOutcome,
        adaptationRequired: promptUsageHistory.adaptationRequired,
        latencyMs: promptUsageHistory.latencyMs,
        successfulHandoffCount: promptUsageHistory.successfulHandoffCount,
        failedHandoffCount: promptUsageHistory.failedHandoffCount,
        tokenInputCount: promptUsageHistory.tokenInputCount,
        tokenOutputCount: promptUsageHistory.tokenOutputCount,
        sessionFingerprint: promptUsageHistory.sessionFingerprint,
        createdAt: promptUsageHistory.createdAt.toISOString(),
      },
    };
  }

  async askAndAnswer(
    payload: AskAndAnswerDto | AskAndAnswerRequestContract,
  ): Promise<AskAndAnswerResponseContract> {
    const requestedInvocationSource =
      payload.invocationSource ?? InvocationSourceEnum.API;
    const normalizedMessage = payload.message.trim();
    const correlationId = payload.sessionFingerprint ?? randomUUID();

    const agent = payload.agentId
      ? await this.agentsRepository.findOneBy({ id: payload.agentId })
      : ((
          await this.agentsRepository.find({
            order: { createdAt: 'DESC' },
            take: 1,
          })
        )[0] ?? null);

    if (!agent) {
      throw new NotFoundException(
        'No llm-ops agent is available for Ask and Answer',
      );
    }

    const promptVersionCandidates = await this.promptVersionsRepository.find({
      where: {
        invocationSource: requestedInvocationSource as InvocationSourceEnum,
      },
      relations: {
        promptTemplate: {
          agent: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
    const promptVersion = promptVersionCandidates.find((candidate) => {
      if (
        payload.promptTemplateId &&
        candidate.promptTemplateId !== payload.promptTemplateId
      ) {
        return false;
      }
      if (
        payload.agentId &&
        candidate.promptTemplate.agentId !== payload.agentId
      ) {
        return false;
      }
      return true;
    });

    const topicFlowVersionId: string | null = null;

    const context = this.buildAskAndAnswerContext(
      agent,
      promptVersion ?? null,
      null,
    );
    const resourceIntent = detectResourceIntent(normalizedMessage);
    const resourceContext =
      (await this.resourceReadonlyAdapterService?.fetchResourceContext(
        resourceIntent,
      )) ?? {
        domain: resourceIntent.domain,
        resource: resourceIntent.resource,
        consultedEndpoint: null,
        summary:
          'Adaptador read-only indisponível; resposta em modo de recomendação.',
        snapshot: null,
      };
    const recommendedActions = this.buildRecommendedActions(resourceContext);
    const astraRetrievedContext = await this.astraRagService.retrieveContext(
      normalizedMessage,
      agent.id,
    );
    const retrievedContext =
      astraRetrievedContext.length > 0
        ? astraRetrievedContext
        : [
            context.agentSlug ? `agent:${context.agentSlug}` : null,
            context.promptTemplateSlug
              ? `prompt-template:${context.promptTemplateSlug}`
              : null,
            context.topicFlowSlug
              ? `topic-flow:${context.topicFlowSlug}`
              : null,
          ].filter((item): item is string => item !== null);
    const administrativeTask = this.detectAdministrativeTask(normalizedMessage);
    const langflowRun = await this.langflowClientService?.runRagFlow(
      normalizedMessage,
      correlationId,
      retrievedContext,
    );
    const langflowAnswerSegment = langflowRun?.enabled
      ? langflowRun.reachable
        ? `Langflow executou o flow RAG ${langflowRun.ragFlowId ?? 'não informado'}${
            langflowRun.outputText
              ? ` e retornou: ${langflowRun.outputText}`
              : ', mas não retornou texto extra'
          }.`
        : `Langflow habilitado, mas o flow RAG não executou: ${langflowRun.error ?? 'erro não informado'}.`
      : null;
    const administrativeAnswerSegment = administrativeTask.detected
      ? `Intenção administrativa detectada (${administrativeTask.action ?? 'acao-nao-classificada'} em ${administrativeTask.target ?? 'alvo-nao-classificado'}). O agente classificou a solicitação em modo ${administrativeTask.mode}; nenhuma mutação real será executada pelo chat sem endpoint auditável, validação de permissão, histórico durável de operação e rollback.`
      : null;

    const answer = [
      `Ask and Answer recebeu: ${normalizedMessage}.`,
      `Modo de execução: ${this.executionMode}.`,
      `Recurso detectado: ${resourceContext.domain}/${resourceContext.resource}.`,
      `Snapshot operacional: ${resourceContext.summary}.`,
      context.agentSlug
        ? `Agente selecionado: ${context.agentSlug}.`
        : 'Agente padrão selecionado.',
      context.promptTemplateSlug
        ? `Template ativo: ${context.promptTemplateSlug}.`
        : 'Template ainda não definido.',
      context.topicFlowSlug
        ? `Topic flow ativo: ${context.topicFlowSlug}.`
        : 'Topic flow ainda não definido.',
      astraRetrievedContext.length > 0
        ? `Contexto recuperado do AstraDB: ${astraRetrievedContext.join(' || ')}.`
        : 'Nenhum documento do AstraDB foi recuperado; usando contexto operacional local.',
      langflowAnswerSegment,
      administrativeAnswerSegment,
      'O Postgres continua armazenando apenas o historico operacional capturado pela API; o historico administrativo dedicado ainda precisa ser implementado antes de qualquer acao real.',
    ]
      .filter((segment): segment is string => segment !== null)
      .join(' ');

    const messages: AskAndAnswerMessageContract[] = [
      {
        role: 'user',
        text: normalizedMessage,
      },
      {
        role: 'assistant',
        text: answer,
      },
    ];

    if (promptVersion) {
      await this.promptUsageHistoryRepository.save(
        this.promptUsageHistoryRepository.create({
          agentId: context.agentId ?? agent.id,
          promptVersionId: promptVersion.id,
          topicFlowVersionId,
          invocationSource: requestedInvocationSource as InvocationSourceEnum,
          runtimeOutcome: RuntimeOutcomeEnum.SUCCESS,
          adaptationRequired: false,
          latencyMs: null,
          successfulHandoffCount: 0,
          failedHandoffCount: 0,
          tokenInputCount: normalizedMessage.length,
          tokenOutputCount: answer.length,
          sessionFingerprint: payload.sessionFingerprint ?? null,
        }),
      );
    }

    const interactionLearningEventPayload: CreateInteractionLearningEventRequestContract =
      {
        agentId: context.agentId ?? agent.id,
        promptVersionId: promptVersion?.id ?? null,
        topicFlowVersionId,
        invocationSource: requestedInvocationSource as InvocationSourceEnum,
        eventType: 'ambiguity',
        severity: 'info',
        eventPayload: {
          channel: 'ask-and-answer',
          message: normalizedMessage,
          answer,
          context,
          resourceContext,
          recommendedActions,
          executionMode: this.executionMode,
          retrievedContext,
          langflow: this.toLangflowContract(langflowRun),
          administrativeTask,
          sessionFingerprint: payload.sessionFingerprint ?? null,
          correlationId,
        },
        humanResolution: null,
      };

    await this.interactionLearningEventsRepository.save(
      this.interactionLearningEventsRepository.create({
        agentId: interactionLearningEventPayload.agentId,
        promptVersionId: interactionLearningEventPayload.promptVersionId,
        topicFlowVersionId: interactionLearningEventPayload.topicFlowVersionId,
        invocationSource:
          interactionLearningEventPayload.invocationSource as InvocationSourceEnum,
        eventType:
          interactionLearningEventPayload.eventType as LearningEventTypeEnum,
        severity: interactionLearningEventPayload.severity,
        eventPayload: interactionLearningEventPayload.eventPayload,
        humanResolution: interactionLearningEventPayload.humanResolution,
      }),
    );

    this.astraRagService.recordInteraction({
      agentId: context.agentId ?? agent.id,
      promptVersionId: promptVersion?.id ?? null,
      topicFlowVersionId,
      invocationSource: requestedInvocationSource,
      correlationId,
      sessionFingerprint: payload.sessionFingerprint ?? null,
      message: normalizedMessage,
      answer,
      retrievedContext,
    });

    return {
      success: true,
      data: {
        answer,
        messages,
        context,
        resourceContext,
        recommendedActions,
        executionMode: this.executionMode,
        runtimeOutcome: RuntimeOutcomeEnum.SUCCESS,
        retrievedContext,
        orchestration: {
          langflow: this.toLangflowContract(langflowRun),
          administrativeTask,
        },
        correlationId,
      },
    };
  }
}
