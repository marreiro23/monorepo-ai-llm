import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TriggerSyncDto } from './dto/trigger-sync.dto.js';
import { SyncService } from './sync.service.js';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('jobs')
  triggerSync(@Body() dto: TriggerSyncDto) {
    return this.syncService.triggerSync(dto);
  }

  @Get('jobs')
  listJobs() {
    return this.syncService.listJobs();
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.syncService.getJob(id);
  }

  @Get('sites')
  listSyncedSites() {
    return this.syncService.listSyncedSites();
  }

  @Get('drives')
  listSyncedDrives() {
    return this.syncService.listSyncedDrives();
  }

  @Get('users')
  listSyncedUsers() {
    return this.syncService.listSyncedUsers();
  }

  @Get('groups')
  listSyncedGroups() {
    return this.syncService.listSyncedGroups();
  }

  @Get('teams')
  listSyncedTeams() {
    return this.syncService.listSyncedTeams();
  }

  @Get('team-channels')
  listSyncedTeamChannels() {
    return this.syncService.listSyncedTeamChannels();
  }

  @Get('team-channel-messages')
  listSyncedTeamChannelMessages() {
    return this.syncService.listSyncedTeamChannelMessages();
  }

  @Get('mailboxes')
  listSyncedMailboxes() {
    return this.syncService.listSyncedMailboxes();
  }

  @Get('onedrives')
  listSyncedOneDrives() {
    return this.syncService.listSyncedOneDrives();
  }
}
