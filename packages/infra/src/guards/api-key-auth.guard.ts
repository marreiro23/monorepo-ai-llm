import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyAuthService } from './api-key-auth.service.js';
import { AuditEventsService } from '../events/audit-events.service.js';

/**
 * Metadata key para marcar endpoints que requerem API Key
 * Uso: @RequireApiKey() no controller
 */
export const REQUIRE_API_KEY = 'requireApiKey';

/**
 * Guard que coordena a validação de API Key para endpoints protegidos.
 *
 * Responsabilidades:
 * - Verificar se o endpoint requer API Key
 * - Coordenar a validação usando ApiKeyAuthService
 * - Lançar exceções apropriadas
 *
 * Casos de uso:
 * - Endpoints de mock do Dev Proxy
 * - Endpoints administrativos
 * - Endpoints de teste
 *
 * @see {@link file://./docs/governance/API-KEY-AUTHENTICATION.md} Para instruções completas de configuração,
 * geração de API Keys seguras, rotação de keys e melhores práticas de segurança.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyAuthService: ApiKeyAuthService,
    private readonly auditEventsService: AuditEventsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verifica se o endpoint requer API Key
    const requireApiKey = this.reflector.get<boolean>(
      REQUIRE_API_KEY,
      context.getHandler()
    );

    // Se não requer, permite acesso
    if (!requireApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const endpoint = this.normalizePath(request.url || request.path);
    const method = request.method as string;

    // Extrai API Key usando o serviço
    const apiKey = this.apiKeyAuthService.extractApiKey(request);

    // Se não encontrou API Key
    if (!apiKey) {
      this.auditEventsService.emitEndpointAccess({
        endpoint,
        method,
        result: 'failure',
        details: {
          reason: 'MISSING_API_KEY',
          authMethod: 'api-key'
        }
      });

      throw this.createUnauthorizedException(
        'API Key não fornecida',
        'MISSING_API_KEY',
        'Forneça a API Key via header (x-api-key), query parameter (apiKey) ou cookie (api_key)'
      );
    }

    // Valida API Key usando o serviço
    const isValid = this.apiKeyAuthService.validateApiKey(apiKey);

    if (!isValid) {
      this.auditEventsService.emitEndpointAccess({
        endpoint,
        method,
        result: 'failure',
        details: {
          reason: 'INVALID_API_KEY',
          authMethod: 'api-key',
          maskedKey: this.apiKeyAuthService.maskApiKey(apiKey)
        }
      });

      throw this.createUnauthorizedException(
        'API Key inválida',
        'INVALID_API_KEY',
        'Verifique se a API Key está correta'
      );
    }

    // Registra acesso bem-sucedido
    this.auditEventsService.emitEndpointAccess({
      endpoint,
      method,
      result: 'success',
      details: {
        authMethod: 'api-key',
        maskedKey: this.apiKeyAuthService.maskApiKey(apiKey)
      }
    });

    return true;
  }

  /**
   * Normaliza o path removendo query strings e trailing slashes
   * Sanitiza caracteres de controle e sequências perigosas para prevenir log injection
   */
  private normalizePath(path: string): string {
    if (!path) return '/';
    const pathWithoutQuery = path.split('?')[0];
    const normalizedPath = pathWithoutQuery?.replace(/\/$/, '') || '/';

    // Sanitiza caracteres de controle, newlines e outros caracteres perigosos
    // Remove: \r, \n, \t, caracteres de controle ASCII (0x00-0x1F, 0x7F)
    return normalizedPath.replace(/[\x00-\x1F\x7F]/g, '');
  }

  /**
   * Cria uma UnauthorizedException padronizada
   */
  private createUnauthorizedException(
    message: string,
    reason: string,
    hint: string
  ): UnauthorizedException {
    return new UnauthorizedException({
      statusCode: 401,
      message,
      error: 'Unauthorized',
      details: {
        reason,
        hint,
        documentation: '/docs/governance/API-KEY-AUTHENTICATION.md'
      }
    });
  }

  /**
   * Retorna quantidade de API Keys configuradas (para debug)
   */
  getConfiguredKeysCount(): number {
    return this.apiKeyAuthService.getConfiguredKeysCount();
  }

  /**
   * Verifica se uma API Key específica é válida (para testes)
   */
  isValidKey(apiKey: string): boolean {
    return this.apiKeyAuthService.isValidKey(apiKey);
  }
}

// Made with Bob
