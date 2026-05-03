#!/usr/bin/env node

const baseUrl = (process.env.LLM_OPS_API_URL ?? 'http://localhost:3002').replace(/\/+$/, '');
const apiKey = process.env.LLM_OPS_API_KEY ?? process.env.API_KEY ?? '';

const slug = process.env.LLM_OPS_AGENT_SLUG ?? 'default-assistant';
const payload = {
  slug,
  displayName: process.env.LLM_OPS_AGENT_DISPLAY_NAME ?? 'Default Assistant',
  description: process.env.LLM_OPS_AGENT_DESCRIPTION ?? 'Agente inicial para smoke/local',
  primaryObjective:
    process.env.LLM_OPS_AGENT_PRIMARY_OBJECTIVE ?? 'Responder solicitacoes de chat no ambiente local',
  supportedSources: (process.env.LLM_OPS_AGENT_SUPPORTED_SOURCES ?? 'vscode,api')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  isActive: (process.env.LLM_OPS_AGENT_IS_ACTIVE ?? 'true').toLowerCase() !== 'false'
};

const headers = { 'Content-Type': 'application/json' };
if (apiKey) headers['x-api-key'] = apiKey;

function fail(message, code = 1) {
  console.error(`[seed-llm-ops-agent] ${message}`);
  process.exit(code);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  const listUrl = `${baseUrl}/llm-ops/agents`;
  const createUrl = `${baseUrl}/llm-ops/agents`;

  const listResponse = await fetch(listUrl, { headers });
  if (!listResponse.ok) {
    const errorBody = await readJson(listResponse);
    fail(`falha ao listar agentes (${listResponse.status}): ${JSON.stringify(errorBody)}`);
  }

  const listBody = await readJson(listResponse);
  const agents = Array.isArray(listBody?.data) ? listBody.data : [];
  const existing = agents.find((agent) => agent?.slug === slug);

  if (existing) {
    console.log(
      JSON.stringify(
        {
          success: true,
          created: false,
          reason: 'already_exists',
          agent: {
            id: existing.id,
            slug: existing.slug,
            displayName: existing.displayName
          }
        },
        null,
        2
      )
    );
    return;
  }

  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const createBody = await readJson(createResponse);
  if (!createResponse.ok || createBody?.success !== true) {
    fail(`falha ao criar agente (${createResponse.status}): ${JSON.stringify(createBody)}`);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        created: true,
        agent: createBody.data
      },
      null,
      2
    )
  );
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
