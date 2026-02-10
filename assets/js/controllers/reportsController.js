import { escapeHtml } from '../utils/dom.js';

const CURRENCY_FORMAT_CONFIG = Object.freeze({
  USD: { locale: 'en-US', currency: 'USD' },
  EUR: { locale: 'de-DE', currency: 'EUR' },
  GBP: { locale: 'en-GB', currency: 'GBP' },
  CAD: { locale: 'en-CA', currency: 'CAD' },
  AUD: { locale: 'en-AU', currency: 'AUD' },
});

/**
 * Render lightweight reports that summarize current app state.
 *
 * This first reporting pass intentionally focuses on clear text metrics so we can
 * evolve toward charts later without changing data ownership boundaries.
 */
export function initializeReportsController(inventoryController, recipeController, plannerController, settingsController) {
  const inventoryStatus = document.getElementById('reports-inventory-status');
  const inventoryMetrics = document.getElementById('reports-inventory-metrics');
  const planningStatus = document.getElementById('reports-planning-status');
  const planningMetrics = document.getElementById('reports-planning-metrics');
  const nutritionStatus = document.getElementById('reports-nutrition-status');
  const nutritionMetrics = document.getElementById('reports-nutrition-metrics');

  /**
   * Convert a raw number to user-selected currency output.
   * @param {number} value
   * @returns {string}
   */
  function formatCurrency(value) {
    const activeCurrency = settingsController?.settings?.general?.currency || 'USD';
    const formatterConfig = CURRENCY_FORMAT_CONFIG[activeCurrency] || CURRENCY_FORMAT_CONFIG.USD;
    return new Intl.NumberFormat(formatterConfig.locale, {
      style: 'currency',
      currency: formatterConfig.currency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Resolve number of days until expiry for quick report health indicators.
   * @param {string | null | undefined} dateString
   * @returns {number}
   */
  function getDaysUntil(dateString) {
    if (!dateString) {
      return Number.POSITIVE_INFINITY;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateString}T00:00:00`);
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
  }

  /**
   * Best-effort aggregate nutrition per day based on active meal plan entries.
   * This gives users an early signal against their configured targets.
   * @returns {{calories: number, protein: number, carbs: number, fats: number}}
   */
  function calculateAverageDailyPlanNutrition() {
    const recipeById = new Map(recipeController.recipes.map((recipe) => [recipe.id, recipe]));
    const inventoryById = new Map(inventoryController.items.map((item) => [item.id, item]));

    if (!plannerController.mealPlanEntries.length) {
      return { calories: 0, protein: 0, carbs: 0, fats: 0 };
    }

    const totals = plannerController.mealPlanEntries.reduce(
      (accumulator, entry) => {
        const recipe = recipeById.get(entry.recipeId);
        if (!recipe) {
          return accumulator;
        }

        const portionMultiplier = Number.isFinite(entry.portionMultiplier) ? entry.portionMultiplier : 1;
        recipe.ingredients.forEach((ingredient) => {
          const sourceItem = inventoryById.get(ingredient.inventoryItemId);
          if (!sourceItem?.nutrition) {
            return;
          }

          const baseQuantity = Number.isFinite(ingredient.normalizedQuantity) ? ingredient.normalizedQuantity : ingredient.quantity;
          const multiplier = Number.isFinite(baseQuantity) ? baseQuantity / 100 : 0;
          accumulator.calories += (sourceItem.nutrition.caloriesPer100 || 0) * multiplier * portionMultiplier;
          accumulator.protein += (sourceItem.nutrition.proteinPer100 || 0) * multiplier * portionMultiplier;
          accumulator.carbs += (sourceItem.nutrition.carbsPer100 || 0) * multiplier * portionMultiplier;
          accumulator.fats += (sourceItem.nutrition.fatsPer100 || 0) * multiplier * portionMultiplier;
        });

        return accumulator;
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );

    const planDayCount = new Set(plannerController.mealPlanEntries.map((entry) => entry.date)).size || 1;
    return {
      calories: totals.calories / planDayCount,
      protein: totals.protein / planDayCount,
      carbs: totals.carbs / planDayCount,
      fats: totals.fats / planDayCount,
    };
  }

  function renderList(container, rows) {
    container.innerHTML = rows.map((row) => `<li>${escapeHtml(row)}</li>`).join('');
  }

  function renderInventoryReport() {
    const totalValue = inventoryController.items.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price : 0), 0);
    const expiringSoon = inventoryController.items.filter((item) => getDaysUntil(item.expiryDate) <= 7).length;
    const lowStockCount = inventoryController.items.filter((item) => item.quantity <= 2).length;

    inventoryStatus.textContent = `Tracking ${inventoryController.items.length} inventory item(s).`;
    renderList(inventoryMetrics, [
      `Estimated pantry value: ${formatCurrency(totalValue)}`,
      `Items expiring in 7 days: ${expiringSoon}`,
      `Items flagged as low stock: ${lowStockCount}`,
    ]);
  }

  function renderPlanningReport() {
    const uniqueRecipeIds = new Set(plannerController.mealPlanEntries.map((entry) => entry.recipeId));
    const uniqueDays = new Set(plannerController.mealPlanEntries.map((entry) => entry.date));

    planningStatus.textContent = plannerController.mealPlanEntries.length
      ? `Plan includes ${plannerController.mealPlanEntries.length} scheduled meal slot(s).`
      : 'No active meal plan entries yet.';

    renderList(planningMetrics, [
      `Recipe library size: ${recipeController.recipes.length}`,
      `Unique recipes in active plan: ${uniqueRecipeIds.size}`,
      `Days covered in active plan: ${uniqueDays.size}`,
    ]);
  }

  function renderNutritionReport() {
    const targets = settingsController?.settings?.nutritionTargets || {};
    const averagePerDay = calculateAverageDailyPlanNutrition();
    const targetRows = [
      ['Calories', targets.calories, averagePerDay.calories, 'kcal'],
      ['Protein', targets.protein, averagePerDay.protein, 'g'],
      ['Carbs', targets.carbs, averagePerDay.carbs, 'g'],
      ['Fats', targets.fats, averagePerDay.fats, 'g'],
    ];

    const formattedRows = targetRows.map(([label, target, actual, unit]) => {
      if (target == null) {
        return `${label}: avg ${actual.toFixed(1)} ${unit} (target not set)`;
      }
      const delta = actual - target;
      const deltaPrefix = delta >= 0 ? '+' : '';
      return `${label}: avg ${actual.toFixed(1)} ${unit} vs target ${target} ${unit} (${deltaPrefix}${delta.toFixed(1)} ${unit})`;
    });

    nutritionStatus.textContent = plannerController.mealPlanEntries.length
      ? 'Averages are based on the current planned meals and linked ingredient nutrition.'
      : 'Create a meal plan to compare estimated intake against nutrition targets.';
    renderList(nutritionMetrics, formattedRows);
  }

  function renderAllReports() {
    renderInventoryReport();
    renderPlanningReport();
    renderNutritionReport();
  }

  inventoryController.onItemsUpdated = renderAllReports;
  recipeController.onRecipesUpdated = renderAllReports;
  plannerController.onMealPlanUpdated = renderAllReports;
  settingsController.onSettingsUpdated = renderAllReports;
  window.addEventListener('app:settings-updated', renderAllReports);

  renderAllReports();

  return {
    refresh: renderAllReports,
  };
}
