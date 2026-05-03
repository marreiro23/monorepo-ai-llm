export type SecretProvider =
  | 'process-env'
  | 'azure-key-vault'
  | 'local-vault-container'
  | 'external-vault';

export type SecretAction = 'register' | 'rotate' | 'revoke';

export type SecretCatalogEntry = {
  logicalKey: string;
  targetName: string;
  provider: SecretProvider;
  requiredBy: string[];
  description: string;
  rotationSupported: boolean;
};

export type SecretMetadata = SecretCatalogEntry & {
  configured: boolean;
  valueStatus: 'redacted';
  valuePreview: '[redacted]';
};

export type SecretOperationPlan = {
  operationId: string;
  action: SecretAction;
  logicalKey: string;
  targetName: string;
  provider: SecretProvider;
  dryRun: true;
  approvalRequired: true;
  mutationAllowed: false;
  status: 'prepared';
  requestedBy: string | null;
  reason: string;
  safetyChecks: string[];
  steps: string[];
  approvalGate: {
    required: true;
    approved: false;
    requiredBeforeMutation: true;
  };
  rollbackPlan: string[];
  audit: {
    durableHistoryRequired: true;
    historyTarget: 'persistent-operation-store';
    correlationId: string;
  };
};

export type ListSecretsOptions = {
  includeUnconfigured?: boolean;
  limit?: number;
  provider?: SecretProvider;
};

export type PrepareOperationInput = {
  action: SecretAction;
  logicalKey: string;
  targetName?: string | null;
  provider?: SecretProvider | null;
  requestedBy?: string | null;
  reason?: string | null;
  correlationId?: string | null;
};

export type EnvironmentLike = NodeJS.ProcessEnv;

const DEFAULT_SECRET_CATALOG: SecretCatalogEntry[] = [
  {
    logicalKey: 'astra.application.token',
    targetName: 'ASTRA_DB_APPLICATION_TOKEN',
    provider: 'process-env',
    requiredBy: ['apps/api', 'apps/web', 'llm-ops-rag'],
    description: 'Astra DB application token for vector store access.',
    rotationSupported: true,
  },
  {
    logicalKey: 'entra.certificate.thumbprint',
    targetName: 'CERT_THUMBPRINT',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description:
      'Microsoft Entra certificate thumbprint for Graph authentication.',
    rotationSupported: true,
  },
  {
    logicalKey: 'entra.client.id',
    targetName: 'CLIENT_ID',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description: 'Microsoft Entra application (client) ID.',
    rotationSupported: false,
  },
  {
    logicalKey: 'graph.client.secret',
    targetName: 'GRAPH_CLIENT_SECRET',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description:
      'Microsoft Graph client secret (alternative to certificate auth).',
    rotationSupported: true,
  },
  {
    logicalKey: 'graph.certificate.pem',
    targetName: 'GRAPH_CERTIFICATE_PEM',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description: 'Microsoft Graph certificate PEM content.',
    rotationSupported: true,
  },
  {
    logicalKey: 'langflow.api.key',
    targetName: 'LANGFLOW_API_KEY',
    provider: 'process-env',
    requiredBy: ['apps/api', 'llm-ops-rag'],
    description: 'Langflow API key for RAG pipeline access.',
    rotationSupported: true,
  },
  {
    logicalKey: 'llm.api.key',
    targetName: 'LLM_API_KEY',
    provider: 'process-env',
    requiredBy: ['apps/api', 'llm-ops'],
    description: 'OpenAI / LLM provider API key for completions.',
    rotationSupported: true,
  },
  {
    logicalKey: 'postgres.llm.password',
    targetName: 'LLM_PG_PASSWORD',
    provider: 'process-env',
    requiredBy: ['apps/api', 'typeorm', 'llm-ops-domain'],
    description: 'PostgreSQL password for the llm_ops schema connection.',
    rotationSupported: true,
  },
  {
    logicalKey: 'postgres.primary.password',
    targetName: 'PG_PASSWORD',
    provider: 'process-env',
    requiredBy: ['apps/api', 'typeorm'],
    description:
      'PostgreSQL password for the primary (public schema) connection.',
    rotationSupported: true,
  },
  {
    logicalKey: 'postgres.superuser.password',
    targetName: 'POSTGRES_PASSWORD',
    provider: 'process-env',
    requiredBy: ['docker-compose', 'postgres-init'],
    description:
      'PostgreSQL superuser password used by the Docker postgres service.',
    rotationSupported: true,
  },
  {
    logicalKey: 'entra.tenant.id',
    targetName: 'TENANT_ID',
    provider: 'process-env',
    requiredBy: ['apps/api', 'graph-auth'],
    description: 'Microsoft Entra tenant ID.',
    rotationSupported: false,
  },
];

export class SecretsRegistry {
  private readonly catalog: SecretCatalogEntry[];
  private readonly env: EnvironmentLike;

  constructor(
    env: EnvironmentLike = process.env,
    catalog: SecretCatalogEntry[] = DEFAULT_SECRET_CATALOG,
  ) {
    this.env = env;
    this.catalog = [...catalog].sort((left, right) =>
      left.logicalKey.localeCompare(right.logicalKey),
    );
  }

  listSecrets(options: ListSecretsOptions = {}): SecretMetadata[] {
    const includeUnconfigured = options.includeUnconfigured ?? true;
    const limit = options.limit ?? 100;

    return this.catalog
      .filter(
        (entry) => !options.provider || entry.provider === options.provider,
      )
      .map((entry) => this.toMetadata(entry))
      .filter((entry) => includeUnconfigured || entry.configured)
      .slice(0, limit);
  }

  prepareOperation(input: PrepareOperationInput): SecretOperationPlan {
    const catalogEntry = this.findOrCreateEntry(input);
    const correlationId =
      input.correlationId?.trim() ||
      this.createCorrelationId(input.action, catalogEntry.logicalKey);
    const reason = input.reason?.trim() || 'No reason supplied; dry-run only.';

    return {
      operationId: correlationId,
      action: input.action,
      logicalKey: catalogEntry.logicalKey,
      targetName: catalogEntry.targetName,
      provider: catalogEntry.provider,
      dryRun: true,
      approvalRequired: true,
      mutationAllowed: false,
      status: 'prepared',
      requestedBy: input.requestedBy?.trim() || null,
      reason,
      safetyChecks: [
        'Secret value was not requested, read, logged, or returned.',
        'Mutation is blocked in this MCP slice.',
        'Explicit approval and durable history are required before any future write path.',
        'Rollback plan is generated before any future provider operation.',
      ],
      steps: this.stepsFor(input.action, catalogEntry),
      approvalGate: {
        required: true,
        approved: false,
        requiredBeforeMutation: true,
      },
      rollbackPlan: this.rollbackFor(input.action, catalogEntry),
      audit: {
        durableHistoryRequired: true,
        historyTarget: 'persistent-operation-store',
        correlationId,
      },
    };
  }

  private findOrCreateEntry(input: PrepareOperationInput): SecretCatalogEntry {
    const logicalKey = input.logicalKey.trim();
    const existing = this.catalog.find(
      (entry) => entry.logicalKey === logicalKey,
    );
    if (existing) {
      return existing;
    }

    return {
      logicalKey,
      targetName: input.targetName?.trim() || this.toEnvName(logicalKey),
      provider: input.provider ?? 'external-vault',
      requiredBy: [],
      description:
        'Dry-run metadata for a logical key not yet present in the catalog.',
      rotationSupported: true,
    };
  }

  private toMetadata(entry: SecretCatalogEntry): SecretMetadata {
    return {
      ...entry,
      configured: Object.prototype.hasOwnProperty.call(
        this.env,
        entry.targetName,
      ),
      valueStatus: 'redacted',
      valuePreview: '[redacted]',
    };
  }

  private stepsFor(action: SecretAction, entry: SecretCatalogEntry): string[] {
    const base = [
      `Resolve provider metadata for ${entry.provider}.`,
      `Open durable operation record for ${entry.logicalKey}.`,
      'Require explicit approval before mutation.',
    ];

    if (action === 'register') {
      return [
        ...base,
        `Validate target name ${entry.targetName} without receiving a secret value.`,
        'After approval in a future slice, register value through the provider write API.',
      ];
    }

    if (action === 'rotate') {
      return [
        ...base,
        `Prepare new version placeholder for ${entry.targetName} without materializing the value.`,
        'After approval in a future slice, rotate through the provider write API and verify dependents.',
      ];
    }

    return [
      ...base,
      `Mark ${entry.targetName} as pending revocation without deleting or disabling it.`,
      'After approval in a future slice, revoke through the provider write API and verify dependents.',
    ];
  }

  private rollbackFor(
    action: SecretAction,
    entry: SecretCatalogEntry,
  ): string[] {
    if (action === 'register') {
      return [
        `Remove pending registration record for ${entry.logicalKey}.`,
        'Keep provider state unchanged because this dry-run performs no write.',
      ];
    }

    if (action === 'rotate') {
      return [
        `Keep current active version for ${entry.logicalKey}.`,
        'Discard prepared replacement metadata because this dry-run performs no write.',
      ];
    }

    return [
      `Keep ${entry.logicalKey} active.`,
      'Discard pending revocation metadata because this dry-run performs no write.',
    ];
  }

  private toEnvName(logicalKey: string): string {
    return logicalKey
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  private createCorrelationId(
    action: SecretAction,
    logicalKey: string,
  ): string {
    const safeKey = logicalKey.replace(/[^A-Za-z0-9_.-]+/g, '-').slice(0, 64);
    return `mcp-secrets-${action}-${safeKey}-${Date.now()}`;
  }
}
