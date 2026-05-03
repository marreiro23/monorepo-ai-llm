import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphService } from '../../graph/graph.service.js';
import { TriggerSyncDto } from './dto/trigger-sync.dto.js';
import { SyncedDriveEntity } from './entities/synced-drive.entity.js';
import { SyncedGroupEntity } from './entities/synced-group.entity.js';
import { SyncedMailboxEntity } from './entities/synced-mailbox.entity.js';
import { SyncedOneDriveEntity } from './entities/synced-onedrive.entity.js';
import { SyncedSiteEntity } from './entities/synced-site.entity.js';
import { SyncedTeamChannelMessageEntity } from './entities/synced-team-channel-message.entity.js';
import { SyncedTeamChannelEntity } from './entities/synced-team-channel.entity.js';
import { SyncedTeamEntity } from './entities/synced-team.entity.js';
import { SyncedUserEntity } from './entities/synced-user.entity.js';
import { SyncJobEntity, SyncJobStatus } from './entities/sync-job.entity.js';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SyncJobEntity)
    private readonly syncJobRepo: Repository<SyncJobEntity>,
    @InjectRepository(SyncedSiteEntity)
    private readonly syncedSiteRepo: Repository<SyncedSiteEntity>,
    @InjectRepository(SyncedDriveEntity)
    private readonly syncedDriveRepo: Repository<SyncedDriveEntity>,
    @InjectRepository(SyncedUserEntity)
    private readonly syncedUserRepo: Repository<SyncedUserEntity>,
    @InjectRepository(SyncedGroupEntity)
    private readonly syncedGroupRepo: Repository<SyncedGroupEntity>,
    @InjectRepository(SyncedTeamEntity)
    private readonly syncedTeamRepo: Repository<SyncedTeamEntity>,
    @InjectRepository(SyncedTeamChannelEntity)
    private readonly syncedTeamChannelRepo: Repository<SyncedTeamChannelEntity>,
    @InjectRepository(SyncedTeamChannelMessageEntity)
    private readonly syncedTeamChannelMessageRepo: Repository<SyncedTeamChannelMessageEntity>,
    @InjectRepository(SyncedMailboxEntity)
    private readonly syncedMailboxRepo: Repository<SyncedMailboxEntity>,
    @InjectRepository(SyncedOneDriveEntity)
    private readonly syncedOneDriveRepo: Repository<SyncedOneDriveEntity>,
    private readonly graphService: GraphService,
  ) {}

  async triggerSync(dto: TriggerSyncDto) {
    if (dto.type === 'drives' && !dto.context) {
      throw new BadRequestException(
        'O campo "context" (siteId) é obrigatório para o tipo "drives".',
      );
    }

    const job = this.syncJobRepo.create({
      type: dto.type,
      status: 'pending',
      context: dto.context,
    });

    await this.syncJobRepo.save(job);
    await this.runJob(job);

    const updated = await this.syncJobRepo.findOneByOrFail({ id: job.id });
    return { success: true, data: updated };
  }

  async listJobs() {
    const jobs = await this.syncJobRepo.find({ order: { createdAt: 'DESC' } });
    return { success: true, data: jobs };
  }

  async getJob(id: string) {
    const job = await this.syncJobRepo.findOneBy({ id });
    if (!job) return { success: false, message: 'Sync job não encontrado.' };
    return { success: true, data: job };
  }

  async listSyncedSites() {
    const sites = await this.syncedSiteRepo.find({
      order: { syncedAt: 'DESC' },
    });
    return { success: true, data: sites };
  }

  async listSyncedDrives() {
    const drives = await this.syncedDriveRepo.find({
      order: { syncedAt: 'DESC' },
    });
    return { success: true, data: drives };
  }

  async listSyncedUsers() {
    const users = await this.syncedUserRepo.find({
      order: { syncedAt: 'DESC' },
    });
    return { success: true, data: users };
  }

  async listSyncedGroups() {
    const groups = await this.syncedGroupRepo.find({
      order: { syncedAt: 'DESC' },
    });
    return { success: true, data: groups };
  }

  async listSyncedTeams() {
    const teams = await this.syncedTeamRepo.find({
      order: { syncedAt: 'DESC' },
    });
    return { success: true, data: teams };
  }

  async listSyncedTeamChannels() {
    const channels = await this.syncedTeamChannelRepo.find({
      order: { syncedAt: 'DESC' },
    });
    return { success: true, data: channels };
  }

  async listSyncedTeamChannelMessages() {
    const messages = await this.syncedTeamChannelMessageRepo.find({
      order: { createdDateTime: 'DESC' },
      take: 200,
    });
    return { success: true, data: messages };
  }

  async listSyncedMailboxes() {
    const mailboxes = await this.syncedMailboxRepo.find({
      order: { syncedAt: 'DESC' },
    });
    return { success: true, data: mailboxes };
  }

  async listSyncedOneDrives() {
    const oneDrives = await this.syncedOneDriveRepo.find({
      order: { syncedAt: 'DESC' },
    });
    return { success: true, data: oneDrives };
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private async runJob(job: SyncJobEntity): Promise<void> {
    await this.syncJobRepo.update(job.id, {
      status: 'running',
      startedAt: new Date(),
    });

    try {
      let count = 0;

      switch (job.type) {
        case 'sites':
          count = await this.syncSites();
          break;
        case 'drives':
          count = await this.syncDrives(job.context!);
          break;
        case 'users':
          count = await this.syncUsers();
          break;
        case 'groups':
          count = await this.syncGroups();
          break;
        case 'teams':
          count = await this.syncTeams();
          break;
        case 'team-channels':
          count = await this.syncTeamChannels(job.context);
          break;
        case 'team-channel-messages':
          count = await this.syncTeamChannelMessages(job.context);
          break;
        case 'mailboxes':
          count = await this.syncMailboxes();
          break;
        case 'onedrives':
          count = await this.syncOneDrives(job.context);
          break;
      }

      await this.syncJobRepo.update(job.id, {
        status: 'completed',
        finishedAt: new Date(),
        itemCount: count,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.syncJobRepo.update(job.id, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: message,
      });
    }
  }

  private async syncSites(): Promise<number> {
    const result = await this.graphService.listSites(undefined, 50);
    const items: Record<string, unknown>[] = result.data as Record<
      string,
      unknown
    >[];

    for (const item of items) {
      const remoteId = this.requireRemoteId(item, 'site');
      await this.syncedSiteRepo.upsert(
        {
          remoteId,
          name: String(item['name'] || ''),
          displayName: String(item['displayName'] || ''),
          webUrl: String(item['webUrl'] || ''),
          rawData: item as any,
        },
        { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
      );
    }

    return items.length;
  }

  private async syncDrives(siteId: string): Promise<number> {
    const result = await this.graphService.listSiteDrives(siteId);
    const items: Record<string, unknown>[] = result.data as Record<
      string,
      unknown
    >[];

    for (const item of items) {
      const remoteId = this.requireRemoteId(item, 'drive');
      await this.syncedDriveRepo.upsert(
        {
          remoteId,
          siteRemoteId: siteId,
          name: String(item['name'] || ''),
          driveType: String(item['driveType'] || ''),
          webUrl: String(item['webUrl'] || ''),
          rawData: item as any,
        },
        { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
      );
    }

    return items.length;
  }

  private async syncUsers(): Promise<number> {
    const result = await this.graphService.listUsers(undefined, 50);
    const items: Record<string, unknown>[] = result.data as Record<
      string,
      unknown
    >[];

    for (const item of items) {
      const remoteId = this.requireRemoteId(item, 'user');
      await this.syncedUserRepo.upsert(
        {
          remoteId,
          displayName: String(item['displayName'] || ''),
          mail: String(item['mail'] || ''),
          userPrincipalName: String(item['userPrincipalName'] || ''),
          rawData: item as any,
        },
        { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
      );
    }

    return items.length;
  }

  private async syncGroups(): Promise<number> {
    const result = await this.graphService.listGroups(undefined, 50);
    const items: Record<string, unknown>[] = result.data as Record<
      string,
      unknown
    >[];

    for (const item of items) {
      const remoteId = this.requireRemoteId(item, 'group');
      await this.syncedGroupRepo.upsert(
        {
          remoteId,
          displayName: String(item['displayName'] || ''),
          mail: String(item['mail'] || ''),
          rawData: item as any,
        },
        { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
      );
    }

    return items.length;
  }

  private async syncTeams(): Promise<number> {
    const result = await this.graphService.listTeams(undefined, 50);
    const items: Record<string, unknown>[] = result.data as Record<
      string,
      unknown
    >[];

    for (const item of items) {
      const remoteId = this.requireRemoteId(item, 'team');
      await this.syncedTeamRepo.upsert(
        {
          remoteId,
          displayName: String(item['displayName'] || ''),
          description: String(item['description'] || ''),
          visibility: String(item['visibility'] || ''),
          rawData: item as any,
        },
        { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
      );
    }

    return items.length;
  }

  private async syncTeamChannels(teamId?: string | null): Promise<number> {
    const teams = teamId
      ? await this.syncedTeamRepo.find({ where: { remoteId: teamId }, take: 1 })
      : await this.syncedTeamRepo.find({
          order: { syncedAt: 'DESC' },
          take: 50,
        });
    let count = 0;

    for (const team of teams) {
      const result = await this.graphService.listTeamChannels(team.remoteId);
      const items: Record<string, unknown>[] = result.data as Record<
        string,
        unknown
      >[];

      for (const item of items) {
        const remoteId = this.requireRemoteId(item, 'team channel');
        await this.syncedTeamChannelRepo.upsert(
          {
            remoteId,
            teamRemoteId: team.remoteId,
            displayName: String(item['displayName'] || ''),
            description: String(item['description'] || ''),
            membershipType: String(item['membershipType'] || ''),
            webUrl: String(item['webUrl'] || ''),
            rawData: item as any,
          },
          { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
        );
        count += 1;
      }
    }

    return count;
  }

  private async syncTeamChannelMessages(
    context?: string | null,
  ): Promise<number> {
    const channelPairs = await this.resolveChannelMessageContext(context);
    let count = 0;

    for (const pair of channelPairs) {
      const result = await this.graphService.listTeamChannelMessages(
        pair.teamRemoteId,
        pair.channelRemoteId,
        50,
      );
      const items: Record<string, unknown>[] = result.data as Record<
        string,
        unknown
      >[];

      for (const item of items) {
        const remoteId = await this.persistTeamChannelMessage(
          pair.teamRemoteId,
          pair.channelRemoteId,
          item,
        );
        count += 1;

        const repliesResult =
          await this.graphService.listTeamChannelMessageReplies(
            pair.teamRemoteId,
            pair.channelRemoteId,
            remoteId,
            50,
          );
        const replies: Record<string, unknown>[] = repliesResult.data as Record<
          string,
          unknown
        >[];
        for (const reply of replies) {
          await this.persistTeamChannelMessage(
            pair.teamRemoteId,
            pair.channelRemoteId,
            reply,
            remoteId,
          );
          count += 1;
        }
      }
    }

    return count;
  }

  private async persistTeamChannelMessage(
    teamRemoteId: string,
    channelRemoteId: string,
    item: Record<string, unknown>,
    fallbackReplyToId?: string,
  ): Promise<string> {
    const remoteId = this.requireRemoteId(item, 'team channel message');
    const from = item['from'] as Record<string, any> | undefined;
    const user = from?.['user'] as Record<string, unknown> | undefined;
    const body = item['body'] as Record<string, unknown> | undefined;

    await this.syncedTeamChannelMessageRepo.upsert(
      {
        remoteId,
        teamRemoteId,
        channelRemoteId,
        replyToId:
          String(item['replyToId'] || fallbackReplyToId || '') || undefined,
        messageType: String(item['messageType'] || ''),
        subject: String(item['subject'] || '') || undefined,
        bodyContentType: String(body?.['contentType'] || ''),
        bodyContent: String(body?.['content'] || ''),
        fromDisplayName: String(
          user?.['displayName'] || from?.['application']?.['displayName'] || '',
        ),
        fromUserId: String(user?.['id'] || ''),
        createdDateTime: this.parseDate(item['createdDateTime']),
        lastModifiedDateTime: this.parseDate(item['lastModifiedDateTime']),
        rawData: item as any,
      },
      { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
    );

    return remoteId;
  }

  private async syncMailboxes(): Promise<number> {
    const result = await this.graphService.listUsers(undefined, 50);
    const items: Record<string, unknown>[] = (
      result.data as Record<string, unknown>[]
    ).filter(
      (item) =>
        String(item['mail'] || item['userPrincipalName'] || '').trim().length >
        0,
    );

    for (const item of items) {
      const remoteId = this.requireRemoteId(item, 'mailbox');
      await this.syncedMailboxRepo.upsert(
        {
          remoteId,
          displayName: String(item['displayName'] || ''),
          mail: String(item['mail'] || ''),
          userPrincipalName: String(item['userPrincipalName'] || ''),
          rawData: item as any,
        },
        { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
      );
    }

    return items.length;
  }

  private async syncOneDrives(userId?: string | null): Promise<number> {
    const users = userId
      ? await this.syncedUserRepo.find({ where: { remoteId: userId }, take: 1 })
      : await this.syncedUserRepo.find({
          order: { syncedAt: 'DESC' },
          take: 50,
        });
    let count = 0;

    for (const user of users) {
      try {
        const result = await this.graphService.getUserDrive(user.remoteId);
        const item = result.data as Record<string, unknown>;
        const remoteId = this.requireRemoteId(item, 'onedrive');

        await this.syncedOneDriveRepo.upsert(
          {
            remoteId,
            userRemoteId: user.remoteId,
            userPrincipalName: user.userPrincipalName,
            name: String(item['name'] || ''),
            driveType: String(item['driveType'] || ''),
            webUrl: String(item['webUrl'] || ''),
            rawData: item as any,
          },
          { conflictPaths: ['remoteId'], skipUpdateIfNoValuesChanged: false },
        );
        count += 1;
      } catch {
        // Some users do not have a provisioned OneDrive or the app lacks per-user drive visibility.
      }
    }

    return count;
  }

  private requireRemoteId(
    item: Record<string, unknown>,
    entityName: string,
  ): string {
    const remoteId = String(item['id'] || '').trim();
    if (!remoteId) {
      throw new BadRequestException(
        `Graph retornou ${entityName} sem id; sync abortado para evitar sobrescrita de dados.`,
      );
    }
    return remoteId;
  }

  private async resolveChannelMessageContext(
    context?: string | null,
  ): Promise<Array<{ teamRemoteId: string; channelRemoteId: string }>> {
    if (context?.includes(':')) {
      const [teamRemoteId, channelRemoteId] = context
        .split(':')
        .map((value) => value.trim());
      if (!teamRemoteId || !channelRemoteId) {
        throw new BadRequestException(
          'Contexto para mensagens deve usar o formato teamId:channelId.',
        );
      }
      return [{ teamRemoteId, channelRemoteId }];
    }

    if (context) {
      const channels = await this.syncedTeamChannelRepo.find({
        where: { teamRemoteId: context },
        take: 50,
      });
      return channels.map((channel) => ({
        teamRemoteId: channel.teamRemoteId,
        channelRemoteId: channel.remoteId,
      }));
    }

    const channels = await this.syncedTeamChannelRepo.find({
      order: { syncedAt: 'DESC' },
      take: 50,
    });
    return channels.map((channel) => ({
      teamRemoteId: channel.teamRemoteId,
      channelRemoteId: channel.remoteId,
    }));
  }

  private parseDate(value: unknown): Date | undefined {
    const raw = String(value || '').trim();
    if (!raw) return undefined;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
