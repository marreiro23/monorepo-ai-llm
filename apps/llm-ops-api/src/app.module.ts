import { Module } from '@nestjs/common';
import { LlmOpsApiController } from './llm-ops-api.controller';
import { LlmOpsApiService } from './llm-ops-api.service';
import { HealthController } from './health.controller';
import { AuthModule } from '@api-llm-embedded/auth';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    AuthModule,
  ],
  controllers: [LlmOpsApiController, HealthController],
  providers: [LlmOpsApiService],
})
export class AppModule {}
