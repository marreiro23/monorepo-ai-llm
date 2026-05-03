import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import type {
  ApprovalStatusContract,
  CreateTopicFlowVersionRequestContract,
  RegressionStatusContract,
} from '@api-llm-embedded/shared';
import {
  ApprovalStatusEnum,
  RegressionStatusEnum,
} from '../entities/llm-ops.enums.js';

export class CreateTopicFlowVersionDto implements CreateTopicFlowVersionRequestContract {
  @IsString()
  @IsNotEmpty()
  topicFlowId!: string;

  @IsNumber()
  versionNumber!: number;

  @IsEnum(ApprovalStatusEnum)
  @IsOptional()
  approvalStatus?: ApprovalStatusContract;

  @IsEnum(RegressionStatusEnum)
  @IsOptional()
  regressionStatus?: RegressionStatusContract;

  @IsString()
  @IsOptional()
  baselineVersionId?: string | null;

  @IsObject()
  flowDefinition!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  validationNotes?: string | null;

  @IsString()
  @IsNotEmpty()
  createdBy!: string;

  @IsString()
  @IsOptional()
  approvedAt?: string | null;
}
