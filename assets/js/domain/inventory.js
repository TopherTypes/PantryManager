/**
 * Usage:
 * - Use `validateInventoryDraft` for form-time validation and
 *   `validateInventoryItem` for persisted records that require IDs.
 * - Use immutable helpers (`upsertInventoryItem`, `archiveInventoryItem`) when
 *   mutating inventory collections in controllers.
 */
import {
  combineValidationResults,
  validateDate,
  validateId,
  validateNonNegativePrice,
  validateNutrition,
  validatePositiveQuantity,
} from '../validation/validators.js';
import { REQUIRED_NUTRITION_FIELDS } from '../validation/constraints.js';
import { allowedUnits } from './conversion.js';

/** Validate an inventory item against canonical MVP constraints. */
export function validateInventoryItem(item) {
  const expiryValidation = item.expiryDate ? validateDate(item.expiryDate) : { isValid: true, errors: [] };

  return combineValidationResults([
    validateId(item.id),
    validateInventoryDraft(item),
    expiryValidation,
  ]);
}

/**
 * Validate UI inventory draft fields (without requiring an ID).
 * Business rules intentionally live in domain modules, not controllers.
 */
export function validateInventoryDraft(item) {
  const errors = [];

  if (!item.name || item.name.length < 1 || item.name.length > 120) {
    errors.push('Name is required and must be between 1 and 120 characters.');
  }

  errors.push(...validatePositiveQuantity(item.quantity).errors);

  if (!item.unit || !allowedUnits.has(item.unit)) {
    errors.push('Unit is required and must be one of g, kg, ml, l, or count.');
  }

  errors.push(...validateNonNegativePrice(item.price).errors);
  errors.push(...validateNutrition(item.nutrition).errors.map((error) => error.replace('nutrition.', '')));

  if (item.expiryDate) {
    errors.push(...validateDate(item.expiryDate).errors.map(() => 'Expiry date must be in YYYY-MM-DD format when provided.'));
  }

  if (item.barcode && !/^[A-Za-z0-9_-]+$/.test(item.barcode)) {
    errors.push('Barcode can only contain letters, numbers, underscores, and dashes.');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Return required nutrition fields that are missing finite values.
 * @param {Record<string, number>} nutrition - Candidate nutrition payload.
 * @returns {string[]} Missing field names.
 */
export function getMissingRequiredNutritionFields(nutrition) {
  return REQUIRED_NUTRITION_FIELDS.filter((key) => !Number.isFinite(nutrition?.[key]));
}

/**
 * Parse quantity text formatted as `<number><optional-space><unit>`.
 * @param {string} rawQuantity - Raw user-provided quantity text.
 * @returns {{quantity: number | null, unit: string | null}} Parsed quantity and unit.
 */
export function parseAndNormalizeQuantityText(rawQuantity) {
  const value = String(rawQuantity || '').trim().toLowerCase();
  if (!value) return { quantity: null, unit: null };

  const match = value.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|count)$/);
  if (!match) return { quantity: null, unit: null };

  const numeric = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric <= 0) return { quantity: null, unit: null };
  return { quantity: numeric, unit: match[2] };
}

/**
 * Insert or replace an inventory item by ID.
 * @param {Record<string, any>[]} items - Existing inventory array.
 * @param {Record<string, any>} item - Inventory item to insert or replace.
 * @returns {Record<string, any>[]} Updated immutable inventory array.
 */
export function upsertInventoryItem(items, item) {
  const existingIndex = items.findIndex((entry) => entry.id === item.id);
  if (existingIndex === -1) return [...items, item];
  return items.map((entry, index) => (index === existingIndex ? item : entry));
}

/**
 * Mark an inventory item as archived at a UTC timestamp.
 * @param {Record<string, any>[]} items - Existing inventory array.
 * @param {string} itemId - Inventory item ID to archive.
 * @param {string} archivedAtUtc - UTC archive timestamp.
 * @returns {Record<string, any>[]} Updated immutable inventory array.
 */
export function archiveInventoryItem(items, itemId, archivedAtUtc) {
  return items.map((item) => (item.id === itemId ? { ...item, archivedAt: archivedAtUtc } : item));
}
