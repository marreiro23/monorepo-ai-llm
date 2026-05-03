import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'synced_team_channel_messages', schema: 'sync' })
export class SyncedTeamChannelMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'remote_id', type: 'varchar', length: 512, unique: true })
  remoteId!: string;

  @Column({ name: 'team_remote_id', type: 'varchar', length: 512 })
  teamRemoteId!: string;

  @Column({ name: 'channel_remote_id', type: 'varchar', length: 512 })
  channelRemoteId!: string;

  @Column({ name: 'reply_to_id', type: 'varchar', length: 512, nullable: true })
  replyToId?: string;

  @Column({
    name: 'message_type',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  messageType?: string;

  @Column({ name: 'subject', type: 'text', nullable: true })
  subject?: string;

  @Column({
    name: 'body_content_type',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  bodyContentType?: string;

  @Column({ name: 'body_content', type: 'text', nullable: true })
  bodyContent?: string;

  @Column({
    name: 'from_display_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  fromDisplayName?: string;

  @Column({
    name: 'from_user_id',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  fromUserId?: string;

  @Column({ name: 'created_date_time', type: 'timestamptz', nullable: true })
  createdDateTime?: Date;

  @Column({
    name: 'last_modified_date_time',
    type: 'timestamptz',
    nullable: true,
  })
  lastModifiedDateTime?: Date;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData?: Record<string, unknown>;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt!: Date;
}
