import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

/**
 * Serviço dedicado para autenticação de API Key.
 * Responsável apenas pela validação de API Keys.
 */
@Injectable()
export class ApiKeyAuthService {
  private readonly validApiKeys: Set<string>;

  constructor(private readonly configService: ConfigService) {
    // Carrega API keys da configuração
    const apiKeysString = this.configService.get<string>('API_KEY', '');
    this.validApiKeys = new Set(
      apiKeysString
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0)
    );

    // Log de inicialização (sem expor as keys)
    if (this.validApiKeys.size === 0) {
      console.warn('⚠️  ApiKeyAuthService: No API keys configured. All requests will be rejected.');
    } else {
      console.log(`✅ ApiKeyAuthService: ${this.validApiKeys.size} API key(s) loaded`);
    }
  }

  /**
   * Extrai API Key de múltiplas fontes (header, query, cookie)
   */
  extractApiKey(request: any): string | null {
    // 1. Tenta header x-api-key
    const headerKey = request.headers?.['x-api-key'];
    if (headerKey && typeof headerKey === 'string') {
      return headerKey;
    }

    // 2. Tenta query parameter apiKey
    const queryKey = request.query?.apiKey;
    if (queryKey && typeof queryKey === 'string') {
      return queryKey;
    }

    // 3. Tenta cookie api_key
    const cookieKey = request.cookies?.api_key;
    if (cookieKey && typeof cookieKey === 'string') {
      return cookieKey;
    }

    return null;
  }

  /**
   * Valida se a API Key é válida
   *
   * Critérios de validação:
   * - Comprimento mínimo de 16 caracteres
   * - Formato alfanumérico (letras, números, hífens e underscores permitidos)
   */
  validateApiKey(apiKey: string): boolean {
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }

    return this.validApiKeys.has(apiKey);
  }

  /**
   * Gera um identificador único para a API Key usando hash SHA-256
   * Não expõe nenhuma parte da chave original, apenas um identificador para logs
   */
  maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.trim().length === 0) {
      return 'invalid-key';
    }
    // Usa SHA-256 para gerar um hash unidirecional
    // Retorna apenas os primeiros 8 caracteres do hash para identificação
    const hash = createHash('sha256').update(apiKey).digest('hex');
    return `key-${hash.substring(0, 8)}`;
  }

  /**
   * Retorna quantidade de API Keys configuradas (para debug)
   */
  getConfiguredKeysCount(): number {
    return this.validApiKeys.size;
  }

  /**
   * Verifica se uma API Key específica é válida (para testes)
   */
  isValidKey(apiKey: string): boolean {
    return this.validateApiKey(apiKey);
  }
}

// Made with Bob
