#!/usr/bin/env node

const syncBaseUrl = (process.env.SYNC_API_URL ?? 'http://localhost:3004').replace(/\/+$/, '');
const graphBaseUrl = (process.env.GRAPH_API_URL ?? syncBaseUrl).replace(/\/+$/, '');
const apiKey = process.env.SYNC_API_KEY ?? process.env.API_KEY ?? '';

const limitSites = Number(process.env.SYNC_POPULATE_LIMIT_SITES ?? 10);
const limitUsers = Number(process.env.SYNC_POPULATE_LIMIT_USERS ?? 10);
const limitTeams = Number(process.env.SYNC_POPULATE_LIMIT_TEAMS ?? 10);
const limitChannels = Number(process.env.SYNC_POPULATE_LIMIT_CHANNELS ?? 20);

const headers = { 'Content-Type': 'application/json' };
if (apiKey) headers['x-api-key'] = apiKey;

function log(step, details) {
  console.log(`[populate-sync-real-data] ${step}${details ? `: ${details}` : ''}`);
}

function fail(message, code = 1) {
  console.error(`[populate-sync-real-data] ${message}`);
  process.exit(code);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function get(path, base = syncBaseUrl) {
  const response = await fetch(`${base}${path}`, { headers });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`GET ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function post(path, payload, base = syncBaseUrl) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`POST ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function trigger(type, context) {
  const payload = context ? { type, context } : { type };
  const result = await post('/sync/jobs', payload);
  const status = result?.data?.status ?? 'unknown';
  const itemCount = result?.data?.itemCount ?? null;
  const errorMessage = result?.data?.errorMessage ?? '';

  if (status !== 'completed') {
    throw new Error(`job ${type}${context ? ` (${context})` : ''} terminou com status=${status} error=${errorMessage}`);
  }

  log('job-complete', `${type}${context ? ` (${context})` : ''} items=${itemCount}`);
  return result;
}

function pickRemoteIds(items, limit) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => item?.remoteId)
    .filter((value) => typeof value === 'string' && value.length > 0)
    .slice(0, limit);
}

async function main() {
  log('start', `syncBaseUrl=${syncBaseUrl}`);

  // Sanity check: graph auth readiness for real-source ingestion.
  try {
    const auth = await get('/graph/auth/status', graphBaseUrl);
    const ok = auth?.success === true || auth?.data?.authenticated === true;
    if (!ok) {
      fail(`Graph auth indisponivel para dados reais: ${JSON.stringify(auth)}`);
    }
    log('graph-auth', 'ok');
  } catch (error) {
    fail(`nao foi possivel validar Graph auth em ${graphBaseUrl}/graph/auth/status: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Base datasets (independentes)
  await trigger('sites');
  await trigger('users');
  await trigger('groups');
  await trigger('teams');
  await trigger('mailboxes');

  // Dependentes de contexto
  const sites = await get('/sync/sites');
  const siteIds = pickRemoteIds(sites?.data, limitSites);
  for (const siteId of siteIds) {
    await trigger('drives', siteId);
  }

  const users = await get('/sync/users');
  const userIds = pickRemoteIds(users?.data, limitUsers);
  for (const userId of userIds) {
    await trigger('onedrives', userId);
  }

  const teams = await get('/sync/teams');
  const teamIds = pickRemoteIds(teams?.data, limitTeams);
  for (const teamId of teamIds) {
    await trigger('team-channels', teamId);
  }

  const channels = await get('/sync/team-channels');
  const channelContexts = Array.isArray(channels?.data)
    ? channels.data
        .map((channel) => {
          const teamId = channel?.teamRemoteId;
          const channelId = channel?.remoteId;
          if (!teamId || !channelId) return null;
          return `${teamId}:${channelId}`;
        })
        .filter(Boolean)
        .slice(0, limitChannels)
    : [];

  for (const context of channelContexts) {
    await trigger('team-channel-messages', context);
  }

  const summary = {
    success: true,
    syncBaseUrl,
    populated: {
      sites: siteIds.length,
      users: userIds.length,
      teams: teamIds.length,
      channels: channelContexts.length
    }
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
