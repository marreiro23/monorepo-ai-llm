import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { MermaidMcpController } from './mermaid-mcp.controller';
import { MermaidMcpService } from './mermaid-mcp.service';

@Module({
  imports: [],
  controllers: [AppController, HealthController, MermaidMcpController],
  providers: [AppService, MermaidMcpService],
})
export class AppModule {}
