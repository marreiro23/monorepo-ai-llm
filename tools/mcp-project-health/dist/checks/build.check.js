import { exec } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
const execAsync = promisify(exec);
function expandWorkspaces(repoRoot) {
    const pkgPath = join(repoRoot, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const patterns = pkg.workspaces ?? [];
    const paths = [];
    for (const pattern of patterns) {
        if (pattern.endsWith('/*')) {
            const dir = join(repoRoot, pattern.slice(0, -2));
            if (existsSync(dir)) {
                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                    if (entry.isDirectory()) {
                        paths.push(join(dir, entry.name));
                    }
                }
            }
        }
        else {
            paths.push(join(repoRoot, pattern));
        }
    }
    return paths.filter((p) => existsSync(join(p, 'tsconfig.json')));
}
async function buildWorkspace(wsPath, timeout) {
    const name = wsPath.replace(/\\/g, '/').split('/').slice(-2).join('/');
    try {
        await execAsync('npx tsgo -p tsconfig.json', { cwd: wsPath, timeout });
        return { workspace: name, success: true, output: '' };
    }
    catch (err) {
        const e = err;
        const output = e.stderr ?? e.stdout ?? String(err);
        return { workspace: name, success: false, output };
    }
}
export async function checkBuild(repoRoot) {
    const start = Date.now();
    const workspaces = expandWorkspaces(repoRoot);
    const results = await Promise.all(workspaces.map((ws) => buildWorkspace(ws, 60_000)));
    const findings = results
        .filter((r) => !r.success)
        .map((r) => ({
        severity: 'error',
        file: r.workspace,
        message: r.output.trim().split('\n')[0] ?? 'build failed'
    }));
    return {
        tool: 'build_check',
        status: findings.length === 0 ? 'ok' : 'error',
        durationMs: Date.now() - start,
        findings,
        corrections: []
    };
}
