import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export type PermissionCheckEventPayload = {
  endpoint: string;
  method: string;
  scopes?: string[];
  userId?: string;
  result: 'success' | 'failure';
  details?: Record<string, any>;
};

export type EndpointAccessEventPayload = {
  endpoint: string;
  method: string;
  userId?: string;
  scopes?: string[];
  result: 'success' | 'failure';
  details?: Record<string, any>;
};

export type MatrixAccessEventPayload = {
  userId?: string;
  accessType: 'read' | 'export';
  details?: Record<string, any>;
};

export type PermissionValidationEventPayload = {
  validatedEndpoints: number;
  invalidRecords: number;
  result: 'success' | 'failure';
  details?: Record<string, any>;
};

@Injectable()
export class AuditEventsService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emitPermissionCheck(payload: PermissionCheckEventPayload): void {
    this.eventEmitter.emit('audit.permission_check', payload);
  }

  emitEndpointAccess(payload: EndpointAccessEventPayload): void {
    this.eventEmitter.emit('audit.endpoint_access', payload);
  }

  emitPermissionDenied(payload: EndpointAccessEventPayload): void {
    this.eventEmitter.emit('audit.permission_denied', payload);
  }

  emitMatrixAccess(payload: MatrixAccessEventPayload): void {
    this.eventEmitter.emit('audit.matrix_access', payload);
  }

  emitPermissionValidation(payload: PermissionValidationEventPayload): void {
    this.eventEmitter.emit('audit.permission_validation', payload);
  }
}
