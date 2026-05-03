import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type {
  PermissionCheckEventPayload,
  EndpointAccessEventPayload,
  MatrixAccessEventPayload,
  PermissionValidationEventPayload,
} from '../../common/events/audit-events.service.js';

type AuditEventType =
  | 'permission_check'
  | 'permission_validation'
  | 'permission_matrix_access'
  | 'endpoint_access'
  | 'permission_denied';

type AuditEvent = {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  endpoint?: string;
  method?: string;
  scopes?: string[];
  userId?: string;
  result: 'success' | 'failure' | 'warning';
  details: Record<string, any>;
  metadata?: Record<string, any>;
};

@Injectable()
export class AuditService {
  private auditLog: AuditEvent[] = [];
  private readonly maxLogSize = 10000; // Limite de eventos em memória

  getStatus() {
    return {
      domain: 'audit',
      status: 'active',
      success: true,
      eventsCount: this.auditLog.length,
      maxLogSize: this.maxLogSize,
    };
  }

  /**
   * Escuta eventos de verificação de permissão
   */
  @OnEvent('audit.permission_check')
  handlePermissionCheckEvent(payload: PermissionCheckEventPayload) {
    this.logPermissionCheck(payload);
  }

  /**
   * Escuta eventos de acesso a endpoint
   */
  @OnEvent('audit.endpoint_access')
  handleEndpointAccessEvent(payload: EndpointAccessEventPayload) {
    this.logEndpointAccess(payload);
  }

  /**
   * Escuta eventos de permissão negada
   */
  @OnEvent('audit.permission_denied')
  handlePermissionDeniedEvent(payload: EndpointAccessEventPayload) {
    this.logEndpointAccess(payload);
  }

  /**
   * Escuta eventos de acesso à matriz de permissões
   */
  @OnEvent('audit.matrix_access')
  handleMatrixAccessEvent(payload: MatrixAccessEventPayload) {
    this.logMatrixAccess(payload);
  }

  /**
   * Escuta eventos de validação de permissões
   */
  @OnEvent('audit.permission_validation')
  handlePermissionValidationEvent(payload: PermissionValidationEventPayload) {
    this.logPermissionValidation(payload);
  }

  logPermissionCheck(data: {
    endpoint: string;
    method: string;
    scopes?: string[];
    result: 'success' | 'failure';
    userId?: string;
    details?: Record<string, any>;
  }) {
    const event: AuditEvent = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      eventType: 'permission_check',
      endpoint: data.endpoint,
      method: data.method,
      scopes: data.scopes,
      userId: data.userId,
      result: data.result,
      details: data.details || {},
    };

    this.addEvent(event);
    return event;
  }

  logPermissionValidation(data: {
    validatedEndpoints: number;
    invalidRecords: number;
    result: 'success' | 'failure';
    details?: Record<string, any>;
  }) {
    const event: AuditEvent = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      eventType: 'permission_validation',
      result: data.result,
      details: {
        validatedEndpoints: data.validatedEndpoints,
        invalidRecords: data.invalidRecords,
        ...data.details,
      },
    };

    this.addEvent(event);
    return event;
  }

  logMatrixAccess(data: {
    userId?: string;
    accessType: 'read' | 'export';
    details?: Record<string, any>;
  }) {
    const event: AuditEvent = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      eventType: 'permission_matrix_access',
      userId: data.userId,
      result: 'success',
      details: {
        accessType: data.accessType,
        ...data.details,
      },
    };

    this.addEvent(event);
    return event;
  }

  logEndpointAccess(data: {
    endpoint: string;
    method: string;
    userId?: string;
    scopes?: string[];
    result: 'success' | 'failure';
    details?: Record<string, any>;
  }) {
    const event: AuditEvent = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      eventType: 'endpoint_access',
      endpoint: data.endpoint,
      method: data.method,
      userId: data.userId,
      scopes: data.scopes,
      result: data.result,
      details: data.details || {},
    };

    this.addEvent(event);
    return event;
  }

  getAuditLog(filters?: {
    eventType?: AuditEventType;
    startDate?: string;
    endDate?: string;
    result?: 'success' | 'failure' | 'warning';
    limit?: number;
  }) {
    let filtered = [...this.auditLog];

    if (filters?.eventType) {
      filtered = filtered.filter((e) => e.eventType === filters.eventType);
    }

    if (filters?.startDate) {
      filtered = filtered.filter((e) => e.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter((e) => e.timestamp <= filters.endDate!);
    }

    if (filters?.result) {
      filtered = filtered.filter((e) => e.result === filters.result);
    }

    // Ordena por timestamp decrescente (mais recentes primeiro)
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Aplica limite
    const limit = filters?.limit || 100;
    filtered = filtered.slice(0, limit);

    return {
      success: true,
      data: {
        events: filtered,
        total: this.auditLog.length,
        filtered: filtered.length,
        filters: filters || {},
      },
    };
  }

  getAuditStats() {
    const stats = {
      total: this.auditLog.length,
      byType: {} as Record<AuditEventType, number>,
      byResult: {
        success: 0,
        failure: 0,
        warning: 0,
      },
      last24h: 0,
      lastHour: 0,
    };

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    this.auditLog.forEach((event) => {
      // Por tipo
      stats.byType[event.eventType] = (stats.byType[event.eventType] || 0) + 1;

      // Por resultado
      stats.byResult[event.result]++;

      // Por período
      const eventDate = new Date(event.timestamp);
      if (eventDate >= last24h) {
        stats.last24h++;
      }
      if (eventDate >= lastHour) {
        stats.lastHour++;
      }
    });

    return {
      success: true,
      data: stats,
    };
  }

  clearAuditLog() {
    const count = this.auditLog.length;
    this.auditLog = [];
    return {
      success: true,
      data: {
        clearedEvents: count,
        message: 'Audit log cleared successfully',
      },
    };
  }

  private addEvent(event: AuditEvent) {
    this.auditLog.push(event);

    // Remove eventos antigos se exceder o limite
    if (this.auditLog.length > this.maxLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxLogSize);
    }
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
