import type {
  LlmOpsResourceCatalogItemContract,
  LlmOpsResourceDomainContract,
} from '@api-llm-embedded/shared';

export const RESOURCE_EXECUTION_MODE = 'read-only-recommendation' as const;

export const RESOURCE_CATALOG: LlmOpsResourceCatalogItemContract[] = [
  {
    domain: 'users',
    description: 'Consulta de usuários persistidos no domínio Users.',
    readableEndpoints: ['/users', '/users/:id'],
    writeEndpoints: ['/users (POST)', '/users/:id (PATCH|DELETE)'],
    llmAccess: RESOURCE_EXECUTION_MODE,
  },
  {
    domain: 'graph',
    description: 'Status e leitura de recursos Microsoft Graph / Entra ID.',
    readableEndpoints: [
      '/graph/config',
      '/graph/auth/status',
      '/graph/sites',
      '/graph/users',
      '/graph/groups',
    ],
    writeEndpoints: [
      '/graph/groups (POST)',
      '/graph/provisioning/team-site (POST)',
    ],
    llmAccess: RESOURCE_EXECUTION_MODE,
  },
  {
    domain: 'sharepoint',
    description: 'Operações de bibliotecas, itens e permissões SharePoint.',
    readableEndpoints: [
      '/sharepoint/drives/:driveId/items',
      '/sharepoint/sites/:siteId/lists/:listId/items',
    ],
    writeEndpoints: ['/sharepoint/... (POST|PUT|PATCH|DELETE)'],
    llmAccess: RESOURCE_EXECUTION_MODE,
  },
  {
    domain: 'sync',
    description: 'Estado de sincronizações e entidades sincronizadas.',
    readableEndpoints: [
      '/sync/jobs',
      '/sync/sites',
      '/sync/users',
      '/sync/groups',
      '/sync/teams',
    ],
    writeEndpoints: ['/sync/jobs (POST)'],
    llmAccess: RESOURCE_EXECUTION_MODE,
  },
  {
    domain: 'governance',
    description: 'Matriz de permissões e conformidade operacional.',
    readableEndpoints: [
      '/governance',
      '/governance/permissions/matrix',
      '/governance/permissions/validation',
    ],
    writeEndpoints: [],
    llmAccess: RESOURCE_EXECUTION_MODE,
  },
  {
    domain: 'audit',
    description: 'Leitura de auditoria operacional e estatísticas.',
    readableEndpoints: ['/audit', '/audit/log', '/audit/stats'],
    writeEndpoints: ['/audit/log (DELETE)'],
    llmAccess: RESOURCE_EXECUTION_MODE,
  },
  {
    domain: 'llm-ops',
    description: 'Estado operacional de agentes, prompts e fluxo de tópicos.',
    readableEndpoints: [
      '/llm-ops/agents',
      '/llm-ops/prompt-templates',
      '/llm-ops/topic-flows',
    ],
    writeEndpoints: ['/llm-ops/* (POST|PATCH)'],
    llmAccess: RESOURCE_EXECUTION_MODE,
  },
];

export type ResourceIntent = {
  domain: LlmOpsResourceDomainContract;
  resource: string;
};

const DOMAIN_KEYWORDS: Array<{
  domain: LlmOpsResourceDomainContract;
  keywords: string[];
}> = [
  {
    domain: 'users',
    keywords: ['user', 'users', 'usuario', 'usuarios', 'membro', 'membros'],
  },
  {
    domain: 'graph',
    keywords: [
      'graph',
      'entra',
      'azure ad',
      'group',
      'groups',
      'team',
      'teams',
    ],
  },
  {
    domain: 'sharepoint',
    keywords: [
      'sharepoint',
      'drive',
      'library',
      'lista',
      'list item',
      'documento',
    ],
  },
  {
    domain: 'sync',
    keywords: ['sync', 'sincron', 'job', 'jobs', 'replicacao'],
  },
  {
    domain: 'governance',
    keywords: ['governance', 'permiss', 'compliance', 'matriz', 'openapi'],
  },
  {
    domain: 'audit',
    keywords: ['audit', 'auditoria', 'log', 'trilha', 'evidencia'],
  },
  {
    domain: 'llm-ops',
    keywords: [
      'llm',
      'rag',
      'prompt',
      'topic flow',
      'ask and answer',
      'langflow',
      'astra',
    ],
  },
];

export function detectResourceIntent(message: string): ResourceIntent {
  const normalized = message.toLowerCase();

  for (const candidate of DOMAIN_KEYWORDS) {
    if (candidate.keywords.some((keyword) => normalized.includes(keyword))) {
      return {
        domain: candidate.domain,
        resource:
          candidate.keywords.find((keyword) => normalized.includes(keyword)) ??
          candidate.domain,
      };
    }
  }

  return {
    domain: 'llm-ops',
    resource: 'operational-status',
  };
}
