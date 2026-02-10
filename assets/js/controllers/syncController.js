import { createLocalStorageAdapter } from '../storage/localStorageAdapter.js';
import { GoogleDriveSyncClient, createSyncEnvelope, migrateSyncEnvelope, resolveSyncConflict } from '../platform/googleDriveSync.js';
import { runRetentionJobs } from '../platform/retentionPolicy.js';

const STORAGE_KEYS = {
  appState: 'app-state',
  syncEnvelope: 'sync-envelope',
  deviceId: 'device-id',
};

/**
 * Build sync + persistence orchestration on top of existing domain controllers.
 *
 * The controller intentionally treats cloud sync as optional: all failures should
 * keep the application fully operational in local-only mode.
 */
export function initializeSyncController(inventoryController, recipeController, plannerController) {
  const storage = createLocalStorageAdapter('pantrymanager');
  const driveClient = new GoogleDriveSyncClient();

  const saveLocalButton = document.getElementById('sync-save-local-button');
  const exportSyncButton = document.getElementById('sync-export-button');
  const importButton = document.getElementById('sync-import-button');
  const tokenField = document.getElementById('sync-google-access-token');
  const importInput = document.getElementById('sync-import-input');
  const syncStatus = document.getElementById('sync-status');

  function setStatus(message, level = 'info') {
    syncStatus.textContent = message;
    syncStatus.className = `helper-text sync-status is-${level}`;
  }

  function getOrCreateDeviceId() {
    const existingId = storage.get(STORAGE_KEYS.deviceId, null);
    if (existingId) {
      return existingId;
    }

    const createdId = (globalThis.crypto?.randomUUID?.() || `device-${Date.now()}`);
    storage.set(STORAGE_KEYS.deviceId, createdId);
    return createdId;
  }

  /**
   * Collect full app state snapshot for persistence and sync.
   * @returns {{inventory: any[], recipes: any[], mealPlans: any[]}}
   */
  function buildAppStateSnapshot() {
    return {
      inventory: inventoryController.items,
      recipes: recipeController.recipes,
      mealPlans: plannerController.mealPlanEntries,
    };
  }

  /**
   * Persist current app state locally; throw to caller for error handling.
   */
  function persistLocalState() {
    storage.set(STORAGE_KEYS.appState, buildAppStateSnapshot());
  }

  /**
   * Hydrate controllers from a state payload.
   * @param {{inventory?: any[], recipes?: any[], mealPlans?: any[]}} state
   */
  function applyState(state) {
    if (!state || typeof state !== 'object') {
      return;
    }

    inventoryController.replaceItems(state.inventory || []);
    recipeController.replaceRecipes(state.recipes || []);
    plannerController.replaceMealPlanEntries(state.mealPlans || []);
  }

  function hydrateFromLocalStorage() {
    try {
      const persistedState = storage.get(STORAGE_KEYS.appState, null);
      if (!persistedState) {
        return;
      }

      applyState(persistedState);
      setStatus('Restored saved local data.', 'success');
    } catch (error) {
      setStatus(`Could not read local snapshot. Continuing with in-memory defaults (${error.message}).`, 'warning');
    }
  }

  function connectAutoPersistence() {
    const safePersist = () => {
      try {
        persistLocalState();
      } catch (error) {
        setStatus(`Local persistence failed. App remains usable in memory only (${error.message}).`, 'warning');
      }
    };

    inventoryController.onItemsUpdated = safePersist;
    recipeController.onRecipesUpdated = safePersist;
    plannerController.onMealPlanUpdated = safePersist;
  }

  function triggerLocalSave() {
    try {
      persistLocalState();
      setStatus('Local snapshot saved.', 'success');
    } catch (error) {
      setStatus(`Failed to save locally (${error.message}).`, 'warning');
    }
  }

  async function triggerExportOrSync() {
    const accessToken = tokenField.value.trim();

    try {
      const currentState = buildAppStateSnapshot();
      const { state: retainedState, report } = runRetentionJobs(currentState);
      const localEnvelope = createSyncEnvelope(retainedState, {
        deviceId: getOrCreateDeviceId(),
        source: 'pantrymanager-web-export',
      });

      storage.set(STORAGE_KEYS.syncEnvelope, localEnvelope);
      storage.set(STORAGE_KEYS.appState, retainedState);

      if (!accessToken) {
        setStatus(`Exported locally only (no access token). Cleanup removed ${Object.values(report).reduce((sum, count) => sum + count, 0)} stale record(s).`, 'info');
        importInput.value = JSON.stringify(localEnvelope, null, 2);
        return;
      }

      const remoteEnvelope = await driveClient.downloadEnvelope(accessToken);
      const resolved = resolveSyncConflict(localEnvelope, remoteEnvelope, { driftToleranceMs: 120000 });

      if (resolved.source === 'remote' && resolved.state) {
        const { state: retainedRemoteState } = runRetentionJobs(resolved.state);
        applyState(retainedRemoteState);
        storage.set(STORAGE_KEYS.appState, retainedRemoteState);
        storage.set(STORAGE_KEYS.syncEnvelope, remoteEnvelope);
        setStatus(`Sync conflict resolved: remote version applied. ${resolved.reason}`, 'info');
        return;
      }

      const uploadResult = await driveClient.uploadEnvelope(accessToken, localEnvelope);
      setStatus(`Synced successfully to Google Drive (file ${uploadResult.fileId}). ${resolved.reason}`, 'success');
    } catch (error) {
      setStatus(`Sync failed. Continuing in local-only mode (${error.message}).`, 'warning');
    }
  }

  function triggerImport() {
    const rawInput = importInput.value.trim();
    if (!rawInput) {
      setStatus('Import payload is empty.', 'warning');
      return;
    }

    try {
      const parsed = JSON.parse(rawInput);
      const migratedEnvelope = migrateSyncEnvelope(parsed?.state ? parsed : createSyncEnvelope(parsed));
      const { state: retainedState, report } = runRetentionJobs(migratedEnvelope.state || {});
      applyState(retainedState);
      storage.set(STORAGE_KEYS.appState, retainedState);
      storage.set(STORAGE_KEYS.syncEnvelope, migratedEnvelope);
      setStatus(`Import completed. Retention cleanup removed ${Object.values(report).reduce((sum, count) => sum + count, 0)} stale record(s).`, 'success');
    } catch (error) {
      setStatus(`Import failed (${error.message}). Existing local data was not changed.`, 'warning');
    }
  }

  saveLocalButton.addEventListener('click', triggerLocalSave);
  exportSyncButton.addEventListener('click', () => { void triggerExportOrSync(); });
  importButton.addEventListener('click', triggerImport);

  hydrateFromLocalStorage();
  connectAutoPersistence();

  return {
    saveLocally: triggerLocalSave,
    exportOrSync: triggerExportOrSync,
    importPayload: triggerImport,
  };
}
