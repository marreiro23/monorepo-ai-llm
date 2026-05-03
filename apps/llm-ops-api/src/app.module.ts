import { Module } from '@nestjs/common';
import { LlmOpsApiController } from './llm-ops-api.controller';
import { LlmOpsApiService } from './llm-ops-api.service';
import { HealthController } from './health.controller';

@Module({
  imports: [],
  controllers: [LlmOpsApiController, HealthController],
  providers: [LlmOpsApiService],
})
export class AppModule {}