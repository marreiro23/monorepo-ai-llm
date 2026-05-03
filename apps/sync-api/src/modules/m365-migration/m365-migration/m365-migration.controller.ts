import { Controller, Get, Param, Post } from '@nestjs/common';
import { M365MigrationService } from './m365-migration.service.js';
import type { MigrationTenantRole } from './entities/migration-tenant.entity.js';

@Controller('m365-migration')
export class M365MigrationController {
  constructor(private readonly migrationService: M365MigrationService) {}

  @Get('readiness/:tenantRole')
  checkReadiness(@Param('tenantRole') tenantRole: MigrationTenantRole) {
    return this.migrationService.checkReadiness(tenantRole);
  }

  @Post('discovery/:tenantRole')
  discoverMailboxes(@Param('tenantRole') tenantRole: MigrationTenantRole) {
    return this.migrationService.discoverMailboxes(tenantRole);
  }

  @Get('mailboxes')
  listMailboxes() {
    return this.migrationService.listMailboxes();
  }

  @Get('mappings')
  listMappings() {
    return this.migrationService.listMappings();
  }

  @Post('mappings/validate')
  validateMappings() {
    return this.migrationService.validateMappings();
  }

  @Post('jobs/dry-run')
  createDryRunJob() {
    return this.migrationService.createDryRunJob();
  }
}
