/**
 * sync-typeorm-smoke.mjs
 * Smoke test com banco real para o domínio sync.
 * Valida criação, leitura e limpeza de sync_jobs, synced_sites, synced_users e synced_groups.
 * Requer PG_* configurados.
 */

import 'reflect-metadata';
import { SyncJobEntity } from '../../apps/api/dist/modules/sync/entities/sync-job.entity.js';
import { SyncedSiteEntity } from '../../apps/api/dist/modules/sync/entities/synced-site.entity.js';
import { SyncedUserEntity } from '../../apps/api/dist/modules/sync/entities/synced-user.entity.js';
import { SyncedGroupEntity } from '../../apps/api/dist/modules/sync/entities/synced-group.entity.js';
import { SyncedDriveEntity } from '../../apps/api/dist/modules/sync/entities/synced-drive.entity.js';
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

const jobRepo = dataSource.getRepository(SyncJobEntity);
const siteRepo = dataSource.getRepository(SyncedSiteEntity);
const userRepo = dataSource.getRepository(SyncedUserEntity);
const groupRepo = dataSource.getRepository(SyncedGroupEntity);
const teamRepo = dataSource.getRepository(SyncedTeamEntity);
const channelRepo = dataSource.getRepository(SyncedTeamChannelEntity);
const channelMessageRepo = dataSource.getRepository(SyncedTeamChannelMessageEntity);
const mailboxRepo = dataSource.getRepository(SyncedMailboxEntity);
const oneDriveRepo = dataSource.getRepository(SyncedOneDriveEntity);

const createdIds = { jobs: [], sites: [], users: [], groups: [], teams: [], channels: [], channelMessages: [], mailboxes: [], oneDrives: [] };

try {
  // --- sync_jobs: criar, ler, listar ---
  const job = await jobRepo.save(jobRepo.create({ type: 'sites', status: 'pending' }));
  createdIds.jobs.push(job.id);
  const found = await jobRepo.findOneByOrFail({ id: job.id });
  const listed = await jobRepo.find({ order: { createdAt: 'DESC' } });

  // --- synced_sites: upsert e leitura ---
  const remoteId = `smoke-site-${Date.now()}`;
  await siteRepo.upsert(
    { remoteId, name: 'Smoke Site', displayName: 'Smoke Site Display', webUrl: 'https://example.com' },
    { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: true }
  );
  const site = await siteRepo.findOneByOrFail({ remoteId });
  createdIds.sites.push(site.id);

  // --- synced_users: upsert e leitura ---
  const userRemoteId = `smoke-user-${Date.now()}`;
  await userRepo.upsert(
    { remoteId: userRemoteId, displayName: 'Smoke User', mail: 'smoke@example.com', userPrincipalName: 'smoke@example.com' },
    { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: true }
  );
  const user = await userRepo.findOneByOrFail({ remoteId: userRemoteId });
  createdIds.users.push(user.id);

  // --- synced_groups: upsert e leitura ---
  const groupRemoteId = `smoke-group-${Date.now()}`;
  await groupRepo.upsert(
    { remoteId: groupRemoteId, displayName: 'Smoke Group', mail: 'smoke-group@example.com' },
    { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: true }
  );
  const group = await groupRepo.findOneByOrFail({ remoteId: groupRemoteId });
  createdIds.groups.push(group.id);

  const teamRemoteId = `smoke-team-${Date.now()}`;
  await teamRepo.upsert(
    { remoteId: teamRemoteId, displayName: 'Smoke Team', visibility: 'private' },
    { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: true }
  );
  const team = await teamRepo.findOneByOrFail({ remoteId: teamRemoteId });
  createdIds.teams.push(team.id);

  const channelRemoteId = `smoke-channel-${Date.now()}`;
  await channelRepo.upsert(
    { remoteId: channelRemoteId, teamRemoteId, displayName: 'Smoke Channel', membershipType: 'standard' },
    { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: true }
  );
  const channel = await channelRepo.findOneByOrFail({ remoteId: channelRemoteId });
  createdIds.channels.push(channel.id);

  const channelMessageRemoteId = `smoke-channel-message-${Date.now()}`;
  await channelMessageRepo.upsert(
    {
      remoteId: channelMessageRemoteId,
      teamRemoteId,
      channelRemoteId,
      messageType: 'message',
      bodyContentType: 'html',
      bodyContent: '<p>Smoke Teams message</p>',
      fromDisplayName: 'Smoke Sender',
      createdDateTime: new Date()
    },
    { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: true }
  );
  const channelMessage = await channelMessageRepo.findOneByOrFail({ remoteId: channelMessageRemoteId });
  createdIds.channelMessages.push(channelMessage.id);

  const mailboxRemoteId = `smoke-mailbox-${Date.now()}`;
  await mailboxRepo.upsert(
    { remoteId: mailboxRemoteId, displayName: 'Smoke Mailbox', mail: 'mailbox@example.com', userPrincipalName: 'mailbox@example.com' },
    { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: true }
  );
  const mailbox = await mailboxRepo.findOneByOrFail({ remoteId: mailboxRemoteId });
  createdIds.mailboxes.push(mailbox.id);

  const oneDriveRemoteId = `smoke-onedrive-${Date.now()}`;
  await oneDriveRepo.upsert(
    { remoteId: oneDriveRemoteId, userRemoteId: userRemoteId, userPrincipalName: 'smoke@example.com', name: 'OneDrive', driveType: 'business' },
    { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: true }
  );
  const oneDrive = await oneDriveRepo.findOneByOrFail({ remoteId: oneDriveRemoteId });
  createdIds.oneDrives.push(oneDrive.id);

  console.log(
    JSON.stringify(
      {
        syncJob: { id: found.id, type: found.type, status: found.status },
        totalJobs: listed.length,
        syncedSite: { id: site.id, remoteId: site.remoteId, name: site.name },
        syncedUser: { id: user.id, remoteId: user.remoteId, displayName: user.displayName },
        syncedGroup: { id: group.id, remoteId: group.remoteId, displayName: group.displayName },
        syncedTeam: { id: team.id, remoteId: team.remoteId, displayName: team.displayName },
        syncedTeamChannel: { id: channel.id, remoteId: channel.remoteId, displayName: channel.displayName },
        syncedTeamChannelMessage: { id: channelMessage.id, remoteId: channelMessage.remoteId, fromDisplayName: channelMessage.fromDisplayName },
        syncedMailbox: { id: mailbox.id, remoteId: mailbox.remoteId, mail: mailbox.mail },
        syncedOneDrive: { id: oneDrive.id, remoteId: oneDrive.remoteId, driveType: oneDrive.driveType }
      },
      null,
      2
    )
  );

  console.log('\n✅ Smoke test sync (banco real) passou com sucesso.');
} finally {
  // --- limpeza ---
  for (const id of createdIds.jobs) await jobRepo.delete({ id });
  for (const id of createdIds.sites) await siteRepo.delete({ id });
  for (const id of createdIds.users) await userRepo.delete({ id });
  for (const id of createdIds.groups) await groupRepo.delete({ id });
  for (const id of createdIds.teams) await teamRepo.delete({ id });
  for (const id of createdIds.channels) await channelRepo.delete({ id });
  for (const id of createdIds.channelMessages) await channelMessageRepo.delete({ id });
  for (const id of createdIds.mailboxes) await mailboxRepo.delete({ id });
  for (const id of createdIds.oneDrives) await oneDriveRepo.delete({ id });

  await dataSource.destroy();
}
