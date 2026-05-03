import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { InvocationSourceEnum } from '../entities/llm-ops.enums.js';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  primaryObjective!: string;

  @IsArray()
  @IsEnum(InvocationSourceEnum, { each: true })
  supportedSources!: InvocationSourceEnum[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
