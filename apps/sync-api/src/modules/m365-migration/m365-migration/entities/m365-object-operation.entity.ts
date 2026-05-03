import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type M365ObjectType =
  | 'teams-channel'
  | 'teams-channel-message'
  | 'teams-channel-member'
  | 'sharepoint-site'
  | 'sharepoint-drive-item'
  | 'onedrive'
  | 'mailbox'
  | 'global-address-list'
  | 'object-permission';

export type M365OperationAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'add-member'
  | 'remove-member'
  | 'grant-permission'
  | 'revoke-permission';
export type M365OperationMode = 'dry-run' | 'live';
export type M365OperationStatus = 'planned' | 'blocked' | 'executed' | 'failed';

@Entity({ name: 'm365_object_operations', schema: 'm365_migration' })
export class M365ObjectOperationEntity {
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

  @Column({ type: 'varchar', length: 64 })
  action!: M365OperationAction;

  @Column({ type: 'varchar', length: 32, default: 'dry-run' })
  mode!: M365OperationMode;

  @Column({ type: 'varchar', length: 32, default: 'planned' })
  status!: M365OperationStatus;

  @Column({
    name: 'target_remote_id',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  targetRemoteId?: string;

  @Column({
    name: 'target_display_name',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  targetDisplayName?: string;

  @Column({ name: 'required_permissions', type: 'jsonb', nullable: true })
  requiredPermissions?: string[];

  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload?: Record<string, unknown>;

  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload?: Record<string, unknown>;

  @Column({ name: 'rollback_hint', type: 'jsonb', nullable: true })
  rollbackHint?: Record<string, unknown>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
