/**
 * PantryManager UI script.
 *
 * Includes:
 * 1) Lightweight panel navigation.
 * 2) Inventory CRUD + filters.
 * 3) Recipe CRUD with inventory-linked ingredients.
 * 4) Conversion-aware ingredient normalization using shared unit-family utilities.
 */
(function initializePantryManager() {
  const navButtons = document.querySelectorAll('.app-nav button[data-target]');
  const panels = document.querySelectorAll('.panel');

  function showPanel(targetId) {
    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === targetId);
    });

    navButtons.forEach((button) => {
      const isActive = button.getAttribute('data-target') === targetId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  navButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      if (targetId) {
        showPanel(targetId);
      }
    });

    if (index === 0) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'page');
    }
  });

  const appState = initializeInventoryFlow();
  initializeRecipeFlow(appState);
})();

/**
 * Shared unit conversion utility.
 *
 * Assumptions documented explicitly for MVP:
 * - Mass base unit is grams (g).
 * - Volume base unit is milliliters (ml).
 * - Count base unit is count.
 * - Cross-family conversion (for example ml -> g) is impossible without density metadata,
 *   which is intentionally out-of-scope for MVP. The utility returns a clear error when this occurs.
 */
const UnitConversion = (() => {
  const unitMap = {
    g: { family: 'mass', toBaseFactor: 1, baseUnit: 'g' },
    kg: { family: 'mass', toBaseFactor: 1000, baseUnit: 'g' },
    ml: { family: 'volume', toBaseFactor: 1, baseUnit: 'ml' },
    l: { family: 'volume', toBaseFactor: 1000, baseUnit: 'ml' },
    count: { family: 'count', toBaseFactor: 1, baseUnit: 'count' }
  };

  function getUnitMeta(unit) {
    return unitMap[unit] || null;
  }

  function canConvert(fromUnit, toUnit) {
    const fromMeta = getUnitMeta(fromUnit);
    const toMeta = getUnitMeta(toUnit);

    if (!fromMeta || !toMeta) {
      return false;
    }

    return fromMeta.family === toMeta.family;
  }

  function convertQuantity(quantity, fromUnit, toUnit) {
    const fromMeta = getUnitMeta(fromUnit);
    const toMeta = getUnitMeta(toUnit);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        ok: false,
        reason: 'Quantity must be a finite number greater than 0 for conversion.'
      };
    }

    if (!fromMeta || !toMeta) {
      return {
        ok: false,
        reason: `Unsupported unit conversion request from ${fromUnit || '(empty)'} to ${toUnit || '(empty)'}.`
      };
    }

    if (fromMeta.family !== toMeta.family) {
      return {
        ok: false,
        reason: `Cannot convert ${fromUnit} (${fromMeta.family}) to ${toUnit} (${toMeta.family}) without additional metadata.`
      };
    }

    const quantityInBase = quantity * fromMeta.toBaseFactor;
    const converted = quantityInBase / toMeta.toBaseFactor;

    return {
      ok: true,
      quantity: Number(converted.toFixed(6)),
      family: fromMeta.family,
      baseUnit: fromMeta.baseUnit
    };
  }

  function normalizeToFamilyBase(quantity, unit) {
    const meta = getUnitMeta(unit);

    if (!meta) {
      return {
        ok: false,
        reason: `Unsupported unit ${unit || '(empty)'}.`
      };
    }

    return convertQuantity(quantity, unit, meta.baseUnit);
  }

  return {
    allowedUnits: new Set(Object.keys(unitMap)),
    getUnitMeta,
    canConvert,
    convertQuantity,
    normalizeToFamilyBase
  };
})();

function initializeInventoryFlow() {
  const state = {
    items: [
      {
        id: 'item_olive_oil_001',
        name: 'Olive Oil',
        quantity: 750,
        unit: 'ml',
        price: 8.5,
        expiryDate: '2026-06-30',
        barcode: '0000000000000',
        category: 'oil',
        nutrition: {
          caloriesPer100: 884,
          proteinPer100: 0,
          carbsPer100: 0,
          sugarsPer100: 0,
          fatsPer100: 100
        }
      },
      {
        id: 'item_flour_002',
        name: 'All-purpose Flour',
        quantity: 2000,
        unit: 'g',
        price: 2.95,
        expiryDate: '2027-01-10',
        barcode: 'FLOUR-001',
        category: 'baking',
        nutrition: {
          caloriesPer100: 364,
          proteinPer100: 10,
          carbsPer100: 76,
          sugarsPer100: 0.3,
          fatsPer100: 1
        }
      }
    ],
    editingItemId: null,
    onItemsUpdated: null
  };

  const tableBody = document.getElementById('inventory-table-body');
  const resultsSummary = document.getElementById('inventory-results-summary');
  const feedback = document.getElementById('inventory-form-feedback');

  const form = document.getElementById('inventory-form');
  const formHeading = document.getElementById('inventory-form-heading');
  const hiddenId = document.getElementById('inventory-item-id');
  const submitButton = document.getElementById('inventory-submit');
  const cancelEditButton = document.getElementById('inventory-cancel-edit');

  const filters = {
    name: document.getElementById('inventory-search-name'),
    expiryDate: document.getElementById('inventory-filter-expiry'),
    category: document.getElementById('inventory-filter-category')
  };

  const fields = {
    name: document.getElementById('item-name'),
    quantity: document.getElementById('item-quantity'),
    unit: document.getElementById('item-unit'),
    price: document.getElementById('item-price'),
    expiryDate: document.getElementById('item-expiry'),
    barcode: document.getElementById('item-barcode'),
    category: document.getElementById('item-category'),
    caloriesPer100: document.getElementById('nutrition-calories'),
    proteinPer100: document.getElementById('nutrition-protein'),
    carbsPer100: document.getElementById('nutrition-carbs'),
    sugarsPer100: document.getElementById('nutrition-sugars'),
    fatsPer100: document.getElementById('nutrition-fats')
  };

  function buildPayload() {
    return {
      id: hiddenId.value || undefined,
      name: fields.name.value.trim(),
      quantity: Number(fields.quantity.value),
      unit: fields.unit.value,
      price: Number(fields.price.value),
      expiryDate: fields.expiryDate.value || null,
      barcode: fields.barcode.value.trim() || null,
      category: fields.category.value.trim() || null,
      nutrition: {
        caloriesPer100: Number(fields.caloriesPer100.value),
        proteinPer100: Number(fields.proteinPer100.value),
        carbsPer100: Number(fields.carbsPer100.value),
        sugarsPer100: Number(fields.sugarsPer100.value),
        fatsPer100: Number(fields.fatsPer100.value)
      }
    };
  }

  function validateInventoryItem(item) {
    const errors = [];

    if (!item.name || item.name.length < 1 || item.name.length > 120) {
      errors.push('Name is required and must be between 1 and 120 characters.');
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push('Quantity is required and must be greater than 0.');
    }

    if (!item.unit || !UnitConversion.allowedUnits.has(item.unit)) {
      errors.push('Unit is required and must be one of g, kg, ml, l, or count.');
    }

    if (!Number.isFinite(item.price) || item.price < 0) {
      errors.push('Price is required and must be 0 or higher.');
    }

    if (item.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate)) {
      errors.push('Expiry date must be in YYYY-MM-DD format when provided.');
    }

    if (item.barcode && !/^[A-Za-z0-9_-]+$/.test(item.barcode)) {
      errors.push('Barcode can only contain letters, numbers, underscores, and dashes.');
    }

    const nutritionKeys = ['caloriesPer100', 'proteinPer100', 'carbsPer100', 'sugarsPer100', 'fatsPer100'];

    nutritionKeys.forEach((key) => {
      const value = item.nutrition?.[key];
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`${key} is required and must be 0 or higher.`);
      }
    });

    return errors;
  }

  function setFeedback(messages, level = 'error') {
    if (messages.length === 0) {
      feedback.textContent = '';
      feedback.className = 'form-feedback';
      return;
    }

    feedback.innerHTML = `<ul>${messages.map((message) => `<li>${message}</li>`).join('')}</ul>`;
    feedback.className = `form-feedback is-${level}`;
  }

  function resetFormToCreateMode(clearFeedback = true) {
    form.reset();
    hiddenId.value = '';
    state.editingItemId = null;
    formHeading.textContent = 'Add Product';
    submitButton.textContent = 'Add Item';
    if (clearFeedback) {
      setFeedback([]);
    }
  }

  function enterEditMode(itemId) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }

    state.editingItemId = item.id;
    hiddenId.value = item.id;
    fields.name.value = item.name;
    fields.quantity.value = String(item.quantity);
    fields.unit.value = item.unit;
    fields.price.value = String(item.price);
    fields.expiryDate.value = item.expiryDate || '';
    fields.barcode.value = item.barcode || '';
    fields.category.value = item.category || '';
    fields.caloriesPer100.value = String(item.nutrition.caloriesPer100);
    fields.proteinPer100.value = String(item.nutrition.proteinPer100);
    fields.carbsPer100.value = String(item.nutrition.carbsPer100);
    fields.sugarsPer100.value = String(item.nutrition.sugarsPer100);
    fields.fatsPer100.value = String(item.nutrition.fatsPer100);

    formHeading.textContent = 'Edit Product';
    submitButton.textContent = 'Update Item';
    setFeedback(['You are editing an existing product. Save changes or cancel to return to add mode.'], 'info');
  }

  function getFilteredItems() {
    const searchName = filters.name.value.trim().toLowerCase();
    const filterExpiry = filters.expiryDate.value;
    const filterCategory = filters.category.value.trim().toLowerCase();

    return state.items.filter((item) => {
      const matchesName = !searchName || item.name.toLowerCase().includes(searchName);
      const matchesCategory = !filterCategory || (item.category || '').toLowerCase().includes(filterCategory);
      const matchesExpiry = !filterExpiry || (item.expiryDate && item.expiryDate <= filterExpiry);

      return matchesName && matchesCategory && matchesExpiry;
    });
  }

  function renderTable() {
    const filteredItems = getFilteredItems();
    tableBody.innerHTML = '';

    if (filteredItems.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="9">No inventory items match the current filters.</td>';
      tableBody.appendChild(row);
      resultsSummary.textContent = 'Showing 0 items.';
      return;
    }

    filteredItems.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(item.name)}</td>
        <td>${item.quantity}</td>
        <td>${item.unit}</td>
        <td>${item.price.toFixed(2)}</td>
        <td>${escapeHtml(item.category || '-')}</td>
        <td>${item.expiryDate || '-'}</td>
        <td>${escapeHtml(item.barcode || '-')}</td>
        <td>
          C:${item.nutrition.caloriesPer100}
          P:${item.nutrition.proteinPer100}
          Cb:${item.nutrition.carbsPer100}
          S:${item.nutrition.sugarsPer100}
          F:${item.nutrition.fatsPer100}
        </td>
        <td>
          <button type="button" data-action="edit" data-id="${item.id}">Edit</button>
          <button type="button" data-action="delete" data-id="${item.id}" class="button-danger">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    resultsSummary.textContent = `Showing ${filteredItems.length} of ${state.items.length} items.`;
  }

  function createInventoryId(name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
    const suffix = String(state.items.length + 1).padStart(3, '0');
    return `item_${slug}_${suffix}`;
  }

  function commitItemsUpdate(nextItems) {
    state.items = nextItems;
    if (typeof state.onItemsUpdated === 'function') {
      state.onItemsUpdated(state.items);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = buildPayload();
    const errors = validateInventoryItem(payload);

    if (errors.length > 0) {
      setFeedback(errors, 'error');
      return;
    }

    let successMessage = 'Item added successfully.';

    if (state.editingItemId) {
      commitItemsUpdate(state.items.map((item) => (item.id === state.editingItemId ? { ...payload, id: state.editingItemId } : item)));
      successMessage = 'Item updated successfully.';
    } else {
      commitItemsUpdate([...state.items, { ...payload, id: createInventoryId(payload.name) }]);
    }

    renderTable();
    resetFormToCreateMode(false);
    setFeedback([successMessage], 'success');
  });

  cancelEditButton.addEventListener('click', () => {
    resetFormToCreateMode();
    setFeedback(['Edit cancelled. You can add a new product now.'], 'info');
  });

  tableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = target.getAttribute('data-action');
    const itemId = target.getAttribute('data-id');

    if (!action || !itemId) {
      return;
    }

    if (action === 'edit') {
      enterEditMode(itemId);
      return;
    }

    if (action === 'delete') {
      commitItemsUpdate(state.items.filter((item) => item.id !== itemId));
      if (state.editingItemId === itemId) {
        resetFormToCreateMode();
      }
      setFeedback(['Item deleted successfully.'], 'success');
      renderTable();
    }
  });

  Object.values(filters).forEach((filterInput) => {
    filterInput.addEventListener('input', renderTable);
  });

  resetFormToCreateMode();
  renderTable();

  return state;
}

function initializeRecipeFlow(inventoryState) {
  const state = {
    recipes: [],
    editingRecipeId: null
  };

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

  function setRecipeFeedback(messages, level = 'error') {
    if (messages.length === 0) {
      recipeFormFeedback.textContent = '';
      recipeFormFeedback.className = 'form-feedback';
      return;
    }

    recipeFormFeedback.innerHTML = `<ul>${messages.map((message) => `<li>${message}</li>`).join('')}</ul>`;
    recipeFormFeedback.className = `form-feedback is-${level}`;
  }

  function buildInventoryOptions(selectedId = '') {
    const baseOption = '<option value="">Select inventory item</option>';
    const itemOptions = inventoryState.items
      .map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.name)} (${item.unit})</option>`)
      .join('');

    return `${baseOption}${itemOptions}`;
  }

  function appendIngredientRow(ingredient = null) {
    const row = document.createElement('div');
    row.className = 'ingredient-row';

    row.innerHTML = `
      <label>
        Inventory item *
        <select data-field="inventoryItemId" required>
          ${buildInventoryOptions(ingredient?.inventoryItemId || '')}
        </select>
      </label>
      <label>
        Quantity *
        <input data-field="quantity" type="number" min="0.01" step="0.01" value="${ingredient?.quantity || ''}" required />
      </label>
      <label>
        Unit *
        <select data-field="unit" required>
          <option value="">Select a unit</option>
          <option value="g" ${ingredient?.unit === 'g' ? 'selected' : ''}>g</option>
          <option value="kg" ${ingredient?.unit === 'kg' ? 'selected' : ''}>kg</option>
          <option value="ml" ${ingredient?.unit === 'ml' ? 'selected' : ''}>ml</option>
          <option value="l" ${ingredient?.unit === 'l' ? 'selected' : ''}>l</option>
          <option value="count" ${ingredient?.unit === 'count' ? 'selected' : ''}>count</option>
        </select>
      </label>
      <button type="button" class="button-muted" data-action="remove-ingredient">Remove</button>
    `;

    ingredientsContainer.appendChild(row);
  }

  function readIngredientRows() {
    return Array.from(ingredientsContainer.querySelectorAll('.ingredient-row')).map((row) => ({
      inventoryItemId: row.querySelector('[data-field="inventoryItemId"]').value,
      quantity: Number(row.querySelector('[data-field="quantity"]').value),
      unit: row.querySelector('[data-field="unit"]').value
    }));
  }

  function createRecipeId(name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'recipe';
    const suffix = String(state.recipes.length + 1).padStart(3, '0');
    return `recipe_${slug}_${suffix}`;
  }

  function validateAndNormalizeRecipe(recipe) {
    const errors = [];
    const warnings = [];
    const normalizedIngredients = [];

    if (!recipe.name || recipe.name.length < 1 || recipe.name.length > 120) {
      errors.push('Recipe name is required and must be between 1 and 120 characters.');
    }

    if (!Number.isInteger(recipe.servings) || recipe.servings < 1) {
      errors.push('Servings is required and must be an integer of at least 1.');
    }

    if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      errors.push('At least one ingredient row is required.');
    }

    recipe.ingredients.forEach((ingredient, index) => {
      const rowNumber = index + 1;
      const inventoryItem = inventoryState.items.find((item) => item.id === ingredient.inventoryItemId);

      // Guardrail: MVP requires inventory-linked ingredients only. Free-form text is intentionally unsupported.
      if (!ingredient.inventoryItemId) {
        errors.push(`Ingredient row ${rowNumber}: inventory item reference is required.`);
        return;
      }

      if (!inventoryItem) {
        errors.push(`Ingredient row ${rowNumber}: selected inventory item does not exist.`);
        return;
      }

      if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
        errors.push(`Ingredient row ${rowNumber}: quantity must be greater than 0.`);
        return;
      }

      if (!UnitConversion.allowedUnits.has(ingredient.unit)) {
        errors.push(`Ingredient row ${rowNumber}: unit must be one of g, kg, ml, l, or count.`);
        return;
      }

      const normalized = UnitConversion.normalizeToFamilyBase(ingredient.quantity, ingredient.unit);
      if (!normalized.ok) {
        errors.push(`Ingredient row ${rowNumber}: normalization failed (${normalized.reason}).`);
        return;
      }

      const inventoryNormalized = UnitConversion.normalizeToFamilyBase(inventoryItem.quantity, inventoryItem.unit);
      if (!inventoryNormalized.ok) {
        errors.push(`Ingredient row ${rowNumber}: inventory unit cannot be normalized (${inventoryNormalized.reason}).`);
        return;
      }

      // Guardrail: prevent silent bad math across unit families.
      if (normalized.family !== inventoryNormalized.family) {
        errors.push(
          `Ingredient row ${rowNumber}: cannot convert ${ingredient.unit} ingredient to ${inventoryItem.unit} inventory because families differ (${normalized.family} vs ${inventoryNormalized.family}).`
        );
        return;
      }

      // We keep both source and normalized values so downstream planning can safely aggregate in base units while preserving user intent.
      normalizedIngredients.push({
        inventoryItemId: ingredient.inventoryItemId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        normalizedQuantity: normalized.quantity,
        normalizedUnit: normalized.baseUnit,
        unitFamily: normalized.family
      });

      if (ingredient.unit !== normalized.baseUnit) {
        warnings.push(`Ingredient row ${rowNumber}: normalized ${ingredient.quantity} ${ingredient.unit} to ${normalized.quantity} ${normalized.baseUnit}.`);
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
        ingredients: normalizedIngredients
      }
    };
  }

  function renderRecipeTable() {
    recipeTableBody.innerHTML = '';

    if (state.recipes.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="6">No recipes created yet.</td>';
      recipeTableBody.appendChild(row);
      recipeSummary.textContent = 'Showing 0 recipes.';
      return;
    }

    state.recipes.forEach((recipe) => {
      const row = document.createElement('tr');
      const ingredientsSummary = recipe.ingredients
        .map((ingredient) => {
          const inventoryItem = inventoryState.items.find((item) => item.id === ingredient.inventoryItemId);
          return `${escapeHtml(inventoryItem?.name || ingredient.inventoryItemId)}: ${ingredient.quantity} ${ingredient.unit} (norm ${ingredient.normalizedQuantity} ${ingredient.normalizedUnit})`;
        })
        .join('<br />');

      row.innerHTML = `
        <td>${escapeHtml(recipe.name)}</td>
        <td>${recipe.servings}</td>
        <td>${ingredientsSummary}</td>
        <td>${escapeHtml(recipe.preparationNotes || '-')}</td>
        <td>${recipe.id}</td>
        <td>
          <button type="button" data-action="edit-recipe" data-id="${recipe.id}">Edit</button>
          <button type="button" data-action="delete-recipe" data-id="${recipe.id}" class="button-danger">Delete</button>
        </td>
      `;
      recipeTableBody.appendChild(row);
    });

    recipeSummary.textContent = `Showing ${state.recipes.length} recipes.`;
  }

  function resetRecipeForm(clearFeedback = true) {
    recipeForm.reset();
    recipeIdField.value = '';
    state.editingRecipeId = null;
    recipeFormHeading.textContent = 'Add Recipe';
    recipeSubmitButton.textContent = 'Add Recipe';
    ingredientsContainer.innerHTML = '';
    appendIngredientRow();

    if (clearFeedback) {
      setRecipeFeedback([]);
    }
  }

  function enterRecipeEditMode(recipeId) {
    const recipe = state.recipes.find((candidate) => candidate.id === recipeId);
    if (!recipe) {
      return;
    }

    state.editingRecipeId = recipe.id;
    recipeIdField.value = recipe.id;
    recipeNameField.value = recipe.name;
    recipeServingsField.value = String(recipe.servings);
    recipeNotesField.value = recipe.preparationNotes || '';

    ingredientsContainer.innerHTML = '';
    recipe.ingredients.forEach((ingredient) => appendIngredientRow(ingredient));

    recipeFormHeading.textContent = 'Edit Recipe';
    recipeSubmitButton.textContent = 'Update Recipe';
    setRecipeFeedback(['You are editing an existing recipe. Save changes or cancel to return to add mode.'], 'info');
  }

  function refreshIngredientOptions() {
    const selects = ingredientsContainer.querySelectorAll('[data-field="inventoryItemId"]');
    selects.forEach((selectElement) => {
      const currentValue = selectElement.value;
      selectElement.innerHTML = buildInventoryOptions(currentValue);
    });

    // Guardrail for data integrity: remove dangling ingredient references if an inventory item was deleted.
    state.recipes = state.recipes.filter((recipe) =>
      recipe.ingredients.every((ingredient) => inventoryState.items.some((item) => item.id === ingredient.inventoryItemId))
    );
    renderRecipeTable();
  }

  addIngredientButton.addEventListener('click', () => {
    appendIngredientRow();
  });

  ingredientsContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    if (target.getAttribute('data-action') === 'remove-ingredient') {
      const row = target.closest('.ingredient-row');
      if (row) {
        row.remove();
      }
      if (ingredientsContainer.querySelectorAll('.ingredient-row').length === 0) {
        appendIngredientRow();
      }
    }
  });

  recipeForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const payload = {
      id: recipeIdField.value || undefined,
      name: recipeNameField.value.trim(),
      servings: Number.parseInt(recipeServingsField.value, 10),
      preparationNotes: recipeNotesField.value.trim() || null,
      ingredients: readIngredientRows()
    };

    const result = validateAndNormalizeRecipe(payload);
    if (result.errors.length > 0) {
      setRecipeFeedback(result.errors, 'error');
      return;
    }

    const nextRecipe = {
      ...result.normalizedRecipe,
      id: state.editingRecipeId || createRecipeId(result.normalizedRecipe.name)
    };

    if (state.editingRecipeId) {
      state.recipes = state.recipes.map((recipe) => (recipe.id === state.editingRecipeId ? nextRecipe : recipe));
    } else {
      state.recipes.push(nextRecipe);
    }

    renderRecipeTable();
    resetRecipeForm(false);

    const feedbackMessages = ['Recipe saved successfully.'];
    if (result.warnings.length > 0) {
      feedbackMessages.push(...result.warnings);
      setRecipeFeedback(feedbackMessages, 'info');
      return;
    }

    setRecipeFeedback(feedbackMessages, 'success');
  });

  recipeCancelButton.addEventListener('click', () => {
    resetRecipeForm();
    setRecipeFeedback(['Recipe edit cancelled.'], 'info');
  });

  recipeTableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = target.getAttribute('data-action');
    const recipeId = target.getAttribute('data-id');
    if (!action || !recipeId) {
      return;
    }

    if (action === 'edit-recipe') {
      enterRecipeEditMode(recipeId);
      return;
    }

    if (action === 'delete-recipe') {
      state.recipes = state.recipes.filter((recipe) => recipe.id !== recipeId);
      if (state.editingRecipeId === recipeId) {
        resetRecipeForm();
      }
      renderRecipeTable();
      setRecipeFeedback(['Recipe deleted successfully.'], 'success');
    }
  });

  inventoryState.onItemsUpdated = () => {
    refreshIngredientOptions();
  };

  resetRecipeForm();
  renderRecipeTable();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
