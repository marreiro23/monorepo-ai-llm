#!/usr/bin/env node

import '../utils/load-env.mjs';
import 'reflect-metadata';
import { EntraRegistrationService } from '../../apps/api/dist/modules/graph/services/entra-registration.service.js';
import { GraphService } from '../../apps/api/dist/modules/graph/graph.service.js';
import { SyncService } from '../../apps/api/dist/modules/sync/sync.service.js';
import { SyncJobEntity } from '../../apps/api/dist/modules/sync/entities/sync-job.entity.js';
import { SyncedSiteEntity } from '../../apps/api/dist/modules/sync/entities/synced-site.entity.js';
import { SyncedDriveEntity } from '../../apps/api/dist/modules/sync/entities/synced-drive.entity.js';
import { SyncedUserEntity } from '../../apps/api/dist/modules/sync/entities/synced-user.entity.js';
import { SyncedGroupEntity } from '../../apps/api/dist/modules/sync/entities/synced-group.entity.js';
import { SyncedTeamEntity } from '../../apps/api/dist/modules/sync/entities/synced-team.entity.js';
import { SyncedTeamChannelEntity } from '../../apps/api/dist/modules/sync/entities/synced-team-channel.entity.js';
import { SyncedTeamChannelMessageEntity } from '../../apps/api/dist/modules/sync/entities/synced-team-channel-message.entity.js';
import { SyncedMailboxEntity } from '../../apps/api/dist/modules/sync/entities/synced-mailbox.entity.js';
import { SyncedOneDriveEntity } from '../../apps/api/dist/modules/sync/entities/synced-onedrive.entity.js';
import { createMainDataSource } from '../utils/typeorm-env.mjs';

const dataSource = await createMainDataSource([
  SyncJobEntity,
  SyncedSiteEntity,
  SyncedDriveEntity,
  SyncedUserEntity,
  SyncedGroupEntity,
  SyncedTeamEntity,
  SyncedTeamChannelEntity,
  SyncedTeamChannelMessageEntity,
  SyncedMailboxEntity,
  SyncedOneDriveEntity
]);

const syncJobRepo = dataSource.getRepository(SyncJobEntity);
const syncedSiteRepo = dataSource.getRepository(SyncedSiteEntity);
const syncedDriveRepo = dataSource.getRepository(SyncedDriveEntity);
const syncedUserRepo = dataSource.getRepository(SyncedUserEntity);
const syncedGroupRepo = dataSource.getRepository(SyncedGroupEntity);
const syncedTeamRepo = dataSource.getRepository(SyncedTeamEntity);
const syncedTeamChannelRepo = dataSource.getRepository(SyncedTeamChannelEntity);
const syncedTeamChannelMessageRepo = dataSource.getRepository(SyncedTeamChannelMessageEntity);
const syncedMailboxRepo = dataSource.getRepository(SyncedMailboxEntity);
const syncedOneDriveRepo = dataSource.getRepository(SyncedOneDriveEntity);

const entraRegistrationService = new EntraRegistrationService();
const graphService = new GraphService(entraRegistrationService);
const syncService = new SyncService(
  syncJobRepo,
  syncedSiteRepo,
  syncedDriveRepo,
  syncedUserRepo,
  syncedGroupRepo,
  syncedTeamRepo,
  syncedTeamChannelRepo,
  syncedTeamChannelMessageRepo,
  syncedMailboxRepo,
  syncedOneDriveRepo,
  graphService
);

try {
  await entraRegistrationService.authenticate();

  const authConfig = entraRegistrationService.getConfig();
  const sitesJob = await syncService.triggerSync({ type: 'sites' });
  const usersJob = await syncService.triggerSync({ type: 'users' });
  const groupsJob = await syncService.triggerSync({ type: 'groups' });
  const teamsJob = await syncService.triggerSync({ type: 'teams' });
  const teamChannelsJob = await syncService.triggerSync({ type: 'team-channels' });
  const teamChannelMessagesJob = await syncService.triggerSync({ type: 'team-channel-messages' });
  const mailboxesJob = await syncService.triggerSync({ type: 'mailboxes' });

  const firstSite = (await syncedSiteRepo.find({
    order: {
      syncedAt: 'DESC'
    },
    take: 1
  }))[0] ?? null;

  let drivesJob = null;
  if (firstSite?.remoteId) {
    drivesJob = await syncService.triggerSync({ type: 'drives', context: firstSite.remoteId });
  }
  const oneDrivesJob = await syncService.triggerSync({ type: 'onedrives' });

  const [siteCount, driveCount, userCount, groupCount, teamCount, teamChannelCount, teamChannelMessageCount, mailboxCount, oneDriveCount] = await Promise.all([
    syncedSiteRepo.count(),
    syncedDriveRepo.count(),
    syncedUserRepo.count(),
    syncedGroupRepo.count(),
    syncedTeamRepo.count(),
    syncedTeamChannelRepo.count(),
    syncedTeamChannelMessageRepo.count(),
    syncedMailboxRepo.count(),
    syncedOneDriveRepo.count()
  ]);

  const latestJobs = await syncJobRepo.find({
    order: {
      createdAt: 'DESC'
    },
    take: 8
  });

  console.log(
    JSON.stringify(
      {
        auth: {
          authMethod: authConfig.authMethod,
          isAuthenticated: authConfig.isAuthenticated,
          graphBaseUrl: authConfig.graphBaseUrl,
          scope: authConfig.scope
        },
        jobs: {
          sites: sitesJob.data,
          users: usersJob.data,
          groups: groupsJob.data,
          teams: teamsJob.data,
          teamChannels: teamChannelsJob.data,
          teamChannelMessages: teamChannelMessagesJob.data,
          mailboxes: mailboxesJob.data,
          drives: drivesJob?.data ?? null,
          oneDrives: oneDrivesJob.data
        },
        persisted: {
          sites: siteCount,
          drives: driveCount,
          users: userCount,
          groups: groupCount,
          teams: teamCount,
          teamChannels: teamChannelCount,
          teamChannelMessages: teamChannelMessageCount,
          mailboxes: mailboxCount,
          oneDrives: oneDriveCount
        },
        latestJobs: latestJobs.map((job) => ({
          id: job.id,
          type: job.type,
          status: job.status,
          itemCount: job.itemCount,
          hasError: Boolean(job.errorMessage)
        }))
      },
      null,
      2
    )
  );

  const failedJobs = [sitesJob.data, usersJob.data, groupsJob.data, teamsJob.data, teamChannelsJob.data, teamChannelMessagesJob.data, mailboxesJob.data, drivesJob?.data, oneDrivesJob.data]
    .filter(Boolean)
    .filter((job) => job.status !== 'completed');

  if (failedJobs.length > 0) {
    throw new Error(`Graph live sync finished with failed jobs: ${failedJobs.map((job) => job.type).join(', ')}`);
  }
} finally {
  await dataSource.destroy();
}
