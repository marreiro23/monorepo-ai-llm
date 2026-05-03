import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MigrationTenantRole = 'source' | 'target';
export type MigrationTenantStatus =
  | 'unconfigured'
  | 'configured'
  | 'validated'
  | 'failed';

@Entity({ name: 'migration_tenants', schema: 'm365_migration' })
export class MigrationTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  role!: MigrationTenantRole;

  @Column({ name: 'tenant_id', type: 'varchar', length: 128, nullable: true })
  tenantId?: string;

  @Column({ name: 'client_id', type: 'varchar', length: 128, nullable: true })
  clientId?: string;

  @Column({ name: 'auth_method', type: 'varchar', length: 64, nullable: true })
  authMethod?: string;

  @Column({
    name: 'certificate_thumbprint',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  certificateThumbprint?: string;

  @Column({ type: 'varchar', length: 32, default: 'unconfigured' })
  status!: MigrationTenantStatus;

  @Column({ name: 'last_validated_at', type: 'timestamptz', nullable: true })
  lastValidatedAt?: Date;

  @Column({ name: 'raw_status', type: 'jsonb', nullable: true })
  rawStatus?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
