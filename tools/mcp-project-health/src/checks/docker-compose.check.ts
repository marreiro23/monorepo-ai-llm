import { exec } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CheckResult, Finding } from '../types.js';

const execAsync = promisify(exec);

const EXPECTED_SERVICES = ['postgres', 'container-manager', 'users-api', 'llm-ops-api', 'sharepoint-api', 'sync-api', 'langflow'];

export async function checkDockerCompose(repoRoot: string): Promise<CheckResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  const envFile = join(repoRoot, '.env.containers');

  const baseCmd = `docker compose --env-file "${envFile}" -p api-llm-embedded --profile persistent --profile always --profile demand`;

  try {
    const { stderr } = await execAsync(`${baseCmd} config --quiet`, { cwd: repoRoot, timeout: 10_000 });
    if (stderr.includes('LLM_API_KEY')) {
      findings.push({ severity: 'warning', message: 'LLM_API_KEY not set (optional for local dev)' });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      tool: 'docker_compose_check',
      status: 'error',
      durationMs: Date.now() - start,
      findings: [{ severity: 'error', file: 'docker-compose.yml', message: `docker compose config failed: ${msg.split('\n')[0]}` }],
      corrections: []
    };
  }

  try {
    const { stdout } = await execAsync(`${baseCmd} config --services`, { cwd: repoRoot, timeout: 10_000 });
    const services = stdout.trim().split('\n').filter(Boolean);
    for (const expected of EXPECTED_SERVICES) {
      if (!services.includes(expected)) {
        findings.push({ severity: 'error', file: 'docker-compose.yml', message: `Missing service: ${expected}` });
      }
    }
  } catch (err: unknown) {
    findings.push({ severity: 'error', message: `Failed to list services: ${String(err)}` });
  }

  const hasErrors = findings.some((f) => f.severity === 'error');
  return {
    tool: 'docker_compose_check',
    status: hasErrors ? 'error' : findings.length > 0 ? 'warning' : 'ok',
    durationMs: Date.now() - start,
    findings,
    corrections: []
  };
}
