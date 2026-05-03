import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import type { CreateUserRequestContract } from '@api-llm-embedded/shared';

export class CreateUserDto implements CreateUserRequestContract {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  email!: string;
}
