import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { InvocationSourceEnum, LearningEventTypeEnum, RuntimeOutcomeEnum, TopicDomainEnum } from '../entities/llm-ops.enums.js';

export class CreateTopicInteractionDto {
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

  @IsEnum(TopicDomainEnum)
  decisionCapabilityFamily!: TopicDomainEnum;

  @IsString()
  @IsNotEmpty()
  decisionAction!: string;

  @IsString()
  @IsNotEmpty()
  decisionTarget!: string;

  @IsString()
  @IsOptional()
  decisionProposedEndpoint?: string | null;

  @IsString()
  @IsNotEmpty()
  decisionRationale!: string;

  @IsOptional()
  @IsNumber()
  decisionConfidence?: number | null;

  @IsOptional()
  decisionRequiresNewEndpoint?: boolean;

  @IsOptional()
  @IsEnum(RuntimeOutcomeEnum)
  runtimeOutcome?: RuntimeOutcomeEnum;

  @IsOptional()
  @IsBoolean()
  adaptationRequired?: boolean;

  @IsOptional()
  @IsNumber()
  latencyMs?: number | null;

  @IsOptional()
  @IsNumber()
  successfulHandoffCount?: number;

  @IsOptional()
  @IsNumber()
  failedHandoffCount?: number;

  @IsOptional()
  @IsNumber()
  tokenInputCount?: number | null;

  @IsOptional()
  @IsNumber()
  tokenOutputCount?: number | null;

  @IsOptional()
  @IsString()
  sessionFingerprint?: string | null;
}
