import {
  combineValidationResults,
  validateId,
  validateNonNegativeQuantity,
  validatePositiveQuantity,
  validateUnit,
} from '../validation/validators.js';

/**
 * Shopping domain service.
 *
 * Implements pure helpers to validate and derive shopping-list gap values.
 */

/**
 * Derive missing quantity from required and available inventory amounts.
 * @param {number} requiredQuantity - Demand quantity.
 * @param {number} availableQuantity - Current stock.
 * @returns {number} Deterministic non-negative shortage quantity.
 */
export function computeMissingQuantity(requiredQuantity, availableQuantity) {
  return Math.max(requiredQuantity - availableQuantity, 0);
}

/**
 * Validate shopping list items against canonical constraints.
 * @param {Record<string, any>} item - Candidate shopping list item.
 * @returns {import('../validation/validators.js').ValidationResult} Validation result.
 */
export function validateShoppingItem(item) {
  return combineValidationResults([
    validateId(item.id),
    validatePositiveQuantity(item.requiredQuantity, 'requiredQuantity'),
    validateNonNegativeQuantity(item.availableQuantity, 'availableQuantity'),
    validateNonNegativeQuantity(item.missingQuantity, 'missingQuantity'),
    validateUnit(item.unit),
    item.inventoryItemId ? validateId(item.inventoryItemId) : { isValid: true, errors: [] },
  ]);
}

/**
 * Normalize a shopping item with computed missing quantity.
 * @param {Record<string, any>} item - Shopping item carrying required and available amounts.
 * @returns {Record<string, any>} Immutable item copy with derived missingQuantity.
 */
export function normalizeShoppingItem(item) {
  return {
    ...item,
    missingQuantity: computeMissingQuantity(item.requiredQuantity, item.availableQuantity),
  };
}
