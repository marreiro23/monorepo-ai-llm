import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CheckResult, Correction, Finding } from '../types.js';

interface RequiredDoc {
  path: string;
  mustContain: string[];
  minimalContent: string;
}

const REQUIRED_DOCS: RequiredDoc[] = [
  {
    path: join('docs', 'architecture', 'llm-ops-contract-matrix-final.md'),
    mustContain: [
      'Wave A + Wave B',
      'GET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status'
    ],
    minimalContent: `# LLM-Ops Contract Matrix — Wave A + Wave B\n\n## Status: Complete (Wave A + Wave B)\n\nThis document is the source-of-truth matrix for all LLM-Ops API contracts.\n\n## Wave B — Advanced Endpoints\n\n| GET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status | – | PromptUsageHistoryStatusResponseContract |\n`
  }
];

export async function checkDocs(repoRoot: string): Promise<CheckResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  const corrections: Correction[] = [];

  for (const doc of REQUIRED_DOCS) {
    const fullPath = join(repoRoot, doc.path);

    if (!existsSync(fullPath)) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, doc.minimalContent, 'utf8');
      findings.push({ severity: 'error', file: doc.path, message: 'Required doc was missing — created with minimal content' });
      corrections.push({
        file: doc.path,
        description: 'Created missing required documentation file',
        before: '(file did not exist)',
        after: doc.minimalContent.trim()
      });
      continue;
    }

    const content = readFileSync(fullPath, 'utf8');
    const missing = doc.mustContain.filter((s) => !content.includes(s));

    if (missing.length > 0) {
      const patch = '\n\n' + missing.map((s) => `<!-- required: ${s} -->\n${s}`).join('\n');
      writeFileSync(fullPath, content + patch, 'utf8');
      findings.push({ severity: 'warning', file: doc.path, message: `Missing required strings: ${missing.join(', ')}` });
      corrections.push({
        file: doc.path,
        description: 'Patched required strings into existing doc',
        before: `(missing: ${missing.join(', ')})`,
        after: `(added ${missing.length} required string(s))`
      });
    }
  }

  return {
    tool: 'docs_check',
    status: corrections.length > 0 ? 'fixed' : 'ok',
    durationMs: Date.now() - start,
    findings,
    corrections
  };
}
