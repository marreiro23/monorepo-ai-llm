import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { UsersApiClient } from './users-api-client.js';

const usersApiUrl = process.env.USERS_API_URL ?? 'http://localhost:3001';
const usersClient = new UsersApiClient(usersApiUrl);

const server = new McpServer({
  name: 'users-readonly-mcp',
  version: '1.0.0',
});

server.registerTool(
  'users_list',
  {
    title: 'List Users',
    description:
      'Lista usuarios do dominio users por GET /users. Somente leitura.',
    inputSchema: {
      limit: z.number().int().positive().max(200).optional(),
    },
  },
  async ({ limit = 50 }) => {
    const users = (await usersClient.listUsers()).slice(0, limit);
    const payload = {
      usersApiUrl,
      count: users.length,
      users,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
      structuredContent: payload,
    };
  },
);

server.registerTool(
  'users_get',
  {
    title: 'Get User',
    description: 'Busca um usuario por id via GET /users/:id. Somente leitura.',
    inputSchema: {
      id: z.string().uuid(),
    },
  },
  async ({ id }) => {
    const user = await usersClient.getUser(id);
    const payload = {
      usersApiUrl,
      user,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
      structuredContent: payload,
    };
  },
);

server.registerTool(
  'users_search',
  {
    title: 'Search Users',
    description:
      'Pesquisa usuarios por nome ou email usando GET /users e filtro local. Somente leitura.',
    inputSchema: {
      query: z.string().default(''),
      limit: z.number().int().positive().max(100).optional(),
    },
  },
  async ({ query, limit = 20 }) => {
    const users = await usersClient.searchUsers(query, limit);
    const payload = {
      usersApiUrl,
      query,
      count: users.length,
      users,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
      structuredContent: payload,
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`users-readonly-mcp failed: ${String(error)}\n`);
  process.exitCode = 1;
});
