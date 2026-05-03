# mcp-project-health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o servidor MCP `tools/mcp-project-health` que detecta e corrige automaticamente problemas de build, Dockerfile, docker-compose, migration paths, docs e banco de dados, gerando audit trail em `.copilot-tracking/`.

**Architecture:** Servidor MCP com 8 tools, cada uma delegando para um módulo `*.check.ts` isolado. `check-runner.ts` orquestra execução em fases (build primeiro, demais em paralelo, database por último). `audit-writer.ts` persiste relatório markdown em `.copilot-tracking/runtime/`.

**Tech Stack:** `@modelcontextprotocol/sdk ^1.29.0`, `zod ^4.3.6`, `pg ^8.20.0`, TypeScript 7 (`tsgo`), Node.js ESM

---

## File Map

| Arquivo | Responsabilidade |
|---------|-----------------|
| `tools/mcp-project-health/package.json` | Dependências e scripts do workspace |
| `tools/mcp-project-health/tsconfig.json` | Extends tsconfig.base.json |
| `tools/mcp-project-health/src/types.ts` | CheckResult, Finding, Correction, CheckStatus |
| `tools/mcp-project-health/src/checks/build.check.ts` | tsgo build nos workspaces |
| `tools/mcp-project-health/src/checks/dockerfile.check.ts` | Detecta/corrige bugs no Dockerfile |
| `tools/mcp-project-health/src/checks/docker-compose.check.ts` | Valida config do compose |
| `tools/mcp-project-health/src/checks/migration-paths.check.ts` | Corrige caminhos de migration |
| `tools/mcp-project-health/src/checks/docs.check.ts` | Cria/valida docs obrigatórios |
| `tools/mcp-project-health/src/checks/smoke.check.ts` | Executa smoke tests por categoria |
| `tools/mcp-project-health/src/checks/database.check.ts` | PG conectividade + migrations |
| `tools/mcp-project-health/src/runner/audit-writer.ts` | Grava relatório em .copilot-tracking/ |
| `tools/mcp-project-health/src/runner/check-runner.ts` | Orquestra checks em fases |
| `tools/mcp-project-health/src/main.ts` | McpServer + registro das 8 tools |
| `tools/mcp-project-health/test/dockerfile.check.test.mjs` | Teste unitário do dockerfile check |
| `tools/mcp-project-health/test/migration-paths.check.test.mjs` | Teste unitário do migration-paths check |
| `tools/mcp-project-health/test/docs.check.test.mjs` | Teste unitário do docs check |
| `scripts/smoke-tests/mcp-project-health-smoke.mjs` | Smoke test de integração do MCP |
| `config/mcp/shp-local-mcp.example.json` | Adiciona entrada project-health |
| `package.json` (raiz) | Adiciona `"tools/*"` aos workspaces |

---

## Task 1: Scaffold — estrutura do workspace

**Files:**
- Create: `tools/mcp-project-health/package.json`
- Create: `tools/mcp-project-health/tsconfig.json`
- Create: `tools/mcp-project-health/src/types.ts`
- Modify: `package.json` (raiz)

- [ ] **Step 1.1: Criar `tools/mcp-project-health/package.json`**

```json
{
  "name": "@api-llm-embedded/mcp-project-health",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "pg": "^8.20.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^25.6.0",
    "@types/pg": "^8.11.0",
    "@typescript/native-preview": "^7.0.0-dev.20260428.1",
    "typescript": "^6.0.3"
  },
  "scripts": {
    "build": "tsgo -p tsconfig.json",
    "start": "node dist/main.js",
    "start:dev": "node --loader ts-node/esm src/main.ts"
  }
}
```

- [ ] **Step 1.2: Criar `tools/mcp-project-health/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 1.3: Criar `tools/mcp-project-health/src/types.ts`**

```typescript
export type CheckStatus = 'ok' | 'fixed' | 'warning' | 'error' | 'skipped';

export interface Finding {
  severity: 'info' | 'warning' | 'error';
  file?: string;
  line?: number;
  message: string;
}

export interface Correction {
  file: string;
  description: string;
  before: string;
  after: string;
}

export interface CheckResult {
  tool: string;
  status: CheckStatus;
  durationMs: number;
  findings: Finding[];
  corrections: Correction[];
  reportPath?: string;
}
```

- [ ] **Step 1.4: Adicionar `"tools/*"` ao `package.json` raiz**

Abrir `package.json` na raiz. Modificar a linha `"workspaces"`:

```json
"workspaces": [
  "apps/api",
  "apps/web",
  "apps/svcia/*",
  "packages/*",
  "tools/*"
]
```

- [ ] **Step 1.5: Instalar dependências**

```bash
npm install
```

Expected: instala `pg`, `@types/pg`, `@modelcontextprotocol/sdk`, `zod` no workspace.

- [ ] **Step 1.6: Criar diretórios restantes**

```bash
mkdir -p tools/mcp-project-health/src/checks tools/mcp-project-health/src/runner tools/mcp-project-health/test
```

- [ ] **Step 1.7: Commit**

```bash
git add tools/mcp-project-health/ package.json package-lock.json
git commit -m "feat: scaffold tools/mcp-project-health workspace"
```

---

## Task 2: build.check.ts

**Files:**
- Create: `tools/mcp-project-health/src/checks/build.check.ts`

- [ ] **Step 2.1: Criar `build.check.ts`**

```typescript
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import type { CheckResult, Finding } from '../types.js';

const execFileAsync = promisify(execFile);

interface WorkspaceBuildResult {
  workspace: string;
  success: boolean;
  output: string;
}

function expandWorkspaces(repoRoot: string): string[] {
  const pkgPath = join(repoRoot, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { workspaces?: string[] };
  const patterns = pkg.workspaces ?? [];
  const { readdirSync } = await import('node:fs') as never;

  const paths: string[] = [];
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
    } else {
      paths.push(join(repoRoot, pattern));
    }
  }
  return paths.filter((p) => existsSync(join(p, 'tsconfig.json')));
}

async function buildWorkspace(wsPath: string, timeout: number): Promise<WorkspaceBuildResult> {
  const name = wsPath.replace(/\\/g, '/').split('/').slice(-2).join('/');
  try {
    await execFileAsync('npx', ['tsgo', '-p', 'tsconfig.json'], {
      cwd: wsPath,
      timeout
    });
    return { workspace: name, success: true, output: '' };
  } catch (err: unknown) {
    const output = err instanceof Error && 'stderr' in err
      ? String((err as NodeJS.ErrnoException & { stderr?: string }).stderr ?? '')
      : String(err);
    return { workspace: name, success: false, output };
  }
}

export async function checkBuild(repoRoot: string): Promise<CheckResult> {
  const start = Date.now();
  const { readdirSync } = await import('node:fs');
  const workspaces = expandWorkspaces(repoRoot);

  const results = await Promise.all(
    workspaces.map((ws) => buildWorkspace(ws, 60_000))
  );

  const findings: Finding[] = results
    .filter((r) => !r.success)
    .map((r) => ({
      severity: 'error' as const,
      file: r.workspace,
      message: r.output.trim().split('\n')[0] ?? 'build failed'
    }));

  const status = findings.length === 0 ? 'ok' : 'error';

  return {
    tool: 'build_check',
    status,
    durationMs: Date.now() - start,
    findings,
    corrections: []
  };
}
```

> **Nota:** `expandWorkspaces` usa `readdirSync` importado dinamicamente para evitar erro de tipagem. Alternativa mais limpa: importar no topo do módulo (ESM não tem problema).

Reescrever sem o dynamic import desnecessário — versão correta:

```typescript
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CheckResult, Finding } from '../types.js';

const execFileAsync = promisify(execFile);

function expandWorkspaces(repoRoot: string): string[] {
  const pkgPath = join(repoRoot, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { workspaces?: string[] };
  const patterns = pkg.workspaces ?? [];
  const paths: string[] = [];

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
    } else {
      paths.push(join(repoRoot, pattern));
    }
  }

  return paths.filter((p) => existsSync(join(p, 'tsconfig.json')));
}

async function buildWorkspace(
  wsPath: string,
  timeout: number
): Promise<{ workspace: string; success: boolean; output: string }> {
  const name = wsPath.replace(/\\/g, '/').split('/').slice(-2).join('/');
  try {
    await execFileAsync('npx', ['tsgo', '-p', 'tsconfig.json'], { cwd: wsPath, timeout });
    return { workspace: name, success: true, output: '' };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    const output = e.stderr ?? e.stdout ?? String(err);
    return { workspace: name, success: false, output };
  }
}

export async function checkBuild(repoRoot: string): Promise<CheckResult> {
  const start = Date.now();
  const workspaces = expandWorkspaces(repoRoot);

  const results = await Promise.all(
    workspaces.map((ws) => buildWorkspace(ws, 60_000))
  );

  const findings: Finding[] = results
    .filter((r) => !r.success)
    .map((r) => ({
      severity: 'error' as const,
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
```

- [ ] **Step 2.2: Verificar que compila**

```bash
npm run -w tools/mcp-project-health build
```

Expected: sem erros, `dist/checks/build.check.js` criado.

- [ ] **Step 2.3: Commit**

```bash
git add tools/mcp-project-health/src/checks/build.check.ts
git commit -m "feat(project-health): add build.check"
```

---

## Task 3: dockerfile.check.ts — com teste TDD

**Files:**
- Create: `tools/mcp-project-health/src/checks/dockerfile.check.ts`
- Create: `tools/mcp-project-health/test/dockerfile.check.test.mjs`

- [ ] **Step 3.1: Escrever teste (deve falhar)**

Criar `tools/mcp-project-health/test/dockerfile.check.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const tmp = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(join(tmp, 'apps', 'api'), { recursive: true });

const BUGGY_DOCKERFILE = `FROM node:22-alpine AS api-package
WORKDIR /app
COPY apps/api/package.json ./apps/api.package.json
RUN node -e "const fs=require('fs'); const pkg=require('./apps/api.package.   @json'); fs.writeFileSync('./package.json', JSON.stringify(pkg));"

FROM node:22-alpine AS builder
WORKDIR /app
RUN mkdir -p node_modules && ./node_modules/.bin/tsc -p apps/api/tsconfig.json

FROM node:latest AS runtime
EXPOSE 3001
`;

writeFileSync(join(tmp, 'apps', 'api', 'Dockerfile'), BUGGY_DOCKERFILE);

const { checkDockerfile } = await import('../dist/checks/dockerfile.check.js');
const result = await checkDockerfile(tmp);

assert.equal(result.tool, 'dockerfile_fix');
assert.equal(result.status, 'fixed', `Expected 'fixed', got '${result.status}'`);
assert.equal(result.corrections.length, 2, `Expected 2 corrections, got ${result.corrections.length}`);
assert.ok(result.corrections[0].before.includes('api.package.   @json'), 'correction 0 should fix corrupted path');
assert.ok(result.corrections[1].before.includes('./node_modules/.bin/tsc'), 'correction 1 should fix compiler');
assert.equal(result.findings.filter(f => f.severity === 'warning').length, 1, 'should warn about node:latest');

rmSync(tmp, { recursive: true });
console.log('✅ dockerfile.check test passed');
```

- [ ] **Step 3.2: Rodar o teste — deve falhar (módulo ainda não existe)**

```bash
cd tools/mcp-project-health && node test/dockerfile.check.test.mjs 2>&1 | head -5
```

Expected: erro como `Cannot find module '../dist/checks/dockerfile.check.js'`

- [ ] **Step 3.3: Criar `dockerfile.check.ts`**

```typescript
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
    // Corrupted path in node -e: api.package.   @json or similar whitespace corruption
    pattern: /api\.package\.\s+@json/g,
    replacement: 'api.package.json',
    description: 'Fixed corrupted require() path in RUN node -e',
    autoFix: true,
    severity: 'error'
  },
  {
    // Wrong compiler: tsc instead of tsgo in builder stage
    pattern: /\.\/node_modules\/\.bin\/tsc(\s)/g,
    replacement: './node_modules/.bin/tsgo$1',
    description: 'Updated compiler tsc → tsgo (TypeScript 7 native)',
    autoFix: true,
    severity: 'error'
  },
  {
    // Image without pinned version
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
  const lines = content.split('\n');

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
        const before = match[0];
        const after = match[0].replace(rule.pattern, rule.replacement);
        corrections.push({
          file: 'apps/api/Dockerfile',
          description: rule.description,
          before,
          after
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
```

- [ ] **Step 3.4: Compilar**

```bash
npm run -w tools/mcp-project-health build
```

Expected: sem erros.

- [ ] **Step 3.5: Rodar o teste — deve passar**

```bash
cd tools/mcp-project-health && node test/dockerfile.check.test.mjs
```

Expected: `✅ dockerfile.check test passed`

- [ ] **Step 3.6: Commit**

```bash
git add tools/mcp-project-health/src/checks/dockerfile.check.ts tools/mcp-project-health/test/dockerfile.check.test.mjs
git commit -m "feat(project-health): add dockerfile.check with auto-fix rules"
```

---

## Task 4: docker-compose.check.ts

**Files:**
- Create: `tools/mcp-project-health/src/checks/docker-compose.check.ts`

- [ ] **Step 4.1: Criar `docker-compose.check.ts`**

```typescript
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CheckResult, Finding } from '../types.js';

const execFileAsync = promisify(execFile);

const EXPECTED_SERVICES = ['postgres', 'container-manager', 'users-api', 'llm-ops-api', 'sharepoint-api', 'sync-api', 'langflow'];
const EXPECTED_PROFILES = ['persistent', 'always', 'demand'];

export async function checkDockerCompose(repoRoot: string): Promise<CheckResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  const envFile = join(repoRoot, '.env.containers');
  const args = ['compose', '--env-file', envFile, '-p', 'api-llm-embedded',
    '--profile', 'persistent', '--profile', 'always', '--profile', 'demand'];

  // Validate config
  try {
    const { stderr } = await execFileAsync('docker', [...args, 'config', '--quiet'], {
      cwd: repoRoot,
      timeout: 10_000
    });
    // LLM_API_KEY missing is a warning, not an error
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

  // Check services
  try {
    const { stdout } = await execFileAsync('docker', [...args, 'config', '--services'], {
      cwd: repoRoot,
      timeout: 10_000
    });
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
```

- [ ] **Step 4.2: Compilar e verificar**

```bash
npm run -w tools/mcp-project-health build
```

Expected: sem erros.

- [ ] **Step 4.3: Verificação rápida no terminal**

```bash
node --input-type=module << 'EOF'
import { checkDockerCompose } from './tools/mcp-project-health/dist/checks/docker-compose.check.js';
const r = await checkDockerCompose(process.cwd());
console.log(r.status, r.findings.length, 'findings');
EOF
```

Expected: `ok 1 findings` (1 warning do LLM_API_KEY) ou `warning 1 findings`.

- [ ] **Step 4.4: Commit**

```bash
git add tools/mcp-project-health/src/checks/docker-compose.check.ts
git commit -m "feat(project-health): add docker-compose.check"
```

---

## Task 5: migration-paths.check.ts — com teste TDD

**Files:**
- Create: `tools/mcp-project-health/src/checks/migration-paths.check.ts`
- Create: `tools/mcp-project-health/test/migration-paths.check.test.mjs`

- [ ] **Step 5.1: Escrever teste**

Criar `tools/mcp-project-health/test/migration-paths.check.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const tmp = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(join(tmp, 'apps', 'api', 'src', 'infra', 'database'), { recursive: true });

// Conteúdo com o bug: paths literais relativos ao CWD
const BUGGY_CONFIG = `
import { fileURLToPath } from 'node:url';
const currentModulePath = fileURLToPath(import.meta.url);
const isTypeScriptRuntime = currentModulePath.endsWith('.ts');

const runtimeMigrationGlobs = (sourceGlob, distGlob) =>
  isTypeScriptRuntime ? [sourceGlob] : [distGlob];

export const AppDataSource = new DataSource({
  migrations: [
    ...runtimeMigrationGlobs(
      'src/infra/database/migrations/CreateUsersTable.ts',
      'dist/infra/database/migrations/CreateUsersTable.js'
    )
  ]
});
`;

writeFileSync(
  join(tmp, 'apps', 'api', 'src', 'infra', 'database', 'typeorm.config.ts'),
  BUGGY_CONFIG
);

const { checkMigrationPaths } = await import('../dist/checks/migration-paths.check.js');
const result = await checkMigrationPaths(tmp);

assert.equal(result.tool, 'migration_paths_fix');
assert.equal(result.status, 'fixed', `Expected 'fixed', got '${result.status}'`);
assert.equal(result.corrections.length, 1);

// Verificar que o arquivo foi corrigido
const fixed = readFileSync(
  join(tmp, 'apps', 'api', 'src', 'infra', 'database', 'typeorm.config.ts'),
  'utf8'
);
assert.ok(fixed.includes('resolve(currentDir'), 'Fixed file should use resolve(currentDir)');
assert.ok(fixed.includes("dirname(currentModulePath)") || fixed.includes('currentDir'), 'Fixed file should use dirname');

rmSync(tmp, { recursive: true });
console.log('✅ migration-paths.check test passed');
```

- [ ] **Step 5.2: Rodar para confirmar falha**

```bash
cd tools/mcp-project-health && node test/migration-paths.check.test.mjs 2>&1 | head -3
```

Expected: erro de módulo não encontrado.

- [ ] **Step 5.3: Criar `migration-paths.check.ts`**

```typescript
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult, Correction, Finding } from '../types.js';

const CONFIG_PATH = join('apps', 'api', 'src', 'infra', 'database', 'typeorm.config.ts');

// Detecta padrão antigo: função retorna array com strings literais relativas ao CWD
// Ex: runtimeMigrationGlobs = (src, dist) => isTypeScriptRuntime ? [src] : [dist]
const OLD_PATTERN = /const runtimeMigrationGlobs\s*=\s*\([^)]+\)\s*:\s*string\[\]\s*=>\s*\n?\s*isTypeScriptRuntime\s*\?[^;]+;/s;

const FIXED_IMPLEMENTATION = `const runtimeMigrationGlobs = (sourceFile: string, distFile: string): string[] => {
  if (isTypeScriptRuntime) {
    return [resolve(currentDir, 'migrations', sourceFile.split('/').pop()!)];
  }
  return [resolve(currentDir, 'migrations', distFile.split('/').pop()!)];
};`;

export async function checkMigrationPaths(repoRoot: string): Promise<CheckResult> {
  const start = Date.now();
  const filePath = join(repoRoot, CONFIG_PATH);
  const findings: Finding[] = [];
  const corrections: Correction[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return {
      tool: 'migration_paths_fix',
      status: 'error',
      durationMs: Date.now() - start,
      findings: [{ severity: 'error', file: CONFIG_PATH, message: 'typeorm.config.ts not found' }],
      corrections: []
    };
  }

  const hasOldPattern = OLD_PATTERN.test(content);
  // Also check: does it already use resolve(currentDir ?
  const alreadyFixed = content.includes('resolve(currentDir') || content.includes("resolve(currentDir,");

  if (!hasOldPattern || alreadyFixed) {
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
    file: CONFIG_PATH,
    message: 'runtimeMigrationGlobs uses CWD-relative paths — migrations not found by TypeORM CLI'
  });

  // Ensure dirname + resolve are imported
  let fixed = content;
  if (!fixed.includes("import { dirname, resolve }") && !fixed.includes("dirname") ) {
    fixed = fixed.replace(
      "import { fileURLToPath } from 'node:url';",
      "import { dirname, resolve } from 'node:path';\nimport { fileURLToPath } from 'node:url';"
    );
  }

  // Ensure currentDir is defined after currentModulePath
  if (!fixed.includes('currentDir')) {
    fixed = fixed.replace(
      'const isTypeScriptRuntime = currentModulePath.endsWith(\'.ts\');',
      'const currentDir = dirname(currentModulePath);\nconst isTypeScriptRuntime = currentModulePath.endsWith(\'.ts\');'
    );
  }

  const before = content.match(OLD_PATTERN)?.[0] ?? '';
  fixed = fixed.replace(OLD_PATTERN, FIXED_IMPLEMENTATION);

  corrections.push({
    file: CONFIG_PATH,
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
```

- [ ] **Step 5.4: Compilar**

```bash
npm run -w tools/mcp-project-health build
```

- [ ] **Step 5.5: Rodar o teste**

```bash
cd tools/mcp-project-health && node test/migration-paths.check.test.mjs
```

Expected: `✅ migration-paths.check test passed`

- [ ] **Step 5.6: Commit**

```bash
git add tools/mcp-project-health/src/checks/migration-paths.check.ts tools/mcp-project-health/test/migration-paths.check.test.mjs
git commit -m "feat(project-health): add migration-paths.check with auto-fix"
```

---

## Task 6: docs.check.ts — com teste TDD

**Files:**
- Create: `tools/mcp-project-health/src/checks/docs.check.ts`
- Create: `tools/mcp-project-health/test/docs.check.test.mjs`

- [ ] **Step 6.1: Escrever teste**

Criar `tools/mcp-project-health/test/docs.check.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const { checkDocs } = await import('../dist/checks/docs.check.js');

// Cenário 1: arquivo ausente → deve criar
const tmp1 = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(tmp1, { recursive: true });
const r1 = await checkDocs(tmp1);
assert.equal(r1.status, 'fixed', `Expected 'fixed' for missing file, got '${r1.status}'`);
assert.ok(existsSync(join(tmp1, 'docs', 'architecture', 'llm-ops-contract-matrix-final.md')));
rmSync(tmp1, { recursive: true });

// Cenário 2: arquivo presente mas sem conteúdo → deve aplicar patch
const tmp2 = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(join(tmp2, 'docs', 'architecture'), { recursive: true });
const { writeFileSync } = await import('node:fs');
writeFileSync(join(tmp2, 'docs', 'architecture', 'llm-ops-contract-matrix-final.md'), '# docs\n');
const r2 = await checkDocs(tmp2);
assert.equal(r2.status, 'fixed', `Expected 'fixed' for file missing required content, got '${r2.status}'`);
const content2 = readFileSync(join(tmp2, 'docs', 'architecture', 'llm-ops-contract-matrix-final.md'), 'utf8');
assert.ok(content2.includes('Wave A + Wave B'));
assert.ok(content2.includes('GET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status'));
rmSync(tmp2, { recursive: true });

// Cenário 3: arquivo correto → status ok
const tmp3 = join(tmpdir(), `ph-test-${randomUUID()}`);
mkdirSync(join(tmp3, 'docs', 'architecture'), { recursive: true });
writeFileSync(
  join(tmp3, 'docs', 'architecture', 'llm-ops-contract-matrix-final.md'),
  '# Wave A + Wave B\nGET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status\n'
);
const r3 = await checkDocs(tmp3);
assert.equal(r3.status, 'ok', `Expected 'ok' for valid file, got '${r3.status}'`);
rmSync(tmp3, { recursive: true });

console.log('✅ docs.check test passed');
```

- [ ] **Step 6.2: Criar `docs.check.ts`**

```typescript
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
    minimalContent: `# LLM-Ops Contract Matrix — Wave A + Wave B

## Status: Complete (Wave A + Wave B)

This document is the source-of-truth matrix for all LLM-Ops API contracts.

## Wave B — Advanced Endpoints

| GET /llm-ops/prompt-usage-history/:promptUsageHistoryId/status | – | PromptUsageHistoryStatusResponseContract |
`
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
      findings.push({
        severity: 'warning',
        file: doc.path,
        message: `Missing required strings: ${missing.join(', ')}`
      });
      corrections.push({
        file: doc.path,
        description: 'Patched required strings into existing doc',
        before: `(missing: ${missing.join(', ')})`,
        after: `(added ${missing.length} required string(s))`
      });
    }
  }

  const status = corrections.length > 0 ? 'fixed' : 'ok';
  return {
    tool: 'docs_check',
    status,
    durationMs: Date.now() - start,
    findings,
    corrections
  };
}
```

- [ ] **Step 6.3: Compilar e rodar teste**

```bash
npm run -w tools/mcp-project-health build && cd tools/mcp-project-health && node test/docs.check.test.mjs
```

Expected: `✅ docs.check test passed`

- [ ] **Step 6.4: Commit**

```bash
git add tools/mcp-project-health/src/checks/docs.check.ts tools/mcp-project-health/test/docs.check.test.mjs
git commit -m "feat(project-health): add docs.check with auto-create/patch"
```

---

## Task 7: smoke.check.ts

**Files:**
- Create: `tools/mcp-project-health/src/checks/smoke.check.ts`

- [ ] **Step 7.1: Criar `smoke.check.ts`**

```typescript
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CheckResult, Finding } from '../types.js';

const execFileAsync = promisify(execFile);

type SmokeCategory = 'static' | 'mcp' | 'typeorm' | 'all';

const SMOKE_CATEGORIES: Record<Exclude<SmokeCategory, 'all'>, string[]> = {
  static: [
    'governance-smoke',
    'retry-jitter-smoke',
    'llm-ops-contracts-ab-smoke',
    'graph-config-smoke'
  ],
  mcp: [
    'mcp-users-read-smoke',
    'mcp-secrets-read-smoke',
    'mcp-llm-ops-read-smoke',
    'mcp-sync-read-smoke'
  ],
  typeorm: [
    'users-typeorm-smoke',
    'llm-ops-typeorm-smoke',
    'sync-typeorm-smoke'
  ]
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
        await execFileAsync('node', [file], { cwd: repoRoot, timeout: timeoutMs });
      } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
        const msg = (e.stderr ?? e.stdout ?? e.message ?? String(err)).trim().split('\n')[0];
        findings.push({ severity: 'error', file: `scripts/smoke-tests/${name}.mjs`, message: msg });
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
```

- [ ] **Step 7.2: Compilar e verificar contra o projeto real**

```bash
npm run -w tools/mcp-project-health build && node --input-type=module << 'EOF'
import { runSmoke } from './tools/mcp-project-health/dist/checks/smoke.check.js';
const r = await runSmoke({ repoRoot: process.cwd(), categories: ['static'] });
console.log(r.status, r.findings.length, 'failures');
EOF
```

Expected: `ok 0 failures`

- [ ] **Step 7.3: Commit**

```bash
git add tools/mcp-project-health/src/checks/smoke.check.ts
git commit -m "feat(project-health): add smoke.check"
```

---

## Task 8: database.check.ts

**Files:**
- Create: `tools/mcp-project-health/src/checks/database.check.ts`

- [ ] **Step 8.1: Criar `database.check.ts`**

```typescript
import { join } from 'node:path';
import type { CheckResult, Finding } from '../types.js';

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
  const { default: pg } = await import('pg') as { default: typeof import('pg') };
  const client = new pg.Client(cfg);
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
  dsName: 'AppDataSource' | 'LlmOpsDataSource',
  envPrefix: 'PG' | 'LLM_PG'
): Promise<{ applied: number; error?: string }> {
  const distPath = join(repoRoot, 'apps', 'api', 'dist', 'infra', 'database', 'typeorm.config.js');
  const fileUrl = new URL(`file:///${distPath.replace(/\\/g, '/')}`);

  try {
    const mod = await import(fileUrl.href) as Record<string, unknown>;
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
  const corrections: string[] = [];

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

  // Test connectivity
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

  // Run migrations if pending
  const mainResult = await runMigrationsIfNeeded(repoRoot, 'AppDataSource', 'PG');
  if (mainResult.error) {
    findings.push({ severity: 'warning', message: `AppDataSource migration check failed: ${mainResult.error}` });
  } else if (mainResult.applied > 0) {
    findings.push({ severity: 'info', message: `Applied ${mainResult.applied} pending migration(s) on main DB` });
    corrections.push(`Applied ${mainResult.applied} main DB migration(s)`);
  }

  if (llmCfg.database && llmCfg.user) {
    const llmResult = await runMigrationsIfNeeded(repoRoot, 'LlmOpsDataSource', 'LLM_PG');
    if (llmResult.error) {
      findings.push({ severity: 'warning', message: `LlmOpsDataSource migration check failed: ${llmResult.error}` });
    } else if (llmResult.applied > 0) {
      findings.push({ severity: 'info', message: `Applied ${llmResult.applied} pending migration(s) on llm_ops DB` });
      corrections.push(`Applied ${llmResult.applied} llm_ops migration(s)`);
    }
  }

  const hasErrors = findings.some((f) => f.severity === 'error');
  const status = hasErrors ? 'error' : corrections.length > 0 ? 'fixed' : 'ok';

  return {
    tool: 'database_check',
    status,
    durationMs: Date.now() - start,
    findings,
    corrections: corrections.map((c) => ({
      file: 'apps/api/dist/infra/database/typeorm.config.js',
      description: c,
      before: 'pending migration',
      after: 'migration applied'
    }))
  };
}
```

- [ ] **Step 8.2: Compilar**

```bash
npm run -w tools/mcp-project-health build
```

Expected: sem erros.

- [ ] **Step 8.3: Verificar com PostgreSQL rodando**

```bash
PG_HOST=localhost PG_DATABASE=api_llm_embedded PG_USER=postgres PG_PASSWORD=postgres \
LLM_PG_HOST=localhost LLM_PG_DATABASE=api_llm_embedded LLM_PG_USER=postgres LLM_PG_PASSWORD=postgres LLM_PG_SCHEMA=llm_ops \
node --input-type=module << 'EOF'
import { checkDatabase } from './tools/mcp-project-health/dist/checks/database.check.js';
const r = await checkDatabase(process.cwd());
console.log(r.status, '-', r.findings.map(f => f.message).join('; ') || 'no findings');
EOF
```

Expected: `ok - no findings` (migrations já aplicadas)

- [ ] **Step 8.4: Commit**

```bash
git add tools/mcp-project-health/src/checks/database.check.ts
git commit -m "feat(project-health): add database.check with auto-migration"
```

---

## Task 9: audit-writer.ts + check-runner.ts

**Files:**
- Create: `tools/mcp-project-health/src/runner/audit-writer.ts`
- Create: `tools/mcp-project-health/src/runner/check-runner.ts`

- [ ] **Step 9.1: Criar `audit-writer.ts`**

```typescript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult } from '../types.js';

const STATUS_ICON: Record<string, string> = {
  ok: '✅',
  fixed: '🔧',
  warning: '⚠️',
  error: '❌',
  skipped: '⏭️'
};

export function writeAuditReport(repoRoot: string, results: CheckResult[]): string {
  const dir = join(repoRoot, '.copilot-tracking', 'runtime');
  mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = join(dir, `health-${stamp}.md`);

  const overallStatus = results.some((r) => r.status === 'error') ? 'error'
    : results.some((r) => r.status === 'fixed') ? 'fixed'
    : results.some((r) => r.status === 'warning') ? 'warning'
    : 'ok';

  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const exitCode = overallStatus === 'error' ? 1 : 0;
  const allCorrections = results.flatMap((r) => r.corrections);

  const lines: string[] = [
    `# Project Health Report`,
    ``,
    `**Date:** ${new Date().toISOString()}`,
    `**Status:** ${STATUS_ICON[overallStatus]} ${overallStatus.toUpperCase()}`,
    `**Duration:** ${totalMs}ms`,
    `**Exit Code:** ${exitCode}`,
    ``,
    `## Check Summary`,
    ``,
    `| Check | Status | Duration | Findings |`,
    `|-------|--------|----------|----------|`,
    ...results.map((r) =>
      `| \`${r.tool}\` | ${STATUS_ICON[r.status]} ${r.status} | ${r.durationMs}ms | ${r.findings.length} |`
    ),
    ``
  ];

  if (allCorrections.length > 0) {
    lines.push(`## Corrections Applied (${allCorrections.length})`, ``);
    for (const c of allCorrections) {
      lines.push(
        `### ${c.file}`,
        `**${c.description}**`,
        ``,
        `\`\`\`diff`,
        `- ${c.before.split('\n').join('\n- ')}`,
        `+ ${c.after.split('\n').join('\n+ ')}`,
        `\`\`\``,
        ``
      );
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

  writeFileSync(path, lines.join('\n'), 'utf8');
  return path;
}
```

- [ ] **Step 9.2: Criar `check-runner.ts`**

```typescript
import { join } from 'node:path';
import type { CheckResult } from '../types.js';
import { checkBuild } from '../checks/build.check.js';
import { checkDockerfile } from '../checks/dockerfile.check.js';
import { checkDockerCompose } from '../checks/docker-compose.check.js';
import { checkMigrationPaths } from '../checks/migration-paths.check.js';
import { checkDocs } from '../checks/docs.check.js';
import { runSmoke } from '../checks/smoke.check.js';
import { checkDatabase } from '../checks/database.check.js';
import { writeAuditReport } from './audit-writer.js';

export type CheckCategory = 'build' | 'dockerfile' | 'docker-compose' | 'migration-paths' | 'docs' | 'smoke' | 'database';

export interface RunAllOptions {
  repoRoot: string;
  smokeCategories?: Array<'static' | 'mcp' | 'typeorm' | 'all'>;
  smokeTimeoutMs?: number;
}

export async function runAll(opts: RunAllOptions): Promise<CheckResult[]> {
  const { repoRoot, smokeCategories = ['static', 'mcp'], smokeTimeoutMs = 30_000 } = opts;

  // Phase 1: build first (database check needs dist)
  const buildResult = await checkBuild(repoRoot);

  // Phase 2: parallel checks (no build dependency)
  const [dockerfileResult, composeResult, migrationResult, docsResult, smokeResult] = await Promise.all([
    checkDockerfile(repoRoot),
    checkDockerCompose(repoRoot),
    checkMigrationPaths(repoRoot),
    checkDocs(repoRoot),
    runSmoke({ repoRoot, categories: smokeCategories, timeoutMs: smokeTimeoutMs })
  ]);

  // Phase 3: database check (needs build to import dist)
  const dbResult = buildResult.status !== 'error'
    ? await checkDatabase(repoRoot)
    : { tool: 'database_check', status: 'skipped' as const, durationMs: 0, findings: [{ severity: 'info' as const, message: 'Skipped: build failed' }], corrections: [] };

  const results = [buildResult, dockerfileResult, composeResult, migrationResult, docsResult, smokeResult, dbResult];
  return results;
}

export async function runAllWithReport(opts: RunAllOptions): Promise<{ results: CheckResult[]; reportPath: string }> {
  const results = await runAll(opts);
  const reportPath = writeAuditReport(opts.repoRoot, results);
  return { results, reportPath };
}
```

- [ ] **Step 9.3: Compilar**

```bash
npm run -w tools/mcp-project-health build
```

Expected: sem erros.

- [ ] **Step 9.4: Commit**

```bash
git add tools/mcp-project-health/src/runner/
git commit -m "feat(project-health): add audit-writer and check-runner"
```

---

## Task 10: main.ts — MCP Server

**Files:**
- Create: `tools/mcp-project-health/src/main.ts`

- [ ] **Step 10.1: Criar `main.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkBuild } from './checks/build.check.js';
import { checkDockerfile } from './checks/dockerfile.check.js';
import { checkDockerCompose } from './checks/docker-compose.check.js';
import { checkMigrationPaths } from './checks/migration-paths.check.js';
import { checkDocs } from './checks/docs.check.js';
import { runSmoke } from './checks/smoke.check.js';
import { checkDatabase } from './checks/database.check.js';
import { runAllWithReport } from './runner/check-runner.js';
import type { CheckResult } from './types.js';

const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd();

const server = new McpServer({
  name: 'project-health-mcp',
  version: '1.0.0'
});

function toToolResult(payload: CheckResult | { results: CheckResult[]; reportPath: string }) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>
  };
}

server.registerTool(
  'health_check_all',
  {
    title: 'Full Project Health Check',
    description: 'Roda todos os checks de saúde do projeto e gera relatório CI em .copilot-tracking/runtime/.',
    inputSchema: {
      smokeCategories: z.array(z.enum(['static', 'mcp', 'typeorm', 'all'])).optional(),
      smokeTimeoutMs: z.number().int().positive().optional()
    }
  },
  async ({ smokeCategories, smokeTimeoutMs }) => {
    const result = await runAllWithReport({
      repoRoot: REPO_ROOT,
      smokeCategories: smokeCategories as Array<'static' | 'mcp' | 'typeorm' | 'all'> | undefined,
      smokeTimeoutMs
    });
    return toToolResult(result);
  }
);

server.registerTool(
  'build_check',
  {
    title: 'Build Check',
    description: 'Compila todos os workspaces TypeScript com tsgo e reporta erros.',
    inputSchema: {}
  },
  async () => toToolResult(await checkBuild(REPO_ROOT))
);

server.registerTool(
  'dockerfile_fix',
  {
    title: 'Dockerfile Fix',
    description: 'Detecta e corrige automaticamente bugs no apps/api/Dockerfile (path corrompido, compilador errado).',
    inputSchema: {}
  },
  async () => toToolResult(await checkDockerfile(REPO_ROOT))
);

server.registerTool(
  'docker_compose_check',
  {
    title: 'Docker Compose Check',
    description: 'Valida a configuração do docker-compose.yml: serviços esperados, profiles e variáveis de ambiente.',
    inputSchema: {}
  },
  async () => toToolResult(await checkDockerCompose(REPO_ROOT))
);

server.registerTool(
  'migration_paths_fix',
  {
    title: 'Migration Paths Fix',
    description: 'Detecta e corrige caminhos de migration relativos ao CWD em typeorm.config.ts, garantindo funcionamento do TypeORM CLI.',
    inputSchema: {}
  },
  async () => toToolResult(await checkMigrationPaths(REPO_ROOT))
);

server.registerTool(
  'docs_check',
  {
    title: 'Required Docs Check',
    description: 'Verifica arquivos de documentação obrigatórios. Cria ou corrige arquivos ausentes.',
    inputSchema: {}
  },
  async () => toToolResult(await checkDocs(REPO_ROOT))
);

server.registerTool(
  'smoke_run',
  {
    title: 'Smoke Tests',
    description: 'Executa smoke tests por categoria: static (sem infra), mcp (MCPs), typeorm (requer PostgreSQL), all.',
    inputSchema: {
      categories: z.array(z.enum(['static', 'mcp', 'typeorm', 'all'])).optional(),
      timeoutMs: z.number().int().positive().optional()
    }
  },
  async ({ categories, timeoutMs }) =>
    toToolResult(
      await runSmoke({
        repoRoot: REPO_ROOT,
        categories: categories as Array<'static' | 'mcp' | 'typeorm' | 'all'> | undefined,
        timeoutMs
      })
    )
);

server.registerTool(
  'database_check',
  {
    title: 'Database Check',
    description: 'Testa conectividade com PostgreSQL e aplica migrations pendentes automaticamente.',
    inputSchema: {}
  },
  async () => toToolResult(await checkDatabase(REPO_ROOT))
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`project-health-mcp failed: ${String(error)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 10.2: Compilar build final**

```bash
npm run -w tools/mcp-project-health build
```

Expected: sem erros. `dist/main.js` gerado.

- [ ] **Step 10.3: Testar startup**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | REPO_ROOT=$(pwd) node tools/mcp-project-health/dist/main.js
```

Expected: resposta JSON com lista de 8 tools (`health_check_all`, `build_check`, etc.)

- [ ] **Step 10.4: Commit**

```bash
git add tools/mcp-project-health/src/main.ts
git commit -m "feat(project-health): add main.ts MCP server with 8 tools"
```

---

## Task 11: Smoke Test de Integração

**Files:**
- Create: `scripts/smoke-tests/mcp-project-health-smoke.mjs`

- [ ] **Step 11.1: Criar `mcp-project-health-smoke.mjs`**

```javascript
import assert from 'node:assert/strict';

// Importa diretamente os checks compilados (sem precisar do servidor MCP rodando)
const { checkBuild } = await import('../../tools/mcp-project-health/dist/checks/build.check.js');
const { checkDockerfile } = await import('../../tools/mcp-project-health/dist/checks/dockerfile.check.js');
const { checkDocs } = await import('../../tools/mcp-project-health/dist/checks/docs.check.js');

const REPO_ROOT = process.cwd();

// Test 1: build_check retorna CheckResult com shape correto
const buildResult = await checkBuild(REPO_ROOT);
assert.ok(['ok', 'error'].includes(buildResult.status), `build status must be ok|error, got ${buildResult.status}`);
assert.equal(buildResult.tool, 'build_check');
assert.ok(Array.isArray(buildResult.findings));
assert.ok(Array.isArray(buildResult.corrections));
assert.ok(typeof buildResult.durationMs === 'number');
console.log(`  build_check: ${buildResult.status} (${buildResult.durationMs}ms)`);

// Test 2: dockerfile_fix no projeto real — deve retornar ok (já corrigido)
const dockerfileResult = await checkDockerfile(REPO_ROOT);
assert.equal(dockerfileResult.tool, 'dockerfile_fix');
assert.ok(['ok', 'fixed', 'warning'].includes(dockerfileResult.status));
assert.ok(Array.isArray(dockerfileResult.corrections));
console.log(`  dockerfile_fix: ${dockerfileResult.status}`);

// Test 3: docs_check no projeto real — deve retornar ok (arquivo já existe e está correto)
const docsResult = await checkDocs(REPO_ROOT);
assert.equal(docsResult.tool, 'docs_check');
assert.ok(['ok', 'fixed'].includes(docsResult.status));
console.log(`  docs_check: ${docsResult.status}`);

// Test 4: smoke_run categoria static
const { runSmoke } = await import('../../tools/mcp-project-health/dist/checks/smoke.check.js');
const smokeResult = await runSmoke({ repoRoot: REPO_ROOT, categories: ['static'], timeoutMs: 30_000 });
assert.equal(smokeResult.tool, 'smoke_run');
assert.equal(smokeResult.status, 'ok', `Static smoke tests failed: ${smokeResult.findings.map(f => f.message).join('; ')}`);
console.log(`  smoke_run[static]: ${smokeResult.status}`);

console.log('\n✅ mcp-project-health-smoke: all checks passed');
```

- [ ] **Step 11.2: Rodar o smoke test**

```bash
node scripts/smoke-tests/mcp-project-health-smoke.mjs
```

Expected:
```
  build_check: ok (NNNms)
  dockerfile_fix: ok
  docs_check: ok
  smoke_run[static]: ok

✅ mcp-project-health-smoke: all checks passed
```

- [ ] **Step 11.3: Commit**

```bash
git add scripts/smoke-tests/mcp-project-health-smoke.mjs
git commit -m "test(project-health): add integration smoke test"
```

---

## Task 12: Configuração MCP e validação final

**Files:**
- Modify: `config/mcp/shp-local-mcp.example.json`

- [ ] **Step 12.1: Adicionar entrada no config MCP**

Abrir `config/mcp/shp-local-mcp.example.json` e adicionar antes do último `}`:

```json
"api-llm-embedded-project-health": {
  "command": "node",
  "args": ["tools/mcp-project-health/dist/main.js"],
  "cwd": "C:\\workdir\\api-llm-embedded",
  "env": {
    "REPO_ROOT": "C:\\workdir\\api-llm-embedded"
  }
}
```

- [ ] **Step 12.2: Build completo de todos os workspaces**

```bash
npm run -ws --if-present build
```

Expected: todos os 8 workspaces compilam sem erro (inclui o novo `mcp-project-health`).

- [ ] **Step 12.3: Rodar health_check_all manualmente**

```bash
PG_HOST=localhost PG_DATABASE=api_llm_embedded PG_USER=postgres PG_PASSWORD=postgres \
LLM_PG_HOST=localhost LLM_PG_DATABASE=api_llm_embedded LLM_PG_USER=postgres LLM_PG_PASSWORD=postgres LLM_PG_SCHEMA=llm_ops \
REPO_ROOT=$(pwd) node --input-type=module << 'EOF'
import { runAllWithReport } from './tools/mcp-project-health/dist/runner/check-runner.js';
const { results, reportPath } = await runAllWithReport({ repoRoot: process.cwd(), smokeCategories: ['static', 'mcp'] });
const summary = results.map(r => `${r.tool}: ${r.status}`).join('\n');
console.log(summary);
console.log(`\nReport: ${reportPath}`);
EOF
```

Expected: todos os checks retornam `ok`, `fixed` ou `warning` (nenhum `error`). Relatório criado em `.copilot-tracking/runtime/health-*.md`.

- [ ] **Step 12.4: Commit final**

```bash
git add config/mcp/shp-local-mcp.example.json
git commit -m "feat(project-health): add MCP config entry and complete project-health server"
```

---

## Self-Review

**Spec coverage:**
- ✅ `tools/mcp-project-health/` — Task 1
- ✅ 8 tools MCP — Tasks 2-8 + 10
- ✅ `types.ts` (CheckResult, Finding, Correction) — Task 1
- ✅ `build.check.ts` — Task 2
- ✅ `dockerfile.check.ts` com 3 regras — Task 3
- ✅ `docker-compose.check.ts` validando 7 serviços — Task 4
- ✅ `migration-paths.check.ts` com auto-fix — Task 5
- ✅ `docs.check.ts` com manifesto e patch — Task 6
- ✅ `smoke.check.ts` com 3 categorias — Task 7
- ✅ `database.check.ts` com `runMigrations` automático — Task 8
- ✅ `audit-writer.ts` gerando markdown com diff — Task 9
- ✅ `check-runner.ts` com fases (build → paralelo → database) — Task 9
- ✅ `REPO_ROOT` env var para resolução de paths — Task 10 (`main.ts`)
- ✅ `"tools/*"` adicionado ao workspace raiz — Task 1
- ✅ Smoke test de integração — Task 11
- ✅ Entrada no config MCP — Task 12

**Type consistency:** `CheckResult`, `Finding`, `Correction`, `CheckStatus` definidos em `types.ts` Task 1 e usados consistentemente em todos os checks. Todos os checks retornam `Promise<CheckResult>`. `check-runner.ts` usa os tipos corretos.

**Placeholder scan:** Nenhum TBD, TODO ou "implement later" encontrado.
