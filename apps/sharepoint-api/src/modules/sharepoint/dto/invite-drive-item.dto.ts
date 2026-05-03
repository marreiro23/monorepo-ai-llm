import { IsArray, IsOptional, IsString } from 'class-validator';

export class InviteDriveItemDto {
  @IsArray()
  @IsString({ each: true })
  emails!: string[];

  @IsArray()
  @IsString({ each: true })
  roles!: string[];

  @IsOptional()
  @IsString()
  message?: string;
}
