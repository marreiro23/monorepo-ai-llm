import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { M365ObjectType } from './m365-object-operation.entity.js';

@Entity({ name: 'm365_object_permission_snapshots', schema: 'm365_migration' })
export class M365ObjectPermissionSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'tenant_role',
    type: 'varchar',
    length: 32,
    default: 'source',
  })
  tenantRole!: string;

  @Column({ name: 'object_type', type: 'varchar', length: 64 })
  objectType!: M365ObjectType;

  @Column({ name: 'object_remote_id', type: 'varchar', length: 512 })
  objectRemoteId!: string;

  @Column({
    name: 'object_display_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  objectDisplayName?: string;

  @Column({
    name: 'permission_remote_id',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  permissionRemoteId?: string;

  @Column({
    name: 'principal_remote_id',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  principalRemoteId?: string;

  @Column({
    name: 'principal_display_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  principalDisplayName?: string;

  @Column({ type: 'jsonb', nullable: true })
  roles?: string[];

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData?: Record<string, unknown>;

  @CreateDateColumn({ name: 'captured_at' })
  capturedAt!: Date;
}
