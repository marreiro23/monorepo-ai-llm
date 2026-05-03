import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  /** Conteúdo do arquivo codificado em base64 */
  @IsString()
  @IsNotEmpty()
  content!: string;

  /** MIME type do arquivo, ex: 'image/png', 'application/pdf' */
  @IsOptional()
  @IsString()
  mimeType?: string;
}
