import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const headers = request.headers;

    if (this.hasValidProviderApiKey(headers) || this.hasValidGithubEntraFlow(headers)) {
      return true;
    }

    throw new UnauthorizedException(
      'Missing or invalid authentication. Use provider API key (OpenAI, Claude, AstraDB, LangFlow) or GitHub+EntraID headers with certificate thumbprint.',
    );
  }

  private hasValidProviderApiKey(
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const genericApiKey = this.getHeader(headers, 'x-api-key');
    const openAiApiKey = this.getHeader(headers, 'x-openai-api-key');
    const claudeApiKey = this.getHeader(headers, 'x-claude-api-key');
    const astraDbApiKey = this.getHeader(headers, 'x-astradb-api-key');
    const langFlowApiKey = this.getHeader(headers, 'x-langflow-api-key');

    const expectedGenericApiKey = this.configService.get<string>('AUTH_API_KEY');
    const expectedOpenAiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    const expectedClaudeApiKey = this.configService.get<string>('CLAUDE_API_KEY');
    const expectedAstraDbApiKey = this.configService.get<string>('ASTRADB_API_KEY');
    const expectedLangFlowApiKey = this.configService.get<string>('LANGFLOW_API_KEY');

    const genericIsValid = expectedGenericApiKey
      ? genericApiKey === expectedGenericApiKey
      : Boolean(genericApiKey);
    const openAiIsValid = expectedOpenAiApiKey
      ? openAiApiKey === expectedOpenAiApiKey
      : Boolean(openAiApiKey);
    const claudeIsValid = expectedClaudeApiKey
      ? claudeApiKey === expectedClaudeApiKey
      : Boolean(claudeApiKey);
    const astraDbIsValid = expectedAstraDbApiKey
      ? astraDbApiKey === expectedAstraDbApiKey
      : Boolean(astraDbApiKey);
    const langFlowIsValid = expectedLangFlowApiKey
      ? langFlowApiKey === expectedLangFlowApiKey
      : Boolean(langFlowApiKey);

    return genericIsValid || openAiIsValid || claudeIsValid || astraDbIsValid || langFlowIsValid;
  }

  private hasValidGithubEntraFlow(
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const expectedThumbprint = this.configService.get<string>(
      'ENTRA_GITHUB_CERT_THUMBPRINT',
    );
    const expectedClientId = this.configService.get<string>('ENTRA_GITHUB_CLIENT_ID');
    const expectedTenantId = this.configService.get<string>('ENTRA_GITHUB_TENANT_ID');
    const expectedBearerToken = this.configService.get<string>('AUTH_BEARER_TOKEN');

    const entraThumbprint = this.getHeader(headers, 'x-entra-cert-thumbprint');
    const entraClientId = this.getHeader(headers, 'x-entra-client-id');
    const entraTenantId = this.getHeader(headers, 'x-entra-tenant-id');
    const githubToken = this.getHeader(headers, 'x-github-token');
    const authHeader = this.getHeader(headers, 'authorization');
    const bearerToken = this.extractBearerToken(authHeader);

    const thumbprintIsValid = expectedThumbprint
      ? entraThumbprint === expectedThumbprint
      : Boolean(entraThumbprint);
    const clientIdIsValid = expectedClientId
      ? entraClientId === expectedClientId
      : Boolean(entraClientId);
    const tenantIdIsValid = expectedTenantId
      ? entraTenantId === expectedTenantId
      : Boolean(entraTenantId);

    const githubCredentialIsValid = expectedBearerToken
      ? bearerToken === expectedBearerToken || githubToken === expectedBearerToken
      : Boolean(bearerToken || githubToken);

    return thumbprintIsValid && clientIdIsValid && tenantIdIsValid && githubCredentialIsValid;
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private extractBearerToken(authHeader?: string): string | undefined {
    if (!authHeader) {
      return undefined;
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
