import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AskAndAnswerResourceContextContract,
  LlmOpsResourceCatalogContract,
} from '@api-llm-embedded/shared';
import {
  RESOURCE_CATALOG,
  RESOURCE_EXECUTION_MODE,
  type ResourceIntent,
} from './resource-catalog.js';

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

@Injectable()
export class ResourceReadonlyAdapterService {
  constructor(private readonly configService: ConfigService) {}

  getCatalog(): LlmOpsResourceCatalogContract {
    return {
      executionMode: RESOURCE_EXECUTION_MODE,
      resources: RESOURCE_CATALOG,
    };
  }

  async fetchResourceContext(
    intent: ResourceIntent,
  ): Promise<AskAndAnswerResourceContextContract> {
    const snapshot = await this.fetchDomainSnapshot(intent.domain);

    return {
      domain: intent.domain,
      resource: intent.resource,
      consultedEndpoint: snapshot.consultedEndpoint,
      summary: snapshot.summary,
      snapshot: snapshot.payload,
    };
  }

  private async fetchDomainSnapshot(domain: ResourceIntent['domain']): Promise<{
    consultedEndpoint: string | null;
    summary: string;
    payload: Record<string, unknown> | null;
  }> {
    switch (domain) {
      case 'users':
        return this.fetchSimpleList('/users', 'users');
      case 'graph':
        return this.fetchSimpleObject(
          '/graph/auth/status',
          'graph-auth-status',
        );
      case 'sync':
        return this.fetchSimpleList('/sync/jobs', 'sync-jobs');
      case 'governance':
        return this.fetchSimpleObject(
          '/governance/permissions/validation',
          'governance-validation',
        );
      case 'audit':
        return this.fetchSimpleObject('/audit/stats', 'audit-stats');
      case 'llm-ops':
        return this.fetchSimpleList('/llm-ops/agents', 'llm-ops-agents');
      case 'sharepoint':
        return this.fetchSharePointSnapshot();
      default:
        return {
          consultedEndpoint: null,
          summary: 'Domínio sem adaptador de snapshot.',
          payload: null,
        };
    }
  }

  private async fetchSharePointSnapshot(): Promise<{
    consultedEndpoint: string | null;
    summary: string;
    payload: Record<string, unknown> | null;
  }> {
    const response = await this.fetchJson<
      ApiResponse<Array<Record<string, unknown>>>
    >('/governance/permissions/matrix');
    if (
      !response.ok ||
      !response.body?.success ||
      !Array.isArray(response.body.data)
    ) {
      return {
        consultedEndpoint: '/governance/permissions/matrix',
        summary:
          'SharePoint snapshot indisponível; use siteId/listId/driveId para consulta detalhada.',
        payload: null,
      };
    }

    const sharePointRows = response.body.data.filter(
      (row) =>
        typeof row?.endpoint === 'string' &&
        row.endpoint.startsWith('/sharepoint'),
    );

    return {
      consultedEndpoint: '/governance/permissions/matrix',
      summary: `SharePoint possui ${sharePointRows.length} endpoints mapeados na matriz de permissões.`,
      payload: {
        endpointsMapped: sharePointRows.length,
      },
    };
  }

  private async fetchSimpleList(
    path: string,
    label: string,
  ): Promise<{
    consultedEndpoint: string;
    summary: string;
    payload: Record<string, unknown> | null;
  }> {
    const response =
      await this.fetchJson<ApiResponse<Array<Record<string, unknown>>>>(path);
    if (
      !response.ok ||
      !response.body?.success ||
      !Array.isArray(response.body.data)
    ) {
      return {
        consultedEndpoint: path,
        summary: `Snapshot de ${label} indisponível no momento; manter recomendação read-only.`,
        payload: null,
      };
    }

    return {
      consultedEndpoint: path,
      summary: `Snapshot de ${label} disponível com ${response.body.data.length} registro(s).`,
      payload: {
        count: response.body.data.length,
      },
    };
  }

  private async fetchSimpleObject(
    path: string,
    label: string,
  ): Promise<{
    consultedEndpoint: string;
    summary: string;
    payload: Record<string, unknown> | null;
  }> {
    const response =
      await this.fetchJson<ApiResponse<Record<string, unknown>>>(path);
    if (
      !response.ok ||
      !response.body?.success ||
      !response.body.data ||
      typeof response.body.data !== 'object'
    ) {
      return {
        consultedEndpoint: path,
        summary: `Snapshot de ${label} indisponível no momento; manter recomendação read-only.`,
        payload: null,
      };
    }

    return {
      consultedEndpoint: path,
      summary: `Snapshot de ${label} coletado com sucesso.`,
      payload: response.body.data,
    };
  }

  private async fetchJson<T>(
    path: string,
  ): Promise<{ ok: boolean; body: T | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(`${this.readApiBaseUrl()}${path}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as T) : null;
      return { ok: response.ok, body: parsed };
    } catch {
      return { ok: false, body: null };
    } finally {
      clearTimeout(timeout);
    }
  }

  private readApiBaseUrl(): string {
    const host = this.configService.get<string>('HOST') ?? '127.0.0.1';
    const port = Number(this.configService.get<string>('PORT') ?? '3000');
    const normalizedHost = host === '0.0.0.0' ? '127.0.0.1' : host;
    return `http://${normalizedHost}:${port}`;
  }
}
