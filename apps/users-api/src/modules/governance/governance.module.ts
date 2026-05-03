import { Module } from '@nestjs/common';
import { GovernanceController } from './governance.controller.js';
import { GovernanceService } from './governance.service.js';
import { AuditEventsModule } from '../../common/events/audit-events.module.js';

@Module({
  imports: [AuditEventsModule],
  controllers: [GovernanceController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
