import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum ApiKeyOwnerType {
  INTERNAL = 'internal',
  EXTERNAL = 'external'
}

export enum ApiKeyStatus {
  ACTIVE = 'active',
  ROTATING = 'rotating',
  REVOKED = 'revoked',
  EXPIRED = 'expired'
}

@Entity({ schema: 'public', name: 'api_keys' })
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'key_prefix', type: 'varchar', length: 12 })
  keyPrefix!: string;

  @Column({ name: 'key_hash', type: 'varchar', length: 64, unique: true })
  keyHash!: string;

  @Column({ type: 'varchar', length: 120 })
  owner!: string;

  @Column({ name: 'owner_type', type: 'enum', enum: ApiKeyOwnerType })
  ownerType!: ApiKeyOwnerType;

  @Column({ type: 'text', array: true, default: [] })
  scopes!: string[];

  @Column({ type: 'enum', enum: ApiKeyStatus, default: ApiKeyStatus.ACTIVE })
  status!: ApiKeyStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'scheduled_rotation_at', type: 'timestamptz', nullable: true })
  scheduledRotationAt!: Date | null;

  @Column({ name: 'successor_key_id', type: 'uuid', nullable: true })
  successorKeyId!: string | null;

  @Column({ name: 'predecessor_key_id', type: 'uuid', nullable: true })
  predecessorKeyId!: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
