import { createOpenFoodFactsAdapter, REQUIRED_NUTRITION_KEYS } from '../domain/barcode.js';
import { getMissingRequiredNutritionFields } from '../domain/inventory.js';
import { escapeHtml } from '../utils/dom.js';

/** Initialize barcode lookup/import workflow UI controller. */
export function initializeBarcodeController(inventoryState) {
  const adapter = createOpenFoodFactsAdapter();
  const barcodeInput = document.getElementById('barcode-input');
  const lookupButton = document.getElementById('barcode-lookup-button');
  const barcodeFeedback = document.getElementById('barcode-lookup-feedback');
  const draftContainer = document.getElementById('barcode-draft-container');
  const draftSummary = document.getElementById('barcode-draft-summary');
  const confirmCheckbox = document.getElementById('barcode-confirm-import');
  const applyDraftButton = document.getElementById('barcode-apply-draft-button');
  const state = { currentDraft: null, draftSource: null, missingNutrition: [] };

  const setBarcodeFeedback = (messages, level = 'info') => { if (!messages.length) { barcodeFeedback.textContent = ''; barcodeFeedback.className = 'form-feedback'; return; } barcodeFeedback.innerHTML = `<ul>${messages.map((message) => `<li>${message}</li>`).join('')}</ul>`; barcodeFeedback.className = `form-feedback is-${level}`; };
  const setDraftVisibility = (isVisible) => { draftContainer.hidden = !isVisible; if (!isVisible) { confirmCheckbox.checked = false; applyDraftButton.disabled = true; draftSummary.innerHTML = ''; } };

  function renderDraft(draft, sourceLabel) {
    state.currentDraft = draft; state.draftSource = sourceLabel; state.missingNutrition = getMissingRequiredNutritionFields(draft.nutrition);
    const nutritionRows = REQUIRED_NUTRITION_KEYS.map((key) => `<li><strong>${escapeHtml(key)}:</strong> ${draft.nutrition[key] == null ? '<em>missing</em>' : String(draft.nutrition[key])}</li>`).join('');
    draftSummary.innerHTML = `<p><strong>Source:</strong> ${escapeHtml(sourceLabel)}</p><p><strong>Name:</strong> ${escapeHtml(draft.name)}</p><p><strong>Barcode:</strong> ${escapeHtml(draft.barcode)}</p><p><strong>Brand:</strong> ${escapeHtml(draft.brand || '-')}</p><p><strong>Quantity/Unit:</strong> ${draft.quantity ?? '-'} ${escapeHtml(draft.unit || '')}</p><p><strong>Category:</strong> ${escapeHtml(draft.category || '-')}</p><p><strong>Nutrition:</strong></p><ul>${nutritionRows}</ul>`;
    setDraftVisibility(true);
  }

  async function lookupWithRetry(barcode) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await adapter.lookupByBarcode(barcode);
      if (result.ok || result.error?.kind !== 'transient') return result;
      if (attempt === 3) return { ok: false, draft: null, error: { kind: 'transient', message: 'Provider lookup failed after 3 attempts. Continue with manual entry.' } };
    }
    return { ok: false, draft: null, error: { kind: 'transient', message: 'Provider lookup exhausted retries. Continue with manual entry.' } };
  }

  async function runLookup() {
    const barcode = barcodeInput.value.trim(); setDraftVisibility(false);
    if (!barcode) return setBarcodeFeedback(['Enter a barcode value before lookup.'], 'error');

    const localMatch = inventoryState.getLocalMatchByBarcode(barcode);
    if (localMatch) {
      renderDraft({ barcode: localMatch.barcode || barcode, name: localMatch.name, brand: null, quantity: localMatch.quantity, unit: localMatch.unit, category: localMatch.category, nutrition: { ...localMatch.nutrition } }, 'Local inventory');
      return setBarcodeFeedback([`Local match found for barcode ${barcode}.`, 'Review the draft and explicitly confirm before prefill.'], 'success');
    }

    setBarcodeFeedback(['No local match found. Querying Open Food Facts adapter...'], 'info');
    const result = await lookupWithRetry(barcode);
    if (result.ok && result.draft) {
      renderDraft(result.draft, 'Open Food Facts');
      return setBarcodeFeedback(['Provider draft loaded successfully.', 'Explicit confirmation is required before this draft can prefill the inventory form.'], 'success');
    }

    const error = result.error;
    const manualFallbackMessage = error?.kind === 'rate_limit' ? 'Provider rate limit reached. Please continue with manual entry.' : error?.kind === 'not_found' ? 'No provider match found. Please continue with manual entry.' : error?.kind === 'malformed' ? 'Provider payload was malformed and discarded. Please continue with manual entry.' : error?.kind === 'offline' ? 'You are offline. External lookup skipped; continue with manual entry.' : 'Lookup temporarily failed after retries. Please continue with manual entry.';
    setBarcodeFeedback([manualFallbackMessage], 'info');
  }

  lookupButton.addEventListener('click', runLookup);
  confirmCheckbox.addEventListener('change', () => { applyDraftButton.disabled = !confirmCheckbox.checked; });
  applyDraftButton.addEventListener('click', () => {
    if (!state.currentDraft || !confirmCheckbox.checked) return setBarcodeFeedback(['Explicit confirmation is required before prefill.'], 'error');
    inventoryState.prefillFormFromDraft(state.currentDraft); inventoryState.focusForm();
    const messages = [`Draft from ${state.draftSource} applied to inventory form.`];
    if (state.missingNutrition.length > 0) messages.push('Save is blocked until missing required nutrition fields are manually completed.');
    setBarcodeFeedback(messages, state.missingNutrition.length > 0 ? 'error' : 'success');
  });
}
