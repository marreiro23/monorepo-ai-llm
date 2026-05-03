import { IsObject } from 'class-validator';

export class CreateListItemDto {
  @IsObject()
  fields!: Record<string, unknown>;
}
