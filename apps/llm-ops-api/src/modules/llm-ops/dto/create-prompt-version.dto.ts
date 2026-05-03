import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import type {
  ApprovalStatusContract,
  CreatePromptVersionRequestContract,
  InvocationSourceContract
} from '@api-llm-embedded/shared';
import { ApprovalStatusEnum, InvocationSourceEnum } from '../entities/llm-ops.enums.js';

export class CreatePromptVersionDto implements CreatePromptVersionRequestContract {
  @IsString()
  @IsNotEmpty()
  promptTemplateId!: string;

  @IsNumber()
  versionNumber!: number;

  @IsEnum(InvocationSourceEnum)
  invocationSource!: InvocationSourceContract;

  @IsEnum(ApprovalStatusEnum)
  @IsOptional()
  approvalStatus?: ApprovalStatusContract;

  @IsBoolean()
  @IsOptional()
  isStable?: boolean;

  @IsString()
  @IsNotEmpty()
  contentMarkdown!: string;

  @IsObject()
  @IsOptional()
  inputContract?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  outputContract?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  coherenceNotes?: string | null;

  @IsString()
  @IsNotEmpty()
  createdBy!: string;
}
