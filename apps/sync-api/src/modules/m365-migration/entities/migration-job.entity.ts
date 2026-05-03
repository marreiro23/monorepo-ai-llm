import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type MigrationJobMode = 'dry-run' | 'exchange-migration';
export type MigrationJobStatus =
  | 'planned'
  | 'blocked'
  | 'running'
  | 'completed'
  | 'failed';

@Entity({ name: 'migration_jobs', schema: 'm365_migration' })
export class MigrationJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, default: 'dry-run' })
  mode!: MigrationJobMode;

  @Column({ type: 'varchar', length: 32, default: 'planned' })
  status!: MigrationJobStatus;

  @Column({ name: 'mapping_count', type: 'int', default: 0 })
  mappingCount!: number;

  @Column({ name: 'blocked_reason', type: 'text', nullable: true })
  blockedReason?: string;

  @Column({ name: 'raw_plan', type: 'jsonb', nullable: true })
  rawPlan?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
