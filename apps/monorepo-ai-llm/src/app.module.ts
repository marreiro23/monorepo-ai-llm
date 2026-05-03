import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { MermaidMcpController } from './mermaid-mcp.controller';
import { MermaidMcpService } from './mermaid-mcp.service';
import { GitMcpController } from './git-mcp.controller';
import { GitMcpService } from './git-mcp.service';
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
  controllers: [AppController, HealthController, MermaidMcpController, GitMcpController],
  providers: [AppService, MermaidMcpService, GitMcpService],
})
export class AppModule {}
