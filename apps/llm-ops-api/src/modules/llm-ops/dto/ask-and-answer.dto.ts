import { IsOptional, IsString } from 'class-validator';

export class AskAndAnswerDto {
  @IsString()
  message!: string;

  @IsString()
  @IsOptional()
  agentId?: string | null;

  @IsString()
  @IsOptional()
  promptTemplateId?: string | null;

  @IsString()
  @IsOptional()
  topicFlowId?: string | null;

  @IsString()
  @IsOptional()
  topicFlowVersionId?: string | null;

  @IsString()
  @IsOptional()
  invocationSource?: string | null;

  @IsString()
  @IsOptional()
  sessionFingerprint?: string | null;
}
