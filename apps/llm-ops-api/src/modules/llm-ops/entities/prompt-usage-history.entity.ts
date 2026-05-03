import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LlmOpsAgentEntity } from './llm-ops-agent.entity.js';
import { InvocationSourceEnum, RuntimeOutcomeEnum } from './llm-ops.enums.js';
import { PromptVersionEntity } from './prompt-version.entity.js';
import { TopicFlowVersionEntity } from './topic-flow-version.entity.js';

@Entity({ schema: 'llm_ops', name: 'prompt_usage_history' })
export class PromptUsageHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => LlmOpsAgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent!: LlmOpsAgentEntity;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @ManyToOne(() => PromptVersionEntity)
  @JoinColumn({ name: 'prompt_version_id' })
  promptVersion!: PromptVersionEntity;

  @Column({ name: 'prompt_version_id', type: 'uuid' })
  promptVersionId!: string;

  @ManyToOne(() => TopicFlowVersionEntity)
  @JoinColumn({ name: 'topic_flow_version_id' })
  topicFlowVersion!: TopicFlowVersionEntity | null;

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
    name: 'runtime_outcome',
    type: 'enum',
    enum: RuntimeOutcomeEnum,
    enumName: 'runtime_outcome',
  })
  runtimeOutcome!: RuntimeOutcomeEnum;

  @Column({ name: 'adaptation_required', type: 'boolean', default: false })
  adaptationRequired!: boolean;

  @Column({ name: 'latency_ms', type: 'integer', nullable: true })
  latencyMs!: number | null;

  @Column({ name: 'successful_handoff_count', type: 'integer', default: 0 })
  successfulHandoffCount!: number;

  @Column({ name: 'failed_handoff_count', type: 'integer', default: 0 })
  failedHandoffCount!: number;

  @Column({ name: 'token_input_count', type: 'integer', nullable: true })
  tokenInputCount!: number | null;

  @Column({ name: 'token_output_count', type: 'integer', nullable: true })
  tokenOutputCount!: number | null;

  @Column({ name: 'session_fingerprint', type: 'text', nullable: true })
  sessionFingerprint!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
