import { checkBuild } from '../checks/build.check.js';
import { checkDockerfile } from '../checks/dockerfile.check.js';
import { checkDockerCompose } from '../checks/docker-compose.check.js';
import { checkMigrationPaths } from '../checks/migration-paths.check.js';
import { checkDocs } from '../checks/docs.check.js';
import { runSmoke } from '../checks/smoke.check.js';
import { checkDatabase } from '../checks/database.check.js';
import { writeAuditReport } from './audit-writer.js';
export async function runAll(opts) {
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
            status: 'skipped',
            durationMs: 0,
            findings: [{ severity: 'info', message: 'Skipped: build failed' }],
            corrections: []
        };
    return [buildResult, dockerfileResult, composeResult, migrationResult, docsResult, smokeResult, dbResult];
}
export async function runAllWithReport(opts) {
    const results = await runAll(opts);
    const reportPath = writeAuditReport(opts.repoRoot, results);
    return { results, reportPath };
}
