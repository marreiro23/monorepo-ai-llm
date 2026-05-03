import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphModule } from '../../graph/graph.module.js';
import { SyncedDriveEntity } from './entities/synced-drive.entity.js';
import { SyncedGroupEntity } from './entities/synced-group.entity.js';
import { SyncedMailboxEntity } from './entities/synced-mailbox.entity.js';
import { SyncedOneDriveEntity } from './entities/synced-onedrive.entity.js';
import { SyncedSiteEntity } from './entities/synced-site.entity.js';
import { SyncedTeamEntity } from './entities/synced-team.entity.js';
import { SyncedTeamChannelEntity } from './entities/synced-team-channel.entity.js';
import { SyncedTeamChannelMessageEntity } from './entities/synced-team-channel-message.entity.js';
import { SyncedUserEntity } from './entities/synced-user.entity.js';
import { SyncJobEntity } from './entities/sync-job.entity.js';
import { SyncController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

const syncEntities = [
  SyncJobEntity,
  SyncedSiteEntity,
  SyncedDriveEntity,
  SyncedUserEntity,
  SyncedGroupEntity,
  SyncedTeamEntity,
  SyncedTeamChannelEntity,
  SyncedTeamChannelMessageEntity,
  SyncedMailboxEntity,
  SyncedOneDriveEntity,
];

@Module({})
export class SyncModule {
  static forRoot(): DynamicModule {
    return {
      module: SyncModule,
      imports: [GraphModule, TypeOrmModule.forFeature(syncEntities)],
      controllers: [SyncController],
      providers: [SyncService],
      exports: [TypeOrmModule],
    };
  }
}
