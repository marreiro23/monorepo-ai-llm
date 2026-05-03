import { Module } from '@nestjs/common';
import { AuditEventsService } from './audit-events.service.js';

@Module({
  providers: [AuditEventsService],
  exports: [AuditEventsService],
})
export class AuditEventsModule {}
