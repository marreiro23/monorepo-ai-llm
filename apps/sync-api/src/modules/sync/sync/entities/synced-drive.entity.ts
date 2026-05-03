import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'synced_drives', schema: 'sync' })
export class SyncedDriveEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'remote_id', type: 'varchar', length: 512, unique: true })
  remoteId!: string;

  @Column({
    name: 'site_remote_id',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  siteRemoteId?: string;

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
