import test from 'node:test';
import assert from 'node:assert/strict';

import { validateUnit } from '../assets/js/validation/validators.js';
import { evaluateRecipeRecommendation } from '../assets/js/domain/recommendations.js';
import { aggregateIngredientDemand } from '../assets/js/domain/planner.js';
import { generateShoppingItems } from '../assets/js/domain/shopping.js';

test('validateUnit accepts canonical count and rejects legacy count aliases', () => {
  assert.equal(validateUnit('count').isValid, true);
  assert.equal(validateUnit('unit').isValid, false);
  assert.equal(validateUnit('item').isValid, false);
  assert.equal(validateUnit('pcs').isValid, false);
});

test('recommendation conversion rejects legacy count aliases as unsupported units', () => {
  const recipe = {
    id: 'recipe_alias_count_001',
    name: 'Alias Count Recipe',
    ingredients: [{ inventoryItemId: 'item_eggs_001', quantity: 2, unit: 'pcs' }],
  };

  const inventoryById = new Map([
    ['item_eggs_001', { id: 'item_eggs_001', name: 'Eggs', quantity: 6, unit: 'count' }],
  ]);

  const result = evaluateRecipeRecommendation(recipe, inventoryById);

  assert.equal(result.shortages.length, 1);
  assert.match(result.shortages[0].reason, /Unsupported unit: pcs/);
});

test('planner + shopping flows preserve canonical count units end-to-end', () => {
  const mealPlanEntries = [
    { id: 'plan_mon_breakfast_001', recipeId: 'recipe_omelette_001', portionMultiplier: 1, date: '2026-01-05', slot: 'breakfast' },
    { id: 'plan_tue_breakfast_001', recipeId: 'recipe_omelette_001', portionMultiplier: 1.5, date: '2026-01-06', slot: 'breakfast' },
  ];

  const recipes = [{
    id: 'recipe_omelette_001',
    ingredients: [{ inventoryItemId: 'item_eggs_001', quantity: 2, unit: 'count' }],
  }];

  const demand = aggregateIngredientDemand(mealPlanEntries, recipes);
  assert.deepEqual(demand, [{
    inventoryItemId: 'item_eggs_001',
    unit: 'count',
    requiredQuantity: 5,
    sourceMealPlanEntryIds: ['plan_mon_breakfast_001', 'plan_tue_breakfast_001'],
  }]);

  const shoppingItems = generateShoppingItems(demand, [
    { id: 'item_eggs_001', name: 'Eggs', quantity: 4, unit: 'count', category: 'dairy' },
  ]);

  assert.equal(shoppingItems.length, 1);
  assert.equal(shoppingItems[0].unit, 'count');
  assert.equal(shoppingItems[0].availableQuantity, 4);
  assert.equal(shoppingItems[0].missingQuantity, 1);
});

test('shopping generation treats non-canonical inventory unit token as non-comparable', () => {
  const demand = [{
    inventoryItemId: 'item_eggs_001',
    unit: 'count',
    requiredQuantity: 3,
    sourceMealPlanEntryIds: ['plan_mon_breakfast_001'],
  }];

  const shoppingItems = generateShoppingItems(demand, [
    { id: 'item_eggs_001', name: 'Eggs', quantity: 12, unit: 'pcs', category: 'dairy' },
  ]);

  assert.equal(shoppingItems.length, 1);
  assert.equal(shoppingItems[0].availableQuantity, 0);
  assert.equal(shoppingItems[0].missingQuantity, 3);
});
