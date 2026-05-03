import { SetMetadata } from '@nestjs/common';
import { REQUIRE_API_KEY } from '../guards/api-key-auth.guard.js';

/**
 * Decorator para marcar endpoints que requerem autenticação via API Key.
 *
 * Use este decorator para:
 * - Endpoints de mock do Dev Proxy
 * - Endpoints administrativos que não usam OAuth
 * - Endpoints de teste e desenvolvimento
 * - Endpoints públicos que precisam de rate limiting
 *
 * Configuração:
 * - Defina a variável de ambiente API_KEY
 * - Múltiplas keys: API_KEY=key1,key2,key3
 *
 * A API Key pode ser fornecida via:
 * - Header: x-api-key
 * - Query parameter: apiKey
 * - Cookie: api_key
 *
 * @example
 * ```typescript
 * @Get('mock-endpoint')
 * @RequireApiKey()
 * getMockData() {
 *   return { data: 'mock' };
 * }
 * ```
 *
 * @example Com documentação
 * ```typescript
 * @Get('admin/stats')
 * @RequireApiKey()
 * @ApiHeader({
 *   name: 'x-api-key',
 *   description: 'API Key para autenticação',
 *   required: true
 * })
 * getAdminStats() {
 *   return { stats: {...} };
 * }
 * ```
 */
export const RequireApiKey = () => SetMetadata(REQUIRE_API_KEY, true);

// Made with Bob
