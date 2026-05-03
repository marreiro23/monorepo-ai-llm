import { IsArray, IsOptional, IsString } from 'class-validator';

export class AddChannelMemberDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
