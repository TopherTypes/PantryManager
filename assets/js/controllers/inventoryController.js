import { getMissingRequiredNutritionFields, validateInventoryDraft } from '../domain/inventory.js';
import { escapeHtml } from '../utils/dom.js';

/**
 * Initialize inventory workspace UI controller and expose state hooks.
 * @param {{showPanel?: (target: string) => void}} options
 */
export function initializeInventoryController(options = {}) {
  const state = {
    items: [
      { id: 'item_olive_oil_001', name: 'Olive Oil', quantity: 750, unit: 'ml', price: 8.5, expiryDate: '2026-06-30', barcode: '0000000000000', category: 'oil', nutrition: { caloriesPer100: 884, proteinPer100: 0, carbsPer100: 0, sugarsPer100: 0, fatsPer100: 100 } },
      { id: 'item_flour_002', name: 'All-purpose Flour', quantity: 2000, unit: 'g', price: 2.95, expiryDate: '2027-01-10', barcode: 'FLOUR-001', category: 'baking', nutrition: { caloriesPer100: 364, proteinPer100: 10, carbsPer100: 76, sugarsPer100: 0.3, fatsPer100: 1 } },
    ],
    editingItemId: null,
    selectedIds: new Set(),
    onItemsUpdatedHandlers: [],
    chips: new Set(),
  };

  const tableBody = document.getElementById('inventory-table-body');
  const tableHead = document.getElementById('inventory-table-head');
  const tableWrap = document.getElementById('inventory-table-wrap');
  const cardGrid = document.getElementById('inventory-card-grid');
  const resultsSummary = document.getElementById('inventory-results-summary');
  const feedback = document.getElementById('inventory-form-feedback');
  const form = document.getElementById('inventory-form');
  const formHeading = document.getElementById('inventory-form-heading');
  const hiddenId = document.getElementById('inventory-item-id');
  const submitButton = document.getElementById('inventory-submit');
  const cancelEditButton = document.getElementById('inventory-cancel-edit');
  const saveAddAnotherButton = document.getElementById('inventory-save-add-another');
  const closeDialogButton = document.getElementById('inventory-close-dialog');
  const openAddItemButton = document.getElementById('inventory-add-item');
  const scanBarcodeButton = document.getElementById('inventory-scan-barcode');
  const moreFiltersButton = document.getElementById('inventory-more-filters');
  const moreFiltersPanel = document.getElementById('inventory-more-filters-panel');
  const bulkDeleteButton = document.getElementById('inventory-bulk-delete');
  const bulkCategoryButton = document.getElementById('inventory-bulk-category');
  const viewModeInput = document.getElementById('inventory-view-mode');
  const sortInput = document.getElementById('inventory-sort');
  const expandedColumnsInput = document.getElementById('inventory-expanded-columns');
  const dialog = document.getElementById('inventory-form-dialog');
  const detailsDrawer = document.getElementById('inventory-details-drawer');
  const detailsContent = document.getElementById('inventory-details-content');
  const detailsCloseButton = document.getElementById('inventory-details-close');
  const metaLine = document.getElementById('inventory-meta');
  const summaryExpiring = document.getElementById('inventory-summary-expiring');
  const summaryLowStock = document.getElementById('inventory-summary-low-stock');
  const summaryValue = document.getElementById('inventory-summary-value');

  const filters = {
    name: document.getElementById('inventory-search-name'),
    expiryDate: document.getElementById('inventory-filter-expiry'),
    category: document.getElementById('inventory-filter-category'),
  };
  const fields = {
    name: document.getElementById('item-name'), quantity: document.getElementById('item-quantity'), unit: document.getElementById('item-unit'), price: document.getElementById('item-price'), expiryDate: document.getElementById('item-expiry'),
    barcode: document.getElementById('item-barcode'), category: document.getElementById('item-category'), caloriesPer100: document.getElementById('nutrition-calories'), proteinPer100: document.getElementById('nutrition-protein'),
    carbsPer100: document.getElementById('nutrition-carbs'), sugarsPer100: document.getElementById('nutrition-sugars'), fatsPer100: document.getElementById('nutrition-fats'),
  };

  const createInventoryId = (name) => `item_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'}_${String(state.items.length + 1).padStart(3, '0')}`;
  const getDaysUntil = (dateString) => {
    if (!dateString) return Number.POSITIVE_INFINITY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateString}T00:00:00`);
    return Math.ceil((target.getTime() - today.getTime()) / 86400000);
  };

  /**
   * Publish toast event to the shell.
   * @param {string} message
   */
  const toast = (message) => window.dispatchEvent(new CustomEvent('app:toast', { detail: { message } }));
  const setFeedback = (messages, level = 'error') => {
    if (!messages.length) {
      feedback.textContent = '';
      feedback.className = 'form-feedback';
      return;
    }
    feedback.innerHTML = `<ul>${messages.map((message) => `<li>${message}</li>`).join('')}</ul>`;
    feedback.className = `form-feedback is-${level}`;
  };

  /**
   * Commit inventory updates and notify all subscribers.
   * @param {Array<Record<string, any>>} nextItems
   */
  function commitItemsUpdate(nextItems) {
    state.items = nextItems;
    state.onItemsUpdatedHandlers.forEach((handler) => handler(state.items));
  }

  const buildPayload = () => ({
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
      fatsPer100: Number(fields.fatsPer100.value),
    },
  });

  const openFormDialog = () => {
    if (!dialog.open) dialog.showModal();
    fields.name.focus();
  };
  const closeFormDialog = () => dialog.close();

  function resetFormToCreateMode(clearFeedback = true) {
    form.reset();
    hiddenId.value = '';
    state.editingItemId = null;
    formHeading.textContent = 'Add Product';
    submitButton.textContent = 'Save item';
    if (clearFeedback) setFeedback([]);
  }

  function enterEditMode(itemId) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
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
    submitButton.textContent = 'Update item';
    setFeedback(['Update fields and save changes.'], 'info');
    openFormDialog();
  }

  function getFilteredItems() {
    const nameFilter = filters.name.value.trim().toLowerCase();
    const expiryFilter = filters.expiryDate.value;
    const categoryFilter = filters.category.value.trim().toLowerCase();
    const withChips = state.items.filter((item) => {
      if (state.chips.has('expiring') && getDaysUntil(item.expiryDate) > 7) return false;
      if (state.chips.has('low-stock') && item.quantity > 2) return false;
      if (state.chips.has('priced') && !item.price) return false;
      return true;
    });
    const filtered = withChips.filter((item) => (!nameFilter || item.name.toLowerCase().includes(nameFilter) || (item.category || '').toLowerCase().includes(nameFilter)) && (!categoryFilter || (item.category || '').toLowerCase().includes(categoryFilter)) && (!expiryFilter || (item.expiryDate && item.expiryDate <= expiryFilter)));
    const [sortKey, sortDirection] = sortInput.value.split('-');
    return filtered.sort((a, b) => {
      const factor = sortDirection === 'asc' ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * factor;
      if (sortKey === 'expiry') return (getDaysUntil(a.expiryDate) - getDaysUntil(b.expiryDate)) * factor;
      return (a.quantity - b.quantity) * factor;
    });
  }

  function renderDetailsDrawer(itemId) {
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    detailsContent.innerHTML = `
      <p class="details-field"><strong>${escapeHtml(item.name)}</strong></p>
      <p class="details-field"><strong>Category:</strong> ${escapeHtml(item.category || '-')}</p>
      <p class="details-field"><strong>Barcode:</strong> ${escapeHtml(item.barcode || '-')}</p>
      <p class="details-field"><strong>Quantity:</strong> ${item.quantity} ${escapeHtml(item.unit)}</p>
      <p class="details-field"><strong>Expiry:</strong> ${escapeHtml(item.expiryDate || '-')} (${Number.isFinite(getDaysUntil(item.expiryDate)) ? `${getDaysUntil(item.expiryDate)} day(s)` : 'n/a'})</p>
      <p class="details-field"><strong>Nutrition:</strong></p>
      <ul>
        <li>Calories: ${item.nutrition.caloriesPer100}</li>
        <li>Protein: ${item.nutrition.proteinPer100}</li>
        <li>Carbs: ${item.nutrition.carbsPer100}</li>
        <li>Sugars: ${item.nutrition.sugarsPer100}</li>
        <li>Fats: ${item.nutrition.fatsPer100}</li>
      </ul>
      <div class="form-actions">
        <button type="button" data-action="edit" data-id="${item.id}">Edit</button>
        <button type="button" data-action="consume" data-id="${item.id}" class="button-muted">Consume</button>
        <button type="button" data-action="shopping" data-id="${item.id}" class="button-muted">Add to shopping</button>
        <button type="button" data-action="delete" data-id="${item.id}" class="button-danger">Delete</button>
      </div>
    `;
    detailsDrawer.hidden = false;
  }

  function renderInventoryRows(items) {
    const showExpanded = expandedColumnsInput.checked;
    tableHead.innerHTML = `<tr><th><input id="inventory-select-all" type="checkbox" aria-label="Select all" /></th><th>Item</th><th>Qty</th><th>${showExpanded ? 'Location' : 'Category'}</th><th>Expiry</th><th>Price</th>${showExpanded ? '<th>Barcode</th><th>Nutrition</th>' : ''}<th>Actions</th></tr>`;
    tableBody.innerHTML = '';
    if (!items.length) {
      tableBody.innerHTML = '<tr><td colspan="9">No items match current filters. Try clearing filters or add an item.</td></tr>';
      return;
    }

    items.forEach((item) => {
      const daysUntil = getDaysUntil(item.expiryDate);
      const urgency = Number.isFinite(daysUntil) ? (daysUntil <= 3 ? '⚠' : daysUntil <= 7 ? '•' : '✓') : '-';
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="checkbox" data-action="select" data-id="${item.id}" ${state.selectedIds.has(item.id) ? 'checked' : ''} /></td>
        <td><button type="button" class="button-muted" data-action="details" data-id="${item.id}">${escapeHtml(item.name)}</button><div class="helper-text">${escapeHtml(item.category || 'Uncategorized')}</div></td>
        <td>${item.quantity} ${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.category || '-')}</td>
        <td>${escapeHtml(item.expiryDate || '-')} <span class="helper-text">${Number.isFinite(daysUntil) ? `${daysUntil}d` : ''} ${urgency}</span></td>
        <td>${Number.isFinite(item.price) ? item.price.toFixed(2) : '-'}</td>
        ${showExpanded ? `<td>${escapeHtml(item.barcode || '-')}</td><td>C:${item.nutrition.caloriesPer100} P:${item.nutrition.proteinPer100} Cb:${item.nutrition.carbsPer100} S:${item.nutrition.sugarsPer100} F:${item.nutrition.fatsPer100}</td>` : ''}
        <td class="inventory-row-action"><button type="button" data-action="edit" data-id="${item.id}">Edit</button><button type="button" data-action="delete" data-id="${item.id}" class="button-danger">Delete</button></td>
      `;
      tableBody.appendChild(row);
    });
  }

  function renderInventoryCards(items) {
    cardGrid.innerHTML = '';
    if (!items.length) {
      cardGrid.innerHTML = '<article class="inventory-item-card">No items in current view.</article>';
      return;
    }
    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'inventory-item-card';
      card.innerHTML = `<h4>${escapeHtml(item.name)}</h4><p class="helper-text">${item.quantity} ${escapeHtml(item.unit)} • ${escapeHtml(item.category || 'Uncategorized')}</p><p class="helper-text">Expiry: ${escapeHtml(item.expiryDate || '-')}</p><div class="form-actions"><button type="button" data-action="details" data-id="${item.id}">Details</button><button type="button" data-action="edit" data-id="${item.id}" class="button-muted">Edit</button></div>`;
      cardGrid.appendChild(card);
    });
  }

  function renderSummary(items) {
    const expiringSoon = items.filter((item) => getDaysUntil(item.expiryDate) <= 7).length;
    const lowStock = items.filter((item) => item.quantity <= 2).length;
    const totalValue = items.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price : 0), 0);
    summaryExpiring.textContent = String(expiringSoon);
    summaryLowStock.textContent = String(lowStock);
    summaryValue.textContent = `$${totalValue.toFixed(2)}`;
    metaLine.textContent = `${state.items.length} items • ${state.items.filter((item) => getDaysUntil(item.expiryDate) <= 7).length} expiring soon`;
  }

  function renderWorkspace() {
    const filteredItems = getFilteredItems();
    renderSummary(state.items);
    resultsSummary.textContent = `Showing ${filteredItems.length} of ${state.items.length} items.`;
    const isCards = viewModeInput.value === 'cards';
    tableWrap.hidden = isCards;
    cardGrid.hidden = !isCards;
    if (isCards) {
      renderInventoryCards(filteredItems);
    } else {
      renderInventoryRows(filteredItems);
    }
  }

  function handleItemSave(keepOpenAfterSave = false) {
    const payload = buildPayload();
    const validationResult = validateInventoryDraft(payload);
    if (!validationResult.isValid) {
      setFeedback(validationResult.errors, 'error');
      return;
    }
    if (state.editingItemId) {
      commitItemsUpdate(state.items.map((item) => (item.id === state.editingItemId ? { ...payload, id: state.editingItemId } : item)));
      toast('Item updated successfully.');
    } else {
      commitItemsUpdate([...state.items, { ...payload, id: createInventoryId(payload.name) }]);
      toast('Item added successfully.');
    }
    renderWorkspace();
    if (keepOpenAfterSave) {
      resetFormToCreateMode(false);
      setFeedback(['Saved. You can add another item.'], 'success');
      fields.name.focus();
      return;
    }
    resetFormToCreateMode(false);
    closeFormDialog();
  }

  function handleRowAction(action, itemId) {
    if (action === 'edit') {
      enterEditMode(itemId);
      return;
    }
    if (action === 'delete') {
      commitItemsUpdate(state.items.filter((item) => item.id !== itemId));
      state.selectedIds.delete(itemId);
      renderWorkspace();
      detailsDrawer.hidden = true;
      toast('Item deleted.');
      return;
    }
    if (action === 'details') {
      renderDetailsDrawer(itemId);
      return;
    }
    if (action === 'consume') {
      commitItemsUpdate(state.items.map((item) => (item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item)));
      renderWorkspace();
      renderDetailsDrawer(itemId);
      toast('Consumed 1 unit.');
      return;
    }
    if (action === 'shopping') {
      toast('Added to shopping workflow context.');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleItemSave(false);
  });

  saveAddAnotherButton.addEventListener('click', () => handleItemSave(true));
  cancelEditButton.addEventListener('click', () => {
    resetFormToCreateMode();
    closeFormDialog();
  });
  closeDialogButton.addEventListener('click', closeFormDialog);
  openAddItemButton.addEventListener('click', () => {
    resetFormToCreateMode();
    openFormDialog();
  });
  scanBarcodeButton.addEventListener('click', () => {
    options.showPanel?.('barcode');
  });
  moreFiltersButton.addEventListener('click', () => {
    moreFiltersPanel.hidden = !moreFiltersPanel.hidden;
  });

  document.querySelectorAll('.chip-button').forEach((chipButton) => {
    chipButton.addEventListener('click', () => {
      const chip = chipButton.getAttribute('data-chip');
      if (!chip) return;
      if (state.chips.has(chip)) {
        state.chips.delete(chip);
        chipButton.classList.remove('is-active');
      } else {
        state.chips.add(chip);
        chipButton.classList.add('is-active');
      }
      renderWorkspace();
    });
  });

  [filters.name, filters.expiryDate, filters.category, viewModeInput, sortInput, expandedColumnsInput].forEach((input) => input.addEventListener('input', renderWorkspace));

  tableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    const itemId = target.getAttribute('data-id');
    if (action && itemId) {
      handleRowAction(action, itemId);
    }
  });

  tableHead.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== 'inventory-select-all') return;
    const visibleIds = getFilteredItems().map((item) => item.id);
    visibleIds.forEach((id) => (target.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id)));
    renderWorkspace();
  });

  tableBody.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.getAttribute('data-action') !== 'select') return;
    const itemId = target.getAttribute('data-id');
    if (!itemId) return;
    if (target.checked) state.selectedIds.add(itemId);
    else state.selectedIds.delete(itemId);
  });

  cardGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    const itemId = target.getAttribute('data-id');
    if (action && itemId) handleRowAction(action, itemId);
  });

  bulkDeleteButton.addEventListener('click', () => {
    if (!state.selectedIds.size) return;
    commitItemsUpdate(state.items.filter((item) => !state.selectedIds.has(item.id)));
    state.selectedIds.clear();
    renderWorkspace();
    toast('Bulk delete complete.');
  });

  bulkCategoryButton.addEventListener('click', () => {
    if (!state.selectedIds.size) return;
    const category = window.prompt('Set category for selected items:', 'pantry');
    if (category == null) return;
    commitItemsUpdate(state.items.map((item) => (state.selectedIds.has(item.id) ? { ...item, category: category.trim() || null } : item)));
    renderWorkspace();
    toast('Bulk category updated.');
  });

  detailsCloseButton.addEventListener('click', () => {
    detailsDrawer.hidden = true;
  });
  detailsContent.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    const itemId = target.getAttribute('data-id');
    if (action && itemId) handleRowAction(action, itemId);
  });

  resetFormToCreateMode();
  renderWorkspace();

  return {
    get items() { return state.items; },
    set onItemsUpdated(handler) { if (typeof handler === 'function') state.onItemsUpdatedHandlers.push(handler); },
    replaceItems(items) {
      if (!Array.isArray(items)) return;
      commitItemsUpdate(items);
      renderWorkspace();
      setFeedback(['Inventory restored from persisted data.'], 'info');
    },
    getLocalMatchByBarcode(barcode) { return state.items.find((item) => item.barcode === barcode) || null; },
    prefillFormFromDraft(draft) {
      resetFormToCreateMode(false);
      fields.name.value = draft.name || '';
      fields.quantity.value = draft.quantity != null ? String(draft.quantity) : '';
      fields.unit.value = draft.unit || '';
      fields.price.value = '';
      fields.expiryDate.value = '';
      fields.barcode.value = draft.barcode || '';
      fields.category.value = draft.category || '';
      fields.caloriesPer100.value = draft.nutrition.caloriesPer100 != null ? String(draft.nutrition.caloriesPer100) : '';
      fields.proteinPer100.value = draft.nutrition.proteinPer100 != null ? String(draft.nutrition.proteinPer100) : '';
      fields.carbsPer100.value = draft.nutrition.carbsPer100 != null ? String(draft.nutrition.carbsPer100) : '';
      fields.sugarsPer100.value = draft.nutrition.sugarsPer100 != null ? String(draft.nutrition.sugarsPer100) : '';
      fields.fatsPer100.value = draft.nutrition.fatsPer100 != null ? String(draft.nutrition.fatsPer100) : '';
      const missingNutrition = getMissingRequiredNutritionFields(draft.nutrition);
      setFeedback(missingNutrition.length > 0 ? ['Provider draft applied, but required nutrition fields are missing.', `Missing: ${missingNutrition.join(', ')}.`] : ['Provider draft applied. Review and save when ready.'], missingNutrition.length ? 'error' : 'info');
      openFormDialog();
    },
    enterEditMode,
    focusForm() {
      openFormDialog();
      fields.name.focus();
    },
  };
}
