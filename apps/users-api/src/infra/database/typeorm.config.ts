import { DataSource, type DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { dirname, resolve } from 'node:path';

export const MAIN_DATABASE_CONNECTION_NAME = 'default';
export const LLM_OPS_DATABASE_CONNECTION_NAME = 'llmOps';

const currentModulePath = __filename;
const currentDir = dirname(currentModulePath);
const isTypeScriptRuntime = currentModulePath.endsWith('.ts');

const runtimeEntityGlobs = (sourceGlob: string, distGlob: string): string[] =>
  isTypeScriptRuntime ? [sourceGlob] : [distGlob];

const runtimeMigrationGlobs = (
  sourceFile: string,
  distFile: string,
): string[] => {
  if (isTypeScriptRuntime) {
    // Running as .ts — resolve relative to src/infra/database/
    return [resolve(currentDir, 'migrations', sourceFile.split('/').pop()!)];
  }
  // Running as compiled .js — resolve relative to dist/infra/database/
  return [resolve(currentDir, 'migrations', distFile.split('/').pop()!)];
};

const llmOpsEntityClasses: DataSourceOptions['entities'] = [];

const initializeManagedDataSource = async (
  options: DataSourceOptions,
): Promise<DataSource> => {
  const typedOptions = options as DataSourceOptions & { schema?: string };
  const dataSource = new DataSource({
    ...options,
    synchronize: false,
  });

  await dataSource.initialize();

  const schemas = new Set<string>();
  for (const metadata of dataSource.entityMetadatas) {
    const schemaName = metadata.schema ?? typedOptions.schema;
    if (schemaName) {
      schemas.add(schemaName);
    }
  }

  // Create schemas sequentially using a dedicated query runner with advisory lock to prevent race conditions
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.connect();

    // Acquire PostgreSQL advisory lock to ensure only one instance creates schemas at a time
    // Using a fixed lock ID based on a hash of the connection string to ensure consistency
    const lockId = 1777063059821; // Unique identifier for schema creation lock
    await queryRunner.query('SELECT pg_advisory_lock($1)', [lockId]);

    try {
      for (const schemaName of schemas) {
        if (!schemaName || schemaName === 'public') {
          continue;
        }
        const normalizedSchema = schemaName.trim().replace(/"/g, '""');
        await queryRunner.query(
          `CREATE SCHEMA IF NOT EXISTS "${normalizedSchema}"`,
        );
      }
    } finally {
      // Always release the advisory lock
      await queryRunner.query('SELECT pg_advisory_unlock($1)', [lockId]);
    }

    if (options.synchronize) {
      // Release query runner before synchronization to avoid conflicts
      await queryRunner.release();
      await dataSource.synchronize();
    }
  } finally {
    if (!queryRunner.isReleased) {
      await queryRunner.release();
    }
  }

  return dataSource;
};

const readBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
};

const readPort = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readRequiredString = (value: string | undefined, key: string): string => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return normalized;
};

const buildBaseOptions = (
  configService: ConfigService,
  prefix: 'PG' | 'LLM_PG',
): any => {
  const host = readRequiredString(
    configService.get<string>(`${prefix}_HOST`),
    `${prefix}_HOST`,
  );
  const port = readPort(configService.get<string>(`${prefix}_PORT`), 5432);
  const database = readRequiredString(
    configService.get<string>(`${prefix}_DATABASE`),
    `${prefix}_DATABASE`,
  );
  const user = readRequiredString(
    configService.get<string>(`${prefix}_USER`),
    `${prefix}_USER`,
  );
  const password = readRequiredString(
    configService.get<string>(`${prefix}_PASSWORD`),
    `${prefix}_PASSWORD`,
  );
  const schema = configService.get<string>(`${prefix}_SCHEMA`) ?? 'public';
  const ssl =
    prefix === 'LLM_PG'
      ? readBoolean(configService.get<string>(`${prefix}_SSL`), false)
      : false;
  const synchronize =
    configService.get<string>('DATABASE_SYNCHRONIZE') === 'true';

  return {
    type: 'postgres',
    host,
    port,
    database,
    username: user,
    password,
    schema,
    synchronize,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    // Configure connection pool to handle concurrent queries
    extra: {
      max: readPort(configService.get<string>(`${prefix}_POOL_MAX`), 10),
      min: readPort(configService.get<string>(`${prefix}_POOL_MIN`), 2),
      idleTimeoutMillis: 30000,
    },
  };
};

export function buildTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions & {
  dataSourceFactory: (options: DataSourceOptions) => Promise<DataSource>;
} {
  const baseOptions = buildBaseOptions(configService, 'PG');

  return {
    ...baseOptions,
    autoLoadEntities: true,
    dataSourceFactory: async (options) => initializeManagedDataSource(options),
  };
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: readRequiredString(process.env.PG_HOST, 'PG_HOST'),
  port: Number.parseInt(process.env.PG_PORT ?? '5432', 10),
  database: readRequiredString(process.env.PG_DATABASE, 'PG_DATABASE'),
  username: readRequiredString(process.env.PG_USER, 'PG_USER'),
  password: readRequiredString(process.env.PG_PASSWORD, 'PG_PASSWORD'),
  schema: process.env.PG_SCHEMA ?? 'public',
  entities: runtimeEntityGlobs('src/**/*.entity.ts', 'dist/**/*.entity.js'),
  migrations: [
    ...runtimeMigrationGlobs(
      'src/infra/database/migrations/1713830500000-CreateUsersTable.ts',
      'dist/infra/database/migrations/1713830500000-CreateUsersTable.js',
    ),
    ...runtimeMigrationGlobs(
      'src/infra/database/migrations/1713830600000-CreateSyncSchema.ts',
      'dist/infra/database/migrations/1713830600000-CreateSyncSchema.js',
    ),
    ...runtimeMigrationGlobs(
      'src/infra/database/migrations/1777593600000-CreateApiKeysTable.ts',
      'dist/infra/database/migrations/1777593600000-CreateApiKeysTable.js',
    ),
  ],
  synchronize: false,
});

export function buildLlmOpsTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions & {
  dataSourceFactory: (options: DataSourceOptions) => Promise<DataSource>;
} {
  const baseOptions = buildBaseOptions(configService, 'LLM_PG');

  return {
    ...baseOptions,
    schema: configService.get<string>('LLM_PG_SCHEMA') ?? 'llm_ops',
    autoLoadEntities: false,
    entities: llmOpsEntityClasses,
    dataSourceFactory: async (options) => initializeManagedDataSource(options),
  };
}

export const LlmOpsDataSource = new DataSource({
  type: 'postgres',
  host: readRequiredString(process.env.LLM_PG_HOST, 'LLM_PG_HOST'),
  port: Number.parseInt(process.env.LLM_PG_PORT ?? '5432', 10),
  database: readRequiredString(process.env.LLM_PG_DATABASE, 'LLM_PG_DATABASE'),
  username: readRequiredString(process.env.LLM_PG_USER, 'LLM_PG_USER'),
  password: readRequiredString(process.env.LLM_PG_PASSWORD, 'LLM_PG_PASSWORD'),
  schema: process.env.LLM_PG_SCHEMA ?? 'llm_ops',
  entities: llmOpsEntityClasses,
  migrations: runtimeMigrationGlobs(
    'src/infra/database/migrations/1713830400000-CreateLlmOpsSchema.ts',
    'dist/infra/database/migrations/1713830400000-CreateLlmOpsSchema.js',
  ),
  synchronize: false,
});
