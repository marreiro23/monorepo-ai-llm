import { DataAPIClient } from '@datastax/astra-db-ts';

export type AstraDbConnectionInput = {
  endpoint?: string | null;
  token?: string | null;
  keyspace?: string | null;
};

export type AstraDbConnectionConfig = {
  endpoint: string;
  token: string;
  keyspace: string;
};

export function readAstraDbConnectionConfig(
  input: AstraDbConnectionInput,
): AstraDbConnectionConfig {
  const endpoint = input.endpoint?.trim();
  const token = input.token?.trim();
  const keyspace = input.keyspace?.trim() || 'llm_ops';

  if (!endpoint) {
    throw new Error('Missing AstraDB configuration: ASTRA_DB_API_ENDPOINT');
  }

  if (!token) {
    throw new Error(
      'Missing AstraDB configuration: ASTRA_DB_APPLICATION_TOKEN',
    );
  }

  return {
    endpoint: endpoint.replace(/\/$/, ''),
    token,
    keyspace,
  };
}

export function createAstraDbConnection(config: AstraDbConnectionConfig) {
  const client = new DataAPIClient();
  const db = client.db(config.endpoint, {
    token: config.token,
    keyspace: config.keyspace,
  });

  return {
    client,
    db,
    endpoint: config.endpoint,
    keyspace: config.keyspace,
  };
}
