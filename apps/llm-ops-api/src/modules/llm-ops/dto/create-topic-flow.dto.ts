import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import type {
  CreateTopicFlowRequestContract,
  InvocationSourceContract,
  TopicDomainContract,
} from '@api-llm-embedded/shared';
import {
  InvocationSourceEnum,
  TopicDomainEnum,
} from '../entities/llm-ops.enums.js';

export class CreateTopicFlowDto implements CreateTopicFlowRequestContract {
  @IsString()
  @IsNotEmpty()
  agentId!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(TopicDomainEnum)
  topicDomain!: TopicDomainContract;

  @IsEnum(InvocationSourceEnum)
  invocationSource!: InvocationSourceContract;

  @IsBoolean()
  @IsOptional()
  isActive!: boolean;
}
