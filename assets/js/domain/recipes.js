import {
  combineValidationResults,
  validateId,
  validatePositiveQuantity,
} from '../validation/validators.js';
import { allowedUnits, normalizeToFamilyBase } from './conversion.js';

export function validateRecipeIngredient(ingredient) {
  const errors = [];
  errors.push(...validateId(ingredient.inventoryItemId).errors);
  errors.push(...validatePositiveQuantity(ingredient.quantity).errors);
  if (!ingredient.unit || !allowedUnits.has(ingredient.unit)) {
    errors.push('unit must be one of g, kg, ml, l, or count');
  }
  return { isValid: errors.length === 0, errors };
}

export function validateRecipe(recipe) {
  const errors = [];
  if (!recipe.name || recipe.name.length < 1 || recipe.name.length > 120) {
    errors.push('Recipe name is required and must be between 1 and 120 characters.');
  }
  if (!Number.isInteger(recipe.servings) || recipe.servings < 1) {
    errors.push('Servings is required and must be an integer of at least 1.');
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 1) {
    errors.push('At least one ingredient row is required.');
  }

  const ingredientResults = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map(validateRecipeIngredient)
    : [];

  return combineValidationResults([{ isValid: errors.length === 0, errors }, ...ingredientResults]);
}

/**
 * Normalize recipe ingredient units to family base while checking inventory compatibility.
 */
export function validateAndNormalizeRecipeForInventory(recipe, inventoryItems) {
  const validation = validateRecipe(recipe);
  const errors = [...validation.errors];
  const warnings = [];
  const normalizedIngredients = [];

  recipe.ingredients.forEach((ingredient, index) => {
    const rowNumber = index + 1;
    const inventoryItem = inventoryItems.find((item) => item.id === ingredient.inventoryItemId);
    if (!inventoryItem) {
      errors.push(`Ingredient row ${rowNumber}: selected inventory item does not exist.`);
      return;
    }

    const normalizedIngredient = normalizeToFamilyBase(ingredient.quantity, ingredient.unit);
    const normalizedInventory = normalizeToFamilyBase(inventoryItem.quantity, inventoryItem.unit);

    if (!normalizedIngredient.ok) {
      errors.push(`Ingredient row ${rowNumber}: normalization failed (${normalizedIngredient.reason}).`);
      return;
    }
    if (!normalizedInventory.ok) {
      errors.push(`Ingredient row ${rowNumber}: inventory unit cannot be normalized (${normalizedInventory.reason}).`);
      return;
    }
    if (normalizedIngredient.family !== normalizedInventory.family) {
      errors.push(`Ingredient row ${rowNumber}: cannot convert ${ingredient.unit} ingredient to ${inventoryItem.unit} inventory because families differ (${normalizedIngredient.family} vs ${normalizedInventory.family}).`);
      return;
    }

    normalizedIngredients.push({
      inventoryItemId: ingredient.inventoryItemId,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      normalizedQuantity: normalizedIngredient.quantity,
      normalizedUnit: normalizedIngredient.baseUnit,
      unitFamily: normalizedIngredient.family,
    });

    if (ingredient.unit !== normalizedIngredient.baseUnit) {
      warnings.push(`Ingredient row ${rowNumber}: normalized ${ingredient.quantity} ${ingredient.unit} to ${normalizedIngredient.quantity} ${normalizedIngredient.baseUnit}.`);
    }
  });

  return {
    errors,
    warnings,
    normalizedRecipe: {
      id: recipe.id,
      name: recipe.name,
      servings: recipe.servings,
      preparationNotes: recipe.preparationNotes || null,
      ingredients: normalizedIngredients,
    },
  };
}

export function upsertRecipe(recipes, recipe) {
  const existingIndex = recipes.findIndex((entry) => entry.id === recipe.id);
  if (existingIndex === -1) return [...recipes, recipe];
  return recipes.map((entry, index) => (index === existingIndex ? recipe : entry));
}
