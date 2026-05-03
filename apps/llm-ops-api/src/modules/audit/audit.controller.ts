import { Controller, Get, Query, Delete } from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  getStatus() {
    return this.auditService.getStatus();
  }

  @Get('log')
  getAuditLog(
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('result') result?: 'success' | 'failure' | 'warning',
    @Query('limit') limit?: string
  ) {
    return this.auditService.getAuditLog({
      eventType: eventType as any,
      startDate,
      endDate,
      result,
      limit: limit ? parseInt(limit, 10) : undefined
    });
  }

  @Get('stats')
  getAuditStats() {
    return this.auditService.getAuditStats();
  }

  @Delete('log')
  clearAuditLog() {
    return this.auditService.clearAuditLog();
  }
}