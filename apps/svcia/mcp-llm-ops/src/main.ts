import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LlmOpsApiClient } from './llm-ops-api-client.js';

const llmOpsApiUrl = process.env.LLM_OPS_API_URL ?? 'http://localhost:3002';
const llmOpsClient = new LlmOpsApiClient(llmOpsApiUrl);

const server = new McpServer({
  name: 'llm-ops-readonly-mcp',
  version: '1.0.0',
});

server.registerTool(
  'agents_list',
  {
    title: 'List LLM Ops Agents',
    description: 'Lista agentes por GET /llm-ops/agents. Somente leitura.',
    inputSchema: {
      limit: z.number().int().positive().max(200).optional(),
    },
  },
  async ({ limit = 50 }) => {
    const agents = await llmOpsClient.listAgents(limit);
    const payload = { llmOpsApiUrl, count: agents.length, agents };
    return toToolResult(payload);
  },
);

server.registerTool(
  'prompts_list',
  {
    title: 'List Prompt Templates',
    description:
      'Lista templates de prompt por GET /llm-ops/prompt-templates. Somente leitura.',
    inputSchema: {
      agentId: z.string().uuid().optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
  },
  async ({ agentId, limit = 50 }) => {
    const prompts = await llmOpsClient.listPrompts(agentId, limit);
    const payload = {
      llmOpsApiUrl,
      agentId: agentId ?? null,
      count: prompts.length,
      prompts,
    };
    return toToolResult(payload);
  },
);

server.registerTool(
  'topic_flows_list',
  {
    title: 'List Topic Flows',
    description:
      'Lista topic flows por GET /llm-ops/topic-flows. Somente leitura.',
    inputSchema: {
      agentId: z.string().uuid().optional(),
      topicDomain: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    },
  },
  async ({ agentId, topicDomain, limit = 50 }) => {
    const topicFlows = await llmOpsClient.listTopicFlows(
      agentId,
      topicDomain,
      limit,
    );
    const payload = {
      llmOpsApiUrl,
      agentId: agentId ?? null,
      topicDomain: topicDomain ?? null,
      count: topicFlows.length,
      topicFlows,
    };
    return toToolResult(payload);
  },
);

server.registerTool(
  'resources_catalog',
  {
    title: 'List Resource Catalog',
    description:
      'Lista o catálogo de recursos consultáveis em modo read-only recommendation.',
    inputSchema: {},
  },
  async () => {
    const catalog = await llmOpsClient.listResourcesCatalog();
    const payload = { llmOpsApiUrl, catalog };
    return toToolResult(payload);
  },
);

server.registerTool(
  'ask_and_answer',
  {
    title: 'Ask And Answer',
    description:
      'Executa consulta RAG/chat via POST /llm-ops/chat. Nao executa mutacao administrativa.',
    inputSchema: {
      message: z.string().min(1),
      agentId: z.string().uuid().optional(),
      promptTemplateId: z.string().uuid().optional(),
      topicFlowId: z.string().uuid().optional(),
      topicFlowVersionId: z.string().uuid().optional(),
      invocationSource: z.string().default('api'),
      sessionFingerprint: z.string().optional(),
    },
  },
  async ({
    message,
    agentId,
    promptTemplateId,
    topicFlowId,
    topicFlowVersionId,
    invocationSource = 'api',
    sessionFingerprint,
  }) => {
    const response = await llmOpsClient.askAndAnswer({
      message,
      agentId: agentId ?? null,
      promptTemplateId: promptTemplateId ?? null,
      topicFlowId: topicFlowId ?? null,
      topicFlowVersionId: topicFlowVersionId ?? null,
      invocationSource,
      sessionFingerprint: sessionFingerprint ?? `mcp-llm-ops-${Date.now()}`,
    });
    const payload = { llmOpsApiUrl, response };
    return toToolResult(payload);
  },
);

function toToolResult(payload: Record<string, unknown>) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`llm-ops-readonly-mcp failed: ${String(error)}\n`);
  process.exitCode = 1;
});
