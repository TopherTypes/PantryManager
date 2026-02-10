/**
 * Usage:
 * - Use `createOpenFoodFactsAdapter` when wiring barcode scans to inventory
 *   drafts and nutrition extraction workflows.
 * - Keep API parsing in this module so controller code stays transport-agnostic.
 */
import { parseAndNormalizeQuantityText } from './inventory.js';

/**
 * Required nutrition keys for canonical barcode draft mapping.
 */
export const REQUIRED_NUTRITION_KEYS = Object.freeze([
  'caloriesPer100',
  'proteinPer100',
  'carbsPer100',
  'sugarsPer100',
  'fatsPer100',
]);

/**
 * Create an Open Food Facts adapter that returns normalized canonical drafts.
 */
export function createOpenFoodFactsAdapter() {
  const endpoint = 'https://world.openfoodfacts.org/api/v2/product';

  return {
    async lookupByBarcode(barcode, options = {}) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { ok: false, draft: null, error: { kind: 'offline', message: 'You appear to be offline. External barcode lookup was skipped; continue with manual entry.' } };
      }

      let response;
      try {
        response = await fetch(`${endpoint}/${encodeURIComponent(barcode)}.json`, {
          signal: options.signal,
          headers: { Accept: 'application/json' },
        });
      } catch {
        return { ok: false, draft: null, error: { kind: 'transient', message: 'Temporary network issue while contacting Open Food Facts.' } };
      }

      if (response.status === 429) return { ok: false, draft: null, error: { kind: 'rate_limit', message: 'Open Food Facts rate limit reached. Continue with manual entry.' } };
      if (response.status >= 500) return { ok: false, draft: null, error: { kind: 'transient', message: `Open Food Facts temporarily unavailable (HTTP ${response.status}).` } };
      if (response.status === 404) return { ok: false, draft: null, error: { kind: 'not_found', message: 'No provider match was found for this barcode.' } };

      let payload;
      try {
        payload = await response.json();
      } catch {
        return { ok: false, draft: null, error: { kind: 'malformed', message: 'Provider response was malformed and could not be parsed.' } };
      }

      if (payload?.status === 0 || !payload?.product) {
        return { ok: false, draft: null, error: { kind: 'not_found', message: 'No provider match was found for this barcode.' } };
      }

      const canonicalDraft = mapOpenFoodFactsProductToCanonicalDraft(payload.product, barcode);
      if (!canonicalDraft) {
        return { ok: false, draft: null, error: { kind: 'malformed', message: 'Provider response was missing required mapping fields and was discarded.' } };
      }

      return { ok: true, draft: canonicalDraft, error: null };
    },
  };
}

function mapOpenFoodFactsProductToCanonicalDraft(product, barcode) {
  const name = String(product?.product_name || '').trim();
  if (!name) return null;

  const quantityResult = parseAndNormalizeQuantityText(product?.quantity);
  const nutriments = product?.nutriments || {};

  return {
    barcode,
    name,
    brand: String(product?.brands || '').trim() || null,
    quantity: quantityResult.quantity,
    unit: quantityResult.unit,
    category: firstCsvToken(product?.categories),
    nutrition: {
      caloriesPer100: toFiniteNumber(nutriments['energy-kcal_100g']),
      proteinPer100: toFiniteNumber(nutriments.proteins_100g),
      carbsPer100: toFiniteNumber(nutriments.carbohydrates_100g),
      sugarsPer100: toFiniteNumber(nutriments.sugars_100g),
      fatsPer100: toFiniteNumber(nutriments.fat_100g),
    },
  };
}

function toFiniteNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
}

function firstCsvToken(value) {
  return String(value || '')
    .split(',')
    .map((segment) => segment.trim())
    .find(Boolean) || null;
}
