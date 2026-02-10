/**
 * Domain-level deterministic fixtures used by smoke-depth unit tests.
 *
 * These fixtures intentionally use fixed IDs/dates so recommendation ranking,
 * planning aggregation, and shopping derivation remain stable across runtimes.
 */
export const recommendationFixtures = {
  now: '2026-01-10T00:00:00.000Z',
  inventoryItems: [
    {
      id: 'item_tomato_001',
      name: 'Tomato',
      quantity: 6,
      unit: 'count',
      expiryDate: '2026-01-11',
      category: 'produce',
    },
    {
      id: 'item_pasta_001',
      name: 'Pasta',
      quantity: 500,
      unit: 'g',
      expiryDate: '2026-03-01',
      category: 'grain',
    },
    {
      id: 'item_milk_001',
      name: 'Milk',
      quantity: 1,
      unit: 'l',
      expiryDate: '2026-01-20',
      category: 'dairy',
    },
  ],
  recipes: [
    {
      id: 'recipe_urgent_001',
      name: 'Urgent Tomato Salad',
      ingredients: [
        { inventoryItemId: 'item_tomato_001', quantity: 2, unit: 'count' },
      ],
    },
    {
      id: 'recipe_later_001',
      name: 'Creamy Pasta',
      ingredients: [
        { inventoryItemId: 'item_pasta_001', quantity: 300, unit: 'g' },
        { inventoryItemId: 'item_milk_001', quantity: 0.2, unit: 'l' },
      ],
    },
    {
      id: 'recipe_partial_001',
      name: 'Big Pasta Pot',
      ingredients: [
        { inventoryItemId: 'item_pasta_001', quantity: 700, unit: 'g' },
      ],
    },
  ],
};

export const plannerFixtures = {
  recipes: [
    {
      id: 'recipe_stew_001',
      name: 'Stew',
      ingredients: [
        { inventoryItemId: 'item_carrot_001', quantity: 0.4, unit: 'kg' },
        { inventoryItemId: 'item_stock_001', quantity: 0.6, unit: 'l' },
      ],
    },
    {
      id: 'recipe_sandwich_001',
      name: 'Sandwich',
      ingredients: [
        { inventoryItemId: 'item_bread_001', quantity: 2, unit: 'count' },
      ],
    },
  ],
  entries: [
    { id: 'plan_monday_001', recipeId: 'recipe_stew_001', portionMultiplier: 1, date: '2026-01-12', slot: 'dinner' },
    { id: 'plan_tuesday_001', recipeId: 'recipe_stew_001', portionMultiplier: 1.5, date: '2026-01-13', slot: 'dinner' },
    { id: 'plan_wednesday_001', recipeId: 'recipe_sandwich_001', portionMultiplier: 2, date: '2026-01-14', slot: 'lunch' },
  ],
};

export const shoppingFixtures = {
  inventoryItems: [
    { id: 'item_carrot_001', name: 'Carrot', quantity: 0.5, unit: 'kg', category: 'vegetable' },
    { id: 'item_stock_001', name: 'Stock', quantity: 0.2, unit: 'l', category: 'canned' },
    { id: 'item_bread_001', name: 'Bread', quantity: 3, unit: 'pcs', category: 'bakery' },
    { id: 'item_soap_001', name: 'Dish Soap', quantity: 0, unit: 'count', category: 'cleaning' },
  ],
  ingredientDemand: [
    { inventoryItemId: 'item_carrot_001', requiredQuantity: 0.4, unit: 'kg', sourceMealPlanEntryIds: ['plan_monday_001'] },
    { inventoryItemId: 'item_stock_001', requiredQuantity: 1.3, unit: 'l', sourceMealPlanEntryIds: ['plan_monday_001', 'plan_tuesday_001'] },
    { inventoryItemId: 'item_bread_001', requiredQuantity: 4, unit: 'count', sourceMealPlanEntryIds: ['plan_wednesday_001'] },
    { inventoryItemId: 'item_soap_001', requiredQuantity: 1, unit: 'count', sourceMealPlanEntryIds: ['plan_household_001'] },
  ],
};

export const barcodeFixtures = {
  barcode: '5012345678900',
  providerPayload: {
    status: 1,
    product: {
      product_name: 'Fixture Granola',
      brands: 'Fixture Foods',
      quantity: '750 g',
      categories: 'grain,breakfast',
      nutriments: {
        'energy-kcal_100g': 420,
        proteins_100g: 10,
        carbohydrates_100g: 62,
        sugars_100g: 18,
        fat_100g: 12,
      },
    },
  },
};
