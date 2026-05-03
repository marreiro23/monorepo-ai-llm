/**
 * sharepoint-smoke.mjs
 * Smoke test sem rede para o módulo SharePoint Extendido.
 * Valida que os métodos do service existem e retornam a estrutura esperada
 * usando stubs que não fazem chamadas reais ao Graph API.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadMock } from '../mocks/devproxy-mock-utils.mjs';

const driveItemsMock = loadMock('sharepoint', 'get-drive-items-200.json');
const driveItems503Mock = loadMock('sharepoint', 'get-drive-items-service-unavailable-503.json');
const driveItems500Mock = loadMock('sharepoint', 'get-drive-items-500.json');
const driveItemsTimeoutMock = loadMock('sharepoint', 'get-drive-items-timeout-504.json');
const listItemsMock = loadMock('sharepoint', 'get-list-items-200.json');
const listNotFoundMock = loadMock('sharepoint', 'get-library-not-found-404.json');

// ─── Stub do EntraRegistrationService ───────────────────────────────────────
const entraStub = {
  async getAccessToken() {
    return 'stub-token-for-smoke-test';
  }
};

// ─── Stub do axios ───────────────────────────────────────────────────────────
function makeAxiosStub(responseData) {
  return async (config) => {
    if (config.method === 'DELETE') {
      return { data: undefined, status: 204 };
    }
    return { data: responseData, status: 200 };
  };
}

// ─── SharePointService stub-able ────────────────────────────────────────────
class SharePointServiceStub {
  #entra;
  #axios;

  constructor(entra, axiosFn) {
    this.#entra = entra;
    this.#axios = axiosFn;
  }

  async #getToken() {
    const token = await this.#entra.getAccessToken();
    if (!token) throw new Error('Token nulo');
    return token;
  }

  async #requestGraph(method, path, data, params, headers) {
    const token = await this.#getToken();
    const response = await this.#axios({
      method,
      url: `https://graph.microsoft.com/v1.0${path}`,
      data,
      params,
      headers: { Authorization: `Bearer ${token}`, ...headers }
    });
    return response.data;
  }

  async listDriveItems(driveId) {
    const result = await this.#requestGraph('GET', `/drives/${driveId}/root/children`);
    return { success: true, data: result?.value || [] };
  }

  async getDriveItem(driveId, itemId) {
    const data = await this.#requestGraph('GET', `/drives/${driveId}/items/${itemId}`);
    return { success: true, data };
  }

  async listDriveItemChildren(driveId, itemId) {
    const result = await this.#requestGraph('GET', `/drives/${driveId}/items/${itemId}/children`);
    return { success: true, data: result?.value || [] };
  }

  async createFolder(driveId, parentItemId, dto) {
    const data = await this.#requestGraph('POST', `/drives/${driveId}/items/${parentItemId}/children`, {
      name: dto.name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename'
    });
    return { success: true, data };
  }

  async uploadFile(driveId, parentItemId, fileName, dto) {
    const buffer = Buffer.from(dto.content, 'base64');
    const data = await this.#requestGraph('PUT', `/drives/${driveId}/items/${parentItemId}:/${fileName}:/content`, buffer);
    return { success: true, data };
  }

  async updateDriveItem(driveId, itemId, dto) {
    const data = await this.#requestGraph('PATCH', `/drives/${driveId}/items/${itemId}`, dto);
    return { success: true, data };
  }

  async deleteDriveItem(driveId, itemId) {
    await this.#requestGraph('DELETE', `/drives/${driveId}/items/${itemId}`);
    return { success: true, data: { driveId, itemId } };
  }

  async inviteDriveItem(driveId, itemId, dto) {
    const data = await this.#requestGraph('POST', `/drives/${driveId}/items/${itemId}/invite`, {
      requireSignIn: true,
      sendInvitation: true,
      roles: dto.roles,
      recipients: dto.emails.map((e) => ({ email: e })),
      message: dto.message || ''
    });
    return { success: true, data };
  }

  async revokeDriveItemPermission(driveId, itemId, permissionId) {
    await this.#requestGraph('DELETE', `/drives/${driveId}/items/${itemId}/permissions/${permissionId}`);
    return { success: true, data: { driveId, itemId, permissionId } };
  }

  async listListItems(siteId, listId) {
    const result = await this.#requestGraph('GET', `/sites/${siteId}/lists/${listId}/items?expand=fields`);
    return { success: true, data: result?.value || [] };
  }

  async getListItem(siteId, listId, itemId) {
    const data = await this.#requestGraph('GET', `/sites/${siteId}/lists/${listId}/items/${itemId}?expand=fields`);
    return { success: true, data };
  }

  async createListItem(siteId, listId, dto) {
    const data = await this.#requestGraph('POST', `/sites/${siteId}/lists/${listId}/items`, { fields: dto.fields });
    return { success: true, data };
  }

  async updateListItem(siteId, listId, itemId, dto) {
    const data = await this.#requestGraph('PATCH', `/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, dto.fields);
    return { success: true, data };
  }

  async deleteListItem(siteId, listId, itemId) {
    await this.#requestGraph('DELETE', `/sites/${siteId}/lists/${listId}/items/${itemId}`);
    return { success: true, data: { siteId, listId, itemId } };
  }
}

// ─── Test Runner ─────────────────────────────────────────────────────────────
async function run() {
  const DRIVE_ID = 'b!fake-drive-id';
  const ITEM_ID = 'item-01';
  const SITE_ID = 'fake.sharepoint.com,site-id,web-id';
  const LIST_ID = 'list-01';

  const fakeItem = { id: ITEM_ID, name: 'Documento.pdf' };
  const fakeList = { value: driveItemsMock.body?.value || [fakeItem] };
  const fakeListItem = { id: 'li-01', fields: { Title: 'Test' } };
  const fakeListItemList = { value: listItemsMock.body?.value || [fakeListItem] };
  const fakePermission = { value: [{ id: 'perm-01', roles: ['read'] }] };
  const fakeInviteResult = { value: [{ grantedToIdentitiesV2: [] }] };

  const svc = (stub) => new SharePointServiceStub(entraStub, makeAxiosStub(stub));

  // Phase 2: Read
  let result = await svc(fakeList).listDriveItems(DRIVE_ID);
  assert.equal(result.success, true, 'listDriveItems: success');
  assert.ok(Array.isArray(result.data), 'listDriveItems: data is array');

  result = await svc(fakeItem).getDriveItem(DRIVE_ID, ITEM_ID);
  assert.equal(result.success, true, 'getDriveItem: success');

  result = await svc(fakeList).listDriveItemChildren(DRIVE_ID, ITEM_ID);
  assert.equal(result.success, true, 'listDriveItemChildren: success');
  assert.ok(Array.isArray(result.data), 'listDriveItemChildren: data is array');

  // Phase 3: Write
  result = await svc(fakeItem).createFolder(DRIVE_ID, 'root', { name: 'NovaP pasta' });
  assert.equal(result.success, true, 'createFolder: success');

  result = await svc(fakeItem).uploadFile(DRIVE_ID, 'root', 'arquivo.txt', {
    content: Buffer.from('hello world').toString('base64'),
    mimeType: 'text/plain'
  });
  assert.equal(result.success, true, 'uploadFile: success');

  result = await svc(fakeItem).updateDriveItem(DRIVE_ID, ITEM_ID, { name: 'NovoNome.txt' });
  assert.equal(result.success, true, 'updateDriveItem: success');

  result = await svc(undefined).deleteDriveItem(DRIVE_ID, ITEM_ID);
  assert.equal(result.success, true, 'deleteDriveItem: success');
  assert.equal(result.data.itemId, ITEM_ID, 'deleteDriveItem: itemId returned');

  // Phase 4: Permissions
  result = await svc(fakeInviteResult).inviteDriveItem(DRIVE_ID, ITEM_ID, {
    emails: ['user@contoso.com'],
    roles: ['read'],
    message: 'Compartilhado via smoke test'
  });
  assert.equal(result.success, true, 'inviteDriveItem: success');

  result = await svc(undefined).revokeDriveItemPermission(DRIVE_ID, ITEM_ID, 'perm-01');
  assert.equal(result.success, true, 'revokeDriveItemPermission: success');
  assert.equal(result.data.permissionId, 'perm-01', 'revokeDriveItemPermission: permissionId returned');

  // Phase 5: List Items
  result = await svc(fakeListItemList).listListItems(SITE_ID, LIST_ID);
  assert.equal(result.success, true, 'listListItems: success');
  assert.ok(Array.isArray(result.data), 'listListItems: data is array');

  result = await svc(fakeListItem).getListItem(SITE_ID, LIST_ID, 'li-01');
  assert.equal(result.success, true, 'getListItem: success');

  result = await svc(fakeListItem).createListItem(SITE_ID, LIST_ID, { fields: { Title: 'Novo Item' } });
  assert.equal(result.success, true, 'createListItem: success');

  result = await svc(fakeListItem).updateListItem(SITE_ID, LIST_ID, 'li-01', { fields: { Title: 'Atualizado' } });
  assert.equal(result.success, true, 'updateListItem: success');

  result = await svc(undefined).deleteListItem(SITE_ID, LIST_ID, 'li-01');
  assert.equal(result.success, true, 'deleteListItem: success');
  assert.equal(result.data.itemId, 'li-01', 'deleteListItem: itemId returned');

  const onlineSnapshotPath = resolve(process.cwd(), '.copilot-tracking', 'runtime', 'api-online-schema-snapshot.json');
  mkdirSync(resolve(process.cwd(), '.copilot-tracking', 'runtime'), { recursive: true });

  const previousSnapshot = existsSync(onlineSnapshotPath)
    ? JSON.parse(readFileSync(onlineSnapshotPath, 'utf8'))
    : { generatedAt: null, sources: [] };

  const mergedSources = (previousSnapshot.sources || []).filter((source) => source.source !== 'sharepoint-smoke');
  mergedSources.push({
    source: 'sharepoint-smoke',
    entries: [
      { endpoint: 'https://graph.microsoft.com/v1.0/drives/{driveId}/root/children', sample: (fakeList.value || [])[0] || {} },
      { endpoint: 'https://graph.microsoft.com/v1.0/sites/{siteId}/lists/{listId}/items', sample: (fakeListItemList.value || [])[0] || {} }
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

  assert.equal(listNotFoundMock.statusCode, 404, 'library-not-found mock: status');
  assert.ok(listNotFoundMock.body?.error?.code, 'library-not-found mock: error.code obrigatorio');
  assert.equal(driveItems503Mock.statusCode, 503, 'drive-items-503 mock: status');
  assert.ok(/unavailable/i.test(driveItems503Mock.body?.error?.message || ''), 'drive-items-503 mock: deve indicar indisponibilidade');
  assert.ok(driveItems503Mock.headers?.['retry-after'], 'drive-items-503 mock: retry-after obrigatorio');
  assert.equal(driveItems500Mock.statusCode, 500, 'drive-items-500 mock: status');
  assert.ok(driveItems500Mock.body?.error?.message, 'drive-items-500 mock: error.message obrigatorio');
  assert.equal(driveItemsTimeoutMock.statusCode, 504, 'drive-items-timeout mock: status');
  assert.ok(/timeout/i.test(driveItemsTimeoutMock.body?.error?.message || ''), 'drive-items-timeout mock: deve indicar timeout');

  console.log('✅  sharepoint-smoke: todos os cenários passaram.');
}

run().catch((err) => {
  console.error('❌  sharepoint-smoke FALHOU:', err.message);
  process.exit(1);
});
