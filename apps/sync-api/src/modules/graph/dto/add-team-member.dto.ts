import { IsArray, IsOptional, IsString } from 'class-validator';

export class AddTeamMemberDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
