import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'synced_mailboxes', schema: 'sync' })
export class SyncedMailboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'remote_id', type: 'varchar', length: 512, unique: true })
  remoteId!: string;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  displayName?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  mail?: string;

  @Column({
    name: 'user_principal_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  userPrincipalName?: string;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData?: Record<string, unknown>;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt!: Date;
}
