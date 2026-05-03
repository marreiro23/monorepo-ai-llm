import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientCertificateCredential,
  ClientSecretCredential,
} from '@azure/identity';
import { X509Certificate } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const API_ROOT = process.cwd();

function getNonEmptyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeThumbprint(value: unknown): string {
  return getNonEmptyValue(value)
    .replace(/[^a-fA-F0-9]/g, '')
    .toUpperCase();
}

function readCertificateThumbprint(certificatePath: string): string {
  const pemContent = readFileSync(certificatePath, 'utf8');
  const certificateMatch = pemContent.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
  );

  if (!certificateMatch) {
    throw new Error(
      'O PEM informado em CERT_PRIVATE_KEY_PATH precisa conter o certificado publico alem da chave privada.',
    );
  }

  const certificate = new X509Certificate(certificateMatch[0]);
  return normalizeThumbprint(certificate.fingerprint);
}

@Injectable()
export class EntraRegistrationService {
  private credential:
    | ClientCertificateCredential
    | ClientSecretCredential
    | null = null;
  private cachedToken: string | null = null;
  private cachedTokenExpiresOn = 0;
  private lastAuthTime: string | null = null;
  private authMethod: string | null = null;
  private certificatePath: string | null = null;
  private certificateThumbprint: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  getConfig() {
    const certPath = getNonEmptyValue(
      this.configService.get<string>('CERT_PRIVATE_KEY_PATH'),
    );
    const clientSecret = getNonEmptyValue(
      this.configService.get<string>('CLIENT_SECRET'),
    );
    const graphScope =
      getNonEmptyValue(this.configService.get<string>('GRAPH_SCOPE')) ||
      DEFAULT_GRAPH_SCOPE;

    return {
      tenantIdConfigured: Boolean(this.configService.get<string>('TENANT_ID')),
      clientIdConfigured: Boolean(this.configService.get<string>('CLIENT_ID')),
      certificatePathConfigured: Boolean(certPath),
      certificateThumbprintConfigured: Boolean(
        getNonEmptyValue(this.configService.get<string>('CERT_THUMBPRINT')),
      ),
      clientSecretConfigured: Boolean(clientSecret),
      authMethod: this.authMethod || 'not-authenticated',
      graphBaseUrl: 'https://graph.microsoft.com/v1.0',
      scope: graphScope,
      isAuthenticated: Boolean(
        this.cachedToken && Date.now() < this.cachedTokenExpiresOn,
      ),
      lastAuthTime: this.lastAuthTime,
      certificatePath: this.certificatePath,
      certificateThumbprint: this.certificateThumbprint,
    };
  }

  getCredential() {
    const tenantId = getNonEmptyValue(
      this.configService.get<string>('TENANT_ID'),
    );
    const clientId = getNonEmptyValue(
      this.configService.get<string>('CLIENT_ID'),
    );
    const clientSecret = getNonEmptyValue(
      this.configService.get<string>('CLIENT_SECRET'),
    );
    const certificateRelativePath = getNonEmptyValue(
      this.configService.get<string>('CERT_PRIVATE_KEY_PATH'),
    );
    const expectedThumbprint = normalizeThumbprint(
      this.configService.get<string>('CERT_THUMBPRINT'),
    );

    if (!tenantId || !clientId) {
      throw new Error(
        'Configure TENANT_ID e CLIENT_ID no ambiente para usar Microsoft Graph.',
      );
    }

    if (!certificateRelativePath && !clientSecret) {
      throw new Error(
        'Configure CLIENT_SECRET ou CERT_PRIVATE_KEY_PATH/CERT_THUMBPRINT para autenticar no Microsoft Graph.',
      );
    }

    if (!this.credential) {
      if (certificateRelativePath) {
        const certificatePath = resolve(API_ROOT, certificateRelativePath);

        if (!existsSync(certificatePath)) {
          throw new Error(
            `Certificado não encontrado em ${certificatePath}. Verifique CERT_PRIVATE_KEY_PATH.`,
          );
        }

        if (!expectedThumbprint) {
          throw new Error(
            'Configure CERT_THUMBPRINT para autenticar no Microsoft Graph com certificado.',
          );
        }

        const actualThumbprint = readCertificateThumbprint(certificatePath);
        if (actualThumbprint !== expectedThumbprint) {
          throw new Error(
            `O thumbprint configurado em CERT_THUMBPRINT nao corresponde ao certificado em ${certificatePath}.`,
          );
        }

        this.credential = new ClientCertificateCredential(tenantId, clientId, {
          certificatePath,
        });
        this.authMethod = 'client-certificate';
        this.certificatePath = certificatePath;
        this.certificateThumbprint = actualThumbprint;
      } else {
        this.credential = new ClientSecretCredential(
          tenantId,
          clientId,
          clientSecret,
        );
        this.authMethod = 'client-secret';
        this.certificatePath = null;
        this.certificateThumbprint = null;
      }
    }

    return this.credential;
  }

  async authenticate() {
    const scope =
      getNonEmptyValue(this.configService.get<string>('GRAPH_SCOPE')) ||
      DEFAULT_GRAPH_SCOPE;
    const token = await this.getCredential().getToken([scope]);
    if (!token?.token) {
      throw new Error('Falha ao obter token de acesso do Microsoft Graph.');
    }

    this.cachedToken = token.token;
    this.cachedTokenExpiresOn =
      token.expiresOnTimestamp || Date.now() + 45 * 60 * 1000;
    this.lastAuthTime = new Date().toISOString();

    return true;
  }

  async getAccessToken() {
    const now = Date.now();
    if (this.cachedToken && now < this.cachedTokenExpiresOn - 120000) {
      return this.cachedToken;
    }

    await this.authenticate();
    return this.cachedToken;
  }
}
