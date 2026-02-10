import { validateAndNormalizeRecipeForInventory } from '../domain/recipes.js';
import { escapeHtml } from '../utils/dom.js';

/** Initialize recipe CRUD controller. */
export function initializeRecipeController(inventoryState) {
  const state = { recipes: [], editingRecipeId: null, onRecipesUpdated: null };
  const recipeTableBody = document.getElementById('recipe-table-body');
  const recipeSummary = document.getElementById('recipe-results-summary');
  const recipeFormFeedback = document.getElementById('recipe-form-feedback');
  const recipeForm = document.getElementById('recipe-form');
  const recipeIdField = document.getElementById('recipe-id');
  const recipeNameField = document.getElementById('recipe-name');
  const recipeServingsField = document.getElementById('recipe-servings');
  const recipeNotesField = document.getElementById('recipe-preparation-notes');
  const recipeFormHeading = document.getElementById('recipe-form-heading');
  const recipeSubmitButton = document.getElementById('recipe-submit');
  const recipeCancelButton = document.getElementById('recipe-cancel-edit');
  const ingredientsContainer = document.getElementById('ingredient-rows');
  const addIngredientButton = document.getElementById('recipe-add-ingredient');

  const commitRecipesUpdate = (nextRecipes) => { state.recipes = nextRecipes; if (typeof state.onRecipesUpdated === 'function') state.onRecipesUpdated(state.recipes); };
  const setRecipeFeedback = (messages, level = 'error') => { if (!messages.length) { recipeFormFeedback.textContent = ''; recipeFormFeedback.className = 'form-feedback'; return; } recipeFormFeedback.innerHTML = `<ul>${messages.map((message) => `<li>${message}</li>`).join('')}</ul>`; recipeFormFeedback.className = `form-feedback is-${level}`; };
  const buildInventoryOptions = (selectedId = '') => `<option value="">Select inventory item</option>${inventoryState.items.map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.name)} (${item.unit})</option>`).join('')}`;

  function appendIngredientRow(ingredient = null) {
    const row = document.createElement('div');
    row.className = 'ingredient-row';
    row.innerHTML = `<label>Inventory item *<select data-field="inventoryItemId" required>${buildInventoryOptions(ingredient?.inventoryItemId || '')}</select></label><label>Quantity *<input data-field="quantity" type="number" min="0.01" step="0.01" value="${ingredient?.quantity || ''}" required /></label><label>Unit *<select data-field="unit" required><option value="">Select a unit</option><option value="g" ${ingredient?.unit === 'g' ? 'selected' : ''}>g</option><option value="kg" ${ingredient?.unit === 'kg' ? 'selected' : ''}>kg</option><option value="ml" ${ingredient?.unit === 'ml' ? 'selected' : ''}>ml</option><option value="l" ${ingredient?.unit === 'l' ? 'selected' : ''}>l</option><option value="count" ${ingredient?.unit === 'count' ? 'selected' : ''}>count</option></select></label><button type="button" class="button-muted" data-action="remove-ingredient">Remove</button>`;
    ingredientsContainer.appendChild(row);
  }

  const readIngredientRows = () => Array.from(ingredientsContainer.querySelectorAll('.ingredient-row')).map((row) => ({ inventoryItemId: row.querySelector('[data-field="inventoryItemId"]').value, quantity: Number(row.querySelector('[data-field="quantity"]').value), unit: row.querySelector('[data-field="unit"]').value }));
  const createRecipeId = (name) => `recipe_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'recipe'}_${String(state.recipes.length + 1).padStart(3, '0')}`;

  function renderRecipeTable() {
    recipeTableBody.innerHTML = '';
    if (!state.recipes.length) { const row = document.createElement('tr'); row.innerHTML = '<td colspan="6">No recipes created yet.</td>'; recipeTableBody.appendChild(row); recipeSummary.textContent = 'Showing 0 recipes.'; return; }
    state.recipes.forEach((recipe) => {
      const row = document.createElement('tr');
      const ingredientsSummary = recipe.ingredients.map((ingredient) => `${escapeHtml(inventoryState.items.find((item) => item.id === ingredient.inventoryItemId)?.name || ingredient.inventoryItemId)}: ${ingredient.quantity} ${ingredient.unit} (norm ${ingredient.normalizedQuantity} ${ingredient.normalizedUnit})`).join('<br />');
      row.innerHTML = `<td>${escapeHtml(recipe.name)}</td><td>${recipe.servings}</td><td>${ingredientsSummary}</td><td>${escapeHtml(recipe.preparationNotes || '-')}</td><td>${recipe.id}</td><td><button type="button" data-action="edit-recipe" data-id="${recipe.id}">Edit</button><button type="button" data-action="delete-recipe" data-id="${recipe.id}" class="button-danger">Delete</button></td>`;
      recipeTableBody.appendChild(row);
    });
    recipeSummary.textContent = `Showing ${state.recipes.length} recipes.`;
  }

  function resetRecipeForm(clearFeedback = true) { recipeForm.reset(); recipeIdField.value = ''; state.editingRecipeId = null; recipeFormHeading.textContent = 'Add Recipe'; recipeSubmitButton.textContent = 'Add Recipe'; ingredientsContainer.innerHTML = ''; appendIngredientRow(); if (clearFeedback) setRecipeFeedback([]); }
  function enterRecipeEditMode(recipeId) { const recipe = state.recipes.find((candidate) => candidate.id === recipeId); if (!recipe) return; state.editingRecipeId = recipe.id; recipeIdField.value = recipe.id; recipeNameField.value = recipe.name; recipeServingsField.value = String(recipe.servings); recipeNotesField.value = recipe.preparationNotes || ''; ingredientsContainer.innerHTML = ''; recipe.ingredients.forEach((ingredient) => appendIngredientRow(ingredient)); recipeFormHeading.textContent = 'Edit Recipe'; recipeSubmitButton.textContent = 'Update Recipe'; setRecipeFeedback(['You are editing an existing recipe. Save changes or cancel to return to add mode.'], 'info'); }
  function refreshIngredientOptions() { ingredientsContainer.querySelectorAll('[data-field="inventoryItemId"]').forEach((selectElement) => { const currentValue = selectElement.value; selectElement.innerHTML = buildInventoryOptions(currentValue); }); commitRecipesUpdate(state.recipes.filter((recipe) => recipe.ingredients.every((ingredient) => inventoryState.items.some((item) => item.id === ingredient.inventoryItemId)))); renderRecipeTable(); }

  addIngredientButton.addEventListener('click', () => appendIngredientRow());
  ingredientsContainer.addEventListener('click', (event) => { const target = event.target; if (!(target instanceof HTMLButtonElement)) return; if (target.getAttribute('data-action') === 'remove-ingredient') { target.closest('.ingredient-row')?.remove(); if (!ingredientsContainer.querySelectorAll('.ingredient-row').length) appendIngredientRow(); } });

  recipeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = { id: recipeIdField.value || undefined, name: recipeNameField.value.trim(), servings: Number.parseInt(recipeServingsField.value, 10), preparationNotes: recipeNotesField.value.trim() || null, ingredients: readIngredientRows() };
    const result = validateAndNormalizeRecipeForInventory(payload, inventoryState.items);
    if (result.errors.length > 0) return setRecipeFeedback(result.errors, 'error');
    const nextRecipe = { ...result.normalizedRecipe, id: state.editingRecipeId || createRecipeId(result.normalizedRecipe.name) };
    commitRecipesUpdate(state.editingRecipeId ? state.recipes.map((recipe) => (recipe.id === state.editingRecipeId ? nextRecipe : recipe)) : [...state.recipes, nextRecipe]);
    renderRecipeTable(); resetRecipeForm(false);
    const feedbackMessages = ['Recipe saved successfully.', ...result.warnings];
    setRecipeFeedback(feedbackMessages, result.warnings.length ? 'info' : 'success');
  });

  recipeCancelButton.addEventListener('click', () => { resetRecipeForm(); setRecipeFeedback(['Recipe edit cancelled.'], 'info'); });
  recipeTableBody.addEventListener('click', (event) => { const target = event.target; if (!(target instanceof HTMLButtonElement)) return; const action = target.getAttribute('data-action'); const recipeId = target.getAttribute('data-id'); if (!action || !recipeId) return; if (action === 'edit-recipe') return enterRecipeEditMode(recipeId); if (action === 'delete-recipe') { commitRecipesUpdate(state.recipes.filter((recipe) => recipe.id !== recipeId)); if (state.editingRecipeId === recipeId) resetRecipeForm(); renderRecipeTable(); setRecipeFeedback(['Recipe deleted successfully.'], 'success'); } });

  inventoryState.onItemsUpdated = refreshIngredientOptions;
  resetRecipeForm(); renderRecipeTable();
  return { get recipes() { return state.recipes; }, set onRecipesUpdated(handler) { state.onRecipesUpdated = handler; } };
}
