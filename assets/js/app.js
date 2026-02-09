/**
 * PantryManager UI script.
 *
 * Includes:
 * 1) Lightweight panel navigation.
 * 2) Inventory CRUD + filters.
 * 3) Data-model-aligned validation and explicit user feedback for each failure state.
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

  initializeInventoryFlow();
})();

function initializeInventoryFlow() {
  const allowedUnits = new Set(['g', 'kg', 'ml', 'l', 'count']);

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
      }
    ],
    editingItemId: null
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

    // Required by data model: name must be present and constrained to 1..120 chars for consistent display/search.
    if (!item.name || item.name.length < 1 || item.name.length > 120) {
      errors.push('Name is required and must be between 1 and 120 characters.');
    }

    // Required by data model: quantity must be > 0 so stock math never produces invalid/negative inventory baselines.
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push('Quantity is required and must be greater than 0.');
    }

    // Required + enum-constrained by model: unit must be in the canonical unit dictionary used by the app.
    if (!item.unit || !allowedUnits.has(item.unit)) {
      errors.push('Unit is required and must be one of g, kg, ml, l, or count.');
    }

    // Required by data model: price must be >= 0 to support free items while blocking impossible negative pricing.
    if (!Number.isFinite(item.price) || item.price < 0) {
      errors.push('Price is required and must be 0 or higher.');
    }

    // Optional in model, but if provided it must follow YYYY-MM-DD to preserve date-only semantics.
    if (item.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate)) {
      errors.push('Expiry date must be in YYYY-MM-DD format when provided.');
    }

    // Optional in model, but if provided use provider-safe barcode characters (letters, digits, dash, underscore).
    if (item.barcode && !/^[A-Za-z0-9_-]+$/.test(item.barcode)) {
      errors.push('Barcode can only contain letters, numbers, underscores, and dashes.');
    }

    const nutritionKeys = ['caloriesPer100', 'proteinPer100', 'carbsPer100', 'sugarsPer100', 'fatsPer100'];

    nutritionKeys.forEach((key) => {
      const value = item.nutrition?.[key];
      // Required by model: all nutrition fields are mandatory and must be numeric >= 0 for stable recommendation math.
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

    // Feedback is explicit per failure state so users know exactly what must be fixed before data can be saved.
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
      const matchesExpiry =
        !filterExpiry ||
        (item.expiryDate && item.expiryDate <= filterExpiry);

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

  function escapeHtml(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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
      state.items = state.items.map((item) => (item.id === state.editingItemId ? { ...payload, id: state.editingItemId } : item));
      successMessage = 'Item updated successfully.';
    } else {
      state.items.push({ ...payload, id: createInventoryId(payload.name) });
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
      state.items = state.items.filter((item) => item.id !== itemId);
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
}
