import { Module } from '@nestjs/common';
import { SyncApiController } from './sync-api.controller';
import { SyncApiService } from './sync-api.service';
import { HealthController } from './health.controller';

@Module({
  imports: [],
  controllers: [SyncApiController,HealthController],
  providers: [SyncApiService],
})
export class SyncApiModule {}
