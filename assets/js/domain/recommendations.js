/**
 * Recommendations domain service.
 *
 * Evaluates recipe satisfiability from pantry inventory using unit-family conversion,
 * then ranks results with expiry urgency as the primary signal.
 */

const UNIT_TO_BASE = Object.freeze({
  // Mass family (base: g)
  g: { family: 'mass', baseUnit: 'g', toBaseFactor: 1 },
  kg: { family: 'mass', baseUnit: 'g', toBaseFactor: 1000 },
  oz: { family: 'mass', baseUnit: 'g', toBaseFactor: 28.349523125 },
  lb: { family: 'mass', baseUnit: 'g', toBaseFactor: 453.59237 },

  // Volume family (base: ml)
  ml: { family: 'volume', baseUnit: 'ml', toBaseFactor: 1 },
  l: { family: 'volume', baseUnit: 'ml', toBaseFactor: 1000 },
  tsp: { family: 'volume', baseUnit: 'ml', toBaseFactor: 4.92892159375 },
  tbsp: { family: 'volume', baseUnit: 'ml', toBaseFactor: 14.78676478125 },
  cup: { family: 'volume', baseUnit: 'ml', toBaseFactor: 240 },

  // Count family (base: count)
  count: { family: 'count', baseUnit: 'count', toBaseFactor: 1 },
  unit: { family: 'count', baseUnit: 'count', toBaseFactor: 1 },
  item: { family: 'count', baseUnit: 'count', toBaseFactor: 1 },
  pcs: { family: 'count', baseUnit: 'count', toBaseFactor: 1 },
});

const MATCH_STATUS = Object.freeze({
  FULLY_SATISFIABLE: 'fully_satisfiable',
  PARTIALLY_SATISFIABLE: 'partially_satisfiable',
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeToBase(quantity, unit) {
  const meta = UNIT_TO_BASE[unit];

  if (!meta) {
    return {
      ok: false,
      reason: `Unsupported unit: ${unit || '(empty)'}.`,
    };
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    return {
      ok: false,
      reason: `Invalid quantity: ${String(quantity)}. Quantity must be a finite number greater than or equal to 0.`,
    };
  }

  return {
    ok: true,
    family: meta.family,
    baseUnit: meta.baseUnit,
    quantity: quantity * meta.toBaseFactor,
  };
}

function computeDaysUntilExpiry(expiryDateIso, now) {
  if (!expiryDateIso) {
    return Number.POSITIVE_INFINITY;
  }

  const expiryTime = new Date(expiryDateIso).getTime();
  if (!Number.isFinite(expiryTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((expiryTime - now.getTime()) / MS_PER_DAY);
}

function compareRecommendationRecords(a, b) {
  // Tie-breaker policy (in strict order):
  // 1) Expiry urgency (primary): lower daysUntilMostUrgentExpiry ranks first.
  // 2) Coverage ratio: recipes that satisfy more ingredients rank higher.
  // 3) Fewer shortages: lower shortage count ranks first.
  // 4) Stable lexical fallback: recipe name then recipe id.
  //
  // Fallback behavior:
  // - Missing/invalid expiry dates become +Infinity and naturally sort to the bottom.
  // - If all ranking factors tie, lexical fallback guarantees deterministic output.
  const aUrgency = a.rankingFactors.daysUntilMostUrgentExpiry;
  const bUrgency = b.rankingFactors.daysUntilMostUrgentExpiry;

  if (aUrgency !== bUrgency) {
    return aUrgency - bUrgency;
  }

  if (b.coverage.ratio !== a.coverage.ratio) {
    return b.coverage.ratio - a.coverage.ratio;
  }

  if (a.shortages.length !== b.shortages.length) {
    return a.shortages.length - b.shortages.length;
  }

  const nameComparison = a.recipe.name.localeCompare(b.recipe.name);
  if (nameComparison !== 0) {
    return nameComparison;
  }

  return a.recipe.id.localeCompare(b.recipe.id);
}

/**
 * Compute ingredient coverage for a recipe against current inventory IDs.
 *
 * This helper maintains backwards compatibility for callers that need only
 * ID-level coverage and do not require quantity-aware conversion checks.
 *
 * @param {Record<string, any>} recipe - Recipe with inventory-linked ingredients.
 * @param {Set<string>} availableInventoryIds - Inventory IDs currently available.
 * @returns {{ matched: number, total: number, ratio: number }} Coverage metrics.
 */
export function computeRecipeCoverage(recipe, availableInventoryIds) {
  const total = recipe.ingredients.length;
  const matched = recipe.ingredients.filter((ingredient) =>
    availableInventoryIds.has(ingredient.inventoryItemId)
  ).length;

  return {
    matched,
    total,
    ratio: total === 0 ? 0 : matched / total,
  };
}

/**
 * Evaluate a single recipe against inventory quantities and unit conversions.
 * @param {Record<string, any>} recipe - Recipe to evaluate.
 * @param {Map<string, Record<string, any>>} inventoryById - Inventory indexed by id.
 * @param {Date} now - Reference time for expiry urgency computation.
 * @returns {Record<string, any>} Explainable recommendation record.
 */
export function evaluateRecipeRecommendation(recipe, inventoryById, now = new Date()) {
  const shortages = [];
  let matchedIngredients = 0;
  let mostUrgentDays = Number.POSITIVE_INFINITY;

  for (const ingredient of recipe.ingredients) {
    const inventoryItem = inventoryById.get(ingredient.inventoryItemId);

    if (!inventoryItem) {
      shortages.push({
        inventoryItemId: ingredient.inventoryItemId,
        requiredQuantity: ingredient.quantity,
        requiredUnit: ingredient.unit,
        missingQuantity: ingredient.quantity,
        missingUnit: ingredient.unit,
        reason: 'Inventory item is not available.',
      });
      continue;
    }

    const required = normalizeToBase(ingredient.quantity, ingredient.unit);
    const available = normalizeToBase(inventoryItem.quantity, inventoryItem.unit);

    if (!required.ok || !available.ok) {
      shortages.push({
        inventoryItemId: ingredient.inventoryItemId,
        requiredQuantity: ingredient.quantity,
        requiredUnit: ingredient.unit,
        availableQuantity: inventoryItem.quantity,
        availableUnit: inventoryItem.unit,
        missingQuantity: ingredient.quantity,
        missingUnit: ingredient.unit,
        reason: required.reason || available.reason,
      });
      continue;
    }

    if (required.family !== available.family) {
      shortages.push({
        inventoryItemId: ingredient.inventoryItemId,
        requiredQuantity: ingredient.quantity,
        requiredUnit: ingredient.unit,
        availableQuantity: inventoryItem.quantity,
        availableUnit: inventoryItem.unit,
        missingQuantity: ingredient.quantity,
        missingUnit: ingredient.unit,
        reason: `Unit family mismatch (${required.family} vs ${available.family}).`,
      });
      continue;
    }

    const missingInBase = Math.max(required.quantity - available.quantity, 0);
    if (missingInBase > 0) {
      shortages.push({
        inventoryItemId: ingredient.inventoryItemId,
        requiredQuantity: ingredient.quantity,
        requiredUnit: ingredient.unit,
        availableQuantity: inventoryItem.quantity,
        availableUnit: inventoryItem.unit,
        missingQuantity: Number((missingInBase / UNIT_TO_BASE[ingredient.unit].toBaseFactor).toFixed(6)),
        missingUnit: ingredient.unit,
        reason: 'Insufficient quantity available after unit normalization.',
      });
      continue;
    }

    matchedIngredients += 1;

    const daysUntilExpiry = computeDaysUntilExpiry(inventoryItem.expiryDate, now);
    if (daysUntilExpiry < mostUrgentDays) {
      mostUrgentDays = daysUntilExpiry;
    }
  }

  const totalIngredients = recipe.ingredients.length;
  const ratio = totalIngredients === 0 ? 0 : matchedIngredients / totalIngredients;
  const isFullySatisfiable = shortages.length === 0;

  return {
    recipe,
    matchStatus: isFullySatisfiable
      ? MATCH_STATUS.FULLY_SATISFIABLE
      : MATCH_STATUS.PARTIALLY_SATISFIABLE,
    coverage: {
      matched: matchedIngredients,
      total: totalIngredients,
      ratio,
    },
    shortages,
    rankingFactors: {
      daysUntilMostUrgentExpiry: mostUrgentDays,
      hasExpiringIngredientSignal: Number.isFinite(mostUrgentDays),
      coverageRatio: ratio,
      shortageCount: shortages.length,
    },
  };
}

/**
 * Build recommendation output grouped by satisfiability and ranked for explainability.
 *
 * @param {Record<string, any>[]} recipes - Candidate recipes.
 * @param {Record<string, any>[]} inventoryItems - Current inventory entities.
 * @param {{ now?: Date }} [options] - Optional evaluation settings.
 * @returns {{
 *   fullySatisfiable: Record<string, any>[],
 *   partiallySatisfiable: Record<string, any>[],
 *   allRanked: Record<string, any>[]
 * }} Grouped and ranked recommendation response.
 */
export function rankRecipeRecommendations(recipes, inventoryItems, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));

  const allRanked = recipes
    .map((recipe) => evaluateRecipeRecommendation(recipe, inventoryById, now))
    .sort(compareRecommendationRecords);

  return {
    fullySatisfiable: allRanked.filter(
      (entry) => entry.matchStatus === MATCH_STATUS.FULLY_SATISFIABLE
    ),
    partiallySatisfiable: allRanked.filter(
      (entry) => entry.matchStatus === MATCH_STATUS.PARTIALLY_SATISFIABLE
    ),
    allRanked,
  };
}

export { MATCH_STATUS };
