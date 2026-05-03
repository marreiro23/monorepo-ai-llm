import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphModule } from '../graph/graph.module.js';
import { M365MigrationController } from './m365-migration.controller.js';
import { M365MigrationService } from './m365-migration.service.js';
import { MigrationEventEntity } from './entities/migration-event.entity.js';
import { MigrationJobEntity } from './entities/migration-job.entity.js';
import { MigrationMailboxMappingEntity } from './entities/migration-mailbox-mapping.entity.js';
import { MigrationMailboxEntity } from './entities/migration-mailbox.entity.js';
import { MigrationReadinessCheckEntity } from './entities/migration-readiness-check.entity.js';
import { MigrationTenantEntity } from './entities/migration-tenant.entity.js';
import { M365ObjectOperationEntity } from './entities/m365-object-operation.entity.js';
import { M365ObjectPermissionSnapshotEntity } from './entities/m365-object-permission-snapshot.entity.js';

export const m365MigrationEntities = [
  MigrationTenantEntity,
  MigrationMailboxEntity,
  MigrationMailboxMappingEntity,
  MigrationReadinessCheckEntity,
  MigrationJobEntity,
  MigrationEventEntity,
  M365ObjectOperationEntity,
  M365ObjectPermissionSnapshotEntity,
];

@Module({})
export class M365MigrationModule {
  static forRoot(): DynamicModule {
    return {
      module: M365MigrationModule,
      imports: [GraphModule, TypeOrmModule.forFeature(m365MigrationEntities)],
      controllers: [M365MigrationController],
      providers: [M365MigrationService],
      exports: [TypeOrmModule, M365MigrationService],
    };
  }
}
