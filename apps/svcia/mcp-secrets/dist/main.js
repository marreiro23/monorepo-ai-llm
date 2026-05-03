import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SecretsRegistry } from './secrets-registry.js';
const secretsRegistry = new SecretsRegistry();
const server = new McpServer({
    name: 'secrets-guarded-mcp',
    version: '1.0.0'
});
const providerSchema = z.enum(['process-env', 'azure-key-vault', 'local-vault-container', 'external-vault']);
server.registerTool('secrets_list', {
    title: 'List Secret Metadata',
    description: 'Lista metadados de chaves logicas sem ler ou retornar valores secretos.',
    inputSchema: {
        includeUnconfigured: z.boolean().optional(),
        limit: z.number().int().positive().max(200).optional(),
        provider: providerSchema.optional()
    }
}, async ({ includeUnconfigured = true, limit = 100, provider }) => {
    const secrets = secretsRegistry.listSecrets({
        includeUnconfigured,
        limit,
        provider: provider
    });
    return toToolResult({
        count: secrets.length,
        dryRunOnly: true,
        valuesReturned: false,
        secrets
    });
});
server.registerTool('secrets_register_prepare', {
    title: 'Prepare Secret Registration',
    description: 'Prepara dry-run para registrar chave logica. Nao recebe valores secretos e nao executa mutacao.',
    inputSchema: prepareSchema('register')
}, async (input) => toToolResult(secretsRegistry.prepareOperation(toPrepareInput('register', input))));
server.registerTool('secrets_rotate_prepare', {
    title: 'Prepare Secret Rotation',
    description: 'Prepara dry-run para rotacionar chave logica. Requer aprovacao antes de qualquer mutacao futura.',
    inputSchema: prepareSchema('rotate')
}, async (input) => toToolResult(secretsRegistry.prepareOperation(toPrepareInput('rotate', input))));
server.registerTool('secrets_revoke_prepare', {
    title: 'Prepare Secret Revocation',
    description: 'Prepara dry-run para revogar chave logica. Requer aprovacao antes de qualquer mutacao futura.',
    inputSchema: prepareSchema('revoke')
}, async (input) => toToolResult(secretsRegistry.prepareOperation(toPrepareInput('revoke', input))));
function prepareSchema(action) {
    return {
        logicalKey: z.string().min(1),
        targetName: action === 'register' ? z.string().min(1).optional() : z.string().min(1).optional(),
        provider: providerSchema.optional(),
        requestedBy: z.string().min(1).optional(),
        reason: z.string().min(1).optional(),
        correlationId: z.string().min(1).optional()
    };
}
function toPrepareInput(action, input) {
    return {
        action,
        logicalKey: input.logicalKey,
        targetName: input.targetName ?? null,
        provider: input.provider ?? null,
        requestedBy: input.requestedBy ?? null,
        reason: input.reason ?? null,
        correlationId: input.correlationId ?? null
    };
}
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
    process.stderr.write(`secrets-guarded-mcp failed: ${String(error)}\n`);
    process.exitCode = 1;
});
