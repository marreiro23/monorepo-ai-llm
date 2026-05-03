import 'reflect-metadata';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GraphService } from '../../apps/api/dist/modules/graph/graph.service.js';
import { loadMock } from '../mocks/devproxy-mock-utils.mjs';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const sitesMock = loadMock('graph', 'get-sites-list-200.json');
const usersMock = loadMock('graph', 'get-users-list-200.json');
const groupsMock = loadMock('graph', 'get-groups-list-200.json');
const rateLimitMock = loadMock('graph', 'get-drives-root-permissions-429.json');
const graph503Mock = loadMock('graph', 'get-sites-service-unavailable-503.json');
const graph500Mock = loadMock('graph', 'get-sites-list-500.json');
const graphTimeoutMock = loadMock('graph', 'get-sites-timeout-504.json');

const primarySite = sitesMock.body?.value?.[0] || {
  id: 'site-1',
  displayName: 'Site 1',
  webUrl: 'https://tenant.sharepoint.com/sites/site1'
};

const fixtures = {
  '/sites': {
    value: sitesMock.body?.value || []
  },
  '/sites/site-1': {
    id: 'site-1',
    displayName: primarySite.displayName || 'Site 1',
    webUrl: primarySite.webUrl || 'https://tenant.sharepoint.com/sites/site1'
  },
  '/sites/site-1/drives': {
    value: [{ id: 'drive-1', name: 'Docs' }]
  },
  '/sites/site-1/permissions': {
    value: [{ id: 'perm-1', roles: ['read'] }]
  },
  '/sites/site-1/lists': {
    value: [
      {
        id: 'list-1',
        name: 'Docs',
        displayName: 'Docs',
        list: { template: 'documentLibrary' },
        drive: { id: 'drive-1', name: 'Docs', description: '', driveType: 'documentLibrary', webUrl: 'https://tenant.sharepoint.com/sites/site1/Docs' }
      }
    ]
  },
  '/sites/site-1/lists/list-1': {
    id: 'list-1',
    name: 'Docs',
    displayName: 'Docs',
    list: { template: 'documentLibrary' },
    drive: { id: 'drive-1', name: 'Docs', description: '', driveType: 'documentLibrary', webUrl: 'https://tenant.sharepoint.com/sites/site1/Docs' }
  },
  '/users': {
    value: usersMock.body?.value || []
  },
  '/groups': {
    value: groupsMock.body?.value || []
  },
  '/drives/drive-1/root/permissions': {
    value: [{ id: 'perm-root-1', roles: ['read'] }]
  },
  '/teams/team-1/channels/channel-1/messages': {
    value: [
      {
        id: 'message-1',
        messageType: 'message',
        body: { contentType: 'html', content: '<p>Top-level message</p>' },
        from: { user: { id: 'user-1', displayName: 'User One' } },
        createdDateTime: '2026-04-25T12:00:00Z'
      }
    ]
  },
  '/teams/team-1/channels/channel-1/messages/message-1/replies': {
    value: [
      {
        id: 'reply-1',
        replyToId: 'message-1',
        messageType: 'message',
        body: { contentType: 'html', content: '<p>Reply message</p>' },
        from: { user: { id: 'user-2', displayName: 'User Two' } },
        createdDateTime: '2026-04-25T12:01:00Z'
      }
    ]
  }
};

const entraStub = {
  getConfig: () => ({
    tenantIdConfigured: true,
    clientIdConfigured: true,
    certificatePathConfigured: true,
    certificateThumbprintConfigured: true,
    clientSecretConfigured: false,
    authMethod: 'client-certificate',
    graphBaseUrl: 'https://graph.microsoft.com/v1.0',
    scope: 'https://graph.microsoft.com/.default',
    isAuthenticated: true,
    lastAuthTime: '2026-04-22T00:00:00.000Z',
    certificatePath: 'mock.pem',
    certificateThumbprint: 'ABC123'
  }),
  authenticate: async () => true,
  getAccessToken: async () => 'stub-token'
};

class GraphReadSmokeService extends GraphService {
  async requestGraph(path, params) {
    const key = path.replace(/%2F/g, '/');
    const response = fixtures[key];

    if (!response) {
      throw new Error(`No fixture for ${key} with params ${JSON.stringify(params || {})}`);
    }

    return response;
  }
}

const service = new GraphReadSmokeService(entraStub);

const [sites, site, drives, permissions, libraries, library, users, groups, rootPermissions, channelMessages, channelMessageReplies] = await Promise.all([
  service.listSites('site', 5),
  service.getSite('site-1'),
  service.listSiteDrives('site-1'),
  service.listSitePermissions('site-1'),
  service.listSiteLibraries('site-1'),
  service.getLibrary('site-1', 'list-1'),
  service.listUsers('user', 5),
  service.listGroups('group', 5),
  service.listDriveRootPermissions('drive-1'),
  service.listTeamChannelMessages('team-1', 'channel-1', 5),
  service.listTeamChannelMessageReplies('team-1', 'channel-1', 'message-1', 5)
]);

const onlineSnapshotPath = resolve(process.cwd(), '.copilot-tracking', 'runtime', 'api-online-schema-snapshot.json');
mkdirSync(resolve(process.cwd(), '.copilot-tracking', 'runtime'), { recursive: true });

const previousSnapshot = existsSync(onlineSnapshotPath)
  ? JSON.parse(readFileSync(onlineSnapshotPath, 'utf8'))
  : { generatedAt: null, sources: [] };

const mergedSources = (previousSnapshot.sources || []).filter((source) => source.source !== 'graph-read-smoke');
mergedSources.push({
  source: 'graph-read-smoke',
  entries: [
    { endpoint: 'https://graph.microsoft.com/v1.0/sites', sample: sites.data[0] || {} },
    { endpoint: 'https://graph.microsoft.com/v1.0/users', sample: users.data[0] || {} },
    { endpoint: 'https://graph.microsoft.com/v1.0/groups', sample: groups.data[0] || {} },
    { endpoint: 'https://graph.microsoft.com/v1.0/drives/drive-1/root/permissions', sample: rootPermissions.data[0] || {} },
    { endpoint: 'https://graph.microsoft.com/v1.0/teams/team-1/channels/channel-1/messages', sample: channelMessages.data[0] || {} },
    { endpoint: 'https://graph.microsoft.com/v1.0/teams/team-1/channels/channel-1/messages/message-1/replies', sample: channelMessageReplies.data[0] || {} }
  ]
});

writeFileSync(
  onlineSnapshotPath,
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    invocationSource: 'vscode',
    sources: mergedSources
  }, null, 2)}\n`,
  'utf8'
);

console.log(
  JSON.stringify(
    {
      sites: sites.data,
      site: site.data,
      drives: drives.data,
      permissions: permissions.data,
      libraries: libraries.data,
      library: library.data,
      users: users.data,
      groups: groups.data,
      rootPermissions: rootPermissions.data,
      channelMessages: channelMessages.data,
      channelMessageReplies: channelMessageReplies.data
    },
    null,
    2
  )
);

if (rateLimitMock.statusCode !== 429) {
  throw new Error('Rate limit mock esperado com status 429 para contrato de resiliencia.');
}

if (!rateLimitMock.headers?.['retry-after']) {
  throw new Error('Rate limit mock deve expor header retry-after.');
}

if (graph500Mock.statusCode !== 500 || !graph500Mock.body?.error?.code) {
  throw new Error('Mock 500 de graph/sites invalido para cenarios de resiliencia.');
}

if (graph503Mock.statusCode !== 503 || !/unavailable/i.test(graph503Mock.body?.error?.message || '')) {
  throw new Error('Mock 503 de graph/sites invalido para cenarios de resiliencia.');
}

if (!graph503Mock.headers?.['retry-after']) {
  throw new Error('Mock 503 de graph/sites deve expor retry-after.');
}

if (graphTimeoutMock.statusCode !== 504 || !/timeout/i.test(graphTimeoutMock.body?.error?.message || '')) {
  throw new Error('Mock 504 timeout de graph/sites invalido para cenarios de resiliencia.');
}
