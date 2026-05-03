import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SyncApiClient } from './sync-api-client.js';
const syncApiUrl = process.env.SYNC_API_URL ?? 'http://localhost:3004';
const syncClient = new SyncApiClient(syncApiUrl);
const server = new McpServer({
    name: 'sync-readonly-mcp',
    version: '1.0.0'
});
server.registerTool('sync_jobs_list', {
    title: 'List Sync Jobs',
    description: 'Lista jobs de sincronizacao por GET /sync/jobs. Somente leitura.',
    inputSchema: {
        limit: z.number().int().positive().max(200).optional(),
        status: z.enum(['pending', 'running', 'completed', 'failed']).optional()
    }
}, async ({ limit = 50, status }) => {
    const jobs = await syncClient.listJobs(limit, status);
    return toToolResult({ syncApiUrl, status: status ?? null, count: jobs.length, jobs });
});
server.registerTool('sync_status', {
    title: 'Get Sync Status',
    description: 'Resume o estado de sincronizacao a partir de GET /sync/jobs. Somente leitura.',
    inputSchema: {}
}, async () => {
    const status = await syncClient.getStatus();
    return toToolResult({ syncApiUrl, status });
});
server.registerTool('sync_sites_list', {
    title: 'List Synced Sites',
    description: 'Lista sites sincronizados por GET /sync/sites. Somente leitura.',
    inputSchema: {
        limit: z.number().int().positive().max(200).optional()
    }
}, async ({ limit = 50 }) => {
    const sites = await syncClient.listSites(limit);
    return toToolResult({ syncApiUrl, count: sites.length, sites });
});
server.registerTool('sync_users_list', {
    title: 'List Synced Users',
    description: 'Lista usuarios sincronizados por GET /sync/users. Somente leitura.',
    inputSchema: {
        limit: z.number().int().positive().max(200).optional()
    }
}, async ({ limit = 50 }) => {
    const users = await syncClient.listUsers(limit);
    return toToolResult({ syncApiUrl, count: users.length, users });
});
function toToolResult(payload) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(payload, null, 2)
            }
        ],
        structuredContent: payload
    };
}
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    process.stderr.write(`sync-readonly-mcp failed: ${String(error)}\n`);
    process.exitCode = 1;
});
