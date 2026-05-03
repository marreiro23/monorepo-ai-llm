import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MigrationMappingStatus = 'draft' | 'valid' | 'blocked';

@Index(['sourceMailboxId'], { unique: true })
@Entity({ name: 'migration_mailbox_mappings', schema: 'm365_migration' })
export class MigrationMailboxMappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_mailbox_id', type: 'uuid' })
  sourceMailboxId!: string;

  @Column({ name: 'target_mailbox_id', type: 'uuid', nullable: true })
  targetMailboxId?: string;

  @Column({ name: 'source_address', type: 'varchar', length: 512 })
  sourceAddress!: string;

  @Column({
    name: 'target_address',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  targetAddress?: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: MigrationMappingStatus;

  @Column({ name: 'validation_errors', type: 'jsonb', nullable: true })
  validationErrors?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
