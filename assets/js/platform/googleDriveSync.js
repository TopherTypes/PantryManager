/**
 * Usage:
 * - Use `createSyncEnvelope` before uploading state snapshots to Drive.
 * - Use `resolveSyncConflict` and `migrateSyncEnvelope` when importing remote
 *   snapshots so merge and schema behavior remains deterministic.
 */
/**
 * Google Drive-backed import/export/sync utilities for single-user continuity.
 *
 * ADR 0002 deliberately keeps MVP as single-user. This module therefore optimizes for
 * one user's data moving between devices, not concurrent collaboration between users.
 *
 * Key assumptions and edge-case policies are intentionally documented inline:
 * - All sync timestamps are stored as ISO-8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
 * - Device clocks can drift; we tolerate small timestamp deltas before declaring conflicts.
 * - Conflict policy is deterministic: newest snapshot wins when outside drift tolerance.
 * - When timestamps are effectively equal (within drift tolerance), local state wins to
 *   avoid unexpected overwrite after explicit user edits on the current device.
 */

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const DEFAULT_SYNC_FILENAME = 'pantrymanager-mvp-sync.json';
const SYNC_SCHEMA_VERSION = 1;

/**
 * @typedef {Object} SyncEnvelope
 * @property {number} schemaVersion
 * @property {string} exportedAtUtc
 * @property {string} deviceId
 * @property {string} source - Human-readable source marker (for diagnostics).
 * @property {Record<string, any>} state
 */

/**
 * Build a canonical sync envelope ready for export to Google Drive.
 *
 * @param {Record<string, any>} state
 * @param {{now?: Date, deviceId?: string, source?: string}} [options]
 * @returns {SyncEnvelope}
 */
export function createSyncEnvelope(state, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();

  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    exportedAtUtc: now.toISOString(),
    deviceId: options.deviceId || 'unknown-device',
    source: options.source || 'pantrymanager-web',
    state,
  };
}

/**
 * Compare sync envelopes while accounting for clock drift.
 *
 * Clock drift policy:
 * - If timestamps differ by <= driftToleranceMs, treat as effectively simultaneous.
 * - If one side is clearly newer (outside tolerance), prefer the newer snapshot.
 *
 * @param {SyncEnvelope | null} localEnvelope
 * @param {SyncEnvelope | null} remoteEnvelope
 * @param {{driftToleranceMs?: number}} [options]
 * @returns {{ winner: 'local' | 'remote' | 'none', reason: string }}
 */
export function compareSyncEnvelopes(localEnvelope, remoteEnvelope, options = {}) {
  const driftToleranceMs = Number.isFinite(options.driftToleranceMs) ? options.driftToleranceMs : 120000;

  if (!localEnvelope && !remoteEnvelope) {
    return { winner: 'none', reason: 'Both sync envelopes are absent.' };
  }

  if (localEnvelope && !remoteEnvelope) {
    return { winner: 'local', reason: 'Remote snapshot not found.' };
  }

  if (!localEnvelope && remoteEnvelope) {
    return { winner: 'remote', reason: 'Local snapshot not found.' };
  }

  const localMs = Date.parse(localEnvelope.exportedAtUtc);
  const remoteMs = Date.parse(remoteEnvelope.exportedAtUtc);

  if (!Number.isFinite(localMs) || !Number.isFinite(remoteMs)) {
    // Defensive fallback: malformed timestamps should never crash sync.
    return { winner: 'local', reason: 'Malformed timestamp detected; local snapshot retained for safety.' };
  }

  const deltaMs = remoteMs - localMs;
  if (Math.abs(deltaMs) <= driftToleranceMs) {
    return {
      winner: 'local',
      reason: 'Snapshots are within clock drift tolerance; local state wins deterministic tie-breaker.',
    };
  }

  if (deltaMs > 0) {
    return { winner: 'remote', reason: 'Remote snapshot is newer than local snapshot.' };
  }

  return { winner: 'local', reason: 'Local snapshot is newer than remote snapshot.' };
}

/**
 * Resolve local-vs-remote state conflict using deterministic envelope comparison.
 *
 * @param {SyncEnvelope | null} localEnvelope
 * @param {SyncEnvelope | null} remoteEnvelope
 * @param {{driftToleranceMs?: number}} [options]
 * @returns {{state: Record<string, any> | null, source: 'local' | 'remote' | 'none', reason: string}}
 */
export function resolveSyncConflict(localEnvelope, remoteEnvelope, options = {}) {
  const decision = compareSyncEnvelopes(localEnvelope, remoteEnvelope, options);

  if (decision.winner === 'local') {
    return {
      state: localEnvelope?.state || null,
      source: 'local',
      reason: decision.reason,
    };
  }

  if (decision.winner === 'remote') {
    return {
      state: remoteEnvelope?.state || null,
      source: 'remote',
      reason: decision.reason,
    };
  }

  return { state: null, source: 'none', reason: decision.reason };
}


/**
 * Migrate historical sync payloads into current schema.
 *
 * Migration policy:
 * - Unknown/newer schema versions are preserved as-is (forward compatibility best effort).
 * - Known older schema versions are transformed deterministically.
 * - Migration is pure and side-effect free so it can run during import previews.
 *
 * @param {any} envelope
 * @returns {SyncEnvelope}
 */
export function migrateSyncEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return createSyncEnvelope({}, { source: 'migration-fallback' });
  }

  const schemaVersion = Number(envelope.schemaVersion) || 0;

  if (schemaVersion >= SYNC_SCHEMA_VERSION) {
    return /** @type {SyncEnvelope} */ (envelope);
  }

  // v0 -> v1 migration:
  // - historical exports used `exportedAt` instead of `exportedAtUtc`
  // - historical exports occasionally omitted `deviceId`
  if (schemaVersion === 0) {
    return {
      schemaVersion: SYNC_SCHEMA_VERSION,
      exportedAtUtc: String(envelope.exportedAtUtc || envelope.exportedAt || new Date().toISOString()),
      deviceId: String(envelope.deviceId || 'unknown-device'),
      source: String(envelope.source || 'pantrymanager-web'),
      state: typeof envelope.state === 'object' && envelope.state !== null ? envelope.state : {},
    };
  }

  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    exportedAtUtc: String(envelope.exportedAtUtc || new Date().toISOString()),
    deviceId: String(envelope.deviceId || 'unknown-device'),
    source: String(envelope.source || 'pantrymanager-web'),
    state: typeof envelope.state === 'object' && envelope.state !== null ? envelope.state : {},
  };
}
/**
 * Minimal Google Drive transport client for MVP sync/import/export.
 *
 * Uses Drive `appDataFolder` to keep snapshots private to the authenticated user account
 * and outside regular Drive browsing clutter.
 */
export class GoogleDriveSyncClient {
  /**
   * @param {{fetchImpl?: typeof fetch, fileName?: string}} [options]
   */
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.fileName = options.fileName || DEFAULT_SYNC_FILENAME;
  }

  /**
   * @param {string} accessToken
   * @returns {Promise<string | null>} file id or null when no sync file exists yet
   */
  async findSyncFileId(accessToken) {
    const query = encodeURIComponent(`name='${this.fileName}' and 'appDataFolder' in parents and trashed=false`);
    const response = await this.fetchImpl(
      `${DRIVE_FILES_ENDPOINT}?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)&pageSize=1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to query Google Drive sync file (HTTP ${response.status}).`);
    }

    const payload = await response.json();
    const file = payload?.files?.[0];
    return file?.id || null;
  }

  /**
   * @param {string} accessToken
   * @returns {Promise<SyncEnvelope | null>}
   */
  async downloadEnvelope(accessToken) {
    const fileId = await this.findSyncFileId(accessToken);
    if (!fileId) {
      return null;
    }

    const response = await this.fetchImpl(`${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to download Google Drive sync payload (HTTP ${response.status}).`);
    }

    const rawEnvelope = await response.json();
    return migrateSyncEnvelope(rawEnvelope);
  }

  /**
   * Upload a sync envelope, creating or updating the appData file.
   *
   * @param {string} accessToken
   * @param {SyncEnvelope} envelope
   * @returns {Promise<{fileId: string}>}
   */
  async uploadEnvelope(accessToken, envelope) {
    const existingId = await this.findSyncFileId(accessToken);
    const metadata = existingId
      ? { name: this.fileName }
      : { name: this.fileName, parents: ['appDataFolder'] };

    const boundary = 'pm-sync-boundary';
    const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const mediaPart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(envelope)}\r\n--${boundary}--`;

    const method = existingId ? 'PATCH' : 'POST';
    const targetUrl = existingId
      ? `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(existingId)}?uploadType=multipart`
      : `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`;

    const response = await this.fetchImpl(targetUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: `${metadataPart}${mediaPart}`,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload Google Drive sync payload (HTTP ${response.status}).`);
    }

    const payload = await response.json();
    return { fileId: payload.id };
  }
}
