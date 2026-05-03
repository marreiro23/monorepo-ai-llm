import { join } from 'node:path';
import type { CheckResult, Correction, Finding } from '../types.js';

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

function readDbConfig(prefix: 'PG' | 'LLM_PG'): DbConfig {
  return {
    host: process.env[`${prefix}_HOST`] ?? 'localhost',
    port: Number(process.env[`${prefix}_PORT`] ?? '5432'),
    database: process.env[`${prefix}_DATABASE`] ?? '',
    user: process.env[`${prefix}_USER`] ?? '',
    password: process.env[`${prefix}_PASSWORD`] ?? ''
  };
}

async function testConnectivity(cfg: DbConfig): Promise<string | null> {
  const pg = await import('pg');
  const Client = (pg.default ?? pg).Client as typeof import('pg').Client;
  const client = new Client(cfg);
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return null;
  } catch (err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function runMigrationsIfNeeded(
  repoRoot: string,
  dsName: 'AppDataSource' | 'LlmOpsDataSource'
): Promise<{ applied: number; error?: string }> {
  const distPath = join(repoRoot, 'apps', 'api', 'dist', 'infra', 'database', 'typeorm.config.js');
  const fileUrl = `file:///${distPath.replace(/\\/g, '/')}`;

  try {
    const mod = await import(fileUrl) as Record<string, unknown>;
    const ds = mod[dsName] as {
      initialize: () => Promise<void>;
      showMigrations: () => Promise<boolean>;
      runMigrations: (opts: object) => Promise<{ name: string }[]>;
      isInitialized: boolean;
      destroy: () => Promise<void>;
    };

    if (!ds.isInitialized) {
      await ds.initialize();
    }

    const hasPending = await ds.showMigrations();
    if (!hasPending) {
      await ds.destroy();
      return { applied: 0 };
    }

    const ran = await ds.runMigrations({ transaction: 'each' });
    await ds.destroy();
    return { applied: ran.length };
  } catch (err: unknown) {
    return { applied: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkDatabase(repoRoot: string): Promise<CheckResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  const correctionMessages: string[] = [];

  const mainCfg = readDbConfig('PG');
  const llmCfg = readDbConfig('LLM_PG');

  if (!mainCfg.database || !mainCfg.user) {
    return {
      tool: 'database_check',
      status: 'skipped',
      durationMs: Date.now() - start,
      findings: [{ severity: 'info', message: 'PG_* env vars not configured — skipping database check' }],
      corrections: []
    };
  }

  const mainErr = await testConnectivity(mainCfg);
  if (mainErr) {
    return {
      tool: 'database_check',
      status: 'error',
      durationMs: Date.now() - start,
      findings: [{ severity: 'error', message: `Cannot connect to main PostgreSQL: ${mainErr}` }],
      corrections: []
    };
  }

  const mainResult = await runMigrationsIfNeeded(repoRoot, 'AppDataSource');
  if (mainResult.error) {
    findings.push({ severity: 'warning', message: `AppDataSource migration check failed: ${mainResult.error}` });
  } else if (mainResult.applied > 0) {
    findings.push({ severity: 'info', message: `Applied ${mainResult.applied} pending migration(s) on main DB` });
    correctionMessages.push(`Applied ${mainResult.applied} main DB migration(s)`);
  }

  if (llmCfg.database && llmCfg.user) {
    const llmResult = await runMigrationsIfNeeded(repoRoot, 'LlmOpsDataSource');
    if (llmResult.error) {
      findings.push({ severity: 'warning', message: `LlmOpsDataSource migration check failed: ${llmResult.error}` });
    } else if (llmResult.applied > 0) {
      findings.push({ severity: 'info', message: `Applied ${llmResult.applied} pending migration(s) on llm_ops DB` });
      correctionMessages.push(`Applied ${llmResult.applied} llm_ops migration(s)`);
    }
  }

  const hasErrors = findings.some((f) => f.severity === 'error');
  const status = hasErrors ? 'error' : correctionMessages.length > 0 ? 'fixed' : 'ok';

  const corrections: Correction[] = correctionMessages.map((c) => ({
    file: 'apps/api/dist/infra/database/typeorm.config.js',
    description: c,
    before: 'pending migration',
    after: 'migration applied'
  }));

  return {
    tool: 'database_check',
    status,
    durationMs: Date.now() - start,
    findings,
    corrections
  };
}
