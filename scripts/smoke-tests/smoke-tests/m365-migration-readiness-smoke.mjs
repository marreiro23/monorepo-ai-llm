/**
 * Smoke test do modulo m365-migration.
 * Valida readiness source/target, persistencia em PostgreSQL e bloqueio seguro
 * do discovery quando permissoes Mail/Exchange ainda nao estao prontas.
 */

import 'reflect-metadata';
import '../utils/load-env.mjs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { M365MigrationService } from '../../apps/api/dist/modules/m365-migration/m365-migration.service.js';

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const service = app.get(M365MigrationService);

try {
  const sourceReadiness = await service.checkReadiness('source');
  const targetReadiness = await service.checkReadiness('target');
  const sourceFailed = sourceReadiness.data.checks.filter((check) => check.status === 'failed');
  const targetFailed = targetReadiness.data.checks.filter((check) => check.status === 'failed');

  let discoveryBlocked = false;
  let discoveryResult = null;
  try {
    discoveryResult = await service.discoverMailboxes('source');
  } catch (err) {
    discoveryBlocked = err instanceof Error && err.message.includes('Readiness falhou');
  }

  if (sourceFailed.length > 0 && !discoveryBlocked) {
    throw new Error('Discovery source deveria estar bloqueado enquanto readiness source falha.');
  }

  if (sourceFailed.length === 0 && discoveryBlocked) {
    throw new Error('Discovery source nao deveria estar bloqueado apos readiness source passar.');
  }

  const dryRun = await service.createDryRunJob();
  if (targetFailed.length > 0 && dryRun.data.status !== 'blocked') {
    throw new Error('Dry-run deveria permanecer bloqueado enquanto readiness target/Exchange falha.');
  }

  console.log(
    JSON.stringify(
      {
        sourceReadiness: {
          failedChecks: sourceFailed.map((check) => check.checkKey),
          totalChecks: sourceReadiness.data.checks.length
        },
        targetReadiness: {
          failedChecks: targetFailed.map((check) => check.checkKey),
          totalChecks: targetReadiness.data.checks.length
        },
        discoveryBlocked,
        discoveryItemCount: discoveryResult?.data?.itemCount ?? null,
        dryRun: {
          id: dryRun.data.id,
          mode: dryRun.data.mode,
          status: dryRun.data.status,
          mappingCount: dryRun.data.mappingCount
        }
      },
      null,
      2
    )
  );

  console.log('\n✅ Smoke test m365-migration readiness passou com bloqueio seguro.');
} finally {
  try {
    await app.close();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('DataSource element')) {
      throw err;
    }
  }
}

process.exit(0);
