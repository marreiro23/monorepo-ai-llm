import { exec } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CheckResult, Finding } from '../types.js';

const execAsync = promisify(exec);

type SmokeCategory = 'static' | 'mcp' | 'typeorm' | 'all';

const SMOKE_CATEGORIES: Record<Exclude<SmokeCategory, 'all'>, string[]> = {
  static: ['governance-smoke', 'retry-jitter-smoke', 'llm-ops-contracts-ab-smoke', 'graph-config-smoke'],
  mcp: ['mcp-users-read-smoke', 'mcp-secrets-read-smoke', 'mcp-llm-ops-read-smoke', 'mcp-sync-read-smoke'],
  typeorm: ['users-typeorm-smoke', 'llm-ops-typeorm-smoke', 'sync-typeorm-smoke']
};

interface SmokeRunInput {
  repoRoot: string;
  categories?: SmokeCategory[];
  timeoutMs?: number;
}

export async function runSmoke({ repoRoot, categories = ['static'], timeoutMs = 30_000 }: SmokeRunInput): Promise<CheckResult> {
  const start = Date.now();
  const findings: Finding[] = [];

  const cats = categories.includes('all')
    ? (['static', 'mcp', 'typeorm'] as const)
    : categories.filter((c): c is Exclude<SmokeCategory, 'all'> => c !== 'all');

  const tests = [...new Set(cats.flatMap((c) => SMOKE_CATEGORIES[c]))];
  const smokeDir = join(repoRoot, 'scripts', 'smoke-tests');

  await Promise.all(
    tests.map(async (name) => {
      const file = join(smokeDir, `${name}.mjs`);
      try {
        await execAsync(`node "${file}"`, { cwd: repoRoot, timeout: timeoutMs });
      } catch (err: unknown) {
        const e = err as { stderr?: string; stdout?: string; message?: string };
        const msg = (e.stderr ?? e.stdout ?? e.message ?? String(err)).trim().split('\n')[0];
        findings.push({ severity: 'error', file: `scripts/smoke-tests/${name}.mjs`, message: msg ?? 'smoke test failed' });
      }
    })
  );

  return {
    tool: 'smoke_run',
    status: findings.length === 0 ? 'ok' : 'error',
    durationMs: Date.now() - start,
    findings,
    corrections: []
  };
}
