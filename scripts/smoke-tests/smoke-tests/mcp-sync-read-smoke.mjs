#!/usr/bin/env node

const { SyncApiClient } = await import('../../apps/svcia/mcp-sync/dist/sync-api-client.js');

const calls = [];
const fetchMock = async (input, init = {}) => {
  const url = String(input);
  const method = init.method ?? 'GET';
  calls.push({ url, method });

  if (method !== 'GET') {
    throw new Error(`Unexpected mutating MCP Sync call: ${method} ${url}`);
  }

  if (url.endsWith('/sync/jobs')) {
    return json({
      success: true,
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          type: 'users',
          status: 'completed',
          context: 'smoke-users',
          itemCount: 2,
          createdAt: '2026-04-26T00:00:00.000Z',
          startedAt: '2026-04-26T00:00:01.000Z',
          finishedAt: '2026-04-26T00:00:02.000Z'
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          type: 'sites',
          status: 'running',
          context: 'smoke-sites',
          itemCount: null,
          createdAt: '2026-04-26T00:01:00.000Z',
          startedAt: '2026-04-26T00:01:01.000Z',
          finishedAt: null
        }
      ]
    });
  }

  if (url.endsWith('/sync/sites')) {
    return json({
      success: true,
      data: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          remoteId: 'contoso.sharepoint.com,site-id,web-id',
          name: 'sites-smoke',
          displayName: 'Sites Smoke',
          webUrl: 'https://contoso.sharepoint.com/sites/smoke',
          syncedAt: '2026-04-26T00:02:00.000Z'
        }
      ]
    });
  }

  if (url.endsWith('/sync/users')) {
    return json({
      success: true,
      data: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          remoteId: 'graph-user-smoke',
          displayName: 'Graph User Smoke',
          mail: 'graph.user.smoke@example.com',
          userPrincipalName: 'graph.user.smoke@example.com',
          syncedAt: '2026-04-26T00:03:00.000Z'
        }
      ]
    });
  }

  return json({ success: false, message: 'not found' }, 404);
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

const client = new SyncApiClient('http://sync-api.test', fetchMock);
const defaultClient = new SyncApiClient(undefined, fetchMock);

const jobs = await client.listJobs();
if (jobs.length !== 2 || jobs[0].type !== 'users') {
  throw new Error('Expected sync_jobs_list to return two smoke jobs');
}

const runningJobs = await client.listJobs(10, 'running');
if (runningJobs.length !== 1 || runningJobs[0].status !== 'running') {
  throw new Error('Expected sync_jobs_list status filter to return one running job');
}

const status = await client.getStatus();
if (status.totalJobs !== 2 || status.byStatus.completed !== 1 || status.byStatus.running !== 1) {
  throw new Error('Expected sync_status to summarize smoke jobs');
}

const sites = await client.listSites();
if (sites.length !== 1 || sites[0].remoteId !== 'contoso.sharepoint.com,site-id,web-id') {
  throw new Error('Expected sync_sites_list to return one smoke site');
}

const users = await client.listUsers();
if (users.length !== 1 || users[0].remoteId !== 'graph-user-smoke') {
  throw new Error('Expected sync_users_list to return one smoke user');
}

await defaultClient.listJobs(1);
if (!calls.some((call) => call.url === 'http://localhost:3004/sync/jobs')) {
  throw new Error('Expected default Sync API URL to target localhost:3004');
}

const unsafeCall = calls.find((call) => call.method !== 'GET' || call.url.endsWith('/sync/jobs') === false && call.url.includes('/sync/jobs/'));
if (unsafeCall) {
  throw new Error(`Unexpected unsafe call: ${JSON.stringify(unsafeCall)}`);
}

console.log(
  JSON.stringify(
    {
      success: true,
      toolsCovered: ['sync_jobs_list', 'sync_status', 'sync_sites_list', 'sync_users_list'],
      callCount: calls.length,
      methods: [...new Set(calls.map((call) => call.method))]
    },
    null,
    2
  )
);
