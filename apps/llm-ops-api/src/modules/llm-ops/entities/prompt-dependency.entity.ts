import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DependencyTypeEnum } from './llm-ops.enums.js';
import { PromptVersionEntity } from './prompt-version.entity.js';

@Entity({ schema: 'llm_ops', name: 'prompt_dependencies' })
export class PromptDependencyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => PromptVersionEntity)
  @JoinColumn({ name: 'prompt_version_id' })
  promptVersion!: PromptVersionEntity;

  @Column({ name: 'prompt_version_id', type: 'uuid' })
  promptVersionId!: string;

  @Column({ name: 'dependency_type', type: 'enum', enum: DependencyTypeEnum, enumName: 'dependency_type' })
  dependencyType!: DependencyTypeEnum;

  @Column({ name: 'depends_on_prompt_template_id', type: 'uuid', nullable: true })
  dependsOnPromptTemplateId!: string | null;

  @Column({ name: 'depends_on_prompt_version_id', type: 'uuid', nullable: true })
  dependsOnPromptVersionId!: string | null;

  @Column({ name: 'depends_on_topic_flow_id', type: 'uuid', nullable: true })
  dependsOnTopicFlowId!: string | null;

  @Column({ name: 'external_reference', type: 'text', nullable: true })
  externalReference!: string | null;

  @Column({ name: 'is_required', type: 'boolean', default: true })
  isRequired!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
