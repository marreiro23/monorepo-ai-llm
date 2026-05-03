import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  displayName!: string;

  @IsString()
  mailNickname!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsIn(['Public', 'Private'])
  visibility?: 'Public' | 'Private';

  @IsOptional()
  @IsBoolean()
  mailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  securityEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ownerUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberUserIds?: string[];
}
