import {
  combineValidationResults,
  validateId,
  validatePositiveQuantity,
  validateUnit,
} from '../validation/validators.js';

/**
 * Recipe domain service.
 *
 * Manages canonical recipe validation and immutable updates for recipe lists.
 */

/**
 * Validate a recipe ingredient row.
 * @param {Record<string, any>} ingredient - Ingredient entry.
 * @returns {import('../validation/validators.js').ValidationResult} Validation output.
 */
export function validateRecipeIngredient(ingredient) {
  return combineValidationResults([
    validateId(ingredient.inventoryItemId),
    validatePositiveQuantity(ingredient.quantity),
    validateUnit(ingredient.unit),
  ]);
}

/**
 * Validate a recipe entity against MVP constraints.
 * @param {Record<string, any>} recipe - Candidate recipe.
 * @returns {import('../validation/validators.js').ValidationResult} Validation output.
 */
export function validateRecipe(recipe) {
  const errors = [];

  if (!Number.isInteger(recipe.servings) || recipe.servings < 1) {
    errors.push('servings must be an integer greater than or equal to 1');
  }

  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 1) {
    errors.push('ingredients must contain at least one ingredient');
  }

  const ingredientResults = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map(validateRecipeIngredient)
    : [];

  return combineValidationResults([
    validateId(recipe.id),
    { isValid: errors.length === 0, errors },
    ...ingredientResults,
  ]);
}

/**
 * Insert or replace a recipe by ID without mutating inputs.
 * @param {Record<string, any>[]} recipes - Existing recipe collection.
 * @param {Record<string, any>} recipe - Recipe to upsert.
 * @returns {Record<string, any>[]} Updated recipe collection.
 */
export function upsertRecipe(recipes, recipe) {
  const existingIndex = recipes.findIndex((entry) => entry.id === recipe.id);
  if (existingIndex === -1) {
    return [...recipes, recipe];
  }

  return recipes.map((entry, index) => (index === existingIndex ? recipe : entry));
}
