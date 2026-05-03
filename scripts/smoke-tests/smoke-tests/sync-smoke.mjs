/**
 * sync-smoke.mjs
 * Smoke test sem rede para o domínio sync (Graph -> PostgreSQL).
 * Valida contratos do service com stubs em memória.
 */

import assert from 'node:assert/strict';

class InMemoryRepo {
  #items = [];

  create(data) {
    return { ...data };
  }

  async save(entity) {
    if (!entity.id) {
      entity.id = `id-${Math.random().toString(16).slice(2)}`;
    }

    const index = this.#items.findIndex((item) => item.id === entity.id);
    if (index >= 0) {
      this.#items[index] = { ...this.#items[index], ...entity };
    } else {
      this.#items.push({ ...entity });
    }

    return entity;
  }

  async update(id, patch) {
    const index = this.#items.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.#items[index] = { ...this.#items[index], ...patch };
    }
  }

  async find(options = {}) {
    const data = [...this.#items];
    if (options.order?.createdAt === 'DESC') {
      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    if (options.order?.syncedAt === 'DESC') {
      data.sort((a, b) => new Date(b.syncedAt || 0).getTime() - new Date(a.syncedAt || 0).getTime());
    }
    return data;
  }

  async findOneBy(filter) {
    return this.#items.find((item) => Object.entries(filter).every(([k, v]) => item[k] === v)) || null;
  }

  async findOneByOrFail(filter) {
    const item = await this.findOneBy(filter);
    if (!item) throw new Error('Item not found');
    return item;
  }

  async upsert(payload, options) {
    const conflictKey = options?.conflictPaths?.[0] || 'id';
    const index = this.#items.findIndex((item) => item[conflictKey] === payload[conflictKey]);

    if (index >= 0) {
      this.#items[index] = { ...this.#items[index], ...payload, syncedAt: new Date().toISOString() };
    } else {
      this.#items.push({ ...payload, id: `id-${Math.random().toString(16).slice(2)}`, syncedAt: new Date().toISOString() });
    }
  }
}

class SyncServiceStub {
  constructor(graphService) {
    this.graphService = graphService;
    this.syncJobRepo = new InMemoryRepo();
    this.syncedSiteRepo = new InMemoryRepo();
    this.syncedDriveRepo = new InMemoryRepo();
    this.syncedUserRepo = new InMemoryRepo();
    this.syncedGroupRepo = new InMemoryRepo();
  }

  async createJob(dto) {
    if (dto.type === 'drives' && !dto.context) {
      throw new Error('O campo "context" (siteId) e obrigatorio para o tipo "drives".');
    }

    const job = this.syncJobRepo.create({
      type: dto.type,
      status: 'pending',
      context: dto.context,
      createdAt: new Date().toISOString()
    });

    await this.syncJobRepo.save(job);
    await this.runJob(job);

    return { success: true, data: await this.syncJobRepo.findOneByOrFail({ id: job.id }) };
  }

  async listJobs() {
    return { success: true, data: await this.syncJobRepo.find({ order: { createdAt: 'DESC' } }) };
  }

  async getJob(id) {
    const job = await this.syncJobRepo.findOneBy({ id });
    if (!job) return { success: false, message: 'Sync job nao encontrado.' };
    return { success: true, data: job };
  }

  async listSyncedSites() {
    return { success: true, data: await this.syncedSiteRepo.find({ order: { syncedAt: 'DESC' } }) };
  }

  async listSyncedDrives() {
    return { success: true, data: await this.syncedDriveRepo.find({ order: { syncedAt: 'DESC' } }) };
  }

  async listSyncedUsers() {
    return { success: true, data: await this.syncedUserRepo.find({ order: { syncedAt: 'DESC' } }) };
  }

  async listSyncedGroups() {
    return { success: true, data: await this.syncedGroupRepo.find({ order: { syncedAt: 'DESC' } }) };
  }

  async runJob(job) {
    await this.syncJobRepo.update(job.id, { status: 'running', startedAt: new Date().toISOString() });

    try {
      let count = 0;
      if (job.type === 'sites') count = await this.syncSites();
      if (job.type === 'drives') count = await this.syncDrives(job.context);
      if (job.type === 'users') count = await this.syncUsers();
      if (job.type === 'groups') count = await this.syncGroups();

      await this.syncJobRepo.update(job.id, {
        status: 'completed',
        finishedAt: new Date().toISOString(),
        itemCount: count
      });
    } catch (error) {
      await this.syncJobRepo.update(job.id, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async syncSites() {
    const items = (await this.graphService.listSites()).data;
    for (const item of items) {
      await this.syncedSiteRepo.upsert(
        {
          remoteId: String(item.id || ''),
          name: String(item.name || ''),
          displayName: String(item.displayName || ''),
          webUrl: String(item.webUrl || ''),
          rawData: item
        },
        { conflictPaths: ['remoteId'] }
      );
    }
    return items.length;
  }

  async syncDrives(siteId) {
    const items = (await this.graphService.listSiteDrives(siteId)).data;
    for (const item of items) {
      await this.syncedDriveRepo.upsert(
        {
          remoteId: String(item.id || ''),
          siteRemoteId: siteId,
          name: String(item.name || ''),
          driveType: String(item.driveType || ''),
          webUrl: String(item.webUrl || ''),
          rawData: item
        },
        { conflictPaths: ['remoteId'] }
      );
    }
    return items.length;
  }

  async syncUsers() {
    const items = (await this.graphService.listUsers()).data;
    for (const item of items) {
      await this.syncedUserRepo.upsert(
        {
          remoteId: String(item.id || ''),
          displayName: String(item.displayName || ''),
          mail: String(item.mail || ''),
          userPrincipalName: String(item.userPrincipalName || ''),
          rawData: item
        },
        { conflictPaths: ['remoteId'] }
      );
    }
    return items.length;
  }

  async syncGroups() {
    const items = (await this.graphService.listGroups()).data;
    for (const item of items) {
      await this.syncedGroupRepo.upsert(
        {
          remoteId: String(item.id || ''),
          displayName: String(item.displayName || ''),
          mail: String(item.mail || ''),
          rawData: item
        },
        { conflictPaths: ['remoteId'] }
      );
    }
    return items.length;
  }
}

async function run() {
  const graphStub = {
    async listSites() {
      return { data: [{ id: 'site-1', name: 'Site 1', displayName: 'Site One', webUrl: 'https://sp/site-1' }] };
    },
    async listSiteDrives(siteId) {
      if (!siteId) throw new Error('siteId nao informado');
      return { data: [{ id: 'drive-1', name: 'Docs', driveType: 'documentLibrary', webUrl: 'https://sp/site-1/docs' }] };
    },
    async listUsers() {
      return { data: [{ id: 'user-1', displayName: 'User 1', mail: 'user1@contoso.com', userPrincipalName: 'user1@contoso.com' }] };
    },
    async listGroups() {
      return { data: [{ id: 'group-1', displayName: 'Group 1', mail: 'group1@contoso.com' }] };
    }
  };

  const svc = new SyncServiceStub(graphStub);

  const sitesJob = await svc.createJob({ type: 'sites' });
  assert.equal(sitesJob.success, true, 'createJob(sites): success');
  assert.equal(sitesJob.data.status, 'completed', 'createJob(sites): completed');
  assert.equal(sitesJob.data.itemCount, 1, 'createJob(sites): itemCount');

  const drivesJob = await svc.createJob({ type: 'drives', context: 'site-1' });
  assert.equal(drivesJob.success, true, 'createJob(drives): success');
  assert.equal(drivesJob.data.status, 'completed', 'createJob(drives): completed');

  const usersJob = await svc.createJob({ type: 'users' });
  assert.equal(usersJob.success, true, 'createJob(users): success');

  const groupsJob = await svc.createJob({ type: 'groups' });
  assert.equal(groupsJob.success, true, 'createJob(groups): success');

  const jobs = await svc.listJobs();
  assert.equal(jobs.success, true, 'listJobs: success');
  assert.ok(jobs.data.length >= 4, 'listJobs: contains jobs');

  const oneJob = await svc.getJob(sitesJob.data.id);
  assert.equal(oneJob.success, true, 'getJob(found): success');

  const missingJob = await svc.getJob('missing-id');
  assert.equal(missingJob.success, false, 'getJob(missing): returns false');

  const sites = await svc.listSyncedSites();
  const drives = await svc.listSyncedDrives();
  const users = await svc.listSyncedUsers();
  const groups = await svc.listSyncedGroups();

  assert.equal(sites.success, true, 'listSyncedSites: success');
  assert.equal(drives.success, true, 'listSyncedDrives: success');
  assert.equal(users.success, true, 'listSyncedUsers: success');
  assert.equal(groups.success, true, 'listSyncedGroups: success');

  assert.equal(sites.data.length, 1, 'listSyncedSites: length');
  assert.equal(drives.data.length, 1, 'listSyncedDrives: length');
  assert.equal(users.data.length, 1, 'listSyncedUsers: length');
  assert.equal(groups.data.length, 1, 'listSyncedGroups: length');

  let contextError = null;
  try {
    await svc.createJob({ type: 'drives' });
  } catch (error) {
    contextError = error;
  }
  assert.ok(contextError instanceof Error, 'createJob(drives sem context): falha esperada');

  const graphFailStub = {
    ...graphStub,
    async listGroups() {
      throw new Error('Graph groups unavailable');
    }
  };
  const failingSvc = new SyncServiceStub(graphFailStub);
  const failed = await failingSvc.createJob({ type: 'groups' });
  assert.equal(failed.success, true, 'createJob(groups fail): request handled');
  assert.equal(failed.data.status, 'failed', 'createJob(groups fail): job failed');

  console.log('✅  sync-smoke: todos os cenarios passaram.');
}

run().catch((err) => {
  console.error('❌  sync-smoke FALHOU:', err.message);
  process.exit(1);
});
