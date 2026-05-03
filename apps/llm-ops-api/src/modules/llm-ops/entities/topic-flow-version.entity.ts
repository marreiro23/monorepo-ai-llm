import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ApprovalStatusEnum, RegressionStatusEnum } from './llm-ops.enums.js';
import { TopicFlowEntity } from './topic-flow.entity.js';

@Entity({ schema: 'llm_ops', name: 'topic_flow_versions' })
@Unique('uq_topic_flow_version', ['topicFlowId', 'versionNumber'])
export class TopicFlowVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TopicFlowEntity)
  @JoinColumn({ name: 'topic_flow_id' })
  topicFlow!: TopicFlowEntity;

  @Column({ name: 'topic_flow_id', type: 'uuid' })
  topicFlowId!: string;

  @Column({ name: 'version_number', type: 'integer' })
  versionNumber!: number;

  @Column({ name: 'approval_status', type: 'enum', enum: ApprovalStatusEnum, enumName: 'approval_status', default: ApprovalStatusEnum.DRAFT })
  approvalStatus!: ApprovalStatusEnum;

  @Column({ name: 'regression_status', type: 'enum', enum: RegressionStatusEnum, enumName: 'regression_status', default: RegressionStatusEnum.NOT_RUN })
  regressionStatus!: RegressionStatusEnum;

  @Column({ name: 'baseline_version_id', type: 'uuid', nullable: true })
  baselineVersionId!: string | null;

  @Column({ name: 'flow_definition', type: 'jsonb' })
  flowDefinition!: Record<string, unknown>;

  @Column({ name: 'validation_notes', type: 'text', nullable: true })
  validationNotes!: string | null;

  @Column({ name: 'created_by', type: 'text' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;
}
