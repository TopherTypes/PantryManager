/**
 * Recommendations domain service.
 *
 * Produces deterministic recipe recommendation scores based on pantry coverage.
 */

/**
 * Compute ingredient coverage for a recipe against current inventory IDs.
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
 * Rank recipes by descending pantry coverage and stable name/id tie-breakers.
 * @param {Record<string, any>[]} recipes - Candidate recipes.
 * @param {Record<string, any>[]} inventoryItems - Available inventory entities.
 * @returns {{ recipe: Record<string, any>, coverage: { matched: number, total: number, ratio: number } }[]} Ranked recommendations.
 */
export function rankRecipeRecommendations(recipes, inventoryItems) {
  const availableInventoryIds = new Set(inventoryItems.map((item) => item.id));

  return recipes
    .map((recipe) => ({
      recipe,
      coverage: computeRecipeCoverage(recipe, availableInventoryIds),
    }))
    .sort((a, b) => {
      if (b.coverage.ratio !== a.coverage.ratio) {
        return b.coverage.ratio - a.coverage.ratio;
      }

      const nameComparison = a.recipe.name.localeCompare(b.recipe.name);
      if (nameComparison !== 0) {
        return nameComparison;
      }

      return a.recipe.id.localeCompare(b.recipe.id);
    });
}
