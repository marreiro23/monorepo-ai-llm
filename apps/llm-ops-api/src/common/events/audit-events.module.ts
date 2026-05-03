import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuditEventsService } from './audit-events.service.js';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [AuditEventsService],
  exports: [AuditEventsService],
})
export class AuditEventsModule {}
