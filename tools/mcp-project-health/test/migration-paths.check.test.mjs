import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const tmp = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(join(tmp, 'apps', 'api', 'src', 'infra', 'database'), { recursive: true });

const BUGGY_CONFIG = `
import { fileURLToPath } from 'node:url';
const currentModulePath = fileURLToPath(import.meta.url);
const isTypeScriptRuntime = currentModulePath.endsWith('.ts');

const runtimeMigrationGlobs = (sourceGlob: string, distGlob: string): string[] =>
  isTypeScriptRuntime ? [sourceGlob] : [distGlob];

export const AppDataSource = {};
`;

writeFileSync(
  join(tmp, 'apps', 'api', 'src', 'infra', 'database', 'typeorm.config.ts'),
  BUGGY_CONFIG
);

const { checkMigrationPaths } = await import('../dist/checks/migration-paths.check.js');
const result = await checkMigrationPaths(tmp);

assert.equal(result.tool, 'migration_paths_fix');
assert.equal(result.status, 'fixed', `Expected 'fixed', got '${result.status}'`);
assert.equal(result.corrections.length, 1);

const fixed = readFileSync(
  join(tmp, 'apps', 'api', 'src', 'infra', 'database', 'typeorm.config.ts'),
  'utf8'
);
assert.ok(fixed.includes('resolve(currentDir'), 'Fixed file should use resolve(currentDir)');

rmSync(tmp, { recursive: true });
console.log('✅ migration-paths.check test passed');
