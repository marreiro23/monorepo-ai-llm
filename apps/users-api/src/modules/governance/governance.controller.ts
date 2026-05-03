import { Controller, Get } from '@nestjs/common';
import { GovernanceService } from './governance.service.js';

@Controller('governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get()
  getStatus() {
    return this.governanceService.getStatus();
  }

  @Get('permissions/matrix')
  getPermissionMatrix() {
    return this.governanceService.getPermissionMatrix();
  }

  @Get('permissions/validation')
  validatePermissionMatrix() {
    return this.governanceService.validatePermissionMatrix();
  }

  @Get('permissions/openapi-report')
  getOpenApiPermissionsReport() {
    return this.governanceService.getOpenApiPermissionsReport();
  }
}