import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const CONFIG_RELPATH = join('apps', 'api', 'src', 'infra', 'database', 'typeorm.config.ts');
const OLD_PATTERN = /const runtimeMigrationGlobs\s*=\s*\([^)]+\)\s*:\s*string\[\]\s*=>\s*\n?\s*isTypeScriptRuntime\s*\?[^;]+;/s;
const FIXED_IMPLEMENTATION = `const runtimeMigrationGlobs = (sourceFile: string, distFile: string): string[] => {
  if (isTypeScriptRuntime) {
    return [resolve(currentDir, 'migrations', sourceFile.split('/').pop()!)];
  }
  return [resolve(currentDir, 'migrations', distFile.split('/').pop()!)];
};`;
export async function checkMigrationPaths(repoRoot) {
    const start = Date.now();
    const filePath = join(repoRoot, CONFIG_RELPATH);
    const findings = [];
    const corrections = [];
    let content;
    try {
        content = readFileSync(filePath, 'utf8');
    }
    catch {
        return {
            tool: 'migration_paths_fix',
            status: 'error',
            durationMs: Date.now() - start,
            findings: [{ severity: 'error', file: CONFIG_RELPATH, message: 'typeorm.config.ts not found' }],
            corrections: []
        };
    }
    const alreadyFixed = content.includes('resolve(currentDir');
    if (alreadyFixed || !OLD_PATTERN.test(content)) {
        return {
            tool: 'migration_paths_fix',
            status: 'ok',
            durationMs: Date.now() - start,
            findings: [],
            corrections: []
        };
    }
    findings.push({
        severity: 'error',
        file: CONFIG_RELPATH,
        message: 'runtimeMigrationGlobs uses CWD-relative paths — migrations not found by TypeORM CLI'
    });
    let fixed = content;
    if (!fixed.includes("import { dirname, resolve }") && !fixed.includes('dirname')) {
        fixed = fixed.replace("import { fileURLToPath } from 'node:url';", "import { dirname, resolve } from 'node:path';\nimport { fileURLToPath } from 'node:url';");
    }
    if (!fixed.includes('currentDir')) {
        fixed = fixed.replace("const isTypeScriptRuntime = currentModulePath.endsWith('.ts');", "const currentDir = dirname(currentModulePath);\nconst isTypeScriptRuntime = currentModulePath.endsWith('.ts');");
    }
    const before = content.match(OLD_PATTERN)?.[0] ?? '';
    fixed = fixed.replace(OLD_PATTERN, FIXED_IMPLEMENTATION);
    corrections.push({
        file: CONFIG_RELPATH,
        description: 'Fixed runtimeMigrationGlobs to use absolute paths via dirname(currentModulePath)',
        before: before.trim(),
        after: FIXED_IMPLEMENTATION.trim()
    });
    writeFileSync(filePath, fixed, 'utf8');
    return {
        tool: 'migration_paths_fix',
        status: 'fixed',
        durationMs: Date.now() - start,
        findings,
        corrections
    };
}
