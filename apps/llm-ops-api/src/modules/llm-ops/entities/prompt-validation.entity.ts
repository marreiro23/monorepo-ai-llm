import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ValidationStatusEnum } from './llm-ops.enums.js';
import { PromptVersionEntity } from './prompt-version.entity.js';

@Entity({ schema: 'llm_ops', name: 'prompt_validations' })
export class PromptValidationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => PromptVersionEntity)
  @JoinColumn({ name: 'prompt_version_id' })
  promptVersion!: PromptVersionEntity;

  @Column({ name: 'prompt_version_id', type: 'uuid' })
  promptVersionId!: string;

  @Column({ name: 'validator_name', type: 'text' })
  validatorName!: string;

  @Column({ name: 'validator_phase', type: 'text' })
  validatorPhase!: string;

  @Column({ name: 'validation_status', type: 'enum', enum: ValidationStatusEnum, enumName: 'validation_status' })
  validationStatus!: ValidationStatusEnum;

  @Column({ name: 'critical_ambiguity_count', type: 'integer', default: 0 })
  criticalAmbiguityCount!: number;

  @Column({ name: 'warning_count', type: 'integer', default: 0 })
  warningCount!: number;

  @Column({ name: 'coherence_score', type: 'numeric', precision: 5, scale: 2, nullable: true })
  coherenceScore!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  findings!: Array<Record<string, unknown>>;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @CreateDateColumn({ name: 'validated_at', type: 'timestamptz' })
  validatedAt!: Date;

  @Column({ name: 'validated_by', type: 'text' })
  validatedBy!: string;
}
