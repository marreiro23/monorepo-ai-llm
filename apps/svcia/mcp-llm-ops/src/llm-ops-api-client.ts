export type LlmOpsAgentRecord = {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  primaryObjective: string;
  supportedSources: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromptTemplateRecord = {
  id: string;
  agentId: string;
  slug: string;
  name: string;
  description: string;
  promptKind: string;
  targetScope: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TopicFlowRecord = {
  id: string;
  agentId: string;
  slug: string;
  name: string;
  description: string;
  topicDomain: string;
  invocationSource: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AskAndAnswerRequest = {
  message: string;
  agentId?: string | null;
  promptTemplateId?: string | null;
  topicFlowId?: string | null;
  topicFlowVersionId?: string | null;
  invocationSource?: string | null;
  sessionFingerprint?: string | null;
};

export type AskAndAnswerPayload = {
  answer: string;
  runtimeOutcome: string;
  retrievedContext: string[];
  resourceContext?: Record<string, unknown>;
  recommendedActions?: Array<Record<string, unknown>>;
  executionMode?: string;
  correlationId?: string;
  orchestration?: Record<string, unknown>;
};

export type ResourceCatalogRecord = {
  executionMode: string;
  resources: Array<{
    domain: string;
    description: string;
    readableEndpoints: string[];
    writeEndpoints: string[];
    llmAccess: string;
  }>;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export class LlmOpsApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl = 'http://localhost:3002', fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async listAgents(limit = 50): Promise<LlmOpsAgentRecord[]> {
    const response =
      await this.request<ApiResponse<LlmOpsAgentRecord[]>>('/llm-ops/agents');
    return this.readList(response, 'agents').slice(0, limit);
  }

  async listPrompts(
    agentId?: string | null,
    limit = 50,
  ): Promise<PromptTemplateRecord[]> {
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
    const response = await this.request<ApiResponse<PromptTemplateRecord[]>>(
      `/llm-ops/prompt-templates${query}`,
    );
    return this.readList(response, 'prompt templates').slice(0, limit);
  }

  async listTopicFlows(
    agentId?: string | null,
    topicDomain?: string | null,
    limit = 50,
  ): Promise<TopicFlowRecord[]> {
    const params = new URLSearchParams();
    if (agentId) {
      params.set('agentId', agentId);
    }
    if (topicDomain) {
      params.set('topicDomain', topicDomain);
    }

    const query = params.size > 0 ? `?${params.toString()}` : '';
    const response = await this.request<ApiResponse<TopicFlowRecord[]>>(
      `/llm-ops/topic-flows${query}`,
    );
    return this.readList(response, 'topic flows').slice(0, limit);
  }

  async askAndAnswer(
    payload: AskAndAnswerRequest,
  ): Promise<AskAndAnswerPayload> {
    const response = await this.request<ApiResponse<AskAndAnswerPayload>>(
      '/llm-ops/chat',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    if (!response.success || !response.data) {
      throw new Error(
        response.message ?? 'LLM Ops chat returned an invalid response',
      );
    }

    return response.data;
  }

  async listResourcesCatalog(): Promise<ResourceCatalogRecord> {
    const response = await this.request<ApiResponse<ResourceCatalogRecord>>(
      '/llm-ops/resources/catalog',
    );
    if (!response.success || !response.data) {
      throw new Error(
        response.message ??
          'LLM Ops resource catalog returned an invalid response',
      );
    }

    return response.data;
  }

  private readList<T>(response: ApiResponse<T[]>, label: string): T[] {
    if (!response.success || !Array.isArray(response.data)) {
      throw new Error(
        response.message ?? `LLM Ops API returned an invalid ${label} response`,
      );
    }

    return response.data;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      body: init.body,
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as T) : null;
    if (!response.ok) {
      throw new Error(
        `LLM Ops API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`,
      );
    }

    return payload as T;
  }
}
