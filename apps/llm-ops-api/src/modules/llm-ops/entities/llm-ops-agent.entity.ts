import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InvocationSourceEnum } from './llm-ops.enums.js';

@Entity({ schema: 'llm_ops', name: 'agents' })
export class LlmOpsAgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'primary_objective', type: 'text' })
  primaryObjective!: string;

  @Column({
    name: 'supported_sources',
    type: 'enum',
    enum: InvocationSourceEnum,
    enumName: 'invocation_source',
    array: true,
  })
  supportedSources!: InvocationSourceEnum[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
