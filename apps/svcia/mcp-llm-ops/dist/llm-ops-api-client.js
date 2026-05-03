export class LlmOpsApiClient {
    baseUrl;
    fetchImpl;
    constructor(baseUrl = 'http://localhost:3002', fetchImpl = fetch) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.fetchImpl = fetchImpl;
    }
    async listAgents(limit = 50) {
        const response = await this.request('/llm-ops/agents');
        return this.readList(response, 'agents').slice(0, limit);
    }
    async listPrompts(agentId, limit = 50) {
        const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
        const response = await this.request(`/llm-ops/prompt-templates${query}`);
        return this.readList(response, 'prompt templates').slice(0, limit);
    }
    async listTopicFlows(agentId, topicDomain, limit = 50) {
        const params = new URLSearchParams();
        if (agentId) {
            params.set('agentId', agentId);
        }
        if (topicDomain) {
            params.set('topicDomain', topicDomain);
        }
        const query = params.size > 0 ? `?${params.toString()}` : '';
        const response = await this.request(`/llm-ops/topic-flows${query}`);
        return this.readList(response, 'topic flows').slice(0, limit);
    }
    async askAndAnswer(payload) {
        const response = await this.request('/llm-ops/chat', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.success || !response.data) {
            throw new Error(response.message ?? 'LLM Ops chat returned an invalid response');
        }
        return response.data;
    }
    async listResourcesCatalog() {
        const response = await this.request('/llm-ops/resources/catalog');
        if (!response.success || !response.data) {
            throw new Error(response.message ?? 'LLM Ops resource catalog returned an invalid response');
        }
        return response.data;
    }
    readList(response, label) {
        if (!response.success || !Array.isArray(response.data)) {
            throw new Error(response.message ?? `LLM Ops API returned an invalid ${label} response`);
        }
        return response.data;
    }
    async request(path, init = {}) {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
            method: init.method ?? 'GET',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                ...(init.headers ?? {})
            },
            body: init.body
        });
        const text = await response.text();
        const payload = text ? JSON.parse(text) : null;
        if (!response.ok) {
            throw new Error(`LLM Ops API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`);
        }
        return payload;
    }
}
