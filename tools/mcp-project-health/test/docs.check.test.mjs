import assert from 'node:assert/strict';
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const { checkDocs } = await import('../dist/checks/docs.check.js');

// Scenario 1: file missing → must create
const tmp1 = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(tmp1, { recursive: true });
const r1 = await checkDocs(tmp1);
assert.equal(r1.status, 'fixed', `Expected 'fixed' for missing file, got '${r1.status}'`);
assert.ok(existsSync(join(tmp1, 'docs', 'architecture', 'llm-ops-contract-matrix-final.md')));
rmSync(tmp1, { recursive: true });

// Scenario 2: file present but missing content → must patch
const tmp2 = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(join(tmp2, 'docs', 'architecture'), { recursive: true });
writeFileSync(join(tmp2, 'docs', 'architecture', 'llm-ops-contract-matrix-final.md'), '# docs\n');
const r2 = await checkDocs(tmp2);
assert.equal(r2.status, 'fixed', `Expected 'fixed' for missing content, got '${r2.status}'`);
const content2 = readFileSync(join(tmp2, 'docs', 'architecture', 'llm-ops-contract-matrix-final.md'), 'utf8');
assert.ok(content2.includes('Wave A + Wave B'));
assert.ok(content2.includes('GET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status'));
rmSync(tmp2, { recursive: true });

// Scenario 3: correct file → ok
const tmp3 = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(join(tmp3, 'docs', 'architecture'), { recursive: true });
writeFileSync(
  join(tmp3, 'docs', 'architecture', 'llm-ops-contract-matrix-final.md'),
  '# Wave A + Wave B\nGET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status\n'
);
const r3 = await checkDocs(tmp3);
assert.equal(r3.status, 'ok', `Expected 'ok' for valid file, got '${r3.status}'`);
rmSync(tmp3, { recursive: true });

console.log('✅ docs.check test passed');
