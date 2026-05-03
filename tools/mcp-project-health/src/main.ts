import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { checkBuild } from './checks/build.check.js';
import { checkDockerfile } from './checks/dockerfile.check.js';
import { checkDockerCompose } from './checks/docker-compose.check.js';
import { checkMigrationPaths } from './checks/migration-paths.check.js';
import { checkDocs } from './checks/docs.check.js';
import { runSmoke } from './checks/smoke.check.js';
import { checkDatabase } from './checks/database.check.js';
import { runAllWithReport } from './runner/check-runner.js';
import type { CheckResult } from './types.js';

const REPO_ROOT = process.env.REPO_ROOT ?? process.cwd();

const server = new McpServer({
  name: 'project-health-mcp',
  version: '1.0.0'
});

function toToolResult(payload: CheckResult | { results: CheckResult[]; reportPath: string }) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>
  };
}

server.registerTool(
  'health_check_all',
  {
    title: 'Full Project Health Check',
    description: 'Roda todos os checks de saúde do projeto e gera relatório CI em .copilot-tracking/runtime/.',
    inputSchema: {
      smokeCategories: z.array(z.enum(['static', 'mcp', 'typeorm', 'all'])).optional(),
      smokeTimeoutMs: z.number().int().positive().optional()
    }
  },
  async ({ smokeCategories, smokeTimeoutMs }) => {
    const result = await runAllWithReport({
      repoRoot: REPO_ROOT,
      smokeCategories: smokeCategories as Array<'static' | 'mcp' | 'typeorm' | 'all'> | undefined,
      smokeTimeoutMs
    });
    return toToolResult(result);
  }
);

server.registerTool(
  'build_check',
  {
    title: 'Build Check',
    description: 'Compila todos os workspaces TypeScript com tsgo e reporta erros.',
    inputSchema: {}
  },
  async () => toToolResult(await checkBuild(REPO_ROOT))
);

server.registerTool(
  'dockerfile_fix',
  {
    title: 'Dockerfile Fix',
    description: 'Detecta e corrige automaticamente bugs no apps/api/Dockerfile.',
    inputSchema: {}
  },
  async () => toToolResult(await checkDockerfile(REPO_ROOT))
);

server.registerTool(
  'docker_compose_check',
  {
    title: 'Docker Compose Check',
    description: 'Valida a configuração do docker-compose.yml: serviços esperados, profiles e variáveis.',
    inputSchema: {}
  },
  async () => toToolResult(await checkDockerCompose(REPO_ROOT))
);

server.registerTool(
  'migration_paths_fix',
  {
    title: 'Migration Paths Fix',
    description: 'Detecta e corrige caminhos de migration relativos ao CWD em typeorm.config.ts.',
    inputSchema: {}
  },
  async () => toToolResult(await checkMigrationPaths(REPO_ROOT))
);

server.registerTool(
  'docs_check',
  {
    title: 'Required Docs Check',
    description: 'Verifica arquivos de documentação obrigatórios. Cria ou corrige arquivos ausentes.',
    inputSchema: {}
  },
  async () => toToolResult(await checkDocs(REPO_ROOT))
);

server.registerTool(
  'smoke_run',
  {
    title: 'Smoke Tests',
    description: 'Executa smoke tests por categoria: static, mcp, typeorm, all.',
    inputSchema: {
      categories: z.array(z.enum(['static', 'mcp', 'typeorm', 'all'])).optional(),
      timeoutMs: z.number().int().positive().optional()
    }
  },
  async ({ categories, timeoutMs }) =>
    toToolResult(
      await runSmoke({
        repoRoot: REPO_ROOT,
        categories: categories as Array<'static' | 'mcp' | 'typeorm' | 'all'> | undefined,
        timeoutMs
      })
    )
);

server.registerTool(
  'database_check',
  {
    title: 'Database Check',
    description: 'Testa conectividade com PostgreSQL e aplica migrations pendentes automaticamente.',
    inputSchema: {}
  },
  async () => toToolResult(await checkDatabase(REPO_ROOT))
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`project-health-mcp failed: ${String(error)}\n`);
  process.exitCode = 1;
});
