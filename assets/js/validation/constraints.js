/**
 * Canonical validation constants for PantryManager domain entities.
 *
 * These values are derived from docs/architecture/data-model.md and are kept
 * centralized so all validators and domain services enforce the same policy.
 */

/** @type {RegExp} Stable entity ID pattern: <prefix>_<slug>_<numeric-suffix>. */
export const ID_PATTERN = /^[a-z]+_[a-z0-9_]+_[0-9]{3,}$/;

/** @type {RegExp} Date-only pattern in YYYY-MM-DD format. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** @type {RegExp} UTC ISO-8601 pattern in YYYY-MM-DDTHH:mm:ssZ format. */
export const DATETIME_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** Required nutrition fields represented on a per-100 basis. */
export const REQUIRED_NUTRITION_FIELDS = Object.freeze([
  'caloriesPer100',
  'proteinPer100',
  'carbsPer100',
  'sugarsPer100',
  'fatsPer100',
]);

/**
 * Canonical built-in units grouped by unit family for MVP workflows.
 * Apps can extend this through custom unit registration.
 */
export const UNIT_FAMILIES = Object.freeze({
  mass: Object.freeze(['g', 'kg', 'oz', 'lb']),
  volume: Object.freeze(['ml', 'l', 'tsp', 'tbsp', 'cup']),
  // Canonical persisted count token for MVP. Legacy aliases are intentionally
  // excluded so validators reject them unless explicitly registered as custom units.
  count: Object.freeze(['count']),
});
