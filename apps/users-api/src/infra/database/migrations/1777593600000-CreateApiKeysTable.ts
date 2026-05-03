import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApiKeysTable1777593600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create type public.api_key_owner_type as enum ('internal', 'external');
      create type public.api_key_status as enum ('active', 'rotating', 'revoked', 'expired');

      create table if not exists public.api_keys (
        id uuid primary key default gen_random_uuid(),
        name varchar(120) not null,
        key_prefix varchar(12) not null,
        key_hash varchar(64) not null unique,
        owner varchar(120) not null,
        owner_type public.api_key_owner_type not null,
        scopes text[] not null default '{}',
        status public.api_key_status not null default 'active',
        expires_at timestamptz,
        scheduled_rotation_at timestamptz,
        successor_key_id uuid,
        predecessor_key_id uuid,
        last_used_at timestamptz,
        metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists idx_api_keys_hash on public.api_keys (key_hash);
      create index if not exists idx_api_keys_status on public.api_keys (status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      drop table if exists public.api_keys;
      drop type if exists public.api_key_status;
      drop type if exists public.api_key_owner_type;
    `);
  }
}
