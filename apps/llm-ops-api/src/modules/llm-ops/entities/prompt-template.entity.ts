import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LlmOpsAgentEntity } from './llm-ops-agent.entity.js';
import { PromptKindEnum } from './llm-ops.enums.js';

@Entity({ schema: 'llm_ops', name: 'prompt_templates' })
export class PromptTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => LlmOpsAgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent!: LlmOpsAgentEntity;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({
    name: 'prompt_kind',
    type: 'enum',
    enum: PromptKindEnum,
    enumName: 'prompt_kind',
  })
  promptKind!: PromptKindEnum;

  @Column({ name: 'target_scope', type: 'text' })
  targetScope!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
