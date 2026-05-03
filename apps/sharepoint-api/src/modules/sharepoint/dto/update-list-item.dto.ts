import { IsObject } from 'class-validator';

export class UpdateListItemDto {
  @IsObject()
  fields!: Record<string, unknown>;
}
