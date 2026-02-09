import {
  combineValidationResults,
  validateDate,
  validateId,
  validateNonNegativePrice,
  validateNutrition,
  validatePositiveQuantity,
  validateUnit,
} from '../validation/validators.js';

/**
 * Inventory domain service.
 *
 * Exposes pure functions for validation and immutable list updates so the
 * inventory workflow can be tested without browser dependencies.
 */

/**
 * Validate an inventory item against canonical MVP constraints.
 * @param {Record<string, any>} item - Candidate inventory entity.
 * @returns {import('../validation/validators.js').ValidationResult} Validation result.
 */
export function validateInventoryItem(item) {
  const expiryValidation = item.expiryDate ? validateDate(item.expiryDate) : { isValid: true, errors: [] };

  return combineValidationResults([
    validateId(item.id),
    validatePositiveQuantity(item.quantity),
    validateUnit(item.unit),
    validateNonNegativePrice(item.price),
    validateNutrition(item.nutrition),
    expiryValidation,
  ]);
}

/**
 * Insert or replace an inventory item by ID without mutating inputs.
 * @param {Record<string, any>[]} items - Existing inventory collection.
 * @param {Record<string, any>} item - Item to upsert.
 * @returns {Record<string, any>[]} New collection with upserted item.
 */
export function upsertInventoryItem(items, item) {
  const existingIndex = items.findIndex((entry) => entry.id === item.id);
  if (existingIndex === -1) {
    return [...items, item];
  }

  return items.map((entry, index) => (index === existingIndex ? item : entry));
}

/**
 * Archive an inventory item by stamping archivedAt.
 * @param {Record<string, any>[]} items - Inventory collection.
 * @param {string} itemId - ID of the item to archive.
 * @param {string} archivedAtUtc - UTC timestamp.
 * @returns {Record<string, any>[]} Updated inventory collection.
 */
export function archiveInventoryItem(items, itemId, archivedAtUtc) {
  return items.map((item) => (item.id === itemId ? { ...item, archivedAt: archivedAtUtc } : item));
}
