import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult, Correction, Finding } from '../types.js';

interface DockerfileRule {
  pattern: RegExp;
  replacement: string;
  description: string;
  autoFix: boolean;
  severity: 'error' | 'warning';
}

const RULES: DockerfileRule[] = [
  {
    pattern: /api\.package\.\s+@json/g,
    replacement: 'api.package.json',
    description: 'Fixed corrupted require() path in RUN node -e',
    autoFix: true,
    severity: 'error'
  },
  {
    pattern: /\.\/node_modules\/\.bin\/tsc(\s)/g,
    replacement: './node_modules/.bin/tsgo$1',
    description: 'Updated compiler tsc → tsgo (TypeScript 7 native)',
    autoFix: true,
    severity: 'error'
  },
  {
    pattern: /FROM\s+\S+:latest/g,
    replacement: '',
    description: 'Docker image uses :latest tag — pin to a specific version',
    autoFix: false,
    severity: 'warning'
  }
];

export async function checkDockerfile(repoRoot: string): Promise<CheckResult> {
  const start = Date.now();
  const dockerfilePath = join(repoRoot, 'apps', 'api', 'Dockerfile');
  const findings: Finding[] = [];
  const corrections: Correction[] = [];

  let content: string;
  try {
    content = readFileSync(dockerfilePath, 'utf8');
  } catch {
    return {
      tool: 'dockerfile_fix',
      status: 'error',
      durationMs: Date.now() - start,
      findings: [{ severity: 'error', file: 'apps/api/Dockerfile', message: 'Dockerfile not found' }],
      corrections: []
    };
  }

  let modified = content;

  for (const rule of RULES) {
    const matches = [...content.matchAll(rule.pattern)];
    if (matches.length === 0) continue;

    for (const match of matches) {
      const lineIndex = content.slice(0, match.index).split('\n').length;
      findings.push({
        severity: rule.severity,
        file: 'apps/api/Dockerfile',
        line: lineIndex,
        message: rule.description
      });

      if (rule.autoFix) {
        corrections.push({
          file: 'apps/api/Dockerfile',
          description: rule.description,
          before: match[0],
          after: match[0].replace(rule.pattern, rule.replacement)
        });
      }
    }

    if (rule.autoFix) {
      modified = modified.replace(rule.pattern, rule.replacement);
    }
  }

  if (corrections.length > 0 && modified !== content) {
    writeFileSync(dockerfilePath, modified, 'utf8');
  }

  const hasErrors = findings.some((f) => f.severity === 'error');
  const status = corrections.length > 0 ? 'fixed' : hasErrors ? 'error' : findings.length > 0 ? 'warning' : 'ok';

  return {
    tool: 'dockerfile_fix',
    status,
    durationMs: Date.now() - start,
    findings,
    corrections
  };
}
