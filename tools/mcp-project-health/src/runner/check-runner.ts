import type { CheckResult } from '../types.js';
import { checkBuild } from '../checks/build.check.js';
import { checkDockerfile } from '../checks/dockerfile.check.js';
import { checkDockerCompose } from '../checks/docker-compose.check.js';
import { checkMigrationPaths } from '../checks/migration-paths.check.js';
import { checkDocs } from '../checks/docs.check.js';
import { runSmoke } from '../checks/smoke.check.js';
import { checkDatabase } from '../checks/database.check.js';
import { writeAuditReport } from './audit-writer.js';

export interface RunAllOptions {
  repoRoot: string;
  smokeCategories?: Array<'static' | 'mcp' | 'typeorm' | 'all'>;
  smokeTimeoutMs?: number;
}

export async function runAll(opts: RunAllOptions): Promise<CheckResult[]> {
  const { repoRoot, smokeCategories = ['static', 'mcp'], smokeTimeoutMs = 30_000 } = opts;

  const buildResult = await checkBuild(repoRoot);

  const [dockerfileResult, composeResult, migrationResult, docsResult, smokeResult] = await Promise.all([
    checkDockerfile(repoRoot),
    checkDockerCompose(repoRoot),
    checkMigrationPaths(repoRoot),
    checkDocs(repoRoot),
    runSmoke({ repoRoot, categories: smokeCategories, timeoutMs: smokeTimeoutMs })
  ]);

  const dbResult = buildResult.status !== 'error'
    ? await checkDatabase(repoRoot)
    : {
        tool: 'database_check',
        status: 'skipped' as const,
        durationMs: 0,
        findings: [{ severity: 'info' as const, message: 'Skipped: build failed' }],
        corrections: []
      };

  return [buildResult, dockerfileResult, composeResult, migrationResult, docsResult, smokeResult, dbResult];
}

export async function runAllWithReport(opts: RunAllOptions): Promise<{ results: CheckResult[]; reportPath: string }> {
  const results = await runAll(opts);
  const reportPath = writeAuditReport(opts.repoRoot, results);
  return { results, reportPath };
}
