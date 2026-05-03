import { Injectable, Logger } from '@nestjs/common';

type AuditEventPayload = {
  endpoint: string;
  method: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
};

type MatrixAccessPayload = {
  accessType: 'read' | 'write';
  details?: Record<string, unknown>;
};

type PermissionValidationPayload = {
  validatedEndpoints: number;
  invalidRecords: number;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
};

@Injectable()
export class AuditEventsService {
  private readonly logger = new Logger(AuditEventsService.name);

  emitEndpointAccess(payload: AuditEventPayload): void {
    this.logger.log(
      `endpoint_access endpoint=${payload.endpoint} method=${payload.method} result=${payload.result}`,
      payload.details,
    );
  }

  emitPermissionCheck(payload: AuditEventPayload & { scopes?: string[] }): void {
    this.logger.log(
      `permission_check endpoint=${payload.endpoint} method=${payload.method} result=${payload.result}`,
      payload,
    );
  }

  emitMatrixAccess(payload: MatrixAccessPayload): void {
    this.logger.log(
      `matrix_access accessType=${payload.accessType}`,
      payload.details,
    );
  }

  emitPermissionValidation(payload: PermissionValidationPayload): void {
    this.logger.log(
      `permission_validation validated=${payload.validatedEndpoints} invalid=${payload.invalidRecords} result=${payload.result}`,
      payload.details,
    );
  }
}
