import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class KnowledgeBaseDocumentDto {
  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsString()
  @IsOptional()
  agentId?: string | null;

  @IsString()
  @IsOptional()
  source?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class IngestKnowledgeBaseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnowledgeBaseDocumentDto)
  documents!: KnowledgeBaseDocumentDto[];
}
