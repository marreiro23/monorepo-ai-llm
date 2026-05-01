import { Module } from '@nestjs/common';
import { SharepointApiController } from './sharepoint-api.controller';
import { SharepointApiService } from './sharepoint-api.service';
import { HealthController } from './health.controller';

@Module({
  imports: [],
  controllers: [SharepointApiController,HealthController],
  providers: [SharepointApiService],
})
export class SharepointApiModule {}
