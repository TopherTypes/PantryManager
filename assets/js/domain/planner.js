import {
  combineValidationResults,
  validateDate,
  validateId,
  validatePositiveQuantity,
} from '../validation/validators.js';

/**
 * Meal planner domain service.
 *
 * Provides pure planning operations and validation for meal plan entries.
 */

const MEAL_SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

/**
 * Validate a meal plan entry.
 * @param {Record<string, any>} entry - Candidate meal-plan row.
 * @returns {import('../validation/validators.js').ValidationResult} Validation result.
 */
export function validateMealPlanEntry(entry) {
  const errors = [];

  if (!MEAL_SLOTS.has(entry.slot)) {
    errors.push('slot must be one of breakfast, lunch, dinner, snack');
  }

  return combineValidationResults([
    validateId(entry.id),
    validateDate(entry.date),
    validateId(entry.recipeId),
    validatePositiveQuantity(entry.portionMultiplier, 'portionMultiplier'),
    { isValid: errors.length === 0, errors },
  ]);
}

/**
 * Add or replace a meal-plan entry by ID.
 * @param {Record<string, any>[]} entries - Existing plan entries.
 * @param {Record<string, any>} nextEntry - Entry to add or replace.
 * @returns {Record<string, any>[]} Updated entries collection.
 */
export function upsertMealPlanEntry(entries, nextEntry) {
  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
  if (existingIndex === -1) {
    return [...entries, nextEntry];
  }

  return entries.map((entry, index) => (index === existingIndex ? nextEntry : entry));
}
