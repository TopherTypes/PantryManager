import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareSyncEnvelopes,
  createSyncEnvelope,
  resolveSyncConflict,
  migrateSyncEnvelope,
} from '../assets/js/platform/googleDriveSync.js';
import {
  applyGeneralRetention,
  applyPricingRetention,
  runRetentionJobs,
} from '../assets/js/platform/retentionPolicy.js';


test('sync envelope migration upgrades legacy exportedAt field', () => {
  const migrated = migrateSyncEnvelope({
    schemaVersion: 0,
    exportedAt: '2026-01-01T00:00:00.000Z',
    state: { ok: true },
  });

  assert.equal(migrated.schemaVersion, 1);
  assert.equal(migrated.exportedAtUtc, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(migrated.state, { ok: true });
});

test('sync envelope conflict resolution prefers newer remote snapshot outside drift tolerance', () => {
  const local = createSyncEnvelope({ version: 'local' }, { now: new Date('2026-01-01T00:00:00.000Z') });
  const remote = createSyncEnvelope({ version: 'remote' }, { now: new Date('2026-01-01T00:10:00.000Z') });

  const decision = compareSyncEnvelopes(local, remote, { driftToleranceMs: 1000 });
  assert.equal(decision.winner, 'remote');

  const resolution = resolveSyncConflict(local, remote, { driftToleranceMs: 1000 });
  assert.equal(resolution.source, 'remote');
  assert.deepEqual(resolution.state, { version: 'remote' });
});

test('sync conflict resolution keeps local snapshot when timestamps are within drift tolerance', () => {
  const local = createSyncEnvelope({ device: 'local' }, { now: new Date('2026-01-01T00:00:00.000Z') });
  const remote = createSyncEnvelope({ device: 'remote' }, { now: new Date('2026-01-01T00:01:00.000Z') });

  const resolution = resolveSyncConflict(local, remote, { driftToleranceMs: 120000 });
  assert.equal(resolution.source, 'local');
  assert.deepEqual(resolution.state, { device: 'local' });
});

test('general retention archives stale active records and deletes old archived records', () => {
  const now = new Date('2026-03-10T00:00:00.000Z');
  const records = [
    { id: 'fresh', updatedAt: '2026-03-05T00:00:00.000Z' },
    { id: 'stale', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'old-archived', archivedAt: '2026-01-01T00:00:00.000Z' },
  ];

  const result = applyGeneralRetention(records, { now, archiveAfterDays: 30, deleteAfterArchiveDays: 30 });

  assert.equal(result.active.length, 1);
  assert.equal(result.active[0].id, 'fresh');
  assert.equal(result.archived.length, 1);
  assert.equal(result.archived[0].id, 'stale');
  assert.equal(result.deleted.length, 1);
  assert.equal(result.deleted[0].id, 'old-archived');
});

test('pricing retention keeps data within 12 months and drops older history', () => {
  const now = new Date('2026-12-31T00:00:00.000Z');
  const history = [
    { id: 'new', recordedAt: '2026-11-30T00:00:00.000Z' },
    { id: 'old', recordedAt: '2024-10-01T00:00:00.000Z' },
  ];

  const result = applyPricingRetention(history, { now, retainMonths: 12 });
  assert.deepEqual(result.retained.map((entry) => entry.id), ['new']);
  assert.deepEqual(result.deleted.map((entry) => entry.id), ['old']);
});

test('retention job bundle applies both general and pricing policies', () => {
  const now = new Date('2026-05-01T00:00:00.000Z');
  const input = {
    inventory: [{ id: 'inv-a', updatedAt: '2026-01-01T00:00:00.000Z' }],
    recipes: [{ id: 'rec-a', updatedAt: '2026-04-25T00:00:00.000Z' }],
    pricingHistory: [{ id: 'price-a', recordedAt: '2024-01-01T00:00:00.000Z' }],
  };

  const { state, report } = runRetentionJobs(input, { now });

  assert.equal(state.inventory.length, 0);
  assert.equal(state.archivedInventory.length, 1);
  assert.equal(state.recipes.length, 1);
  assert.equal(state.pricingHistory.length, 0);
  assert.equal(report.pricingDeleted, 1);
});
