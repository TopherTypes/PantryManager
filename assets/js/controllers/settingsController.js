/**
 * Canonical defaults for user-configurable settings.
 *
 * These defaults are intentionally aligned with the UI's existing initial values
 * so first-run behavior remains unchanged until a user explicitly saves preferences.
 */
const DEFAULT_SETTINGS = Object.freeze({
  general: {
    theme: 'light',
    currency: 'USD',
    startPanel: 'inventory',
  },
  inventory: {
    viewMode: 'table',
    sortOrder: 'name-asc',
    expandedColumns: false,
  },
  planner: {
    weekStart: '',
  },
  nutritionTargets: {
    calories: null,
    protein: null,
    carbs: null,
    fats: null,
  },
});

/**
 * Supported theme identifiers accepted by the settings payload.
 * Keeping this central avoids accidental drift between form values and runtime checks.
 */
const THEME_OPTIONS = Object.freeze(new Set(['light', 'dark']));
const CURRENCY_OPTIONS = Object.freeze(new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD']));

/**
 * Normalize a number-like form value to a non-negative numeric target or null.
 * @param {unknown} value
 * @returns {number | null}
 */
function normalizeTargetValue(value) {
  if (value === '' || value == null) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null;
}

/**
 * Resolve an incoming currency code to one of the known supported options.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeCurrency(value) {
  return typeof value === 'string' && CURRENCY_OPTIONS.has(value) ? value : DEFAULT_SETTINGS.general.currency;
}

/**
 * Apply the selected theme mode by writing a data attribute at the document root.
 * @param {'light' | 'dark'} themeMode
 */
function applyTheme(themeMode) {
  if (!document?.documentElement) return;

  // Mirror the theme marker to both `<html>` and `<body>` so CSS selectors and
  // feature code can reliably detect the active mode in every browser context.
  document.documentElement.dataset.theme = themeMode;
  document.body?.setAttribute('data-theme', themeMode);
  document.body?.classList.toggle('theme-dark', themeMode === 'dark');
}

/**
 * Resolve an incoming theme string to a supported option.
 * @param {unknown} value
 * @returns {'light' | 'dark'}
 */
function normalizeTheme(value) {
  return typeof value === 'string' && THEME_OPTIONS.has(value) ? value : DEFAULT_SETTINGS.general.theme;
}

/**
 * Create the settings modal controller and wire preferences to existing UI inputs.
 * @param {{showPanel?: (targetId: string) => void}} options
 */
export function initializeSettingsController(options = {}) {
  const dialog = document.getElementById('settings-dialog');
  const form = document.getElementById('settings-form');
  const feedback = document.getElementById('settings-feedback');
  const openButton = document.getElementById('settings-open-button');
  const closeButton = document.getElementById('settings-close-button');
  const resetButton = document.getElementById('settings-reset-button');

  const fields = {
    theme: document.getElementById('setting-theme'),
    currency: document.getElementById('setting-currency'),
    startPanel: document.getElementById('setting-start-panel'),
    inventoryView: document.getElementById('setting-inventory-view'),
    inventorySort: document.getElementById('setting-inventory-sort'),
    expandedColumns: document.getElementById('setting-expanded-columns'),
    mealPlanWeekStart: document.getElementById('setting-meal-plan-week-start'),
    targetCalories: document.getElementById('setting-target-calories'),
    targetProtein: document.getElementById('setting-target-protein'),
    targetCarbs: document.getElementById('setting-target-carbs'),
    targetFats: document.getElementById('setting-target-fats'),
  };

  const linkedInputs = {
    inventoryView: document.getElementById('inventory-view-mode'),
    inventorySort: document.getElementById('inventory-sort'),
    expandedColumns: document.getElementById('inventory-expanded-columns'),
    mealPlanWeekStart: document.getElementById('meal-plan-week-start'),
  };

  const state = {
    settings: structuredClone(DEFAULT_SETTINGS),
    onSettingsUpdatedHandlers: [],
  };

  function setFeedback(message, level = 'info') {
    feedback.textContent = message;
    feedback.className = `form-feedback is-${level}`;
  }

  /**
   * Merge incoming settings onto defaults so old payloads remain backward compatible.
   * @param {Record<string, any> | null | undefined} incoming
   * @returns {{general: {theme: 'light' | 'dark', currency: string, startPanel: string}, inventory: {viewMode: string, sortOrder: string, expandedColumns: boolean}, planner: {weekStart: string}, nutritionTargets: {calories: number | null, protein: number | null, carbs: number | null, fats: number | null}}}
   */
  function normalizeSettings(incoming) {
    const source = incoming && typeof incoming === 'object' ? incoming : {};
    return {
      general: {
        theme: normalizeTheme(source.general?.theme),
        currency: normalizeCurrency(source.general?.currency),
        startPanel: source.general?.startPanel || DEFAULT_SETTINGS.general.startPanel,
      },
      inventory: {
        viewMode: source.inventory?.viewMode || DEFAULT_SETTINGS.inventory.viewMode,
        sortOrder: source.inventory?.sortOrder || DEFAULT_SETTINGS.inventory.sortOrder,
        expandedColumns: Boolean(source.inventory?.expandedColumns),
      },
      planner: {
        weekStart: source.planner?.weekStart || DEFAULT_SETTINGS.planner.weekStart,
      },
      nutritionTargets: {
        calories: normalizeTargetValue(source.nutritionTargets?.calories),
        protein: normalizeTargetValue(source.nutritionTargets?.protein),
        carbs: normalizeTargetValue(source.nutritionTargets?.carbs),
        fats: normalizeTargetValue(source.nutritionTargets?.fats),
      },
    };
  }

  /**
   * Sync current in-memory settings into modal inputs.
   */
  function renderFormFromState() {
    fields.theme.value = state.settings.general.theme;
    fields.currency.value = state.settings.general.currency;
    fields.startPanel.value = state.settings.general.startPanel;
    fields.inventoryView.value = state.settings.inventory.viewMode;
    fields.inventorySort.value = state.settings.inventory.sortOrder;
    fields.expandedColumns.checked = state.settings.inventory.expandedColumns;
    fields.mealPlanWeekStart.value = state.settings.planner.weekStart;
    fields.targetCalories.value = state.settings.nutritionTargets.calories ?? '';
    fields.targetProtein.value = state.settings.nutritionTargets.protein ?? '';
    fields.targetCarbs.value = state.settings.nutritionTargets.carbs ?? '';
    fields.targetFats.value = state.settings.nutritionTargets.fats ?? '';
  }

  /**
   * Dispatch an input event on linked controls so their existing listeners react.
   * @param {HTMLElement | null} element
   */
  function emitInput(element) {
    if (!element) return;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Apply settings to the existing workspace controls and navigation shell.
   * @param {{general: {theme: 'light' | 'dark', currency: string, startPanel: string}, inventory: {viewMode: string, sortOrder: string, expandedColumns: boolean}, planner: {weekStart: string}, nutritionTargets: {calories: number | null, protein: number | null, carbs: number | null, fats: number | null}}} nextSettings
   * @param {{navigateToStartPanel?: boolean}} [options]
   */
  function applySettings(nextSettings, options = {}) {
    // Theme is applied first so visual updates happen immediately for the full app shell.
    applyTheme(nextSettings.general.theme);

    linkedInputs.inventoryView.value = nextSettings.inventory.viewMode;
    emitInput(linkedInputs.inventoryView);

    linkedInputs.inventorySort.value = nextSettings.inventory.sortOrder;
    emitInput(linkedInputs.inventorySort);

    linkedInputs.expandedColumns.checked = nextSettings.inventory.expandedColumns;
    emitInput(linkedInputs.expandedColumns);

    linkedInputs.mealPlanWeekStart.value = nextSettings.planner.weekStart || new Date().toISOString().slice(0, 10);
    emitInput(linkedInputs.mealPlanWeekStart);

    // Broadcast a normalized payload so any panel (including reports) can react.
    window.dispatchEvent(new CustomEvent('app:settings-updated', { detail: structuredClone(nextSettings) }));

    if (options.navigateToStartPanel) {
      options.showPanel?.(nextSettings.general.startPanel);
    }
  }

  function notifySettingsUpdated() {
    state.onSettingsUpdatedHandlers.forEach((handler) => handler(state.settings));
  }

  function openDialog() {
    renderFormFromState();
    setFeedback('Update your defaults and save to persist them across sync/export.', 'info');
    dialog.showModal();
  }

  function closeDialog() {
    dialog.close();
  }

  function readFormSettings() {
    return normalizeSettings({
      general: {
        theme: fields.theme.value,
        currency: fields.currency.value,
        startPanel: fields.startPanel.value,
      },
      inventory: {
        viewMode: fields.inventoryView.value,
        sortOrder: fields.inventorySort.value,
        expandedColumns: fields.expandedColumns.checked,
      },
      planner: {
        weekStart: fields.mealPlanWeekStart.value,
      },
      nutritionTargets: {
        calories: fields.targetCalories.value,
        protein: fields.targetProtein.value,
        carbs: fields.targetCarbs.value,
        fats: fields.targetFats.value,
      },
    });
  }

  openButton?.addEventListener('click', openDialog);
  closeButton?.addEventListener('click', closeDialog);
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeDialog();
    }
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const normalized = readFormSettings();
    state.settings = normalized;
    applySettings(normalized, { showPanel: options.showPanel, navigateToStartPanel: true });
    notifySettingsUpdated();
    setFeedback('Settings saved. Changes are applied immediately and included in sync.', 'success');
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Settings saved.' } }));
  });

  resetButton?.addEventListener('click', () => {
    state.settings = structuredClone(DEFAULT_SETTINGS);
    applySettings(state.settings, { showPanel: options.showPanel, navigateToStartPanel: false });
    renderFormFromState();
    notifySettingsUpdated();
    setFeedback('Defaults restored. Save/export to propagate to other devices.', 'info');
  });

  // Apply defaults immediately so linked controls are deterministic.
  applySettings(state.settings, { showPanel: options.showPanel, navigateToStartPanel: false });

  return {
    get settings() {
      return state.settings;
    },
    set onSettingsUpdated(handler) {
      if (typeof handler === 'function') {
        state.onSettingsUpdatedHandlers.push(handler);
      }
    },
    /**
     * Replace settings from persisted/synced state.
     * @param {Record<string, any>} incoming
     */
    replaceSettings(incoming) {
      state.settings = normalizeSettings(incoming);
      applySettings(state.settings, { showPanel: options.showPanel, navigateToStartPanel: true });
      renderFormFromState();
      setFeedback('Settings restored from persisted data.', 'info');
    },
  };
}

export { DEFAULT_SETTINGS };
