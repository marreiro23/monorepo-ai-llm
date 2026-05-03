import { Injectable } from '@nestjs/common';
import { AuditEventsService } from '../../common/events/audit-events.service.js';

type GovernancePermissionRecord = {
  endpoint: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  upstreamApi: 'graph';
  upstreamPath: string;
  minimumScopes: string[];
  rationale: string;
};

@Injectable()
export class GovernanceService {
  constructor(private readonly auditEventsService: AuditEventsService) {}

  private readonly permissionMatrix: GovernancePermissionRecord[] = [
    {
      endpoint: '/graph/sites',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/sites',
      minimumScopes: ['Sites.Read.All'],
      rationale: 'Lista sites do tenant para descoberta inicial.',
    },
    {
      endpoint: '/graph/sites/:siteId',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}',
      minimumScopes: ['Sites.Read.All'],
      rationale: 'Consulta metadados do site selecionado.',
    },
    {
      endpoint: '/graph/sites/:siteId/drives',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}/drives',
      minimumScopes: ['Sites.Read.All'],
      rationale: 'Lista bibliotecas e drives associados ao site.',
    },
    {
      endpoint: '/graph/sites/:siteId/permissions',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}/permissions',
      minimumScopes: ['Sites.Read.All'],
      rationale: 'Lê permissões efetivas do site para inspeção.',
    },
    {
      endpoint: '/graph/sites/:siteId/libraries',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}/lists',
      minimumScopes: ['Sites.Read.All'],
      rationale: 'Lê listas e bibliotecas SharePoint do site.',
    },
    {
      endpoint: '/graph/sites/:siteId/libraries/:listId',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}/lists/{listId}',
      minimumScopes: ['Sites.Read.All'],
      rationale: 'Lê metadados detalhados de uma biblioteca.',
    },
    {
      endpoint: '/graph/users',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/users',
      minimumScopes: ['User.Read.All'],
      rationale: 'Lista usuários do diretório para seleção e lookup.',
    },
    {
      endpoint: '/graph/groups',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/groups',
      minimumScopes: ['Group.Read.All'],
      rationale: 'Lista grupos do diretório para associação e leitura.',
    },
    {
      endpoint: '/graph/drives/:driveId/root/permissions',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/drives/{driveId}/root/permissions',
      minimumScopes: ['Files.Read.All'],
      rationale: 'Lê permissões do item raiz do drive.',
    },
    {
      endpoint: '/sharepoint/drives/:driveId/items',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/drives/{driveId}/root/children',
      minimumScopes: ['Files.Read.All'],
      rationale: 'Lista arquivos e pastas do drive.',
    },
    {
      endpoint: '/sharepoint/drives/:driveId/items/:itemId',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/drives/{driveId}/items/{itemId}',
      minimumScopes: ['Files.Read.All'],
      rationale: 'Lê um item específico do drive.',
    },
    {
      endpoint: '/sharepoint/drives/:driveId/items/:itemId/children',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/drives/{driveId}/items/{itemId}/children',
      minimumScopes: ['Files.Read.All'],
      rationale: 'Lista filhos de uma pasta específica.',
    },
    {
      endpoint: '/sharepoint/drives/:driveId/items/:parentItemId/folders',
      method: 'POST',
      upstreamApi: 'graph',
      upstreamPath: '/drives/{driveId}/items/{parentItemId}/children',
      minimumScopes: ['Files.ReadWrite.All'],
      rationale: 'Cria pasta no drive e exige escrita no conteúdo.',
    },
    {
      endpoint:
        '/sharepoint/drives/:driveId/items/:parentItemId/files/:fileName',
      method: 'POST',
      upstreamApi: 'graph',
      upstreamPath:
        '/drives/{driveId}/items/{parentItemId}:/{fileName}:/content',
      minimumScopes: ['Files.ReadWrite.All'],
      rationale: 'Faz upload de conteúdo binário em um drive.',
    },
    {
      endpoint: '/sharepoint/drives/:driveId/items/:itemId',
      method: 'PATCH',
      upstreamApi: 'graph',
      upstreamPath: '/drives/{driveId}/items/{itemId}',
      minimumScopes: ['Files.ReadWrite.All'],
      rationale: 'Atualiza metadados do drive item.',
    },
    {
      endpoint: '/sharepoint/drives/:driveId/items/:itemId',
      method: 'DELETE',
      upstreamApi: 'graph',
      upstreamPath: '/drives/{driveId}/items/{itemId}',
      minimumScopes: ['Files.ReadWrite.All'],
      rationale: 'Remove item do drive e exige permissão de escrita.',
    },
    {
      endpoint: '/sharepoint/drives/:driveId/items/:itemId/invite',
      method: 'POST',
      upstreamApi: 'graph',
      upstreamPath: '/drives/{driveId}/items/{itemId}/invite',
      minimumScopes: ['Files.ReadWrite.All'],
      rationale: 'Concede compartilhamento sobre item já existente.',
    },
    {
      endpoint:
        '/sharepoint/drives/:driveId/items/:itemId/permissions/:permissionId',
      method: 'DELETE',
      upstreamApi: 'graph',
      upstreamPath:
        '/drives/{driveId}/items/{itemId}/permissions/{permissionId}',
      minimumScopes: ['Files.ReadWrite.All'],
      rationale: 'Revoga compartilhamento previamente criado.',
    },
    {
      endpoint: '/sharepoint/sites/:siteId/lists/:listId/items',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}/lists/{listId}/items?expand=fields',
      minimumScopes: ['Sites.Read.All'],
      rationale: 'Lê itens de lista com seus fields.',
    },
    {
      endpoint: '/sharepoint/sites/:siteId/lists/:listId/items/:itemId',
      method: 'GET',
      upstreamApi: 'graph',
      upstreamPath:
        '/sites/{siteId}/lists/{listId}/items/{itemId}?expand=fields',
      minimumScopes: ['Sites.Read.All'],
      rationale: 'Lê um item específico da lista.',
    },
    {
      endpoint: '/sharepoint/sites/:siteId/lists/:listId/items',
      method: 'POST',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}/lists/{listId}/items',
      minimumScopes: ['Sites.ReadWrite.All'],
      rationale: 'Cria item na lista e exige escrita no site.',
    },
    {
      endpoint: '/sharepoint/sites/:siteId/lists/:listId/items/:itemId',
      method: 'PATCH',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}/lists/{listId}/items/{itemId}/fields',
      minimumScopes: ['Sites.ReadWrite.All'],
      rationale: 'Atualiza fields do item da lista.',
    },
    {
      endpoint: '/sharepoint/sites/:siteId/lists/:listId/items/:itemId',
      method: 'DELETE',
      upstreamApi: 'graph',
      upstreamPath: '/sites/{siteId}/lists/{listId}/items/{itemId}',
      minimumScopes: ['Sites.ReadWrite.All'],
      rationale: 'Exclui item da lista.',
    },
  ];

  getStatus() {
    return {
      domain: 'governance',
      matrixEntries: this.permissionMatrix.length,
      status: 'active',
      success: true,
    };
  }

  getPermissionMatrix() {
    // Registra acesso à matriz de permissões
    this.auditEventsService.emitMatrixAccess({
      accessType: 'read',
      details: {
        totalEndpoints: this.permissionMatrix.length,
      },
    });

    return {
      success: true,
      data: this.permissionMatrix,
    };
  }

  validatePermissionMatrix() {
    const invalidRecords = this.permissionMatrix.filter((record) => {
      if (!record.endpoint || !record.upstreamPath || !record.rationale) {
        return true;
      }

      if (record.minimumScopes.length === 0) {
        return true;
      }

      if (record.method === 'GET') {
        return false;
      }

      return !record.minimumScopes.some((scope) => scope.includes('ReadWrite'));
    });

    const result = {
      success: invalidRecords.length === 0,
      data: {
        checkedAt: new Date().toISOString(),
        invalidRecords,
        valid: invalidRecords.length === 0,
        validatedEndpoints: this.permissionMatrix.length,
      },
    };

    // Registra validação de permissões
    this.auditEventsService.emitPermissionValidation({
      validatedEndpoints: this.permissionMatrix.length,
      invalidRecords: invalidRecords.length,
      result: invalidRecords.length === 0 ? 'success' : 'failure',
      details: {
        invalidEndpoints: invalidRecords.map((r) => r.endpoint),
      },
    });

    return result;
  }

  getOpenApiPermissionsReport() {
    // Agrupa endpoints por domínio
    const byDomain = this.permissionMatrix.reduce(
      (acc, record) => {
        const domain = record.endpoint.split('/')[1] || 'unknown'; // Extrai 'graph' ou 'sharepoint'
        if (!acc[domain]) {
          acc[domain] = [];
        }
        acc[domain].push(record);
        return acc;
      },
      {} as Record<string, GovernancePermissionRecord[]>,
    );

    // Gera estatísticas por domínio
    const domainStats = Object.entries(byDomain).map(([domain, records]) => {
      const readOps = records.filter((r) => r.method === 'GET').length;
      const writeOps = records.filter((r) => r.method !== 'GET').length;
      const uniqueScopes = [
        ...new Set(records.flatMap((r) => r.minimumScopes)),
      ];

      return {
        domain,
        totalEndpoints: records.length,
        readOperations: readOps,
        writeOperations: writeOps,
        uniqueScopes: uniqueScopes.length,
        scopes: uniqueScopes,
        endpoints: records.map((r) => ({
          path: r.endpoint,
          method: r.method,
          upstreamPath: r.upstreamPath,
          scopes: r.minimumScopes,
          rationale: r.rationale,
        })),
      };
    });

    // Análise de conformidade
    const conformanceIssues = this.permissionMatrix.filter((record) => {
      // Verifica se operações de escrita usam ReadWrite
      if (record.method !== 'GET') {
        return !record.minimumScopes.some((scope) =>
          scope.includes('ReadWrite'),
        );
      }
      return false;
    });

    return {
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          totalEndpoints: this.permissionMatrix.length,
          totalDomains: Object.keys(byDomain).length,
          totalUniqueScopes: [
            ...new Set(this.permissionMatrix.flatMap((r) => r.minimumScopes)),
          ].length,
          conformanceIssues: conformanceIssues.length,
        },
        domains: domainStats,
        conformance: {
          valid: conformanceIssues.length === 0,
          issues: conformanceIssues.map((r) => ({
            endpoint: r.endpoint,
            method: r.method,
            issue: 'Write operation without ReadWrite scope',
            currentScopes: r.minimumScopes,
          })),
        },
        recommendations: [
          'Revisar endpoints com permissões amplas (.All) para possível redução de escopo',
          'Considerar delegated permissions para operações específicas de usuário',
          'Implementar cache de tokens para reduzir chamadas de autenticação',
          'Adicionar rate limiting por scope para proteção adicional',
        ],
      },
    };
  }
}
