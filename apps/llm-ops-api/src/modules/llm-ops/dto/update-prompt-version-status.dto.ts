import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import type { ApprovalStatusContract, UpdatePromptVersionStatusRequestContract } from '@api-llm-embedded/shared';
import { ApprovalStatusEnum } from '../entities/llm-ops.enums.js';

export class UpdatePromptVersionStatusDto implements UpdatePromptVersionStatusRequestContract {
  @IsEnum(ApprovalStatusEnum)
  approvalStatus!: ApprovalStatusContract;

  @IsDateString()
  @IsOptional()
  approvedAt?: string | null;

  @IsDateString()
  @IsOptional()
  deprecatedAt?: string | null;
}
