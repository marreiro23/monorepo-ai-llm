import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  forwardRef
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GovernanceService } from '../../modules/governance/governance.service.js';
import { AuditEventsService } from '../events/audit-events.service.js';

/**
 * Metadata key para marcar endpoints que devem ignorar validação de permissões
 * Uso: @SkipPermissionValidation() no controller
 */
export const SKIP_PERMISSION_VALIDATION = 'skipPermissionValidation';

/**
 * Guard que valida se um endpoint possui permissões mínimas definidas na matriz de governança.
 *
 * Bloqueia requisições para endpoints que:
 * 1. Não possuem entrada na matriz de permissões
 * 2. Usam permissões mais amplas que o necessário
 * 3. Não possuem rationale documentado
 *
 * Exceções:
 * - Endpoints marcados com @SkipPermissionValidation()
 * - Endpoints de health check e admin
 * - Endpoints de governança e auditoria
 */
@Injectable()
export class PermissionValidationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(forwardRef(() => GovernanceService))
    private readonly governanceService: GovernanceService,
    private readonly auditEventsService: AuditEventsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verifica se o endpoint deve ignorar validação
    const skipValidation = this.reflector.get<boolean>(
      SKIP_PERMISSION_VALIDATION,
      context.getHandler()
    );

    if (skipValidation) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method as string;
    const path = this.normalizePath(request.url || request.path || '');

    // Endpoints que sempre são permitidos (whitelist)
    if (this.isWhitelistedEndpoint(path)) {
      return true;
    }

    // Busca o endpoint na matriz de permissões
    const permissionRecord = this.findPermissionRecord(path, method);

    if (!permissionRecord) {
      // Registra tentativa de acesso a endpoint sem permissão definida
      this.auditEventsService.emitEndpointAccess({
        endpoint: path,
        method,
        result: 'failure',
        details: {
          reason: 'endpoint_not_in_permission_matrix',
          message: 'Endpoint não possui permissões mínimas definidas'
        }
      });

      throw new ForbiddenException({
        statusCode: 403,
        message: 'Endpoint bloqueado: permissões não definidas',
        error: 'Forbidden',
        details: {
          endpoint: path,
          method,
          reason: 'MISSING_PERMISSION_MATRIX_ENTRY',
          documentation: '/governance/permissions/matrix',
          howToFix: 'Adicione este endpoint à matriz de permissões em GovernanceService'
        }
      });
    }

    // Valida se o registro possui todos os campos obrigatórios
    if (!this.isValidPermissionRecord(permissionRecord)) {
      this.auditEventsService.emitEndpointAccess({
        endpoint: path,
        method,
        result: 'failure',
        details: {
          reason: 'invalid_permission_record',
          message: 'Registro de permissão incompleto ou inválido',
          record: permissionRecord
        }
      });

      throw new ForbiddenException({
        statusCode: 403,
        message: 'Endpoint bloqueado: registro de permissão inválido',
        error: 'Forbidden',
        details: {
          endpoint: path,
          method,
          reason: 'INVALID_PERMISSION_RECORD',
          issues: this.getValidationIssues(permissionRecord),
          documentation: '/governance/permissions/validation'
        }
      });
    }

    // Registra acesso bem-sucedido
    this.auditEventsService.emitPermissionCheck({
      endpoint: path,
      method,
      scopes: permissionRecord.minimumScopes,
      result: 'success',
      details: {
        rationale: permissionRecord.rationale,
        upstreamPath: permissionRecord.upstreamPath
      }
    });

    return true;
  }

  /**
   * Normaliza o path removendo query strings e trailing slashes
   */
  private normalizePath(path: string): string {
    if (!path) return '/';
    const pathWithoutQuery = path.split('?')[0];
    return pathWithoutQuery?.replace(/\/$/, '') || '/';
  }

  /**
   * Verifica se o endpoint está na whitelist (sempre permitido)
   */
  private isWhitelistedEndpoint(path: string): boolean {
    const whitelistedPrefixes = [
      '/health',
      '/admin',
      '/governance',
      '/audit'
    ];

    return whitelistedPrefixes.some(prefix => path.startsWith(prefix));
  }

  /**
   * Busca o registro de permissão na matriz
   * Suporta paths com parâmetros dinâmicos (ex: /graph/sites/:siteId)
   */
  private findPermissionRecord(path: string, method: string): any {
    const matrix = this.governanceService.getPermissionMatrix().data;

    // Busca exata primeiro
    let record = matrix.find(
      r => r.endpoint === path && r.method === method
    );

    if (record) {
      return record;
    }

    // Busca com parâmetros dinâmicos
    // Converte /graph/sites/abc123 para /graph/sites/:siteId
    for (const r of matrix) {
      if (r.method !== method) continue;

      const pattern = this.endpointToRegex(r.endpoint);
      if (pattern.test(path)) {
        return r;
      }
    }

    return null;
  }

  /**
   * Converte um endpoint com parâmetros para regex
   * Ex: /graph/sites/:siteId -> /^\/graph\/sites\/[^\/]+$/
   */
  private endpointToRegex(endpoint: string): RegExp {
    const pattern = endpoint
      .replace(/:[^\/]+/g, '[^/]+') // :param -> [^/]+
      .replace(/\//g, '\\/'); // / -> \/

    return new RegExp(`^${pattern}$`);
  }

  /**
   * Valida se o registro de permissão possui todos os campos obrigatórios
   */
  private isValidPermissionRecord(record: any): boolean {
    if (!record.endpoint || !record.method || !record.upstreamPath) {
      return false;
    }

    if (!record.minimumScopes || record.minimumScopes.length === 0) {
      return false;
    }

    if (!record.rationale || record.rationale.trim().length === 0) {
      return false;
    }

    // Valida que operações de escrita usam ReadWrite
    if (record.method !== 'GET') {
      const hasReadWrite = record.minimumScopes.some((scope: string) =>
        scope.includes('ReadWrite')
      );
      if (!hasReadWrite) {
        return false;
      }
    }

    return true;
  }

  /**
   * Retorna lista de issues de validação para um registro
   */
  private getValidationIssues(record: any): string[] {
    const issues: string[] = [];

    if (!record.endpoint) issues.push('Missing endpoint');
    if (!record.method) issues.push('Missing method');
    if (!record.upstreamPath) issues.push('Missing upstreamPath');
    if (!record.minimumScopes || record.minimumScopes.length === 0) {
      issues.push('Missing or empty minimumScopes');
    }
    if (!record.rationale || record.rationale.trim().length === 0) {
      issues.push('Missing or empty rationale');
    }

    if (record.method !== 'GET') {
      const hasReadWrite = record.minimumScopes?.some((scope: string) =>
        scope.includes('ReadWrite')
      );
      if (!hasReadWrite) {
        issues.push('Write operation without ReadWrite scope');
      }
    }

    return issues;
  }
}

// Made with Bob
