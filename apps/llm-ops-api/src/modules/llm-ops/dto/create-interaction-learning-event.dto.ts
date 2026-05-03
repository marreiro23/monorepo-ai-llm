import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { InvocationSourceEnum, LearningEventTypeEnum } from '../entities/llm-ops.enums.js';

export class CreateInteractionLearningEventDto {
  @IsString()
  @IsNotEmpty()
  agentId!: string;

  @IsString()
  @IsOptional()
  promptVersionId?: string | null;

  @IsString()
  @IsOptional()
  topicFlowVersionId?: string | null;

  @IsEnum(InvocationSourceEnum)
  invocationSource!: InvocationSourceEnum;

  @IsEnum(LearningEventTypeEnum)
  eventType!: LearningEventTypeEnum;

  @IsString()
  severity!: string;

  @IsObject()
  eventPayload!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  humanResolution?: string | null;
}
