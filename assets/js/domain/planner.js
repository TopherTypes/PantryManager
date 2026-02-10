/**
 * Usage:
 * - Use `validateMealPlanEntry` before persisting entries from UI controllers.
 * - Use `aggregateIngredientDemand` and `selectMealPlanEntriesForWeek` to build
 *   shopping inputs from weekly plan windows.
 */
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
 * Round quantity values used in planning/shopping math.
 *
 * Rounding policy:
 * - Keep internal aggregation at full precision to avoid cumulative drift.
 * - Round only when returning public domain outputs so downstream consumers
 *   (UI, exports, tests) observe deterministic numeric values.
 * - Use 3 decimal places to support fractional portions while keeping values readable.
 *
 * @param {number} value - Numeric quantity to round.
 * @returns {number} Quantity rounded to planner precision.
 */
function roundPlannedQuantity(value) {
  return Number(value.toFixed(3));
}

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

/**
 * Add a meal-plan entry, preventing duplicate date+slot assignments.
 * @param {Record<string, any>[]} entries - Existing meal-plan entries.
 * @param {Record<string, any>} nextEntry - Entry carrying date, slot, recipeId, and portionMultiplier.
 * @returns {Record<string, any>[]} Updated meal-plan entries.
 */
export function addMealPlanEntry(entries, nextEntry) {
  const duplicateSlot = entries.some(
    (entry) => entry.date === nextEntry.date && entry.slot === nextEntry.slot
  );

  if (duplicateSlot) {
    throw new Error('meal plan already contains an entry for this date and slot');
  }

  return [...entries, nextEntry];
}


/**
 * Build a stable aggregation key for ingredient demand rows.
 *
 * Canonical unit policy:
 * - The unit token is part of the identity to prevent implicit alias conversion.
 * - `count` is canonical for count-family persisted values.
 *
 * @param {Record<string, any>} ingredient - Recipe ingredient row.
 * @returns {string} Composite key for aggregation.
 */
function createDemandAggregationKey(ingredient) {
  return `${ingredient.inventoryItemId}::${ingredient.unit}`;
}

/**
 * Aggregate ingredient demand for selected meal-plan entries.
 *
 * Aggregation rules:
 * - Each recipe ingredient quantity is scaled by the meal entry's `portionMultiplier`
 *   before any totals are computed.
 * - Values are aggregated by inventory item + unit. We intentionally do not auto-convert
 *   between units here because density- and conversion-policy decisions belong to a
 *   dedicated conversion module.
 * - We aggregate in raw floating point and round once at output to reduce rounding drift.
 *
 * @param {Record<string, any>[]} mealPlanEntries - Entries included in planning scope.
 * @param {Record<string, any>[]} recipes - Available recipes referenced by entries.
 * @returns {Record<string, any>[]} Aggregated ingredient demand rows.
 */
export function aggregateIngredientDemand(mealPlanEntries, recipes) {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const demandByIngredient = new Map();

  mealPlanEntries.forEach((entry) => {
    const recipe = recipeById.get(entry.recipeId);
    if (!recipe) {
      return;
    }

    recipe.ingredients.forEach((ingredient) => {
      const aggregationKey = createDemandAggregationKey(ingredient);
      const scaledQuantity = ingredient.quantity * entry.portionMultiplier;

      if (!demandByIngredient.has(aggregationKey)) {
        demandByIngredient.set(aggregationKey, {
          inventoryItemId: ingredient.inventoryItemId,
          unit: ingredient.unit,
          requiredQuantity: 0,
          sourceMealPlanEntryIds: [],
        });
      }

      const aggregateRow = demandByIngredient.get(aggregationKey);
      aggregateRow.requiredQuantity += scaledQuantity;
      aggregateRow.sourceMealPlanEntryIds.push(entry.id);
    });
  });

  return Array.from(demandByIngredient.values()).map((row) => ({
    ...row,
    requiredQuantity: roundPlannedQuantity(row.requiredQuantity),
  }));
}

/**
 * Select meal-plan entries whose `date` falls within an inclusive weekly window.
 * @param {Record<string, any>[]} entries - Candidate meal-plan entries.
 * @param {string} weekStartDate - Inclusive range start in YYYY-MM-DD.
 * @param {string} weekEndDate - Inclusive range end in YYYY-MM-DD.
 * @returns {Record<string, any>[]} Entries inside the target date window.
 */
export function selectMealPlanEntriesForWeek(entries, weekStartDate, weekEndDate) {
  return entries.filter((entry) => entry.date >= weekStartDate && entry.date <= weekEndDate);
}
