// Client para seu agente cagent ativar containers sob demanda

import axios from 'axios';

const MANAGER_URL = process.env.MANAGER_URL || 'http://localhost:3000';

interface DomainActivationResult {
  status: string;
  domain: string;
  port: number;
  url: string;
  message: string;
}

interface ContainerStatus {
  domain: string;
  running: boolean;
  port: number;
  inactivityMs: number;
}

/**
 * Ativa container de um domínio específico
 * Chamado pelo seu agente antes de fazer requisições
 */
export async function activateDomain(
  domain: 'users' | 'llm-ops' | 'sharepoint' | 'sync'
): Promise<DomainActivationResult> {
  try {
    const response = await axios.post<DomainActivationResult>(
      `${MANAGER_URL}/activate/${domain}`,
      null,
      { timeout: 10000 }
    );
    
    console.log(`✓ Activated ${domain} on port ${response.data.port}`);
    
    // Esperar container ficar ready
    await waitForHealth(response.data.url);
    
    return response.data;
  } catch (error) {
    console.error(`✗ Failed to activate ${domain}:`, error);
    throw error;
  }
}

/**
 * Espera container ficar ready via healthcheck
 */
async function waitForHealth(
  url: string,
  maxRetries = 30,
  retryInterval = 1000
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(url, { timeout: 1000 });
      console.log(`✓ Container ready after ${i * retryInterval}ms`);
      return;
    } catch {
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, retryInterval));
      }
    }
  }
  throw new Error(`Container did not become ready in ${maxRetries * retryInterval}ms`);
}

/**
 * Verifica status de todos os containers
 */
export async function getStatus(): Promise<ContainerStatus[]> {
  try {
    const response = await axios.get<ContainerStatus[]>(
      `${MANAGER_URL}/status`,
      { timeout: 5000 }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to get container status:', error);
    throw error;
  }
}

// Exemplo de uso com seu agente
export async function callDomainApi(
  domain: 'users' | 'llm-ops' | 'sharepoint' | 'sync',
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    data?: unknown;
  }
): Promise<unknown> {
  // 1. Ativar container
  const activation = await activateDomain(domain);
  
  // 2. Fazer requisição ao endpoint
  const url = `http://localhost:${activation.port}${endpoint}`;
  const response = await axios({
    method: options?.method || 'GET',
    url,
    data: options?.data,
    timeout: 30000,
  });
  
  return response.data;
}

// Uso:
// await callDomainApi('users', '/users', { method: 'GET' });
// await callDomainApi('llm-ops', '/llm-ops/agents', { method: 'POST', data: {...} });
