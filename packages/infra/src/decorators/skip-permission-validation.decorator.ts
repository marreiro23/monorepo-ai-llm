import { SetMetadata } from '@nestjs/common';
import { SKIP_PERMISSION_VALIDATION } from '../guards/permission-validation.guard.js';

/**
 * Decorator para marcar endpoints que devem ignorar a validação de permissões.
 *
 * Use este decorator apenas para:
 * - Endpoints de health check
 * - Endpoints administrativos internos
 * - Endpoints de governança e auditoria
 * - Endpoints públicos sem autenticação
 *
 * @example
 * ```typescript
 * @Get('health')
 * @SkipPermissionValidation()
 * getHealth() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const SkipPermissionValidation = () =>
  SetMetadata(SKIP_PERMISSION_VALIDATION, true);

// Made with Bob
