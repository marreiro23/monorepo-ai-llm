import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
