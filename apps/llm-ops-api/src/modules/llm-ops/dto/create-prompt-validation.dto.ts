import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import type { CreatePromptValidationRequestContract, ValidationStatusContract } from '@api-llm-embedded/shared';
import { ValidationStatusEnum } from '../entities/llm-ops.enums.js';

export class CreatePromptValidationDto implements CreatePromptValidationRequestContract {
  @IsString()
  @IsNotEmpty()
  promptVersionId!: string;

  @IsString()
  @IsNotEmpty()
  validatorName!: string;

  @IsString()
  @IsNotEmpty()
  validatorPhase!: string;

  @IsEnum(ValidationStatusEnum)
  validationStatus!: ValidationStatusContract;

  @IsNumber()
  @IsOptional()
  criticalAmbiguityCount?: number;

  @IsNumber()
  @IsOptional()
  warningCount?: number;

  @IsString()
  @IsOptional()
  coherenceScore?: string | null;

  @IsArray()
  @IsOptional()
  findings?: Array<Record<string, unknown>>;

  @IsString()
  @IsOptional()
  summary?: string | null;

  @IsString()
  @IsNotEmpty()
  validatedBy!: string;
}
