import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type SyncJobType =
  | 'sites'
  | 'drives'
  | 'users'
  | 'groups'
  | 'teams'
  | 'team-channels'
  | 'team-channel-messages'
  | 'mailboxes'
  | 'onedrives';
export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed';

@Entity({ name: 'sync_jobs', schema: 'sync' })
export class SyncJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  type!: SyncJobType;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: SyncJobStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  context?: string;

  @Column({ name: 'item_count', type: 'int', nullable: true })
  itemCount?: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt?: Date;
}
