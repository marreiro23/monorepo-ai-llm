import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'synced_team_channels', schema: 'sync' })
export class SyncedTeamChannelEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'remote_id', type: 'varchar', length: 512, unique: true })
  remoteId!: string;

  @Column({ name: 'team_remote_id', type: 'varchar', length: 512 })
  teamRemoteId!: string;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  displayName?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'membership_type',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  membershipType?: string;

  @Column({ name: 'web_url', type: 'text', nullable: true })
  webUrl?: string;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData?: Record<string, unknown>;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt!: Date;
}
