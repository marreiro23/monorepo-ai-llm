import { Module } from '@nestjs/common';
import { UsersApiController } from './users-api.controller';
import { UsersApiService } from './users-api.service';
import { HealthController } from './health.controller';

@Module({
  imports: [],
  controllers: [UsersApiController, HealthController],
  providers: [UsersApiService],
})
export class AppModule {}