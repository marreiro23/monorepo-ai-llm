import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1713830500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(120) not null,
  email varchar(180) not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop table if exists public.users;');
  }
}
