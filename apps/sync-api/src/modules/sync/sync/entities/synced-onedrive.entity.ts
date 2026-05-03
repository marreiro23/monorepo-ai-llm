import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'synced_onedrives', schema: 'sync' })
export class SyncedOneDriveEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'remote_id', type: 'varchar', length: 512, unique: true })
  remoteId!: string;

  @Column({
    name: 'user_remote_id',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  userRemoteId?: string;

  @Column({
    name: 'user_principal_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  userPrincipalName?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  name?: string;

  @Column({ name: 'drive_type', type: 'varchar', length: 128, nullable: true })
  driveType?: string;

  @Column({ name: 'web_url', type: 'text', nullable: true })
  webUrl?: string;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData?: Record<string, unknown>;

  @UpdateDateColumn({ name: 'synced_at' })
  syncedAt!: Date;
}
