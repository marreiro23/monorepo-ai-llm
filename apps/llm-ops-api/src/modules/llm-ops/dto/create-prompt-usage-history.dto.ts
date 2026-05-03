import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import type {
  CreatePromptUsageHistoryRequestContract,
  InvocationSourceContract,
  RuntimeOutcomeContract,
} from '@api-llm-embedded/shared';
import {
  InvocationSourceEnum,
  RuntimeOutcomeEnum,
} from '../entities/llm-ops.enums.js';

export class CreatePromptUsageHistoryDto implements CreatePromptUsageHistoryRequestContract {
  @IsString()
  @IsNotEmpty()
  agentId!: string;

  @IsString()
  @IsNotEmpty()
  promptVersionId!: string;

  @IsString()
  @IsOptional()
  topicFlowVersionId?: string | null;

  @IsEnum(InvocationSourceEnum)
  invocationSource!: InvocationSourceContract;

  @IsEnum(RuntimeOutcomeEnum)
  runtimeOutcome!: RuntimeOutcomeContract;

  @IsBoolean()
  @IsOptional()
  adaptationRequired?: boolean;

  @IsNumber()
  @IsOptional()
  latencyMs?: number | null;

  @IsNumber()
  @IsOptional()
  successfulHandoffCount?: number;

  @IsNumber()
  @IsOptional()
  failedHandoffCount?: number;

  @IsNumber()
  @IsOptional()
  tokenInputCount?: number | null;

  @IsNumber()
  @IsOptional()
  tokenOutputCount?: number | null;

  @IsString()
  @IsOptional()
  sessionFingerprint?: string | null;
}
