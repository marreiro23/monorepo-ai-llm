#!/usr/bin/env node

const { LlmOpsApiClient } = await import('../../apps/svcia/mcp-llm-ops/dist/llm-ops-api-client.js');

const agentId = '11111111-1111-4111-8111-111111111111';
const promptTemplateId = '22222222-2222-4222-8222-222222222222';
const topicFlowId = '33333333-3333-4333-8333-333333333333';

const calls = [];
const fetchMock = async (input, init = {}) => {
  const url = String(input);
  const method = init.method ?? 'GET';
  calls.push({ url, method });

  if (method !== 'GET' && !(method === 'POST' && url.endsWith('/llm-ops/chat'))) {
    throw new Error(`Unexpected mutating MCP LLM Ops call: ${method} ${url}`);
  }

  if (url.endsWith('/llm-ops/agents')) {
    return json({
      success: true,
      data: [
        {
          id: agentId,
          slug: 'assistant-admin',
          displayName: 'Assistant Admin',
          description: 'Read-only smoke agent',
          primaryObjective: 'Validate LLM Ops MCP',
          supportedSources: ['api'],
          isActive: true,
          createdAt: '2026-04-26T00:00:00.000Z',
          updatedAt: '2026-04-26T00:00:00.000Z'
        }
      ]
    });
  }

  if (url.includes('/llm-ops/prompt-templates')) {
    return json({
      success: true,
      data: [
        {
          id: promptTemplateId,
          agentId,
          slug: 'ask-and-answer',
          name: 'Ask And Answer',
          description: 'Smoke prompt template',
          promptKind: 'instruction',
          targetScope: 'chat',
          isActive: true,
          createdAt: '2026-04-26T00:00:00.000Z',
          updatedAt: '2026-04-26T00:00:00.000Z'
        }
      ]
    });
  }

  if (url.includes('/llm-ops/topic-flows')) {
    return json({
      success: true,
      data: [
        {
          id: topicFlowId,
          agentId,
          slug: 'admin-readiness',
          name: 'Admin Readiness',
          description: 'Smoke topic flow',
          topicDomain: 'users',
          invocationSource: 'api',
          isActive: true,
          createdAt: '2026-04-26T00:00:00.000Z',
          updatedAt: '2026-04-26T00:00:00.000Z'
        }
      ]
    });
  }

  if (url.endsWith('/llm-ops/resources/catalog')) {
    return json({
      success: true,
      data: {
        executionMode: 'read-only-recommendation',
        resources: [
          {
            domain: 'users',
            description: 'Users domain',
            readableEndpoints: ['/users'],
            writeEndpoints: ['/users (POST)'],
            llmAccess: 'read-only-recommendation'
          }
        ]
      }
    });
  }

  if (url.endsWith('/llm-ops/chat')) {
    const body = JSON.parse(init.body);
    if (!body.message || body.message.includes('[intencao-chave]')) {
      throw new Error('Unexpected unsafe chat payload in MCP LLM Ops smoke');
    }

    return json({
      success: true,
      data: {
        answer: `Ask and Answer recebeu: ${body.message}`,
        runtimeOutcome: 'success',
        retrievedContext: ['agent:assistant-admin'],
        resourceContext: {
          domain: 'llm-ops',
          resource: 'operational-status',
          consultedEndpoint: '/llm-ops/agents',
          summary: 'Snapshot operacional disponível.',
          snapshot: { count: 1 }
        },
        recommendedActions: [
          {
            action: 'Conferir agentes ativos',
            targetEndpoint: '/llm-ops/agents',
            preconditions: ['Validar permissões mínimas'],
            rationale: 'Mantém diagnóstico read-only.'
          }
        ],
        executionMode: 'read-only-recommendation',
        correlationId: body.sessionFingerprint,
        orchestration: {
          administrativeTask: {
            detected: false,
            action: null,
            target: null,
            mode: 'dry-run',
            nextStep: 'Responder como consulta operacional sem executar mutação administrativa.'
          }
        }
      }
    });
  }

  return json({ success: false, message: 'not found' }, 404);
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

const client = new LlmOpsApiClient('http://llm-ops-api.test', fetchMock);

const agents = await client.listAgents();
if (agents.length !== 1 || agents[0].id !== agentId) {
  throw new Error('Expected agents_list to return one smoke agent');
}

const prompts = await client.listPrompts(agentId);
if (prompts.length !== 1 || prompts[0].id !== promptTemplateId) {
  throw new Error('Expected prompts_list to return one smoke prompt');
}

const topicFlows = await client.listTopicFlows(agentId, 'users');
if (topicFlows.length !== 1 || topicFlows[0].id !== topicFlowId) {
  throw new Error('Expected topic_flows_list to return one smoke topic flow');
}

const catalog = await client.listResourcesCatalog();
if (catalog.executionMode !== 'read-only-recommendation' || !Array.isArray(catalog.resources) || catalog.resources.length === 0) {
  throw new Error('Expected resources_catalog to return read-only catalog');
}

const chat = await client.askAndAnswer({
  message: 'Qual o status operacional do agente?',
  agentId,
  promptTemplateId,
  invocationSource: 'api',
  sessionFingerprint: 'mcp-llm-ops-smoke'
});
if (chat.runtimeOutcome !== 'success' || !chat.answer.includes('Ask and Answer recebeu')) {
  throw new Error('Expected ask_and_answer to return a successful chat response');
}
if (chat.executionMode !== 'read-only-recommendation') {
  throw new Error('Expected ask_and_answer execution mode to be read-only-recommendation');
}
if (!chat.resourceContext || !Array.isArray(chat.recommendedActions)) {
  throw new Error('Expected ask_and_answer to return resource context and recommendations');
}

const unsafeCall = calls.find((call) => call.method !== 'GET' && !(call.method === 'POST' && call.url.endsWith('/llm-ops/chat')));
if (unsafeCall) {
  throw new Error(`Unexpected unsafe call: ${JSON.stringify(unsafeCall)}`);
}

console.log(
  JSON.stringify(
    {
      success: true,
      toolsCovered: ['agents_list', 'prompts_list', 'topic_flows_list', 'resources_catalog', 'ask_and_answer'],
      callCount: calls.length,
      methods: [...new Set(calls.map((call) => call.method))]
    },
    null,
    2
  )
);
