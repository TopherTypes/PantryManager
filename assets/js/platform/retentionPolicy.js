/**
 * Usage:
 * - Use `runRetentionJobs` as the orchestration entrypoint for scheduled
 *   retention processing.
 * - Use lower-level retention functions only for targeted testing scenarios.
 */
/**
 * Retention policy engine for MVP lifecycle requirements.
 *
 * Policy (from clarifications Q8 / ADR 0002):
 * 1) Most domain records are archived after 30 days of inactivity.
 * 2) Archived records are deleted after an additional 30-day archive window.
 * 3) Pricing history is retained for 12 months before deletion.
 *
 * Time-zone and clock behavior notes:
 * - All comparisons are performed against UTC millisecond timestamps.
 * - Date-only fields are interpreted as UTC midnight to avoid local-time ambiguity.
 * - This engine assumes host clock is reasonably correct. If clock skew is severe,
 *   policy execution can run early/late; callers should schedule periodic reruns.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse timestamps using stable UTC fallback for date-only values.
 * @param {string | null | undefined} raw
 * @returns {number | null}
 */
function parseUtcMs(raw) {
  if (!raw) {
    return null;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const normalized = isDateOnly ? `${raw}T00:00:00.000Z` : raw;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Determine whether a record should be archived now.
 *
 * A record is archive-eligible when:
 * - it is not already archived
 * - it has `updatedAt` older than archive threshold
 *
 * @param {Record<string, any>} record
 * @param {number} nowMs
 * @param {number} archiveAfterMs
 * @returns {boolean}
 */
function shouldArchiveRecord(record, nowMs, archiveAfterMs) {
  if (record.archivedAt) {
    return false;
  }

  const updatedAtMs = parseUtcMs(record.updatedAt) ?? parseUtcMs(record.createdAt);
  if (!Number.isFinite(updatedAtMs)) {
    return false;
  }

  return nowMs - updatedAtMs >= archiveAfterMs;
}

/**
 * Determine whether an archived record should be deleted.
 *
 * @param {Record<string, any>} record
 * @param {number} nowMs
 * @param {number} deleteAfterArchiveMs
 * @returns {boolean}
 */
function shouldDeleteArchivedRecord(record, nowMs, deleteAfterArchiveMs) {
  const archivedAtMs = parseUtcMs(record.archivedAt);
  if (!Number.isFinite(archivedAtMs)) {
    return false;
  }

  return nowMs - archivedAtMs >= deleteAfterArchiveMs;
}

/**
 * Apply retention policy to general domain records.
 *
 * Returns active + archived collections so callers can keep a clear audit trail.
 *
 * @param {Record<string, any>[]} records
 * @param {{now?: Date, archiveAfterDays?: number, deleteAfterArchiveDays?: number}} [options]
 * @returns {{active: Record<string, any>[], archived: Record<string, any>[], deleted: Record<string, any>[]}}
 */
export function applyGeneralRetention(records, options = {}) {
  const nowMs = (options.now instanceof Date ? options.now : new Date()).getTime();
  const archiveAfterMs = (options.archiveAfterDays || 30) * DAY_MS;
  const deleteAfterArchiveMs = (options.deleteAfterArchiveDays || 30) * DAY_MS;

  const active = [];
  const archived = [];
  const deleted = [];

  for (const record of records) {
    if (shouldDeleteArchivedRecord(record, nowMs, deleteAfterArchiveMs)) {
      deleted.push(record);
      continue;
    }

    if (shouldArchiveRecord(record, nowMs, archiveAfterMs)) {
      const archivedRecord = {
        ...record,
        archivedAt: new Date(nowMs).toISOString(),
      };
      archived.push(archivedRecord);
      continue;
    }

    if (record.archivedAt) {
      archived.push(record);
    } else {
      active.push(record);
    }
  }

  return { active, archived, deleted };
}

/**
 * Apply 12-month pricing history retention.
 *
 * @param {Record<string, any>[]} pricingHistory
 * @param {{now?: Date, retainMonths?: number}} [options]
 * @returns {{retained: Record<string, any>[], deleted: Record<string, any>[]}}
 */
export function applyPricingRetention(pricingHistory, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const retainMonths = options.retainMonths || 12;

  // Month-window retention uses calendar month subtraction instead of fixed-day approximation.
  // This avoids off-by-weeks behavior across month length differences and leap years.
  const retentionThreshold = new Date(now.toISOString());
  retentionThreshold.setUTCMonth(retentionThreshold.getUTCMonth() - retainMonths);
  const retentionThresholdMs = retentionThreshold.getTime();

  const retained = [];
  const deleted = [];

  for (const point of pricingHistory) {
    const effectiveMs = parseUtcMs(point.recordedAt) ?? parseUtcMs(point.createdAt);

    if (!Number.isFinite(effectiveMs)) {
      // Keep malformed records to avoid accidental data loss; a migration can clean later.
      retained.push(point);
      continue;
    }

    if (effectiveMs < retentionThresholdMs) {
      deleted.push(point);
      continue;
    }

    retained.push(point);
  }

  return { retained, deleted };
}

/**
 * Apply full policy bundle to MVP state.
 *
 * Expected state shape is intentionally tolerant to partial datasets.
 *
 * @param {{inventory?: any[], recipes?: any[], mealPlans?: any[], shoppingLists?: any[], pricingHistory?: any[]}} state
 * @param {{now?: Date}} [options]
 * @returns {{state: Record<string, any>, report: Record<string, any>}}
 */
export function runRetentionJobs(state, options = {}) {
  const nextState = { ...state };

  const inventory = applyGeneralRetention(state.inventory || [], options);
  const recipes = applyGeneralRetention(state.recipes || [], options);
  const mealPlans = applyGeneralRetention(state.mealPlans || [], options);
  const shoppingLists = applyGeneralRetention(state.shoppingLists || [], options);
  const pricing = applyPricingRetention(state.pricingHistory || [], options);

  nextState.inventory = inventory.active;
  nextState.archivedInventory = inventory.archived;
  nextState.recipes = recipes.active;
  nextState.archivedRecipes = recipes.archived;
  nextState.mealPlans = mealPlans.active;
  nextState.archivedMealPlans = mealPlans.archived;
  nextState.shoppingLists = shoppingLists.active;
  nextState.archivedShoppingLists = shoppingLists.archived;
  nextState.pricingHistory = pricing.retained;

  return {
    state: nextState,
    report: {
      inventoryDeleted: inventory.deleted.length,
      recipeDeleted: recipes.deleted.length,
      mealPlanDeleted: mealPlans.deleted.length,
      shoppingListDeleted: shoppingLists.deleted.length,
      pricingDeleted: pricing.deleted.length,
    },
  };
}
