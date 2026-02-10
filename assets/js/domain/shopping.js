/**
 * Usage:
 * - Use `generateShoppingItems` to derive shortages from aggregated demand and
 *   current inventory snapshots.
 * - Use `groupShoppingItemsByStoreSection` for presentation-layer grouping while
 *   preserving domain-owned section mapping rules.
 */
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

/**
 * Generic section taxonomy used to group shopping output.
 *
 * This intentionally remains retailer-agnostic for MVP while still enabling
 * practical in-store ordering.
 */
export const STORE_SECTION_TAXONOMY = Object.freeze({
  produce: 'produce',
  dairyAndFridge: 'dairy-and-fridge',
  meatAndSeafood: 'meat-and-seafood',
  bakery: 'bakery',
  frozen: 'frozen',
  pantry: 'pantry',
  beverages: 'beverages',
  household: 'household',
  other: 'other',
});


/**
 * Determine whether inventory and demand rows can be compared directly.
 *
 * Canonical unit policy:
 * - We only compare quantities when the persisted unit tokens are identical.
 * - This intentionally prevents implicit alias handling (for example `pcs` => `count`) so
 *   non-canonical tokens cannot silently pass through shopping computations.
 *
 * @param {Record<string, any> | undefined} inventoryItem - Inventory source row.
 * @param {Record<string, any>} demand - Aggregated demand row.
 * @returns {boolean} True when quantities are directly comparable.
 */
function hasComparableUnit(inventoryItem, demand) {
  return Boolean(inventoryItem && inventoryItem.unit === demand.unit);
}

const CATEGORY_TO_STORE_SECTION = Object.freeze({
  fruit: STORE_SECTION_TAXONOMY.produce,
  vegetable: STORE_SECTION_TAXONOMY.produce,
  produce: STORE_SECTION_TAXONOMY.produce,
  dairy: STORE_SECTION_TAXONOMY.dairyAndFridge,
  fridge: STORE_SECTION_TAXONOMY.dairyAndFridge,
  meat: STORE_SECTION_TAXONOMY.meatAndSeafood,
  seafood: STORE_SECTION_TAXONOMY.meatAndSeafood,
  bakery: STORE_SECTION_TAXONOMY.bakery,
  frozen: STORE_SECTION_TAXONOMY.frozen,
  baking: STORE_SECTION_TAXONOMY.pantry,
  grain: STORE_SECTION_TAXONOMY.pantry,
  canned: STORE_SECTION_TAXONOMY.pantry,
  spice: STORE_SECTION_TAXONOMY.pantry,
  oil: STORE_SECTION_TAXONOMY.pantry,
  beverage: STORE_SECTION_TAXONOMY.beverages,
  drinks: STORE_SECTION_TAXONOMY.beverages,
  cleaning: STORE_SECTION_TAXONOMY.household,
});

/**
 * Quantity rounding for shopping list output.
 *
 * Rounding policy mirrors planner math:
 * - Keep computation in raw precision.
 * - Round emitted values to 3 decimals for deterministic UX and snapshots.
 *
 * @param {number} value - Numeric quantity to round.
 * @returns {number} Rounded quantity value.
 */
function roundShoppingQuantity(value) {
  return Number(value.toFixed(3));
}

/**
 * Build shopping items from aggregated demand and current inventory.
 *
 * Comparison rules:
 * - Required quantity comes from already-aggregated planner demand.
 * - Available quantity is matched by inventory item ID.
 * - If inventory unit differs from demand unit, available is treated as 0 because
 *   conversion policy is outside this module's scope.
 * - Missing quantity is derived with `max(required - available, 0)`.
 *
 * @param {Record<string, any>[]} ingredientDemand - Aggregated demand rows.
 * @param {Record<string, any>[]} inventoryItems - Current inventory items.
 * @returns {Record<string, any>[]} Shopping items requiring purchase.
 */
export function generateShoppingItems(ingredientDemand, inventoryItems) {
  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));

  return ingredientDemand
    .map((demand) => {
      const inventoryItem = inventoryById.get(demand.inventoryItemId);
      const availableQuantity = hasComparableUnit(inventoryItem, demand)
        ? inventoryItem.quantity
        : 0;

      const requiredQuantity = roundShoppingQuantity(demand.requiredQuantity);
      const roundedAvailable = roundShoppingQuantity(availableQuantity);
      const missingQuantity = roundShoppingQuantity(
        computeMissingQuantity(requiredQuantity, roundedAvailable)
      );

      return {
        id: `shop_${demand.inventoryItemId}_${demand.unit}`,
        ingredientName: inventoryItem?.name ?? demand.inventoryItemId,
        inventoryItemId: demand.inventoryItemId,
        requiredQuantity,
        availableQuantity: roundedAvailable,
        missingQuantity,
        unit: demand.unit,
        storeSection: resolveStoreSection(inventoryItem),
        sourceMealPlanEntryIds: demand.sourceMealPlanEntryIds,
      };
    })
    .filter((item) => item.missingQuantity > 0);
}

/**
 * Group shopping items by store section.
 * @param {Record<string, any>[]} shoppingItems - Flat shopping list.
 * @returns {Record<string, Record<string, any>[]>} Items keyed by store section.
 */
export function groupShoppingItemsByStoreSection(shoppingItems) {
  return shoppingItems.reduce((groups, item) => {
    const section = item.storeSection || STORE_SECTION_TAXONOMY.other;
    if (!groups[section]) {
      groups[section] = [];
    }

    groups[section].push(item);
    return groups;
  }, {});
}

/**
 * Resolve a store section from known inventory metadata.
 * @param {Record<string, any> | undefined} inventoryItem - Source inventory item.
 * @returns {string} Store section taxonomy value.
 */
export function resolveStoreSection(inventoryItem) {
  const normalizedCategory = inventoryItem?.category?.toLowerCase?.() || '';
  return CATEGORY_TO_STORE_SECTION[normalizedCategory] || STORE_SECTION_TAXONOMY.other;
}
