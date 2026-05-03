import { Module } from '@nestjs/common';
import { ApiKeyAuthService } from './api-key-auth.service.js';
import { ApiKeyAuthGuard } from './api-key-auth.guard.js';
import { AuditEventsModule } from '../events/audit-events.module.js';

/**
 * Módulo que fornece guards e serviços de autenticação comuns.
 */
@Module({
  imports: [AuditEventsModule],
  providers: [ApiKeyAuthService, ApiKeyAuthGuard],
  exports: [ApiKeyAuthService, ApiKeyAuthGuard, AuditEventsModule]
})
export class GuardsModule {}

// Made with Bob
