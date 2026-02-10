import { getMissingRequiredNutritionFields, validateInventoryDraft } from '../domain/inventory.js';
import { escapeHtml } from '../utils/dom.js';

/** Initialize inventory UI controller and expose state accessors/hooks. */
export function initializeInventoryController() {
  const state = {
    items: [
      { id: 'item_olive_oil_001', name: 'Olive Oil', quantity: 750, unit: 'ml', price: 8.5, expiryDate: '2026-06-30', barcode: '0000000000000', category: 'oil', nutrition: { caloriesPer100: 884, proteinPer100: 0, carbsPer100: 0, sugarsPer100: 0, fatsPer100: 100 } },
      { id: 'item_flour_002', name: 'All-purpose Flour', quantity: 2000, unit: 'g', price: 2.95, expiryDate: '2027-01-10', barcode: 'FLOUR-001', category: 'baking', nutrition: { caloriesPer100: 364, proteinPer100: 10, carbsPer100: 76, sugarsPer100: 0.3, fatsPer100: 1 } },
    ],
    editingItemId: null,
    onItemsUpdatedHandlers: [],
  };

  const tableBody = document.getElementById('inventory-table-body');
  const resultsSummary = document.getElementById('inventory-results-summary');
  const feedback = document.getElementById('inventory-form-feedback');
  const form = document.getElementById('inventory-form');
  const formHeading = document.getElementById('inventory-form-heading');
  const hiddenId = document.getElementById('inventory-item-id');
  const submitButton = document.getElementById('inventory-submit');
  const cancelEditButton = document.getElementById('inventory-cancel-edit');
  const filters = { name: document.getElementById('inventory-search-name'), expiryDate: document.getElementById('inventory-filter-expiry'), category: document.getElementById('inventory-filter-category') };
  const fields = {
    name: document.getElementById('item-name'), quantity: document.getElementById('item-quantity'), unit: document.getElementById('item-unit'), price: document.getElementById('item-price'), expiryDate: document.getElementById('item-expiry'),
    barcode: document.getElementById('item-barcode'), category: document.getElementById('item-category'), caloriesPer100: document.getElementById('nutrition-calories'), proteinPer100: document.getElementById('nutrition-protein'),
    carbsPer100: document.getElementById('nutrition-carbs'), sugarsPer100: document.getElementById('nutrition-sugars'), fatsPer100: document.getElementById('nutrition-fats'),
  };

  function buildPayload() { return { id: hiddenId.value || undefined, name: fields.name.value.trim(), quantity: Number(fields.quantity.value), unit: fields.unit.value, price: Number(fields.price.value), expiryDate: fields.expiryDate.value || null, barcode: fields.barcode.value.trim() || null, category: fields.category.value.trim() || null, nutrition: { caloriesPer100: Number(fields.caloriesPer100.value), proteinPer100: Number(fields.proteinPer100.value), carbsPer100: Number(fields.carbsPer100.value), sugarsPer100: Number(fields.sugarsPer100.value), fatsPer100: Number(fields.fatsPer100.value) } }; }
  function setFeedback(messages, level = 'error') { if (!messages.length) { feedback.textContent = ''; feedback.className = 'form-feedback'; return; } feedback.innerHTML = `<ul>${messages.map((message) => `<li>${message}</li>`).join('')}</ul>`; feedback.className = `form-feedback is-${level}`; }
  function resetFormToCreateMode(clearFeedback = true) { form.reset(); hiddenId.value = ''; state.editingItemId = null; formHeading.textContent = 'Add Product'; submitButton.textContent = 'Add Item'; if (clearFeedback) setFeedback([]); }

  function enterEditMode(itemId) {
    const item = state.items.find((candidate) => candidate.id === itemId); if (!item) return;
    state.editingItemId = item.id; hiddenId.value = item.id;
    fields.name.value = item.name; fields.quantity.value = String(item.quantity); fields.unit.value = item.unit; fields.price.value = String(item.price); fields.expiryDate.value = item.expiryDate || ''; fields.barcode.value = item.barcode || ''; fields.category.value = item.category || '';
    fields.caloriesPer100.value = String(item.nutrition.caloriesPer100); fields.proteinPer100.value = String(item.nutrition.proteinPer100); fields.carbsPer100.value = String(item.nutrition.carbsPer100); fields.sugarsPer100.value = String(item.nutrition.sugarsPer100); fields.fatsPer100.value = String(item.nutrition.fatsPer100);
    formHeading.textContent = 'Edit Product'; submitButton.textContent = 'Update Item'; setFeedback(['You are editing an existing product. Save changes or cancel to return to add mode.'], 'info');
  }

  function getFilteredItems() { const n = filters.name.value.trim().toLowerCase(); const e = filters.expiryDate.value; const c = filters.category.value.trim().toLowerCase(); return state.items.filter((item) => (!n || item.name.toLowerCase().includes(n)) && (!c || (item.category || '').toLowerCase().includes(c)) && (!e || (item.expiryDate && item.expiryDate <= e))); }
  function renderTable() {
    const filteredItems = getFilteredItems(); tableBody.innerHTML = '';
    if (!filteredItems.length) { const row = document.createElement('tr'); row.innerHTML = '<td colspan="9">No inventory items match the current filters.</td>'; tableBody.appendChild(row); resultsSummary.textContent = 'Showing 0 items.'; return; }
    filteredItems.forEach((item) => { const row = document.createElement('tr'); row.innerHTML = `<td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${item.unit}</td><td>${item.price.toFixed(2)}</td><td>${escapeHtml(item.category || '-')}</td><td>${item.expiryDate || '-'}</td><td>${escapeHtml(item.barcode || '-')}</td><td>C:${item.nutrition.caloriesPer100} P:${item.nutrition.proteinPer100} Cb:${item.nutrition.carbsPer100} S:${item.nutrition.sugarsPer100} F:${item.nutrition.fatsPer100}</td><td><button type="button" data-action="edit" data-id="${item.id}">Edit</button><button type="button" data-action="delete" data-id="${item.id}" class="button-danger">Delete</button></td>`; tableBody.appendChild(row); });
    resultsSummary.textContent = `Showing ${filteredItems.length} of ${state.items.length} items.`;
  }

  const createInventoryId = (name) => `item_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'}_${String(state.items.length + 1).padStart(3, '0')}`;
  /**
   * Commit inventory updates and notify all registered listeners.
   * @param {Array<Record<string, any>>} nextItems
   */
  const commitItemsUpdate = (nextItems) => {
    state.items = nextItems;
    state.onItemsUpdatedHandlers.forEach((handler) => handler(state.items));
  };

  function prefillFormFromDraft(draft) {
    resetFormToCreateMode(false);
    fields.name.value = draft.name || ''; fields.quantity.value = draft.quantity != null ? String(draft.quantity) : ''; fields.unit.value = draft.unit || ''; fields.price.value = ''; fields.expiryDate.value = ''; fields.barcode.value = draft.barcode || ''; fields.category.value = draft.category || '';
    fields.caloriesPer100.value = draft.nutrition.caloriesPer100 != null ? String(draft.nutrition.caloriesPer100) : ''; fields.proteinPer100.value = draft.nutrition.proteinPer100 != null ? String(draft.nutrition.proteinPer100) : ''; fields.carbsPer100.value = draft.nutrition.carbsPer100 != null ? String(draft.nutrition.carbsPer100) : ''; fields.sugarsPer100.value = draft.nutrition.sugarsPer100 != null ? String(draft.nutrition.sugarsPer100) : ''; fields.fatsPer100.value = draft.nutrition.fatsPer100 != null ? String(draft.nutrition.fatsPer100) : '';
    const missingNutrition = getMissingRequiredNutritionFields(draft.nutrition);
    if (missingNutrition.length > 0) { setFeedback(['Provider draft applied, but save is blocked until required nutrition fields are completed manually.', `Missing: ${missingNutrition.join(', ')}.`], 'error'); return; }
    setFeedback(['Provider draft applied. Review all fields and explicitly save when ready.'], 'info');
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const payload = buildPayload();
    const validationResult = validateInventoryDraft(payload);
    if (!validationResult.isValid) { setFeedback(validationResult.errors, 'error'); return; }

    let successMessage = 'Item added successfully.';
    if (state.editingItemId) { commitItemsUpdate(state.items.map((item) => (item.id === state.editingItemId ? { ...payload, id: state.editingItemId } : item))); successMessage = 'Item updated successfully.'; }
    else { commitItemsUpdate([...state.items, { ...payload, id: createInventoryId(payload.name) }]); }

    renderTable(); resetFormToCreateMode(false); setFeedback([successMessage], 'success');
  });

  cancelEditButton.addEventListener('click', () => { resetFormToCreateMode(); setFeedback(['Edit cancelled. You can add a new product now.'], 'info'); });
  tableBody.addEventListener('click', (event) => { const target = event.target; if (!(target instanceof HTMLButtonElement)) return; const action = target.getAttribute('data-action'); const itemId = target.getAttribute('data-id'); if (!action || !itemId) return; if (action === 'edit') return enterEditMode(itemId); if (action === 'delete') { commitItemsUpdate(state.items.filter((item) => item.id !== itemId)); if (state.editingItemId === itemId) resetFormToCreateMode(); setFeedback(['Item deleted successfully.'], 'success'); renderTable(); } });
  Object.values(filters).forEach((filterInput) => filterInput.addEventListener('input', renderTable));

  resetFormToCreateMode(); renderTable();
  return {
    get items() { return state.items; },
    set onItemsUpdated(handler) { if (typeof handler === 'function') state.onItemsUpdatedHandlers.push(handler); },
    /**
     * Replace inventory state from a persistence or sync source.
     * @param {Array<Record<string, any>>} items
     */
    replaceItems(items) {
      if (!Array.isArray(items)) {
        return;
      }

      commitItemsUpdate(items);
      renderTable();
      setFeedback(['Inventory restored from persisted data.'], 'info');
    },
    getLocalMatchByBarcode(barcode) { return state.items.find((item) => item.barcode === barcode) || null; },
    prefillFormFromDraft,
    enterEditMode,
    focusForm() { fields.name.focus(); },
  };
}
