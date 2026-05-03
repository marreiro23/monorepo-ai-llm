import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ApprovalStatusEnum, InvocationSourceEnum } from './llm-ops.enums.js';
import { PromptTemplateEntity } from './prompt-template.entity.js';

@Entity({ schema: 'llm_ops', name: 'prompt_versions' })
@Unique('uq_prompt_version', ['promptTemplateId', 'versionNumber', 'invocationSource'])
export class PromptVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => PromptTemplateEntity)
  @JoinColumn({ name: 'prompt_template_id' })
  promptTemplate!: PromptTemplateEntity;

  @Column({ name: 'prompt_template_id', type: 'uuid' })
  promptTemplateId!: string;

  @Column({ name: 'version_number', type: 'integer' })
  versionNumber!: number;

  @Column({ name: 'invocation_source', type: 'enum', enum: InvocationSourceEnum, enumName: 'invocation_source' })
  invocationSource!: InvocationSourceEnum;

  @Column({ name: 'approval_status', type: 'enum', enum: ApprovalStatusEnum, enumName: 'approval_status', default: ApprovalStatusEnum.DRAFT })
  approvalStatus!: ApprovalStatusEnum;

  @Column({ name: 'is_stable', type: 'boolean', default: false })
  isStable!: boolean;

  @Column({ name: 'content_markdown', type: 'text' })
  contentMarkdown!: string;

  @Column({ name: 'input_contract', type: 'jsonb', default: () => "'{}'::jsonb" })
  inputContract!: Record<string, unknown>;

  @Column({ name: 'output_contract', type: 'jsonb', default: () => "'{}'::jsonb" })
  outputContract!: Record<string, unknown>;

  @Column({ name: 'coherence_notes', type: 'text', nullable: true })
  coherenceNotes!: string | null;

  @Column({ name: 'created_by', type: 'text' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'deprecated_at', type: 'timestamptz', nullable: true })
  deprecatedAt!: Date | null;
}
