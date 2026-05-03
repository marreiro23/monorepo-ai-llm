import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const STATUS_ICON = {
    ok: '✅',
    fixed: '🔧',
    warning: '⚠️',
    error: '❌',
    skipped: '⏭️'
};
export function writeAuditReport(repoRoot, results) {
    const dir = join(repoRoot, '.copilot-tracking', 'runtime');
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportPath = join(dir, `health-${stamp}.md`);
    const overallStatus = results.some((r) => r.status === 'error') ? 'error'
        : results.some((r) => r.status === 'fixed') ? 'fixed'
            : results.some((r) => r.status === 'warning') ? 'warning'
                : 'ok';
    const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
    const exitCode = overallStatus === 'error' ? 1 : 0;
    const allCorrections = results.flatMap((r) => r.corrections);
    const lines = [
        `# Project Health Report`,
        ``,
        `**Date:** ${new Date().toISOString()}`,
        `**Status:** ${STATUS_ICON[overallStatus] ?? overallStatus} ${overallStatus.toUpperCase()}`,
        `**Duration:** ${totalMs}ms`,
        `**Exit Code:** ${exitCode}`,
        ``,
        `## Check Summary`,
        ``,
        `| Check | Status | Duration | Findings |`,
        `|-------|--------|----------|----------|`,
        ...results.map((r) => `| \`${r.tool}\` | ${STATUS_ICON[r.status] ?? r.status} ${r.status} | ${r.durationMs}ms | ${r.findings.length} |`),
        ``
    ];
    if (allCorrections.length > 0) {
        lines.push(`## Corrections Applied (${allCorrections.length})`, ``);
        for (const c of allCorrections) {
            lines.push(`### ${c.file}`, `**${c.description}**`, ``, `\`\`\`diff`, `- ${c.before.split('\n').join('\n- ')}`, `+ ${c.after.split('\n').join('\n+ ')}`, `\`\`\``, ``);
        }
    }
    const errorFindings = results.flatMap((r) => r.findings.filter((f) => f.severity === 'error'));
    if (errorFindings.length > 0) {
        lines.push(`## Errors Requiring Attention`, ``);
        for (const f of errorFindings) {
            lines.push(`- **${f.file ?? 'project'}** (line ${f.line ?? '?'}): ${f.message}`);
        }
        lines.push(``);
    }
    lines.push(`---`, `*Suggested exit code: ${exitCode}*`);
    writeFileSync(reportPath, lines.join('\n'), 'utf8');
    return reportPath;
}
