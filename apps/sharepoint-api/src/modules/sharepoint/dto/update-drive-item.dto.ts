import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateDriveItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  parentReference?: {
    id?: string;
    driveId?: string;
  };
}
