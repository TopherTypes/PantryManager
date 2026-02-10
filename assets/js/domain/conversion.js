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

export function getUnitMeta(unit) {
  return UNIT_MAP[unit] || null;
}

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
