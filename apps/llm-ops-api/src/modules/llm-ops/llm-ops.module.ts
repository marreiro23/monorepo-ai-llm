import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LlmOpsController } from './llm-ops.controller.js';
import { LlmOpsService } from './llm-ops.service.js';
import { AstraRagService } from './astra-rag.service.js';
import { LangflowClientService } from './langflow-client.service.js';
import { ResourceReadonlyAdapterService } from './resource-readonly-adapter.service.js';
import {
  InteractionLearningEventEntity,
  LlmOpsAgentEntity,
  PromptDependencyEntity,
  PromptTemplateEntity,
  PromptUsageHistoryEntity,
  PromptValidationEntity,
  PromptVersionEntity,
  TopicFlowEntity,
  TopicFlowVersionEntity
} from './entities/index.js';
import {
  buildLlmOpsTypeOrmOptions,
  LLM_OPS_DATABASE_CONNECTION_NAME
} from '../../infra/database/typeorm.config.js';

const llmOpsEntities = [
  LlmOpsAgentEntity,
  PromptTemplateEntity,
  PromptVersionEntity,
  PromptValidationEntity,
  TopicFlowEntity,
  TopicFlowVersionEntity,
  PromptDependencyEntity,
  InteractionLearningEventEntity,
  PromptUsageHistoryEntity
];

@Module({})
export class LlmOpsModule {
  static forRoot(): DynamicModule {
    return {
      module: LlmOpsModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          name: LLM_OPS_DATABASE_CONNECTION_NAME,
          useFactory: (configService: ConfigService) => buildLlmOpsTypeOrmOptions(configService)
        }),
        TypeOrmModule.forFeature(llmOpsEntities, LLM_OPS_DATABASE_CONNECTION_NAME)
      ],
      controllers: [LlmOpsController],
      providers: [LlmOpsService, AstraRagService, LangflowClientService, ResourceReadonlyAdapterService],
      exports: [TypeOrmModule]
    };
  }
}
