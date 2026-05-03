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
import { InvocationSourceEnum, TopicDomainEnum } from './llm-ops.enums.js';

@Entity({ schema: 'llm_ops', name: 'topic_flows' })
export class TopicFlowEntity {
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
    name: 'topic_domain',
    type: 'enum',
    enum: TopicDomainEnum,
    enumName: 'topic_domain',
  })
  topicDomain!: TopicDomainEnum;

  @Column({
    name: 'invocation_source',
    type: 'enum',
    enum: InvocationSourceEnum,
    enumName: 'invocation_source',
  })
  invocationSource!: InvocationSourceEnum;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
