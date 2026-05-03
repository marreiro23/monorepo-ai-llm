#!/usr/bin/env node

import '../utils/load-env.mjs';
import 'reflect-metadata';
import { ClientCertificateCredential } from '@azure/identity';
import { resolve } from 'node:path';
import { M365ObjectOperationEntity } from '../../apps/api/dist/modules/m365-migration/entities/m365-object-operation.entity.js';
import { M365ObjectPermissionSnapshotEntity } from '../../apps/api/dist/modules/m365-migration/entities/m365-object-permission-snapshot.entity.js';
import { createMainDataSource } from '../utils/typeorm-env.mjs';

const EXPECTED_ROLE_SETS = {
  teamsFullContent: ['Channel.ReadBasic.All', 'ChannelMessage.Read.All'],
  teamsMembers: ['ChannelMember.Read.All', 'ChannelMember.ReadWrite.All'],
  sharePointSites: ['Sites.FullControl.All', 'Sites.ReadWrite.All'],
  oneDrive: ['Files.ReadWrite.All'],
  mailboxes: ['Mail.ReadWrite', 'MailboxSettings.ReadWrite'],
  globalAddressLists: ['Exchange.ManageAsApp']
};

function decodeJwtPayload(token) {
  return JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

function hasAnyRole(roles, candidates) {
  return candidates.some((role) => roles.includes(role));
}

const credential = new ClientCertificateCredential(process.env.TENANT_ID, process.env.CLIENT_ID, {
  certificatePath: resolve(process.cwd(), process.env.CERT_PRIVATE_KEY_PATH)
});
const token = await credential.getToken(['https://graph.microsoft.com/.default']);
const payload = decodeJwtPayload(token.token);
const roles = payload.roles || [];
const readiness = Object.fromEntries(
  Object.entries(EXPECTED_ROLE_SETS).map(([key, candidates]) => [key, {
    passed: hasAnyRole(roles, candidates),
    acceptedRoles: candidates,
    presentRoles: candidates.filter((role) => roles.includes(role))
  }])
);

const dataSource = await createMainDataSource([
  M365ObjectOperationEntity,
  M365ObjectPermissionSnapshotEntity
]);
const operationRepo = dataSource.getRepository(M365ObjectOperationEntity);

try {
  const operations = [
    {
      objectType: 'teams-channel',
      action: 'read',
      targetDisplayName: 'Teams full channel content dry-run',
      requiredPermissions: ['Channel.ReadBasic.All', 'ChannelMessage.Read.All'],
      requestPayload: { includesReplies: true, liveMutation: false },
      rollbackHint: { required: false }
    },
    {
      objectType: 'teams-channel-member',
      action: 'add-member',
      status: readiness.teamsMembers.passed ? 'planned' : 'blocked',
      targetDisplayName: 'Teams channel member add dry-run',
      requiredPermissions: ['ChannelMember.ReadWrite.All'],
      requestPayload: { dryRunOnly: true, requiresTestPrivateOrSharedChannel: true },
      rollbackHint: { action: 'remove-member', requiresConversationMemberId: true }
    },
    {
      objectType: 'teams-channel-member',
      action: 'remove-member',
      status: readiness.teamsMembers.passed ? 'planned' : 'blocked',
      targetDisplayName: 'Teams channel member remove dry-run',
      requiredPermissions: ['ChannelMember.ReadWrite.All'],
      requestPayload: { dryRunOnly: true, requiresExistingTestMember: true },
      rollbackHint: { action: 'add-member', requiresUserId: true }
    },
    {
      objectType: 'sharepoint-drive-item',
      action: 'grant-permission',
      targetDisplayName: 'SharePoint/OneDrive permission grant dry-run',
      requiredPermissions: ['Files.ReadWrite.All', 'Sites.FullControl.All'],
      requestPayload: { dryRunOnly: true, operation: 'driveItem invite' },
      rollbackHint: { action: 'revoke-permission', requiresPermissionId: true }
    },
    {
      objectType: 'global-address-list',
      action: 'update',
      status: readiness.globalAddressLists.passed ? 'planned' : 'blocked',
      targetDisplayName: 'Exchange GAL update dry-run',
      requiredPermissions: ['Exchange.ManageAsApp', 'Exchange Address Lists role'],
      requestPayload: { dryRunOnly: true, cmdlet: 'Set-GlobalAddressList -WhatIf' },
      rollbackHint: { action: 'restore previous GAL filter', source: 'operation history snapshot' }
    }
  ];

  const saved = [];
  for (const operation of operations) {
    saved.push(await operationRepo.save(operationRepo.create({
      tenantRole: 'source',
      mode: 'dry-run',
      status: operation.status || 'planned',
      ...operation
    })));
  }

  console.log(JSON.stringify({
    appid: payload.appid,
    tid: payload.tid,
    readiness,
    savedOperations: saved.map((item) => ({
      id: item.id,
      objectType: item.objectType,
      action: item.action,
      mode: item.mode,
      status: item.status
    }))
  }, null, 2));

  const failedRequiredReadiness = ['teamsFullContent', 'sharePointSites', 'oneDrive', 'mailboxes'].filter((key) => !readiness[key].passed);
  if (failedRequiredReadiness.length > 0) {
    throw new Error(`Readiness obrigatoria falhou: ${failedRequiredReadiness.join(', ')}`);
  }
} finally {
  await dataSource.destroy();
}
