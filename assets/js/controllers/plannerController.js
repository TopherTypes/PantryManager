import { rankRecipeRecommendations } from '../domain/recommendations.js';
import { aggregateIngredientDemand, addMealPlanEntry } from '../domain/planner.js';
import { generateShoppingItems, groupShoppingItemsByStoreSection } from '../domain/shopping.js';
import { escapeHtml } from '../utils/dom.js';

/**
 * Build deterministic meal-plan and shopping projections from live app state.
 */
export function initializePlannerController(inventoryState, recipeState) {
  const recommendationRunButton = document.getElementById('recommendations-run-button') || document.getElementById('recommendation-run-button');
  const recommendationStatus = document.getElementById('recommendations-status') || document.getElementById('recommendation-status');
  const recommendationOutput = document.getElementById('recommendations-output') || document.getElementById('recommendation-output');
  const mealPlanGenerateButton = document.getElementById('meal-plan-generate-button');
  const mealPlanStatus = document.getElementById('meal-plan-status');
  const mealPlanOutput = document.getElementById('meal-plan-output');
  const mealPlanWeekStart = document.getElementById('meal-plan-week-start');
  const shoppingGenerateButton = document.getElementById('shopping-list-generate-button') || document.getElementById('shopping-generate-button');
  const shoppingStatus = document.getElementById('shopping-list-status') || document.getElementById('shopping-status');
  const shoppingOutput = document.getElementById('shopping-list-output') || document.getElementById('shopping-output');

  const state = { rankedRecommendations: null, mealPlanEntries: [], onMealPlanUpdatedHandlers: [] };
  const getCurrentInventory = () => inventoryState.items;
  const getCurrentRecipes = () => recipeState.recipes;

  /**
   * Commit meal plan updates and notify persistence/sync subscribers.
   * @param {Array<Record<string, any>>} entries
   */
  function commitMealPlanEntries(entries) {
    state.mealPlanEntries = entries;
    state.onMealPlanUpdatedHandlers.forEach((handler) => handler(state.mealPlanEntries));
  }

  function runRecommendations() {
    state.rankedRecommendations = rankRecipeRecommendations(getCurrentRecipes(), getCurrentInventory());
    const recommendationCount = state.rankedRecommendations.allRanked.length;
    recommendationStatus.textContent = recommendationCount === 0 ? 'No recommendation candidates available. Add recipes to continue.' : `Generated ${recommendationCount} ranked recommendation(s).`;
    renderRecommendations();
  }

  function generateMealPlanEntries() {
    if (!state.rankedRecommendations || state.rankedRecommendations.allRanked.length === 0) {
      mealPlanStatus.textContent = 'No recommendations available. Run recommendation generation first.';
      renderMealPlan();
      renderShopping();
      return;
    }

    const weekStartDate = mealPlanWeekStart.value || new Date().toISOString().slice(0, 10);
    const recipeCandidates = state.rankedRecommendations.allRanked.slice(0, 7);
    const slotSequence = ['dinner', 'lunch', 'breakfast', 'snack'];
    const nextEntries = [];
    let rollingEntries = [];

    recipeCandidates.forEach((entry, index) => {
      const date = new Date(`${weekStartDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);

      const plannedEntry = { id: `meal_${date.toISOString().slice(0, 10).replaceAll('-', '')}_${slotSequence[index % slotSequence.length]}_${String(index + 1).padStart(3, '0')}`, date: date.toISOString().slice(0, 10), slot: slotSequence[index % slotSequence.length], recipeId: entry.recipe.id, portionMultiplier: 1 };
      try { rollingEntries = addMealPlanEntry(rollingEntries, plannedEntry); nextEntries.push(plannedEntry); } catch {}
    });

    commitMealPlanEntries(nextEntries);
    mealPlanStatus.textContent = state.mealPlanEntries.length === 0 ? 'No meal-plan entries could be generated.' : `Generated ${state.mealPlanEntries.length} meal-plan entry(ies).`;
    renderMealPlan(); renderShopping();
  }

  function renderAllPanels() { renderRecommendations(); renderMealPlan(); renderShopping(); }

  function renderRecommendations() {
    const rankedEntries = state.rankedRecommendations?.allRanked || [];
    if (!rankedEntries.length) { recommendationOutput.innerHTML = '<p class="helper-text">No recommendation results to display.</p>'; return; }
    const itemsMarkup = rankedEntries.map((entry, index) => `<li id="recommendation-row-${index}" data-testid="recommendation-row-${index}"><strong>${escapeHtml(entry.recipe.name)}</strong><span> — coverage ${entry.coverage.matched}/${entry.coverage.total}</span><span>, shortages ${entry.shortages.length}</span><span>, urgency ${escapeHtml(Number.isFinite(entry.rankingFactors.daysUntilMostUrgentExpiry) ? `${entry.rankingFactors.daysUntilMostUrgentExpiry} day(s)` : 'No expiry signal')}</span></li>`).join('');
    recommendationOutput.innerHTML = `<ol id="recommendations-ranked-list" data-testid="recommendations-ranked-list">${itemsMarkup}</ol>`;
  }

  function renderMealPlan() {
    if (!state.mealPlanEntries.length) { mealPlanOutput.innerHTML = '<p class="helper-text">No meal-plan entries to display.</p>'; return; }
    const recipeById = new Map(getCurrentRecipes().map((recipe) => [recipe.id, recipe]));
    const rowsMarkup = state.mealPlanEntries.map((entry, index) => `<li id="meal-plan-row-${index}" data-testid="meal-plan-row-${index}"><strong>${escapeHtml(entry.date)}</strong><span> ${escapeHtml(entry.slot)}:</span><span> ${escapeHtml(recipeById.get(entry.recipeId)?.name || entry.recipeId)}</span></li>`).join('');
    mealPlanOutput.innerHTML = `<ul id="meal-plan-assignment-list" data-testid="meal-plan-assignment-list">${rowsMarkup}</ul>`;
  }

  function renderShopping() {
    if (!state.mealPlanEntries.length) { shoppingOutput.innerHTML = '<p class="helper-text">No shopping data to display because the meal plan is empty.</p>'; return; }
    const demandRows = aggregateIngredientDemand(state.mealPlanEntries, getCurrentRecipes());
    if (!demandRows.length) { shoppingOutput.innerHTML = '<p class="helper-text">No ingredient demand was produced from the active plan.</p>'; return; }
    const shoppingItems = generateShoppingItems(demandRows, getCurrentInventory());
    if (!shoppingItems.length) { shoppingOutput.innerHTML = '<p class="helper-text">No shopping gaps detected. Inventory fully covers the active plan.</p>'; return; }
    const groupedBySection = groupShoppingItemsByStoreSection(shoppingItems);
    const sectionMarkup = Object.entries(groupedBySection).map(([sectionName, items], groupIndex) => `<section id="shopping-group-${groupIndex}" data-testid="shopping-group-${groupIndex}"><h4>${escapeHtml(sectionName)}</h4><ul>${items.map((item, itemIndex) => `<li id="shopping-item-${groupIndex}-${itemIndex}" data-testid="shopping-item-${groupIndex}-${itemIndex}">${escapeHtml(item.ingredientName)} — missing ${item.missingQuantity} ${escapeHtml(item.unit)}</li>`).join('')}</ul></section>`).join('');
    shoppingOutput.innerHTML = sectionMarkup;
    shoppingStatus.textContent = `Generated ${shoppingItems.length} shopping item(s) across ${Object.keys(groupedBySection).length} store section(s).`;
  }

  recommendationRunButton.addEventListener('click', runRecommendations);
  mealPlanGenerateButton.addEventListener('click', generateMealPlanEntries);
  shoppingGenerateButton.addEventListener('click', () => { if (!state.mealPlanEntries.length) { shoppingStatus.textContent = 'No meal plan entries found. Generate a weekly plan first.'; return renderShopping(); } shoppingStatus.textContent = 'Shopping list refreshed from active plan.'; renderShopping(); });
  inventoryState.onItemsUpdated = () => (state.rankedRecommendations ? runRecommendations() : renderAllPanels());
  recipeState.onRecipesUpdated = () => (state.rankedRecommendations ? runRecommendations() : renderAllPanels());

  recommendationStatus.textContent = 'Generate recommendations to begin planning.';
  mealPlanStatus.textContent = 'Generate a weekly plan after recommendations are available.';
  shoppingStatus.textContent = 'Generate a shopping list from the active plan.';
  mealPlanWeekStart.value = new Date().toISOString().slice(0, 10);
  renderAllPanels();

  return {
    get mealPlanEntries() { return state.mealPlanEntries; },
    set onMealPlanUpdated(handler) { if (typeof handler === 'function') state.onMealPlanUpdatedHandlers.push(handler); },
    /**
     * Replace meal plan entries from persisted/synced state.
     * @param {Array<Record<string, any>>} entries
     */
    replaceMealPlanEntries(entries) {
      if (!Array.isArray(entries)) {
        return;
      }

      commitMealPlanEntries(entries);
      renderMealPlan();
      renderShopping();
      mealPlanStatus.textContent = 'Meal plan restored from persisted data.';
    },
  };
}
