/**
 * Usage:
 * - Import `normalizeToFamilyBase` when recipe or inventory workflows require
 *   deterministic unit-family normalization.
 * - Import `getUnitMeta` or `allowedUnits` for UI-level checks that should
 *   stay aligned with canonical domain conversion rules.
 */
/**
 * Shared unit conversion utility.
 *
 * Assumptions documented explicitly for MVP:
 * - Mass base unit is grams (g).
 * - Volume base unit is milliliters (ml).
 * - Count base unit is count.
 * - Cross-family conversion is not supported without density metadata.
 */
const UNIT_MAP = Object.freeze({
  g: { family: 'mass', toBaseFactor: 1, baseUnit: 'g' },
  kg: { family: 'mass', toBaseFactor: 1000, baseUnit: 'g' },
  ml: { family: 'volume', toBaseFactor: 1, baseUnit: 'ml' },
  l: { family: 'volume', toBaseFactor: 1000, baseUnit: 'ml' },
  count: { family: 'count', toBaseFactor: 1, baseUnit: 'count' },
});

export const allowedUnits = new Set(Object.keys(UNIT_MAP));

/**
 * Retrieve conversion metadata for a canonical unit token.
 * @param {string} unit - Canonical unit token.
 * @returns {{family: string, toBaseFactor: number, baseUnit: string} | null} Unit metadata or null.
 */
export function getUnitMeta(unit) {
  return UNIT_MAP[unit] || null;
}

/**
 * Convert a quantity into its unit-family base representation.
 * @param {number} quantity - Quantity to normalize.
 * @param {string} unit - Source unit token.
 * @returns {{ok: false, reason: string} | {ok: true, quantity: number, family: string, baseUnit: string}} Conversion result.
 */
export function normalizeToFamilyBase(quantity, unit) {
  const meta = getUnitMeta(unit);
  if (!meta) {
    return { ok: false, reason: `Unsupported unit ${unit || '(empty)'}.` };
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, reason: 'Quantity must be a finite number greater than 0 for conversion.' };
  }

  return {
    ok: true,
    quantity: Number((quantity * meta.toBaseFactor).toFixed(6)),
    family: meta.family,
    baseUnit: meta.baseUnit,
  };
}
