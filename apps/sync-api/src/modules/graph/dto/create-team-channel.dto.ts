import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateTeamChannelDto {
  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['standard', 'private', 'shared'])
  membershipType?: 'standard' | 'private' | 'shared';
}
