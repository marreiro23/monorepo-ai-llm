import { Body, Controller, Get, Patch, Post, Query, Param } from '@nestjs/common';
import type {
  AgentMutationResponseContract,
  AgentsListResponseContract,
  AskAndAnswerResponseContract,
  InteractionLearningEventMutationResponseContract,
  InteractionLearningEventsListResponseContract,
  PromptUsageHistoryListResponseContract,
  PromptUsageHistoryMutationResponseContract,
  PromptUsageHistoryStatusResponseContract,
  PromptValidationMutationResponseContract,
  PromptValidationsListResponseContract,
  PromptTemplateMutationResponseContract,
  PromptTemplatesListResponseContract,
  PromptVersionStatusResponseContract,
  PromptVersionMutationResponseContract,
  PromptVersionsListResponseContract,
  ResourceCatalogResponseContract,
  TopicFlowMutationResponseContract,
  TopicFlowsListResponseContract,
  TopicFlowVersionMutationResponseContract,
  TopicFlowVersionsListResponseContract,
  TopicFlowVersionStatusResponseContract,
  TopicInteractionMutationResponseContract
} from '@api-llm-embedded/shared';
import { CreateAgentDto } from './dto/create-agent.dto.js';
import { AskAndAnswerDto } from './dto/ask-and-answer.dto.js';
import { CreateInteractionLearningEventDto } from './dto/create-interaction-learning-event.dto.js';
import { IngestKnowledgeBaseDto } from './dto/ingest-knowledge-base.dto.js';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto.js';
import { CreateTopicInteractionDto } from './dto/create-topic-interaction.dto.js';
import { CreatePromptUsageHistoryDto } from './dto/create-prompt-usage-history.dto.js';
import { CreatePromptValidationDto } from './dto/create-prompt-validation.dto.js';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto.js';
import { CreateTopicFlowDto } from './dto/create-topic-flow.dto.js';
import { CreateTopicFlowVersionDto } from './dto/create-topic-flow-version.dto.js';
import { UpdatePromptVersionStatusDto } from './dto/update-prompt-version-status.dto.js';
import { UpdateTopicFlowVersionStatusDto } from './dto/update-topic-flow-version-status.dto.js';
import { LlmOpsService } from './llm-ops.service.js';

@Controller('llm-ops')
export class LlmOpsController {
  constructor(private readonly llmOpsService: LlmOpsService) {}

  @Get('resources/catalog')
  getResourcesCatalog(): Promise<ResourceCatalogResponseContract> {
    return this.llmOpsService.getResourcesCatalog();
  }

  @Get('agents')
  listAgents(): Promise<AgentsListResponseContract> {
    return this.llmOpsService.listAgents();
  }

  @Post('agents')
  createAgent(@Body() payload: CreateAgentDto): Promise<AgentMutationResponseContract> {
    return this.llmOpsService.createAgent(payload);
  }

  @Get('prompt-templates')
  listPromptTemplates(@Query('agentId') agentId?: string): Promise<PromptTemplatesListResponseContract> {
    if (agentId) {
      return this.llmOpsService.listPromptTemplatesByAgent(agentId);
    }

    return this.llmOpsService.listPromptTemplates();
  }

  @Post('prompt-templates')
  createPromptTemplate(@Body() payload: CreatePromptTemplateDto): Promise<PromptTemplateMutationResponseContract> {
    return this.llmOpsService.createPromptTemplate(payload);
  }

  @Get('prompt-versions')
  listPromptVersions(@Query('promptTemplateId') promptTemplateId?: string): Promise<PromptVersionsListResponseContract> {
    if (promptTemplateId) {
      return this.llmOpsService.listPromptVersionsByTemplate(promptTemplateId);
    }

    return this.llmOpsService.listPromptVersions();
  }

  @Post('prompt-versions')
  createPromptVersion(@Body() payload: CreatePromptVersionDto): Promise<PromptVersionMutationResponseContract> {
    return this.llmOpsService.createPromptVersion(payload);
  }

  @Patch('prompt-versions/:promptVersionId/status')
  updatePromptVersionStatus(
    @Param('promptVersionId') promptVersionId: string,
    @Body() payload: UpdatePromptVersionStatusDto
  ): Promise<PromptVersionMutationResponseContract> {
    return this.llmOpsService.updatePromptVersionStatus(promptVersionId, payload);
  }

  @Get('prompt-versions/:promptVersionId/status')
  getPromptVersionStatus(@Param('promptVersionId') promptVersionId: string): Promise<PromptVersionStatusResponseContract> {
    return this.llmOpsService.getPromptVersionStatus(promptVersionId);
  }

  @Get('prompt-validations')
  listPromptValidations(): Promise<PromptValidationsListResponseContract> {
    return this.llmOpsService.listPromptValidations();
  }

  @Post('prompt-validations')
  createPromptValidation(@Body() payload: CreatePromptValidationDto): Promise<PromptValidationMutationResponseContract> {
    return this.llmOpsService.createPromptValidation(payload);
  }

  @Get('topic-flows')
  listTopicFlows(
    @Query('agentId') agentId?: string,
    @Query('topicDomain') topicDomain?: string
  ): Promise<TopicFlowsListResponseContract> {
    if (agentId) {
      return this.llmOpsService.listTopicFlowsByAgent(agentId, topicDomain);
    }

    return this.llmOpsService.listTopicFlows(topicDomain);
  }

  @Post('topic-flows')
  createTopicFlow(@Body() payload: CreateTopicFlowDto): Promise<TopicFlowMutationResponseContract> {
    return this.llmOpsService.createTopicFlow(payload);
  }

  @Get('topic-flow-versions')
  listTopicFlowVersions(@Query('topicFlowId') topicFlowId?: string): Promise<TopicFlowVersionsListResponseContract> {
    if (topicFlowId) {
      return this.llmOpsService.listTopicFlowVersionsByTopicFlow(topicFlowId);
    }

    return this.llmOpsService.listTopicFlowVersions();
  }

  @Post('topic-flow-versions')
  createTopicFlowVersion(@Body() payload: CreateTopicFlowVersionDto): Promise<TopicFlowVersionMutationResponseContract> {
    return this.llmOpsService.createTopicFlowVersion(payload);
  }

  @Patch('topic-flow-versions/:topicFlowVersionId/status')
  updateTopicFlowVersionStatus(
    @Param('topicFlowVersionId') topicFlowVersionId: string,
    @Body() payload: UpdateTopicFlowVersionStatusDto
  ): Promise<TopicFlowVersionMutationResponseContract> {
    return this.llmOpsService.updateTopicFlowVersionStatus(topicFlowVersionId, payload);
  }

  @Get('topic-flow-versions/:topicFlowVersionId/status')
  getTopicFlowVersionStatus(@Param('topicFlowVersionId') topicFlowVersionId: string): Promise<TopicFlowVersionStatusResponseContract> {
    return this.llmOpsService.getTopicFlowVersionStatus(topicFlowVersionId);
  }

  @Get('prompt-usage-history')
  listPromptUsageHistory(@Query('promptVersionId') promptVersionId?: string): Promise<PromptUsageHistoryListResponseContract> {
    if (promptVersionId) {
      return this.llmOpsService.listPromptUsageHistoryByPromptVersion(promptVersionId);
    }

    return this.llmOpsService.listPromptUsageHistory();
  }

  @Post('prompt-usage-history')
  createPromptUsageHistory(@Body() payload: CreatePromptUsageHistoryDto): Promise<PromptUsageHistoryMutationResponseContract> {
    return this.llmOpsService.createPromptUsageHistory(payload);
  }

  @Get('interaction-learning-events')
  listInteractionLearningEvents(): Promise<InteractionLearningEventsListResponseContract> {
    return this.llmOpsService.listInteractionLearningEvents();
  }

  @Post('interaction-learning-events')
  createInteractionLearningEvent(
    @Body() payload: CreateInteractionLearningEventDto
  ): Promise<InteractionLearningEventMutationResponseContract> {
    return this.llmOpsService.createInteractionLearningEvent(payload);
  }

  @Post('topic-interactions')
  createTopicInteraction(@Body() payload: CreateTopicInteractionDto): Promise<TopicInteractionMutationResponseContract> {
    return this.llmOpsService.createTopicInteraction(payload);
  }

  @Post('knowledge-base/documents')
  ingestKnowledgeBase(@Body() payload: IngestKnowledgeBaseDto): Promise<{ success: true; data: { insertedIds: string[] } }> {
    return this.llmOpsService.ingestKnowledgeBaseDocuments(payload);
  }

  @Get('prompt-usage-history/:promptUsageHistoryId/status')
  getPromptUsageHistoryStatus(
    @Param('promptUsageHistoryId') promptUsageHistoryId: string
  ): Promise<PromptUsageHistoryStatusResponseContract> {
    return this.llmOpsService.getPromptUsageHistoryStatus(promptUsageHistoryId);
  }

  @Post('chat')
  askAndAnswer(@Body() payload: AskAndAnswerDto): Promise<AskAndAnswerResponseContract> {
    return this.llmOpsService.askAndAnswer(payload);
  }
}
