import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { MigrationTenantRole } from './migration-tenant.entity.js';

export type MigrationReadinessStatus = 'passed' | 'failed' | 'warning';

@Entity({ name: 'migration_readiness_checks', schema: 'm365_migration' })
export class MigrationReadinessCheckEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_role', type: 'varchar', length: 32 })
  tenantRole!: MigrationTenantRole;

  @Column({ name: 'check_key', type: 'varchar', length: 128 })
  checkKey!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: MigrationReadinessStatus;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
