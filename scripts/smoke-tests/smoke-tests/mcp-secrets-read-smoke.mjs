#!/usr/bin/env node

const { SecretsRegistry } = await import('../../apps/svcia/mcp-secrets/dist/secrets-registry.js');

const testEnv = {
  POSTGRES_PASSWORD: 'super-secret-pg-password',
  TENANT_ID: 'test-tenant-id',
  CLIENT_ID: 'test-client-id',
  LLM_API_KEY: 'sk-test-key-1234',
  ASTRA_DB_APPLICATION_TOKEN: 'AstraCS:test-token',
};

const registry = new SecretsRegistry(testEnv);

// --- Test 1: listSecrets returns metadata without real values ---
const secrets = registry.listSecrets({ includeUnconfigured: true });

if (!Array.isArray(secrets) || secrets.length === 0) {
  throw new Error('listSecrets must return a non-empty array');
}

for (const secret of secrets) {
  if (secret.valuePreview !== '[redacted]') {
    throw new Error(`Secret ${secret.logicalKey} has valuePreview !== '[redacted]': ${secret.valuePreview}`);
  }
  if (secret.valueStatus !== 'redacted') {
    throw new Error(`Secret ${secret.logicalKey} has valueStatus !== 'redacted': ${secret.valueStatus}`);
  }
  for (const realValue of Object.values(testEnv)) {
    if (JSON.stringify(secret).includes(realValue)) {
      throw new Error(`Secret value leaked in ${secret.logicalKey} metadata!`);
    }
  }
}

// --- Test 2: configured flag reflects actual env ---
const configured = secrets.filter((s) => s.configured);
const expectedConfigured = ['POSTGRES_PASSWORD', 'TENANT_ID', 'CLIENT_ID', 'LLM_API_KEY', 'ASTRA_DB_APPLICATION_TOKEN'];
for (const targetName of expectedConfigured) {
  const found = configured.find((s) => s.targetName === targetName);
  if (!found) throw new Error(`${targetName} should be configured but is not`);
}

// --- Test 3: prepareOperation returns dry-run plan ---
const plan = registry.prepareOperation({
  action: 'rotate',
  logicalKey: 'postgres.primary.password',
  reason: 'Quarterly rotation',
  requestedBy: 'smoke-test'
});

if (plan.dryRun !== true) throw new Error(`dryRun must be true, got: ${plan.dryRun}`);
if (plan.mutationAllowed !== false) throw new Error(`mutationAllowed must be false, got: ${plan.mutationAllowed}`);
if (plan.approvalRequired !== true) throw new Error(`approvalRequired must be true, got: ${plan.approvalRequired}`);
if (plan.status !== 'prepared') throw new Error(`status must be 'prepared', got: ${plan.status}`);
if (!plan.audit?.correlationId) throw new Error('correlationId missing from audit');
if (!Array.isArray(plan.safetyChecks) || plan.safetyChecks.length === 0) throw new Error('safetyChecks must be non-empty');
if (!Array.isArray(plan.rollbackPlan) || plan.rollbackPlan.length === 0) throw new Error('rollbackPlan must be non-empty');

for (const realValue of Object.values(testEnv)) {
  if (JSON.stringify(plan).includes(realValue)) throw new Error('Secret value leaked in operation plan!');
}

// --- Test 4: register and revoke also return dry-run ---
for (const action of ['register', 'revoke']) {
  const op = registry.prepareOperation({ action, logicalKey: 'llm.api.key', reason: 'smoke' });
  if (op.dryRun !== true) throw new Error(`${action}: dryRun must be true`);
  if (op.mutationAllowed !== false) throw new Error(`${action}: mutationAllowed must be false`);
}

console.log(JSON.stringify({
  success: true,
  catalogSize: secrets.length,
  configuredCount: configured.length,
  unconfiguredCount: secrets.length - configured.length,
  contractChecks: ['valuePreview=[redacted]', 'dryRun=true', 'mutationAllowed=false', 'noSecretValueLeaks']
}, null, 2));
