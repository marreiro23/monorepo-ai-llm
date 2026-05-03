import { Module } from '@nestjs/common';
import { UsersApiController } from './users-api.controller';
import { UsersApiService } from './users-api.service';
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
  controllers: [UsersApiController, HealthController],
  providers: [UsersApiService],
})
export class AppModule {}
