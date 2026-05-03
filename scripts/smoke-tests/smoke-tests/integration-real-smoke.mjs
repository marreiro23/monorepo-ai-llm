#!/usr/bin/env node
/**
 * Smoke test de integração real — sem fetchMock.
 * Requer os containers rodando: users (3001), llm-ops (3002), sync (3004).
 *
 * Uso:
 *   node scripts/smoke-tests/integration-real-smoke.mjs
 *
 * Variáveis opcionais:
 *   USERS_API_URL, LLM_OPS_API_URL, SYNC_API_URL
 */

const USERS_URL  = process.env.USERS_API_URL  ?? 'http://localhost:3001';
const LLM_OPS_URL = process.env.LLM_OPS_API_URL ?? 'http://localhost:3002';
const SYNC_URL   = process.env.SYNC_API_URL   ?? 'http://localhost:3004';

const results = [];

async function check(label, fn) {
  try {
    const value = await fn();
    results.push({ label, status: 'ok', value });
  } catch (err) {
    results.push({ label, status: 'fail', error: String(err.message ?? err) });
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} → ${url}`);
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} → ${url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Users (3001) ──────────────────────────────────────────────────────────────
await check('users:health', async () => {
  const { status } = await getJson(`${USERS_URL}/health`);
  if (status !== 'ok') throw new Error(`Unexpected status: ${status}`);
  return 'ok';
});

await check('users:list', async () => {
  const { success, data } = await getJson(`${USERS_URL}/users`);
  if (!success || !Array.isArray(data)) throw new Error('Invalid response shape');
  return `${data.length} user(s)`;
});

// ── LLM-Ops (3002) ────────────────────────────────────────────────────────────
await check('llm-ops:health', async () => {
  const { status } = await getJson(`${LLM_OPS_URL}/health`);
  if (status !== 'ok') throw new Error(`Unexpected status: ${status}`);
  return 'ok';
});

await check('llm-ops:agents', async () => {
  const { success, data } = await getJson(`${LLM_OPS_URL}/llm-ops/agents`);
  if (!success || !Array.isArray(data)) throw new Error('Invalid response shape');
  return `${data.length} agent(s)`;
});

await check('llm-ops:prompt-templates', async () => {
  const { success, data } = await getJson(`${LLM_OPS_URL}/llm-ops/prompt-templates`);
  if (!success || !Array.isArray(data)) throw new Error('Invalid response shape');
  return `${data.length} template(s)`;
});

await check('llm-ops:topic-flows', async () => {
  const { success, data } = await getJson(`${LLM_OPS_URL}/llm-ops/topic-flows`);
  if (!success || !Array.isArray(data)) throw new Error('Invalid response shape');
  return `${data.length} flow(s)`;
});

await check('llm-ops:resources-catalog', async () => {
  const { success, data } = await getJson(`${LLM_OPS_URL}/llm-ops/resources/catalog`);
  if (!success || !data?.executionMode) throw new Error('Invalid catalog shape');
  if (data.executionMode !== 'read-only-recommendation') throw new Error(`Unexpected executionMode: ${data.executionMode}`);
  return `${data.resources?.length ?? 0} resource(s), mode=${data.executionMode}`;
});

await check('llm-ops:chat-no-agent', async () => {
  const res = await postJson(`${LLM_OPS_URL}/llm-ops/chat`, {
    message: 'Qual o status operacional?',
    invocationSource: 'api',
    sessionFingerprint: 'integration-real-smoke'
  });
  if (!res.success) throw new Error(`Chat returned success=false`);
  if (res.data?.executionMode !== 'read-only-recommendation') throw new Error('executionMode mismatch');
  if (res.data?.runtimeOutcome !== 'success') throw new Error(`runtimeOutcome=${res.data?.runtimeOutcome}`);
  return `outcome=${res.data.runtimeOutcome}, mode=${res.data.executionMode}`;
});

// ── Sync (3004) ───────────────────────────────────────────────────────────────
await check('sync:health', async () => {
  const { status } = await getJson(`${SYNC_URL}/health`);
  if (status !== 'ok') throw new Error(`Unexpected status: ${status}`);
  return 'ok';
});

await check('sync:jobs', async () => {
  const { success, data } = await getJson(`${SYNC_URL}/sync/jobs`);
  if (!success || !Array.isArray(data)) throw new Error('Invalid response shape');
  return `${data.length} job(s)`;
});

await check('sync:users', async () => {
  const { success, data } = await getJson(`${SYNC_URL}/sync/users`);
  if (!success || !Array.isArray(data)) throw new Error('Invalid response shape');
  return `${data.length} synced user(s)`;
});

await check('sync:sites', async () => {
  const { success, data } = await getJson(`${SYNC_URL}/sync/sites`);
  if (!success || !Array.isArray(data)) throw new Error('Invalid response shape');
  return `${data.length} synced site(s)`;
});

// ── MCP API clients via importação dinâmica ───────────────────────────────────
const usersClientPath  = new URL('../../apps/svcia/mcp-users/dist/users-api-client.js',  import.meta.url);
const llmOpsClientPath = new URL('../../apps/svcia/mcp-llm-ops/dist/llm-ops-api-client.js', import.meta.url);
const syncClientPath   = new URL('../../apps/svcia/mcp-sync/dist/sync-api-client.js',    import.meta.url);

await check('mcp-client:users-list', async () => {
  const { UsersApiClient } = await import(usersClientPath.href);
  const client = new UsersApiClient(USERS_URL);
  const users = await client.listUsers();
  return `${users.length} user(s) via MCP client`;
});

await check('mcp-client:llm-ops-agents', async () => {
  const { LlmOpsApiClient } = await import(llmOpsClientPath.href);
  const client = new LlmOpsApiClient(LLM_OPS_URL);
  const agents = await client.listAgents();
  return `${agents.length} agent(s) via MCP client`;
});

await check('mcp-client:sync-status', async () => {
  const { SyncApiClient } = await import(syncClientPath.href);
  const client = new SyncApiClient(SYNC_URL);
  const status = await client.getStatus();
  if (typeof status.totalJobs !== 'number') throw new Error('Invalid status shape');
  return `totalJobs=${status.totalJobs} via MCP client`;
});

// ── Relatório final ───────────────────────────────────────────────────────────
const failed = results.filter(r => r.status === 'fail');
const passed = results.filter(r => r.status === 'ok');

console.log(JSON.stringify({
  success: failed.length === 0,
  urls: { users: USERS_URL, llmOps: LLM_OPS_URL, sync: SYNC_URL },
  summary: { total: results.length, passed: passed.length, failed: failed.length },
  results: results.map(r => r.status === 'ok'
    ? { label: r.label, status: 'ok', value: r.value }
    : { label: r.label, status: 'FAIL', error: r.error }
  )
}, null, 2));

if (failed.length > 0) process.exit(1);
