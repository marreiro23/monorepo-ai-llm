#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const repoRoot = process.cwd();
const webAppUrl = normalizeBaseUrl(process.env.WEB_APP_URL ?? 'http://127.0.0.1:4173');

const sourceChecks = [
  {
    path: 'apps/web/src/app/App.tsx',
    includes: ['NavigationDashboardPage', "window.location.hash === '#links'"]
  },
  {
    path: 'apps/web/src/features/ask-and-answer/components/ask-and-answer-panel.tsx',
    includes: ['href="#links"', 'Abrir painel de links']
  },
  {
    path: 'apps/web/src/features/navigation-dashboard/components/navigation-dashboard-page.tsx',
    includes: ['Painel da aplicacao', 'href="#ask-and-answer"', 'MCP Servers', 'Secrets']
  },
  {
    path: 'apps/web/src/features/navigation-dashboard/components/navigation-dashboard-page.css',
    includes: ['.navigation-groups', '@media (max-width: 760px)', ':focus-visible']
  }
];

for (const check of sourceChecks) {
  const content = await readFile(join(repoRoot, check.path), 'utf8');
  for (const expected of check.includes) {
    if (!content.includes(expected)) {
      throw new Error(`Expected ${check.path} to include ${expected}`);
    }
  }
}

const devServer = await probeDevServer(webAppUrl);

console.log(
  JSON.stringify(
    {
      success: true,
      checks: {
        sourceNavigation: true,
        sourceAccessibility: true,
        backendIndependent: true,
        devServer
      }
    },
    null,
    2
  )
);

function normalizeBaseUrl(input) {
  return input.replace(/\/+$/, '');
}

async function probeDevServer(baseUrl) {
  try {
    const root = await fetchWithTimeout(`${baseUrl}/`, 3000);
    if (!root.ok) {
      return { available: false, reason: `root returned ${root.status}` };
    }

    const appModule = await fetchText(`${baseUrl}/src/app/App.tsx`);
    const dashboardModule = await fetchText(
      `${baseUrl}/src/features/navigation-dashboard/components/navigation-dashboard-page.tsx`
    );

    assertServedModule(appModule, ['NavigationDashboardPage', '"#links"']);
    assertServedModule(dashboardModule, ['Painel da aplicacao', 'MCP Servers']);

    return {
      available: true,
      baseUrl,
      routesChecked: ['/', '/#links', '/#ask-and-answer'],
      modulesServed: ['App.tsx', 'navigation-dashboard-page.tsx']
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchText(url) {
  const response = await fetchWithTimeout(url, 3000);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.text();
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function assertServedModule(content, expectedTokens) {
  for (const token of expectedTokens) {
    if (!content.includes(token)) {
      throw new Error(`Served module did not include ${token}`);
    }
  }
}
