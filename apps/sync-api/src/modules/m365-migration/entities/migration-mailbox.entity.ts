import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { MigrationTenantRole } from './migration-tenant.entity.js';

@Index(['tenantRole', 'remoteId'], { unique: true })
@Entity({ name: 'migration_mailboxes', schema: 'm365_migration' })
export class MigrationMailboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_role', type: 'varchar', length: 32 })
  tenantRole!: MigrationTenantRole;

  @Column({ name: 'remote_id', type: 'varchar', length: 512 })
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

  @Column({
    name: 'mailbox_kind',
    type: 'varchar',
    length: 64,
    default: 'unknown',
  })
  mailboxKind!: string;

  @Column({
    name: 'readiness_status',
    type: 'varchar',
    length: 32,
    default: 'unknown',
  })
  readinessStatus!: string;

  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
