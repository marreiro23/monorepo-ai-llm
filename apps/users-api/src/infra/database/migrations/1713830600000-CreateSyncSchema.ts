import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSyncSchema1713830600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
create schema if not exists sync;

create table if not exists sync.sync_jobs (
  id          uuid primary key default gen_random_uuid(),
  type        varchar(64)  not null,
  status      varchar(32)  not null default 'pending',
  context     varchar(255),
  item_count  integer,
  error_message text,
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz
);

create table if not exists sync.synced_sites (
  id           uuid primary key default gen_random_uuid(),
  remote_id    varchar(512) not null unique,
  name         varchar(512),
  display_name varchar(512),
  web_url      text,
  raw_data     jsonb,
  synced_at    timestamptz not null default now()
);

create table if not exists sync.synced_drives (
  id             uuid primary key default gen_random_uuid(),
  remote_id      varchar(512) not null unique,
  site_remote_id varchar(512),
  name           varchar(512),
  drive_type     varchar(128),
  web_url        text,
  raw_data       jsonb,
  synced_at      timestamptz not null default now()
);

create table if not exists sync.synced_users (
  id                   uuid primary key default gen_random_uuid(),
  remote_id            varchar(512) not null unique,
  display_name         varchar(512),
  mail                 varchar(512),
  user_principal_name  varchar(512),
  raw_data             jsonb,
  synced_at            timestamptz not null default now()
);

create table if not exists sync.synced_groups (
  id           uuid primary key default gen_random_uuid(),
  remote_id    varchar(512) not null unique,
  display_name varchar(512),
  mail         varchar(512),
  raw_data     jsonb,
  synced_at    timestamptz not null default now()
);

create table if not exists sync.synced_teams (
  id           uuid primary key default gen_random_uuid(),
  remote_id    varchar(512) not null unique,
  display_name varchar(512),
  description  text,
  visibility   varchar(128),
  raw_data     jsonb,
  synced_at    timestamptz not null default now()
);

create table if not exists sync.synced_team_channels (
  id              uuid primary key default gen_random_uuid(),
  remote_id       varchar(512) not null unique,
  team_remote_id  varchar(512) not null,
  display_name    varchar(512),
  description     text,
  membership_type varchar(128),
  web_url         text,
  raw_data        jsonb,
  synced_at       timestamptz not null default now()
);

create table if not exists sync.synced_team_channel_messages (
  id                      uuid primary key default gen_random_uuid(),
  remote_id               varchar(512) not null unique,
  team_remote_id          varchar(512) not null,
  channel_remote_id       varchar(512) not null,
  reply_to_id             varchar(512),
  message_type            varchar(128),
  subject                 text,
  body_content_type       varchar(64),
  body_content            text,
  from_display_name       varchar(512),
  from_user_id            varchar(512),
  created_date_time       timestamptz,
  last_modified_date_time timestamptz,
  raw_data                jsonb,
  synced_at               timestamptz not null default now()
);

create table if not exists sync.synced_mailboxes (
  id                   uuid primary key default gen_random_uuid(),
  remote_id            varchar(512) not null unique,
  display_name         varchar(512),
  mail                 varchar(512),
  user_principal_name  varchar(512),
  raw_data             jsonb,
  synced_at            timestamptz not null default now()
);

create table if not exists sync.synced_onedrives (
  id                   uuid primary key default gen_random_uuid(),
  remote_id            varchar(512) not null unique,
  user_remote_id       varchar(512),
  user_principal_name  varchar(512),
  name                 varchar(512),
  drive_type           varchar(128),
  web_url              text,
  raw_data             jsonb,
  synced_at            timestamptz not null default now()
);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
drop table if exists sync.synced_groups;
drop table if exists sync.synced_onedrives;
drop table if exists sync.synced_mailboxes;
drop table if exists sync.synced_team_channel_messages;
drop table if exists sync.synced_team_channels;
drop table if exists sync.synced_teams;
drop table if exists sync.synced_users;
drop table if exists sync.synced_drives;
drop table if exists sync.synced_sites;
drop table if exists sync.sync_jobs;
drop schema if exists sync;
    `);
  }
}
