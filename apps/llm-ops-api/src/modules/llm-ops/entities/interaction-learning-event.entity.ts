import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LlmOpsAgentEntity } from './llm-ops-agent.entity.js';
import {
  InvocationSourceEnum,
  LearningEventTypeEnum,
} from './llm-ops.enums.js';

@Entity({ schema: 'llm_ops', name: 'interaction_learning_events' })
export class InteractionLearningEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => LlmOpsAgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent!: LlmOpsAgentEntity;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @Column({ name: 'prompt_version_id', type: 'uuid', nullable: true })
  promptVersionId!: string | null;

  @Column({ name: 'topic_flow_version_id', type: 'uuid', nullable: true })
  topicFlowVersionId!: string | null;

  @Column({
    name: 'invocation_source',
    type: 'enum',
    enum: InvocationSourceEnum,
    enumName: 'invocation_source',
  })
  invocationSource!: InvocationSourceEnum;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: LearningEventTypeEnum,
    enumName: 'learning_event_type',
  })
  eventType!: LearningEventTypeEnum;

  @Column({ type: 'text' })
  severity!: string;

  @Column({
    name: 'event_payload',
    type: 'jsonb',
    default: () => "'{}'::jsonb",
  })
  eventPayload!: Record<string, unknown>;

  @Column({ name: 'human_resolution', type: 'text', nullable: true })
  humanResolution!: string | null;

  @CreateDateColumn({ name: 'observed_at', type: 'timestamptz' })
  observedAt!: Date;
}
