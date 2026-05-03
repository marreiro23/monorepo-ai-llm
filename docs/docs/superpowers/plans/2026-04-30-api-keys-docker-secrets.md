# API Keys Management & Docker Secrets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PostgreSQL-backed `ApiKeysModule` with scoped keys, scheduled rotation, and admin HTTP endpoints, then harden Docker Compose to inject external secrets via files instead of env vars.

**Architecture:** A new `modules/api-keys/` module (entity + service + controller) follows the existing domain pattern. `ApiKeyAuthGuard` is updated to delegate to `ApiKeysService` (DB + in-memory cache), falling back to the existing env-based check when the table is empty. `mcp-secrets` gains three new dry-run tools that call the admin API. For Docker, sensitive env vars are replaced with the `*_FILE` convention and `secrets:` stanzas in `docker-compose.yml`.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL 16, Node native test runner (`node:test`), `@modelcontextprotocol/sdk`, Docker Compose v3.8

---

## File Map

### Part A — api-keys module

**Create:**
- `packages/shared/src/contracts/admin/api-key.contract.ts` — shared types for the admin API
- `packages/shared/src/contracts/admin/index.ts` — barrel
- `apps/api/src/modules/api-keys/entities/api-key.entity.ts` — TypeORM entity (schema: public)
- `apps/api/src/infra/database/migrations/1777593600000-CreateApiKeysTable.ts` — migration
- `apps/api/src/modules/api-keys/dto/create-api-key.dto.ts`
- `apps/api/src/modules/api-keys/dto/rotate-api-key.dto.ts`
- `apps/api/src/modules/api-keys/dto/api-key-response.dto.ts`
- `apps/api/src/modules/api-keys/api-keys.service.ts` — validation, creation, rotation, revocation
- `apps/api/src/modules/api-keys/api-keys.service.spec.ts` — unit tests
- `apps/api/src/modules/api-keys/api-keys.controller.ts` — 5 admin endpoints
- `apps/api/src/modules/api-keys/api-keys.module.ts`
- `apps/svcia/mcp-secrets/src/admin-api-client.ts` — HTTP client for admin API

**Modify:**
- `packages/shared/src/index.ts` — add admin contract export
- `apps/api/src/infra/database/typeorm.config.ts` — register migration in `AppDataSource`
- `apps/api/src/common/decorators/require-api-key.decorator.ts` — add optional `scopes` param
- `apps/api/src/common/guards/api-key-auth.guard.ts` — delegate to `ApiKeysService`, scope check
- `apps/api/src/common/guards/guards.module.ts` — import `ApiKeysModule`
- `apps/api/src/app.module.ts` — import `ApiKeysModule`
- `apps/svcia/mcp-secrets/src/main.ts` — register 3 new tools
- `apps/svcia/mcp-secrets/src/secrets-registry.ts` — add `api_key.*` entries

### Part B — Docker Compose secrets

**Create:**
- `scripts/bootstrap/check-secrets.sh` — pre-flight validation

**Modify:**
- `apps/api/src/config/env.validation.ts` — add `readSecret()` with `_FILE` fallback
- `docker-compose.yml` — add `secrets:` stanza per service
- `.gitignore` — ensure `secrets/*.txt` and `secrets/*.pem` are ignored

---

## PHASE A — Application-level API Keys

---

### Task 1: Shared contracts

**Files:**
- Create: `packages/shared/src/contracts/admin/api-key.contract.ts`
- Create: `packages/shared/src/contracts/admin/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the contract types**

```typescript
// packages/shared/src/contracts/admin/api-key.contract.ts

export type ApiKeyOwnerType = 'internal' | 'external';
export type ApiKeyStatus = 'active' | 'rotating' | 'revoked' | 'expired';

export type ApiKeyContract = {
  id: string;
  name: string;
  keyPrefix: string;
  owner: string;
  ownerType: ApiKeyOwnerType;
  scopes: string[];
  status: ApiKeyStatus;
  expiresAt: string | null;
  scheduledRotationAt: string | null;
  successorKeyId: string | null;
  predecessorKeyId: string | null;
  lastUsedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateApiKeyRequest = {
  name: string;
  owner: string;
  ownerType: ApiKeyOwnerType;
  scopes?: string[];
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export type RotateApiKeyRequest = {
  scheduledAt: string;
  dryRun?: boolean;
};

export type ApiKeyCreateResponse = {
  key: ApiKeyContract;
  plaintext: string;
};

export type ApiKeyRotateResponse = {
  predecessor: ApiKeyContract;
  successor: ApiKeyContract;
  plaintext: string;
  scheduledAt: string;
  dryRun: boolean;
};

export type ApiKeyListResponse = {
  data: ApiKeyContract[];
  count: number;
};
```

- [ ] **Step 2: Write the barrel**

```typescript
// packages/shared/src/contracts/admin/index.ts
export * from './api-key.contract.js';
```

- [ ] **Step 3: Add export to shared index**

In `packages/shared/src/index.ts`, append:
```typescript
export * from './contracts/admin/index.js';
```

- [ ] **Step 4: Verify compilation**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/contracts/admin/ packages/shared/src/index.ts
git commit -m "feat(shared): add admin api-key contracts"
```

---

### Task 2: Entity and migration

**Files:**
- Create: `apps/api/src/modules/api-keys/entities/api-key.entity.ts`
- Create: `apps/api/src/infra/database/migrations/1777593600000-CreateApiKeysTable.ts`
- Modify: `apps/api/src/infra/database/typeorm.config.ts`

- [ ] **Step 1: Create the entity**

```typescript
// apps/api/src/modules/api-keys/entities/api-key.entity.ts
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
```

- [ ] **Step 2: Create the migration**

```typescript
// apps/api/src/infra/database/migrations/1777593600000-CreateApiKeysTable.ts
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
```

- [ ] **Step 3: Register migration in AppDataSource**

In `apps/api/src/infra/database/typeorm.config.ts`, find the `AppDataSource` migrations array and add the new migration:

```typescript
// Before (existing entries):
migrations: [
  ...runtimeMigrationGlobs(
    'src/infra/database/migrations/1713830500000-CreateUsersTable.ts',
    'dist/infra/database/migrations/1713830500000-CreateUsersTable.js'
  ),
  ...runtimeMigrationGlobs(
    'src/infra/database/migrations/1713830600000-CreateSyncSchema.ts',
    'dist/infra/database/migrations/1713830600000-CreateSyncSchema.js'
  )
],

// After (add the new entry):
migrations: [
  ...runtimeMigrationGlobs(
    'src/infra/database/migrations/1713830500000-CreateUsersTable.ts',
    'dist/infra/database/migrations/1713830500000-CreateUsersTable.js'
  ),
  ...runtimeMigrationGlobs(
    'src/infra/database/migrations/1713830600000-CreateSyncSchema.ts',
    'dist/infra/database/migrations/1713830600000-CreateSyncSchema.js'
  ),
  ...runtimeMigrationGlobs(
    'src/infra/database/migrations/1777593600000-CreateApiKeysTable.ts',
    'dist/infra/database/migrations/1777593600000-CreateApiKeysTable.js'
  )
],
```

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/api-keys/entities/ apps/api/src/infra/database/migrations/1777593600000-CreateApiKeysTable.ts apps/api/src/infra/database/typeorm.config.ts
git commit -m "feat(api-keys): add entity and migration"
```

---

### Task 3: DTOs

**Files:**
- Create: `apps/api/src/modules/api-keys/dto/create-api-key.dto.ts`
- Create: `apps/api/src/modules/api-keys/dto/rotate-api-key.dto.ts`
- Create: `apps/api/src/modules/api-keys/dto/api-key-response.dto.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// apps/api/src/modules/api-keys/dto/create-api-key.dto.ts
import { ApiKeyOwnerType } from '../entities/api-key.entity.js';

export class CreateApiKeyDto {
  name!: string;
  owner!: string;
  ownerType!: ApiKeyOwnerType;
  scopes?: string[];
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}
```

```typescript
// apps/api/src/modules/api-keys/dto/rotate-api-key.dto.ts
export class RotateApiKeyDto {
  scheduledAt!: string;
  dryRun?: boolean;
}
```

```typescript
// apps/api/src/modules/api-keys/dto/api-key-response.dto.ts
import type { ApiKeyContract } from '@api-llm-embedded/shared';
import type { ApiKeyEntity } from '../entities/api-key.entity.js';

export function toApiKeyContract(e: ApiKeyEntity): ApiKeyContract {
  return {
    id: e.id,
    name: e.name,
    keyPrefix: e.keyPrefix,
    owner: e.owner,
    ownerType: e.ownerType as ApiKeyContract['ownerType'],
    scopes: e.scopes,
    status: e.status as ApiKeyContract['status'],
    expiresAt: e.expiresAt?.toISOString() ?? null,
    scheduledRotationAt: e.scheduledRotationAt?.toISOString() ?? null,
    successorKeyId: e.successorKeyId,
    predecessorKeyId: e.predecessorKeyId,
    lastUsedAt: e.lastUsedAt?.toISOString() ?? null,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString()
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/api-keys/dto/
git commit -m "feat(api-keys): add DTOs and response mapper"
```

---

### Task 4: ApiKeysService + tests

**Files:**
- Create: `apps/api/src/modules/api-keys/api-keys.service.ts`
- Create: `apps/api/src/modules/api-keys/api-keys.service.spec.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// apps/api/src/modules/api-keys/api-keys.service.spec.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiKeyStatus, ApiKeyOwnerType } from './entities/api-key.entity.js';

// Minimal mock repository factory
function makeMockRepo(overrides: Record<string, unknown> = {}) {
  return {
    findOne: async () => null,
    findOneBy: async () => null,
    find: async () => [],
    create: (data: Record<string, unknown>) => data,
    save: async (data: Record<string, unknown>) => ({ id: 'uuid-test', createdAt: new Date(), updatedAt: new Date(), ...data }),
    update: async () => ({ affected: 1 }),
    ...overrides
  };
}

// Lazy import after module exists
const { ApiKeysService } = await import('./api-keys.service.js');

describe('ApiKeysService', () => {
  describe('hashKey', () => {
    it('produces a 64-char hex string and is deterministic', () => {
      const svc = new ApiKeysService(makeMockRepo() as any);
      const h1 = (svc as any).hashKey('secret');
      const h2 = (svc as any).hashKey('secret');
      assert.equal(h1.length, 64);
      assert.equal(h1, h2);
    });

    it('different inputs produce different hashes', () => {
      const svc = new ApiKeysService(makeMockRepo() as any);
      assert.notEqual((svc as any).hashKey('a'), (svc as any).hashKey('b'));
    });
  });

  describe('validate', () => {
    it('returns null when key not found in DB', async () => {
      const svc = new ApiKeysService(makeMockRepo({ findOne: async () => null }) as any);
      assert.equal(await svc.validate('missing'), null);
    });

    it('returns record for active key', async () => {
      const record = { id: '1', status: ApiKeyStatus.ACTIVE, expiresAt: null, scheduledRotationAt: null, scopes: [] };
      const svc = new ApiKeysService(makeMockRepo({
        findOne: async () => record,
        update: async () => ({ affected: 1 })
      }) as any);
      const result = await svc.validate('any-key');
      assert.deepEqual(result, record);
    });

    it('returns null for expired absolute expiry', async () => {
      const record = { id: '1', status: ApiKeyStatus.ACTIVE, expiresAt: new Date(Date.now() - 1000), scheduledRotationAt: null, scopes: [] };
      const svc = new ApiKeysService(makeMockRepo({ findOne: async () => record }) as any);
      assert.equal(await svc.validate('any-key'), null);
    });

    it('lazy-evicts rotating key past scheduledRotationAt and returns null', async () => {
      let capturedUpdate: Record<string, unknown> | null = null;
      const record = {
        id: 'rot-1',
        status: ApiKeyStatus.ROTATING,
        expiresAt: null,
        scheduledRotationAt: new Date(Date.now() - 500)
      };
      const svc = new ApiKeysService(makeMockRepo({
        findOne: async () => record,
        update: async (_: unknown, data: Record<string, unknown>) => { capturedUpdate = data; return { affected: 1 }; }
      }) as any);
      assert.equal(await svc.validate('any-key'), null);
      assert.equal(capturedUpdate?.status, ApiKeyStatus.EXPIRED);
    });

    it('cache: second call within TTL skips DB', async () => {
      let callCount = 0;
      const record = { id: '1', status: ApiKeyStatus.ACTIVE, expiresAt: null, scheduledRotationAt: null, scopes: [] };
      const svc = new ApiKeysService(makeMockRepo({
        findOne: async () => { callCount++; return record; },
        update: async () => ({ affected: 1 })
      }) as any);
      await svc.validate('cached-key');
      await svc.validate('cached-key');
      assert.equal(callCount, 1);
    });
  });

  describe('hasRequiredScopes', () => {
    it('returns true when requiredScopes is empty', () => {
      const svc = new ApiKeysService(makeMockRepo() as any);
      const rec = { scopes: ['a'] } as any;
      assert.ok(svc.hasRequiredScopes(rec, []));
    });

    it('returns true when all required scopes present', () => {
      const svc = new ApiKeysService(makeMockRepo() as any);
      assert.ok(svc.hasRequiredScopes({ scopes: ['a', 'b'] } as any, ['a']));
    });

    it('returns false when a required scope is missing', () => {
      const svc = new ApiKeysService(makeMockRepo() as any);
      assert.ok(!svc.hasRequiredScopes({ scopes: ['a'] } as any, ['a', 'b']));
    });
  });

  describe('revoke', () => {
    it('returns true when update affects 1 row', async () => {
      const svc = new ApiKeysService(makeMockRepo({ update: async () => ({ affected: 1 }) }) as any);
      assert.ok(await svc.revoke('some-id'));
    });

    it('returns false when update affects 0 rows (already revoked)', async () => {
      const svc = new ApiKeysService(makeMockRepo({ update: async () => ({ affected: 0 }) }) as any);
      assert.ok(!(await svc.revoke('not-found')));
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run -w apps/api test
```
Expected: FAIL — `ApiKeysService` does not exist yet.

- [ ] **Step 3: Implement ApiKeysService**

```typescript
// apps/api/src/modules/api-keys/api-keys.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { ApiKeyEntity, ApiKeyStatus, ApiKeyOwnerType } from './entities/api-key.entity.js';
import type { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import type { RotateApiKeyDto } from './dto/rotate-api-key.dto.js';

type CacheEntry = { record: ApiKeyEntity | null; expiresAt: number };

@Injectable()
export class ApiKeysService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly repo: Repository<ApiKeyEntity>
  ) {}

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private generateKey(ownerType: ApiKeyOwnerType): string {
    const prefix = ownerType === ApiKeyOwnerType.INTERNAL ? 'aki' : 'ake';
    return `${prefix}_${randomBytes(32).toString('hex')}`;
  }

  async validate(rawKey: string): Promise<ApiKeyEntity | null> {
    const hash = this.hashKey(rawKey);
    const now = Date.now();

    const cached = this.cache.get(hash);
    if (cached && now < cached.expiresAt) {
      return cached.record;
    }

    const record = await this.repo.findOne({
      where: {
        keyHash: hash,
        status: In([ApiKeyStatus.ACTIVE, ApiKeyStatus.ROTATING])
      }
    });

    if (!record) {
      this.cache.set(hash, { record: null, expiresAt: now + 10_000 });
      return null;
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      this.cache.set(hash, { record: null, expiresAt: now + 10_000 });
      return null;
    }

    if (
      record.status === ApiKeyStatus.ROTATING &&
      record.scheduledRotationAt &&
      record.scheduledRotationAt <= new Date()
    ) {
      await this.repo.update(record.id, { status: ApiKeyStatus.EXPIRED });
      this.cache.set(hash, { record: null, expiresAt: now + 10_000 });
      return null;
    }

    this.cache.set(hash, { record, expiresAt: now + 60_000 });
    void this.repo.update(record.id, { lastUsedAt: new Date() });

    return record;
  }

  hasRequiredScopes(record: ApiKeyEntity, requiredScopes: string[]): boolean {
    if (requiredScopes.length === 0) return true;
    return requiredScopes.every(scope => record.scopes.includes(scope));
  }

  async create(dto: CreateApiKeyDto): Promise<{ entity: ApiKeyEntity; plaintext: string }> {
    const plaintext = this.generateKey(dto.ownerType);
    const prefix = plaintext.substring(0, 11);
    const hash = this.hashKey(plaintext);

    const entity = this.repo.create({
      name: dto.name,
      keyPrefix: prefix,
      keyHash: hash,
      owner: dto.owner,
      ownerType: dto.ownerType,
      scopes: dto.scopes ?? [],
      status: ApiKeyStatus.ACTIVE,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      successorKeyId: null,
      predecessorKeyId: null,
      lastUsedAt: null,
      metadata: dto.metadata ?? null
    });

    const saved = await this.repo.save(entity);
    return { entity: saved, plaintext };
  }

  async listAll(): Promise<ApiKeyEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<ApiKeyEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async rotate(
    id: string,
    dto: RotateApiKeyDto
  ): Promise<{ predecessor: ApiKeyEntity; successor: ApiKeyEntity; plaintext: string } | null> {
    const predecessor = await this.repo.findOneBy({ id });
    if (!predecessor || predecessor.status !== ApiKeyStatus.ACTIVE) return null;

    const plaintext = this.generateKey(predecessor.ownerType);
    const prefix = plaintext.substring(0, 11);
    const hash = this.hashKey(plaintext);

    const successorEntity = this.repo.create({
      name: predecessor.name,
      keyPrefix: prefix,
      keyHash: hash,
      owner: predecessor.owner,
      ownerType: predecessor.ownerType,
      scopes: [...predecessor.scopes],
      status: ApiKeyStatus.ACTIVE,
      predecessorKeyId: predecessor.id,
      successorKeyId: null,
      expiresAt: null,
      scheduledRotationAt: null,
      lastUsedAt: null,
      metadata: predecessor.metadata
    });

    const savedSuccessor = await this.repo.save(successorEntity);

    await this.repo.update(predecessor.id, {
      status: ApiKeyStatus.ROTATING,
      scheduledRotationAt: new Date(dto.scheduledAt),
      successorKeyId: savedSuccessor.id
    });

    const updatedPredecessor = await this.repo.findOneBy({ id });

    return { predecessor: updatedPredecessor!, successor: savedSuccessor, plaintext };
  }

  async revoke(id: string): Promise<boolean> {
    const result = await this.repo.update(
      { id, status: In([ApiKeyStatus.ACTIVE, ApiKeyStatus.ROTATING]) },
      { status: ApiKeyStatus.REVOKED }
    );
    return (result.affected ?? 0) > 0;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run -w apps/api test
```
Expected: all tests in `api-keys.service.spec.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/api-keys/api-keys.service.ts apps/api/src/modules/api-keys/api-keys.service.spec.ts
git commit -m "feat(api-keys): implement ApiKeysService with cache and rotation"
```

---

### Task 5: Update decorator and guard

**Files:**
- Modify: `apps/api/src/common/decorators/require-api-key.decorator.ts`
- Modify: `apps/api/src/common/guards/api-key-auth.guard.ts`

- [ ] **Step 1: Update the decorator**

Replace the entire content of `apps/api/src/common/decorators/require-api-key.decorator.ts`:

```typescript
// apps/api/src/common/decorators/require-api-key.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { REQUIRE_API_KEY } from '../guards/api-key-auth.guard.js';

export interface RequireApiKeyOptions {
  scopes?: string[];
}

/**
 * Marks an endpoint as requiring API Key authentication.
 * Optionally restricts access to keys that carry specific scopes.
 *
 * @example
 * @RequireApiKey()                              // any valid key
 * @RequireApiKey({ scopes: ['admin:api-keys'] }) // only keys with this scope
 */
export const RequireApiKey = (options: RequireApiKeyOptions = {}) =>
  SetMetadata(REQUIRE_API_KEY, { scopes: options.scopes ?? [] });
```

- [ ] **Step 2: Update the guard**

Replace the entire content of `apps/api/src/common/guards/api-key-auth.guard.ts`:

```typescript
// apps/api/src/common/guards/api-key-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyAuthService } from './api-key-auth.service.js';
import { AuditEventsService } from '../events/audit-events.service.js';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service.js';

export const REQUIRE_API_KEY = 'requireApiKey';

export interface RequireApiKeyMeta {
  scopes: string[];
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyAuthService: ApiKeyAuthService,
    private readonly auditEventsService: AuditEventsService,
    private readonly apiKeysService: ApiKeysService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RequireApiKeyMeta | undefined>(
      REQUIRE_API_KEY,
      context.getHandler()
    );

    if (!options) return true;

    const request = context.switchToHttp().getRequest();
    const endpoint = this.normalizePath(request.url || request.path);
    const method = request.method as string;
    const apiKey = this.apiKeyAuthService.extractApiKey(request);

    if (!apiKey) {
      this.auditEventsService.emitEndpointAccess({
        endpoint,
        method,
        result: 'failure',
        details: { reason: 'MISSING_API_KEY', authMethod: 'api-key' }
      });
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'API Key não fornecida',
        error: 'Unauthorized',
        details: {
          reason: 'MISSING_API_KEY',
          hint: 'Forneça a API Key via header (x-api-key), query parameter (apiKey) ou cookie (api_key)'
        }
      });
    }

    // Primary: DB-backed validation
    const record = await this.apiKeysService.validate(apiKey);

    if (record) {
      if (!this.apiKeysService.hasRequiredScopes(record, options.scopes)) {
        this.auditEventsService.emitEndpointAccess({
          endpoint,
          method,
          result: 'failure',
          details: {
            reason: 'INSUFFICIENT_SCOPES',
            authMethod: 'api-key',
            maskedKey: this.apiKeyAuthService.maskApiKey(apiKey),
            requiredScopes: options.scopes,
            keyScopes: record.scopes
          }
        });
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Escopos insuficientes',
          error: 'Forbidden',
          details: { reason: 'INSUFFICIENT_SCOPES', required: options.scopes }
        });
      }
      this.auditEventsService.emitEndpointAccess({
        endpoint,
        method,
        result: 'success',
        details: { authMethod: 'api-key', source: 'database', maskedKey: record.keyPrefix + '...' }
      });
      return true;
    }

    // Fallback: env-based key (backward compat when table is empty)
    const isEnvValid = this.apiKeyAuthService.validateApiKey(apiKey);
    if (isEnvValid) {
      this.auditEventsService.emitEndpointAccess({
        endpoint,
        method,
        result: 'success',
        details: { authMethod: 'api-key', source: 'env-fallback', maskedKey: this.apiKeyAuthService.maskApiKey(apiKey) }
      });
      return true;
    }

    this.auditEventsService.emitEndpointAccess({
      endpoint,
      method,
      result: 'failure',
      details: { reason: 'INVALID_API_KEY', authMethod: 'api-key', maskedKey: this.apiKeyAuthService.maskApiKey(apiKey) }
    });
    throw new UnauthorizedException({
      statusCode: 401,
      message: 'API Key inválida',
      error: 'Unauthorized',
      details: { reason: 'INVALID_API_KEY', hint: 'Verifique se a API Key está correta' }
    });
  }

  private normalizePath(path: string): string {
    if (!path) return '/';
    const pathWithoutQuery = path.split('?')[0];
    const normalizedPath = pathWithoutQuery?.replace(/\/$/, '') || '/';
    return normalizedPath.replace(/[\x00-\x1F\x7F]/g, '');
  }

  getConfiguredKeysCount(): number {
    return this.apiKeyAuthService.getConfiguredKeysCount();
  }

  isValidKey(apiKey: string): boolean {
    return this.apiKeyAuthService.isValidKey(apiKey);
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/decorators/require-api-key.decorator.ts apps/api/src/common/guards/api-key-auth.guard.ts
git commit -m "feat(api-keys): update guard to delegate to ApiKeysService with scope enforcement"
```

---

### Task 6: Admin controller

**Files:**
- Create: `apps/api/src/modules/api-keys/api-keys.controller.ts`

- [ ] **Step 1: Write the controller**

```typescript
// apps/api/src/modules/api-keys/api-keys.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  ApiKeyCreateResponse,
  ApiKeyListResponse,
  ApiKeyContract,
  ApiKeyRotateResponse
} from '@api-llm-embedded/shared';
import { RequireApiKey } from '../../common/decorators/require-api-key.decorator.js';
import { ApiKeysService } from './api-keys.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { RotateApiKeyDto } from './dto/rotate-api-key.dto.js';
import { toApiKeyContract } from './dto/api-key-response.dto.js';

@ApiTags('Admin - API Keys')
@Controller('admin/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @RequireApiKey({ scopes: ['admin:api-keys'] })
  @ApiOperation({ summary: 'Create a new API key. Returns plaintext once — store it securely.' })
  @ApiResponse({ status: 201, description: 'Key created. Plaintext returned once.' })
  async create(@Body() dto: CreateApiKeyDto): Promise<ApiKeyCreateResponse> {
    const { entity, plaintext } = await this.apiKeysService.create(dto);
    return { key: toApiKeyContract(entity), plaintext };
  }

  @Get()
  @RequireApiKey({ scopes: ['admin:api-keys'] })
  @ApiOperation({ summary: 'List all API keys (metadata only, no values).' })
  @ApiResponse({ status: 200, description: 'List of key metadata.' })
  async findAll(): Promise<ApiKeyListResponse> {
    const data = await this.apiKeysService.listAll();
    return { data: data.map(toApiKeyContract), count: data.length };
  }

  @Get(':id')
  @RequireApiKey({ scopes: ['admin:api-keys'] })
  @ApiOperation({ summary: 'Get a single API key by ID.' })
  @ApiResponse({ status: 200, description: 'Key metadata.' })
  @ApiResponse({ status: 404, description: 'Key not found.' })
  async findOne(@Param('id') id: string): Promise<ApiKeyContract> {
    const entity = await this.apiKeysService.findById(id);
    if (!entity) throw new NotFoundException(`API key ${id} not found`);
    return toApiKeyContract(entity);
  }

  @Patch(':id/rotate')
  @RequireApiKey({ scopes: ['admin:api-keys'] })
  @ApiOperation({ summary: 'Schedule key rotation. Old key coexists until scheduledAt.' })
  @ApiResponse({ status: 200, description: 'Successor key created. Plaintext returned once.' })
  @ApiResponse({ status: 404, description: 'Key not found or not in active status.' })
  async rotate(
    @Param('id') id: string,
    @Body() dto: RotateApiKeyDto
  ): Promise<ApiKeyRotateResponse> {
    if (dto.dryRun) {
      const entity = await this.apiKeysService.findById(id);
      if (!entity) throw new NotFoundException(`API key ${id} not found`);
      return {
        predecessor: toApiKeyContract(entity),
        successor: { ...toApiKeyContract(entity), id: 'dry-run', keyPrefix: 'preview', status: 'active' },
        plaintext: '[dry-run — no key generated]',
        scheduledAt: dto.scheduledAt,
        dryRun: true
      };
    }

    const result = await this.apiKeysService.rotate(id, dto);
    if (!result) throw new NotFoundException(`API key ${id} not found or not active`);

    return {
      predecessor: toApiKeyContract(result.predecessor),
      successor: toApiKeyContract(result.successor),
      plaintext: result.plaintext,
      scheduledAt: dto.scheduledAt,
      dryRun: false
    };
  }

  @Delete(':id')
  @RequireApiKey({ scopes: ['admin:api-keys'] })
  @ApiOperation({ summary: 'Revoke a key immediately.' })
  @ApiResponse({ status: 200, description: 'Key revoked.' })
  @ApiResponse({ status: 404, description: 'Key not found or already revoked/expired.' })
  async revoke(@Param('id') id: string): Promise<{ revoked: boolean; id: string }> {
    const ok = await this.apiKeysService.revoke(id);
    if (!ok) throw new NotFoundException(`API key ${id} not found or already inactive`);
    return { revoked: true, id };
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/api-keys/api-keys.controller.ts
git commit -m "feat(api-keys): add admin controller with 5 endpoints"
```

---

### Task 7: Module wiring

**Files:**
- Create: `apps/api/src/modules/api-keys/api-keys.module.ts`
- Modify: `apps/api/src/common/guards/guards.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module**

```typescript
// apps/api/src/modules/api-keys/api-keys.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyEntity } from './entities/api-key.entity.js';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeysController } from './api-keys.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKeyEntity])],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService]
})
export class ApiKeysModule {}
```

- [ ] **Step 2: Update GuardsModule to import ApiKeysModule**

Replace the entire content of `apps/api/src/common/guards/guards.module.ts`:

```typescript
// apps/api/src/common/guards/guards.module.ts
import { Module } from '@nestjs/common';
import { ApiKeyAuthService } from './api-key-auth.service.js';
import { ApiKeyAuthGuard } from './api-key-auth.guard.js';
import { AuditEventsModule } from '../events/audit-events.module.js';
import { ApiKeysModule } from '../../modules/api-keys/api-keys.module.js';

@Module({
  imports: [AuditEventsModule, ApiKeysModule],
  providers: [ApiKeyAuthService, ApiKeyAuthGuard],
  exports: [ApiKeyAuthService, ApiKeyAuthGuard, AuditEventsModule, ApiKeysModule]
})
export class GuardsModule {}
```

- [ ] **Step 3: Add ApiKeysModule to AppModule**

In `apps/api/src/app.module.ts`, add `ApiKeysModule` to the imports array:

```typescript
// Add this import at the top:
import { ApiKeysModule } from './modules/api-keys/api-keys.module.js';

// Add to the imports array (after GuardsModule):
ApiKeysModule,
```

- [ ] **Step 4: Build to confirm full compilation**

```bash
npm run -w apps/api build
```
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Run all tests**

```bash
npm run -w apps/api test
```
Expected: All tests pass.

- [ ] **Step 6: Run migration (requires PostgreSQL configured)**

```bash
npm run -w apps/api migration:run
```
Expected: `CreateApiKeysTable1777593600000` migration applied.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/api-keys/api-keys.module.ts apps/api/src/common/guards/guards.module.ts apps/api/src/app.module.ts
git commit -m "feat(api-keys): wire ApiKeysModule into app"
```

---

### Task 8: MCP secrets integration

**Files:**
- Create: `apps/svcia/mcp-secrets/src/admin-api-client.ts`
- Modify: `apps/svcia/mcp-secrets/src/main.ts`
- Modify: `apps/svcia/mcp-secrets/src/secrets-registry.ts`

- [ ] **Step 1: Create admin API client**

```typescript
// apps/svcia/mcp-secrets/src/admin-api-client.ts
export interface ApiKeyMeta {
  id: string;
  name: string;
  keyPrefix: string;
  owner: string;
  ownerType: string;
  scopes: string[];
  status: string;
  scheduledRotationAt: string | null;
  expiresAt: string | null;
}

export interface RotateDryRunResult {
  dryRun: true;
  correlationId: string;
  preview: {
    predecessorId: string;
    predecessorPrefix: string;
    scheduledAt: string;
    affectedScopes: string[];
  };
  approvalRequired: true;
  mutationAllowed: false;
}

export interface RevokeDryRunResult {
  dryRun: true;
  correlationId: string;
  preview: { id: string; name: string; currentStatus: string };
  approvalRequired: true;
  mutationAllowed: false;
}

function generateCorrelationId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export class AdminApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = process.env.ADMIN_API_URL ?? 'http://localhost:3000';
    this.apiKey = process.env.ADMIN_API_KEY ?? '';
  }

  private headers(): Record<string, string> {
    return { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' };
  }

  async listApiKeys(): Promise<ApiKeyMeta[]> {
    const res = await fetch(`${this.baseUrl}/admin/api-keys`, { headers: this.headers() });
    if (!res.ok) throw new Error(`admin API error: ${res.status}`);
    const body = await res.json() as { data: ApiKeyMeta[] };
    return body.data;
  }

  async prepareRotate(id: string, scheduledAt: string): Promise<RotateDryRunResult> {
    const res = await fetch(`${this.baseUrl}/admin/api-keys/${id}/rotate`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ scheduledAt, dryRun: true })
    });
    if (!res.ok) throw new Error(`admin API error: ${res.status}`);
    const preview = await res.json() as { predecessor: ApiKeyMeta; scheduledAt: string };
    return {
      dryRun: true,
      correlationId: generateCorrelationId('rot'),
      preview: {
        predecessorId: preview.predecessor.id,
        predecessorPrefix: preview.predecessor.keyPrefix,
        scheduledAt: preview.scheduledAt,
        affectedScopes: preview.predecessor.scopes
      },
      approvalRequired: true,
      mutationAllowed: false
    };
  }

  async prepareRevoke(id: string): Promise<RevokeDryRunResult> {
    const keys = await this.listApiKeys();
    const found = keys.find(k => k.id === id);
    if (!found) throw new Error(`API key ${id} not found`);
    return {
      dryRun: true,
      correlationId: generateCorrelationId('rev'),
      preview: { id: found.id, name: found.name, currentStatus: found.status },
      approvalRequired: true,
      mutationAllowed: false
    };
  }
}
```

- [ ] **Step 2: Register new tools in mcp-secrets/main.ts**

In `apps/svcia/mcp-secrets/src/main.ts`, add after the existing imports:

```typescript
import { AdminApiClient } from './admin-api-client.js';
```

Add after `const secretsRegistry = new SecretsRegistry();`:

```typescript
const adminClient = new AdminApiClient();
```

Then register three new tools before `async function main()`:

```typescript
server.registerTool(
  'api_key_list',
  {
    title: 'List API Keys',
    description: 'Lista metadados de todas as API keys do sistema (sem valores). Requer ADMIN_API_URL e ADMIN_API_KEY configurados.',
    inputSchema: {}
  },
  async () => {
    const keys = await adminClient.listApiKeys();
    return toToolResult({ count: keys.length, dryRunOnly: true, valuesReturned: false, keys });
  }
);

server.registerTool(
  'api_key_rotate_prepare',
  {
    title: 'Prepare API Key Rotation',
    description: 'Dry-run de rotacao agendada de uma API key. Retorna correlationId para uso na chamada HTTP de aprovacao.',
    inputSchema: {
      keyId: z.string().min(1).describe('ID da API key a ser rotacionada'),
      scheduledAt: z.string().min(1).describe('ISO 8601 — data em que a key antiga expira')
    }
  },
  async ({ keyId, scheduledAt }) => {
    const result = await adminClient.prepareRotate(keyId, scheduledAt);
    return toToolResult(result as unknown as Record<string, unknown>);
  }
);

server.registerTool(
  'api_key_revoke_prepare',
  {
    title: 'Prepare API Key Revocation',
    description: 'Dry-run de revogacao de uma API key. Retorna correlationId para uso na chamada HTTP de aprovacao.',
    inputSchema: {
      keyId: z.string().min(1).describe('ID da API key a ser revogada')
    }
  },
  async ({ keyId }) => {
    const result = await adminClient.prepareRevoke(keyId);
    return toToolResult(result as unknown as Record<string, unknown>);
  }
);
```

- [ ] **Step 3: Add api_key.* entries to secrets-registry catalog**

In `apps/svcia/mcp-secrets/src/secrets-registry.ts`, find the default catalog and add these entries at the end of the `defaultCatalog` array:

```typescript
{
  logicalKey: 'api.admin.key',
  envName: 'ADMIN_API_KEY',
  description: 'API key com scope admin:api-keys usada pelo mcp-secrets para chamar /admin/api-keys',
  provider: 'process-env' as SecretProvider,
  configured: !!process.env.ADMIN_API_KEY
},
{
  logicalKey: 'api.admin.url',
  envName: 'ADMIN_API_URL',
  description: 'Base URL do admin HTTP (ex: http://localhost:3000)',
  provider: 'process-env' as SecretProvider,
  configured: !!process.env.ADMIN_API_URL
},
```

- [ ] **Step 4: Build mcp-secrets**

```bash
npm run -w apps/svcia/mcp-secrets build
```
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/svcia/mcp-secrets/src/
git commit -m "feat(mcp-secrets): add api_key_list, rotate_prepare, revoke_prepare tools"
```

---

## PHASE B — Docker Compose Secrets

---

### Task 9: readSecret helper in env.validation.ts

**Files:**
- Modify: `apps/api/src/config/env.validation.ts`

- [ ] **Step 1: Add readSecret helper and update secret reads**

The `readSecret` helper reads from a file when `{NAME}_FILE` is set, falling back to the env var. This means Docker Compose can mount secrets as files without changing the app's config API.

Replace the entire content of `apps/api/src/config/env.validation.ts`:

```typescript
// apps/api/src/config/env.validation.ts
import { readFileSync } from 'node:fs';

export type AppEnv = {
  nodeEnv: string;
  port: number;
  pgHost: string;
  pgPort: number;
  pgDatabase: string;
  pgUser: string;
  pgPassword: string;
  pgSchema: string;
  databaseSynchronize: boolean;
  llmPgHost: string;
  llmPgPort: number;
  llmPgDatabase: string;
  llmPgUser: string;
  llmPgPassword: string;
  llmPgSsl: boolean;
  llmPgSchema: string;
  langflowEnabled: boolean;
  langflowUrl: string | null;
  langflowApiKey: string | null;
  langflowServiceAccountKey: string | null;
  langflowRunTimeoutMs: number;
  astraDbEnabled: boolean;
  astraDbApplicationToken: string | null;
  astraDbApiEndpoint: string | null;
  astraDbKeyspace: string;
  astraDbRegion: string | null;
  m365MigrationMode: string;
  m365EnableMailboxContentRead: boolean;
  m365EnableMailboxContentWrite: boolean;
  m365EnableExchangeMigration: boolean;
  sourceTenantId: string | null;
  sourceClientId: string | null;
  targetTenantId: string | null;
  targetClientId: string | null;
};

// Reads from {NAME}_FILE path first, then falls back to env var.
// Docker Compose secrets mount files at /run/secrets/<name>.
function readSecret(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const filePath = env[`${name}_FILE`]?.trim();
  if (filePath) {
    return readFileSync(filePath, 'utf8').trim();
  }
  return env[name]?.trim();
}

function readRequiredString(env: NodeJS.ProcessEnv, key: string): string {
  const value = readSecret(env, key);
  if (!value) {
    throw new Error(`Missing required env var: ${key} (or ${key}_FILE)`);
  }
  return value;
}

function readOptionalString(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = readSecret(env, key);
  return value || null;
}

export function buildAppEnv(env: NodeJS.ProcessEnv): AppEnv {
  const databaseSynchronize = env.DATABASE_SYNCHRONIZE === 'true';

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number(env.PORT ?? 3000),
    pgHost: readRequiredString(env, 'PG_HOST'),
    pgPort: Number(env.PG_PORT ?? 5432),
    pgDatabase: readRequiredString(env, 'PG_DATABASE'),
    pgUser: readRequiredString(env, 'PG_USER'),
    pgPassword: readRequiredString(env, 'PG_PASSWORD'),
    pgSchema: env.PG_SCHEMA ?? 'public',
    databaseSynchronize,
    llmPgHost: readRequiredString(env, 'LLM_PG_HOST'),
    llmPgPort: Number(env.LLM_PG_PORT ?? 5432),
    llmPgDatabase: readRequiredString(env, 'LLM_PG_DATABASE'),
    llmPgUser: readRequiredString(env, 'LLM_PG_USER'),
    llmPgPassword: readRequiredString(env, 'LLM_PG_PASSWORD'),
    llmPgSsl: env.LLM_PG_SSL === 'true',
    llmPgSchema: env.LLM_PG_SCHEMA ?? 'llm_ops',
    langflowEnabled: env.LANGFLOW_ENABLED === 'true',
    langflowUrl: readOptionalString(env, 'LANGFLOW_URL'),
    langflowApiKey: readOptionalString(env, 'LANGFLOW_API_KEY'),
    langflowServiceAccountKey: readOptionalString(env, 'LANGFLOW_SVCACT_KEY'),
    langflowRunTimeoutMs: Number(env.LANGFLOW_RUN_TIMEOUT_MS ?? 15000),
    astraDbEnabled: env.ASTRA_DB_ENABLED === 'true',
    astraDbApplicationToken: readOptionalString(env, 'ASTRA_DB_APPLICATION_TOKEN'),
    astraDbApiEndpoint: readOptionalString(env, 'ASTRA_DB_API_ENDPOINT'),
    astraDbKeyspace: env.ASTRA_DB_KEYSPACE?.trim() || 'llm_ops',
    astraDbRegion: readOptionalString(env, 'ASTRA_DB_REGION'),
    m365MigrationMode: env.M365_MIGRATION_MODE?.trim() || 'inventory-only',
    m365EnableMailboxContentRead: env.M365_ENABLE_MAILBOX_CONTENT_READ === 'true',
    m365EnableMailboxContentWrite: env.M365_ENABLE_MAILBOX_CONTENT_WRITE === 'true',
    m365EnableExchangeMigration: env.M365_ENABLE_EXCHANGE_MIGRATION === 'true',
    sourceTenantId: readOptionalString(env, 'SOURCE_TENANT_ID'),
    sourceClientId: readOptionalString(env, 'SOURCE_CLIENT_ID'),
    targetTenantId: readOptionalString(env, 'TARGET_TENANT_ID'),
    targetClientId: readOptionalString(env, 'TARGET_CLIENT_ID')
  };
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/config/env.validation.ts
git commit -m "feat(config): add readSecret helper with _FILE fallback for Docker secrets"
```

---

### Task 10: Docker Compose secrets and bootstrap script

**Files:**
- Create: `scripts/bootstrap/check-secrets.sh`
- Modify: `docker-compose.yml`
- Modify: `.gitignore`

- [ ] **Step 1: Create the bootstrap validation script**

```bash
# scripts/bootstrap/check-secrets.sh
#!/usr/bin/env bash
set -euo pipefail

SECRETS_DIR="${1:-./secrets}"

declare -a REQUIRED_FILES=(
  "pg_password.txt"
  "llm_pg_password.txt"
  "postgres_password.txt"
  "astra_db_token.txt"
  "langflow_api_key.txt"
  "llm_api_key.txt"
  "graph_client_secret.txt"
)

OPTIONAL_FILES=(
  "cert.pem"
)

MISSING=0

echo "Checking secrets in: $SECRETS_DIR"

for f in "${REQUIRED_FILES[@]}"; do
  path="$SECRETS_DIR/$f"
  if [[ ! -f "$path" ]]; then
    echo "  MISSING: $path"
    MISSING=$((MISSING + 1))
  elif [[ ! -s "$path" ]]; then
    echo "  EMPTY:   $path"
    MISSING=$((MISSING + 1))
  else
    echo "  OK:      $path"
  fi
done

for f in "${OPTIONAL_FILES[@]}"; do
  path="$SECRETS_DIR/$f"
  if [[ ! -f "$path" ]]; then
    echo "  WARN (optional): $path not found"
  else
    echo "  OK (optional):   $path"
  fi
done

if [[ $MISSING -gt 0 ]]; then
  echo ""
  echo "ERROR: $MISSING required secret file(s) missing."
  echo "Copy secrets/local.secrets.example.json for reference."
  exit 1
fi

echo ""
echo "All required secrets present."
```

Make it executable:
```bash
chmod +x scripts/bootstrap/check-secrets.sh
```

- [ ] **Step 2: Add secrets directory to .gitignore**

In `.gitignore`, add (if not already present):
```
# Docker secrets — never commit actual secret files
secrets/*.txt
secrets/*.pem
secrets/*.key
!secrets/local.secrets.example.json
```

- [ ] **Step 3: Add secrets stanza to docker-compose.yml for postgres service**

Find the `postgres` service in `docker-compose.yml` and update its `environment` block. Replace:
```yaml
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-api_llm_embedded}
```
With:
```yaml
    secrets:
      - postgres_password
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
      POSTGRES_DB: ${POSTGRES_DB:-api_llm_embedded}
```

Note: The official `postgres:16-alpine` image natively supports `POSTGRES_PASSWORD_FILE`.

- [ ] **Step 4: Add global secrets section to docker-compose.yml**

At the end of `docker-compose.yml`, before or after the `volumes:` section, add:

```yaml
secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
  pg_password:
    file: ./secrets/pg_password.txt
  llm_pg_password:
    file: ./secrets/llm_pg_password.txt
  astra_db_token:
    file: ./secrets/astra_db_token.txt
  langflow_api_key:
    file: ./secrets/langflow_api_key.txt
  llm_api_key:
    file: ./secrets/llm_api_key.txt
  graph_client_secret:
    file: ./secrets/graph_client_secret.txt
```

- [ ] **Step 5: For each domain service that uses secrets, add secrets stanza**

For each domain container in `docker-compose.yml` that reads `PG_PASSWORD`, `LLM_PG_PASSWORD`, `LLM_API_KEY`, `ASTRA_DB_APPLICATION_TOKEN`, `LANGFLOW_API_KEY`, or `GRAPH_CLIENT_SECRET`, apply the pattern:

```yaml
# Example for llm-ops domain service:
    secrets:
      - llm_pg_password
      - astra_db_token
      - langflow_api_key
      - llm_api_key
    environment:
      # Replace direct secret values with _FILE pointers:
      LLM_PG_PASSWORD_FILE: /run/secrets/llm_pg_password
      ASTRA_DB_APPLICATION_TOKEN_FILE: /run/secrets/astra_db_token
      LANGFLOW_API_KEY_FILE: /run/secrets/langflow_api_key
      LLM_API_KEY_FILE: /run/secrets/llm_api_key

# Example for users/sync domain service:
    secrets:
      - pg_password
    environment:
      PG_PASSWORD_FILE: /run/secrets/pg_password

# Example for sharepoint domain service:
    secrets:
      - graph_client_secret
    environment:
      GRAPH_CLIENT_SECRET_FILE: /run/secrets/graph_client_secret
      # CERT_PRIVATE_KEY_PATH stays as env var pointing to existing cert mount
```

- [ ] **Step 6: Create placeholder secret files for local dev**

```bash
mkdir -p secrets
echo "your-pg-password-here" > secrets/pg_password.txt
echo "your-pg-password-here" > secrets/postgres_password.txt
echo "your-llm-pg-password-here" > secrets/llm_pg_password.txt
echo "your-astra-db-token-here" > secrets/astra_db_token.txt
echo "your-langflow-api-key-here" > secrets/langflow_api_key.txt
echo "your-llm-api-key-here" > secrets/llm_api_key.txt
echo "your-graph-client-secret-here" > secrets/graph_client_secret.txt
```

Then immediately verify the script passes:

```bash
bash scripts/bootstrap/check-secrets.sh
```
Expected output:
```
Checking secrets in: ./secrets
  OK: ./secrets/pg_password.txt
  OK: ./secrets/postgres_password.txt
  ...
All required secrets present.
```

- [ ] **Step 7: Verify docker compose config is valid**

```bash
docker compose --env-file .env.containers config --quiet
```
Expected: No errors.

- [ ] **Step 8: Verify docker inspect no longer leaks secrets**

```bash
# Start postgres with secrets
docker compose --env-file .env.containers -p api-llm-embedded --profile persistent up -d postgres

# Inspect — POSTGRES_PASSWORD must NOT appear in Env
docker inspect api-llm-embedded-postgres | grep -i password
```
Expected: `POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password` appears. No plaintext password.

- [ ] **Step 9: Commit**

```bash
git add scripts/bootstrap/check-secrets.sh docker-compose.yml .gitignore
git commit -m "feat(docker): migrate sensitive env vars to Docker Compose secrets with _FILE pattern"
```

---

## Verification Checklist

### Part A — api-keys module
- [ ] `npm run type-check` → 0 errors
- [ ] `npm run -w apps/api test` → all tests pass
- [ ] `npm run -w apps/api migration:run` → migration applied cleanly
- [ ] `POST /admin/api-keys` → returns `{ key: {...}, plaintext: "aki_..." }` — verify DB stores only `key_hash`
- [ ] Use returned key in `GET /admin/api-keys` → 200 OK
- [ ] `PATCH /admin/api-keys/:id/rotate` with future `scheduledAt` → both keys accepted by guard; after `scheduledAt`, predecessor rejected on next use
- [ ] `DELETE /admin/api-keys/:id` → key rejected immediately after
- [ ] Key with missing scope → 403 Forbidden (not 401)
- [ ] `npm run validate:mcp` → `api_key_list`, `api_key_rotate_prepare`, `api_key_revoke_prepare` respond with `dryRun: true`

### Part B — Docker secrets
- [ ] `bash scripts/bootstrap/check-secrets.sh` → passes with all files present
- [ ] `docker compose config --quiet` → no errors
- [ ] `docker inspect <container>` → `PG_PASSWORD` and `LLM_API_KEY` not in `Env` list
- [ ] `docker exec <container> cat /run/secrets/pg_password` → correct value
- [ ] `npm run dev` (no Docker) → app still reads `PG_PASSWORD` env var (fallback works)
