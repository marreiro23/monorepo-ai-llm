import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import type {
  ApprovalStatusContract,
  RegressionStatusContract,
  UpdateTopicFlowVersionStatusRequestContract,
} from '@api-llm-embedded/shared';
import {
  ApprovalStatusEnum,
  RegressionStatusEnum,
} from '../entities/llm-ops.enums.js';

export class UpdateTopicFlowVersionStatusDto implements UpdateTopicFlowVersionStatusRequestContract {
  @IsEnum(ApprovalStatusEnum)
  @IsOptional()
  approvalStatus?: ApprovalStatusContract;

  @IsEnum(RegressionStatusEnum)
  @IsOptional()
  regressionStatus?: RegressionStatusContract;

  @IsDateString()
  @IsOptional()
  approvedAt?: string | null;
}
