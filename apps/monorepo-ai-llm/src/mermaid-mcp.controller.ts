import { Controller, Get, Post, Query } from '@nestjs/common';
import { MermaidMcpService } from './mermaid-mcp.service';

@Controller('mcp/mermaid')
export class MermaidMcpController {
  constructor(private readonly mermaidMcpService: MermaidMcpService) {}

  @Get('status')
  getStatus() {
    return this.mermaidMcpService.status();
  }

  @Post('sync')
  sync(@Query('domain') domain?: string) {
    return this.mermaidMcpService.sync(domain?.trim() || undefined);
  }
}
