import assert from 'node:assert/strict';

const { checkBuild } = await import('../../tools/mcp-project-health/dist/checks/build.check.js');
const { checkDockerfile } = await import('../../tools/mcp-project-health/dist/checks/dockerfile.check.js');
const { checkDocs } = await import('../../tools/mcp-project-health/dist/checks/docs.check.js');
const { runSmoke } = await import('../../tools/mcp-project-health/dist/checks/smoke.check.js');

const REPO_ROOT = process.cwd();

// Test 1: build_check returns valid CheckResult shape
const buildResult = await checkBuild(REPO_ROOT);
assert.ok(['ok', 'error'].includes(buildResult.status), `build status must be ok|error, got ${buildResult.status}`);
assert.equal(buildResult.tool, 'build_check');
assert.ok(Array.isArray(buildResult.findings));
assert.ok(Array.isArray(buildResult.corrections));
assert.ok(typeof buildResult.durationMs === 'number');
console.log(`  build_check: ${buildResult.status} (${buildResult.durationMs}ms)`);

// Test 2: dockerfile_fix on real project — should return ok (already fixed)
const dockerfileResult = await checkDockerfile(REPO_ROOT);
assert.equal(dockerfileResult.tool, 'dockerfile_fix');
assert.ok(['ok', 'fixed', 'warning'].includes(dockerfileResult.status));
assert.ok(Array.isArray(dockerfileResult.corrections));
console.log(`  dockerfile_fix: ${dockerfileResult.status}`);

// Test 3: docs_check on real project — file already exists and is correct
const docsResult = await checkDocs(REPO_ROOT);
assert.equal(docsResult.tool, 'docs_check');
assert.ok(['ok', 'fixed'].includes(docsResult.status));
console.log(`  docs_check: ${docsResult.status}`);

// Test 4: smoke_run static category
const smokeResult = await runSmoke({ repoRoot: REPO_ROOT, categories: ['static'], timeoutMs: 30_000 });
assert.equal(smokeResult.tool, 'smoke_run');
assert.equal(smokeResult.status, 'ok', `Static smoke tests failed: ${smokeResult.findings.map(f => f.message).join('; ')}`);
console.log(`  smoke_run[static]: ${smokeResult.status}`);

console.log('\n✅ mcp-project-health-smoke: all checks passed');
