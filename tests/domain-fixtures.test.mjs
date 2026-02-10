import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getMissingRequiredNutritionFields,
  parseAndNormalizeQuantityText,
} from '../assets/js/domain/inventory.js';
import { validateAndNormalizeRecipeForInventory } from '../assets/js/domain/recipes.js';
import { MATCH_STATUS, rankRecipeRecommendations } from '../assets/js/domain/recommendations.js';
import { aggregateIngredientDemand } from '../assets/js/domain/planner.js';
import {
  generateShoppingItems,
  groupShoppingItemsByStoreSection,
  STORE_SECTION_TAXONOMY,
} from '../assets/js/domain/shopping.js';
import { createOpenFoodFactsAdapter } from '../assets/js/domain/barcode.js';
import {
  barcodeFixtures,
  plannerFixtures,
  recommendationFixtures,
  shoppingFixtures,
} from './fixtures/domain-fixtures.mjs';

/**
 * Minimal event target used to run barcode controller-like decision flow tests in Node.
 */
class FakeElement {
  constructor() {
    this.value = '';
    this.textContent = '';
    this.className = '';
    this.innerHTML = '';
    this.hidden = false;
    this.checked = false;
    this.disabled = false;
    this.listeners = new Map();
  }

  addEventListener(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  async dispatch(eventName) {
    const callbacks = this.listeners.get(eventName) || [];
    for (const callback of callbacks) {
      await callback();
    }
  }
}

/**
 * Small harness mirroring controller decision order for barcode lookup:
 * 1) local inventory match first
 * 2) provider lookup when local misses
 * 3) retry transient failures up to three attempts
 */
async function runBarcodeLookupFlow({ barcode, getLocalMatchByBarcode, adapter }) {
  const localMatch = getLocalMatchByBarcode(barcode);
  if (localMatch) {
    return { branch: 'local_hit', ok: true, draft: localMatch };
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await adapter.lookupByBarcode(barcode);
    if (result.ok) {
      return { branch: 'provider_hit', ok: true, draft: result.draft, attempts: attempt };
    }

    if (result.error?.kind !== 'transient') {
      return { branch: result.error?.kind ?? 'unknown_error', ok: false, attempts: attempt };
    }

    if (attempt === 3) {
      return { branch: 'retry_fallback', ok: false, attempts: attempt };
    }
  }

  return { branch: 'retry_fallback', ok: false, attempts: 3 };
}

test('recommendation fixtures rank full/partial matches with expiry urgency tie-breakers', () => {
  const ranked = rankRecipeRecommendations(
    recommendationFixtures.recipes,
    recommendationFixtures.inventoryItems,
    { now: new Date(recommendationFixtures.now) }
  );

  assert.deepEqual(
    ranked.allRanked.map((entry) => entry.recipe.id),
    ['recipe_urgent_001', 'recipe_later_001', 'recipe_partial_001']
  );

  assert.deepEqual(
    ranked.fullySatisfiable.map((entry) => entry.recipe.id),
    ['recipe_urgent_001', 'recipe_later_001']
  );

  assert.equal(ranked.partiallySatisfiable.length, 1);
  assert.equal(ranked.partiallySatisfiable[0].matchStatus, MATCH_STATUS.PARTIALLY_SATISFIABLE);
  assert.match(ranked.partiallySatisfiable[0].shortages[0].reason, /Insufficient quantity/);
});

test('planner fixtures aggregate demand using portion multipliers deterministically', () => {
  const aggregated = aggregateIngredientDemand(plannerFixtures.entries, plannerFixtures.recipes);

  assert.deepEqual(aggregated, [
    {
      inventoryItemId: 'item_carrot_001',
      unit: 'kg',
      requiredQuantity: 1,
      sourceMealPlanEntryIds: ['plan_monday_001', 'plan_tuesday_001'],
    },
    {
      inventoryItemId: 'item_stock_001',
      unit: 'l',
      requiredQuantity: 1.5,
      sourceMealPlanEntryIds: ['plan_monday_001', 'plan_tuesday_001'],
    },
    {
      inventoryItemId: 'item_bread_001',
      unit: 'count',
      requiredQuantity: 4,
      sourceMealPlanEntryIds: ['plan_wednesday_001'],
    },
  ]);
});

test('shopping fixtures compute deficits and grouping taxonomy rules', () => {
  const shoppingItems = generateShoppingItems(
    shoppingFixtures.ingredientDemand,
    shoppingFixtures.inventoryItems
  );

  assert.deepEqual(
    shoppingItems.map((item) => ({
      inventoryItemId: item.inventoryItemId,
      availableQuantity: item.availableQuantity,
      missingQuantity: item.missingQuantity,
      storeSection: item.storeSection,
    })),
    [
      {
        inventoryItemId: 'item_stock_001',
        availableQuantity: 0.2,
        missingQuantity: 1.1,
        storeSection: STORE_SECTION_TAXONOMY.pantry,
      },
      {
        inventoryItemId: 'item_bread_001',
        availableQuantity: 0,
        missingQuantity: 4,
        storeSection: STORE_SECTION_TAXONOMY.bakery,
      },
      {
        inventoryItemId: 'item_soap_001',
        availableQuantity: 0,
        missingQuantity: 1,
        storeSection: STORE_SECTION_TAXONOMY.household,
      },
    ]
  );

  const grouped = groupShoppingItemsByStoreSection(shoppingItems);
  assert.deepEqual(Object.keys(grouped).sort(), ['bakery', 'household', 'pantry']);
  assert.equal(grouped.pantry[0].inventoryItemId, 'item_stock_001');
});

test('inventory and recipe fixtures keep nutrition/quantity parsing and normalization deterministic', () => {
  assert.deepEqual(parseAndNormalizeQuantityText('750 g'), { quantity: 750, unit: 'g' });
  assert.deepEqual(parseAndNormalizeQuantityText(''), { quantity: null, unit: null });

  const missingNutrition = getMissingRequiredNutritionFields({
    caloriesPer100: 200,
    proteinPer100: 9,
    carbsPer100: 40,
    sugarsPer100: NaN,
  });
  assert.deepEqual(missingNutrition, ['sugarsPer100', 'fatsPer100']);

  const normalized = validateAndNormalizeRecipeForInventory(
    {
      id: 'recipe_fixture_001',
      name: 'Fixture Soup',
      servings: 2,
      ingredients: [{ inventoryItemId: 'item_stock_001', quantity: 500, unit: 'ml' }],
    },
    [{ id: 'item_stock_001', quantity: 1, unit: 'l' }]
  );

  assert.equal(normalized.errors.length, 0);
  assert.equal(normalized.normalizedRecipe.ingredients[0].normalizedQuantity, 500);
  assert.equal(normalized.normalizedRecipe.ingredients[0].normalizedUnit, 'ml');
});

test('barcode fixture flow covers local hit, provider hit, retry fallback, malformed and offline branches', async () => {
  const barcode = barcodeFixtures.barcode;

  const localResult = await runBarcodeLookupFlow({
    barcode,
    getLocalMatchByBarcode: () => ({ barcode, name: 'Local Oats' }),
    adapter: {
      async lookupByBarcode() {
        throw new Error('provider should not be called on local hit');
      },
    },
  });
  assert.equal(localResult.branch, 'local_hit');

  const originalFetch = globalThis.fetch;
  const originalNavigator = globalThis.navigator;

  try {
    globalThis.fetch = async () => ({
      status: 200,
      async json() {
        return barcodeFixtures.providerPayload;
      },
    });

    const adapter = createOpenFoodFactsAdapter();
    const providerResult = await runBarcodeLookupFlow({
      barcode,
      getLocalMatchByBarcode: () => null,
      adapter,
    });

    assert.equal(providerResult.branch, 'provider_hit');
    assert.equal(providerResult.draft.name, 'Fixture Granola');

    let attempts = 0;
    const retryResult = await runBarcodeLookupFlow({
      barcode,
      getLocalMatchByBarcode: () => null,
      adapter: {
        async lookupByBarcode() {
          attempts += 1;
          return {
            ok: false,
            error: { kind: 'transient', message: 'Temporary network issue' },
          };
        },
      },
    });

    assert.equal(retryResult.branch, 'retry_fallback');
    assert.equal(attempts, 3);

    globalThis.fetch = async () => ({
      status: 200,
      async json() {
        throw new Error('broken payload');
      },
    });
    const malformed = await adapter.lookupByBarcode(barcode);
    assert.equal(malformed.ok, false);
    assert.equal(malformed.error.kind, 'malformed');

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: false },
    });

    const offline = await adapter.lookupByBarcode(barcode);
    assert.equal(offline.ok, false);
    assert.equal(offline.error.kind, 'offline');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalNavigator === undefined) {
      delete globalThis.navigator;
    } else {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }
  }
});

test('barcode decision harness can run with deterministic fake event targets in Node', async () => {
  const button = new FakeElement();
  let clicked = 0;
  button.addEventListener('click', async () => {
    clicked += 1;
  });

  await button.dispatch('click');
  assert.equal(clicked, 1);
});
