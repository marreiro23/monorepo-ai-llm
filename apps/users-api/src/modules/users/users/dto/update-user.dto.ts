import { IsEmail, IsOptional, IsString } from 'class-validator';
import type { UpdateUserRequestContract } from '@api-llm-embedded/shared';

export class UpdateUserDto implements UpdateUserRequestContract {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
