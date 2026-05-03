import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PromptKindEnum } from '../entities/llm-ops.enums.js';

export class CreatePromptTemplateDto {
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

  @IsEnum(PromptKindEnum)
  promptKind!: PromptKindEnum;

  @IsString()
  @IsNotEmpty()
  targetScope!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
