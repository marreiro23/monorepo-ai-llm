import 'reflect-metadata';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EntraRegistrationService } from '../../apps/api/dist/modules/graph/services/entra-registration.service.js';
import { GraphService } from '../../apps/api/dist/modules/graph/graph.service.js';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const entraRegistrationService = new EntraRegistrationService();
entraRegistrationService.credential = {
  getToken: async () => ({
    token: 'stub-token',
    expiresOnTimestamp: Date.now() + 60 * 60 * 1000
  })
};

const graphService = new GraphService(entraRegistrationService);
const authStatus = await graphService.getAuthStatus();

console.log(JSON.stringify(authStatus, null, 2));
