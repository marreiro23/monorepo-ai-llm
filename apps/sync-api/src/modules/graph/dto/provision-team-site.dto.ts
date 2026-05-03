import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ProvisionTeamSiteDto {
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  mailNickname!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  visibility?: 'Public' | 'Private';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ownerUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberUserIds?: string[];
}
