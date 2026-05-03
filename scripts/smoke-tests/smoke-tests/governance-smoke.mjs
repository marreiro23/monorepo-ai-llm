import assert from 'node:assert/strict';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditEventsService } from '../../apps/api/dist/common/events/audit-events.service.js';
import { GovernanceService } from '../../apps/api/dist/modules/governance/governance.service.js';

const auditEventsService = new AuditEventsService(new EventEmitter2());
const service = new GovernanceService(auditEventsService);

const status = service.getStatus();
assert.equal(status.success, true, 'governance status should succeed');
assert.equal(status.status, 'active', 'governance status should be active');
assert.ok(status.matrixEntries > 0, 'governance should expose matrix entries');

const matrix = service.getPermissionMatrix();
assert.equal(matrix.success, true, 'permission matrix should succeed');
assert.ok(Array.isArray(matrix.data), 'permission matrix should return an array');
assert.ok(matrix.data.length >= 10, 'permission matrix should contain mapped endpoints');

const validation = service.validatePermissionMatrix();
assert.equal(validation.success, true, 'permission matrix validation should succeed');
assert.equal(validation.data.valid, true, 'permission matrix should be valid');
assert.equal(validation.data.invalidRecords.length, 0, 'permission matrix should not contain invalid records');

console.log('✅  governance-smoke: matriz e validacao de permissoes passaram.');
