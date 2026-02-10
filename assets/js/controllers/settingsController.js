/**
 * Canonical defaults for user-configurable settings.
 *
 * These defaults are intentionally aligned with the UI's existing initial values
 * so first-run behavior remains unchanged until a user explicitly saves preferences.
 */
const DEFAULT_SETTINGS = Object.freeze({
  general: {
    theme: 'light',
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
});

/**
 * Supported theme identifiers accepted by the settings payload.
 * Keeping this central avoids accidental drift between form values and runtime checks.
 */
const THEME_OPTIONS = Object.freeze(new Set(['light', 'dark']));

/**
 * Apply the selected theme mode by writing a data attribute at the document root.
 * @param {'light' | 'dark'} themeMode
 */
function applyTheme(themeMode) {
  if (!document?.documentElement) return;
  document.documentElement.dataset.theme = themeMode;
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
    startPanel: document.getElementById('setting-start-panel'),
    inventoryView: document.getElementById('setting-inventory-view'),
    inventorySort: document.getElementById('setting-inventory-sort'),
    expandedColumns: document.getElementById('setting-expanded-columns'),
    mealPlanWeekStart: document.getElementById('setting-meal-plan-week-start'),
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
   * @returns {{general: {theme: 'light' | 'dark', startPanel: string}, inventory: {viewMode: string, sortOrder: string, expandedColumns: boolean}, planner: {weekStart: string}}}
   */
  function normalizeSettings(incoming) {
    const source = incoming && typeof incoming === 'object' ? incoming : {};
    return {
      general: {
        theme: normalizeTheme(source.general?.theme),
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
    };
  }

  /**
   * Sync current in-memory settings into modal inputs.
   */
  function renderFormFromState() {
    fields.theme.value = state.settings.general.theme;
    fields.startPanel.value = state.settings.general.startPanel;
    fields.inventoryView.value = state.settings.inventory.viewMode;
    fields.inventorySort.value = state.settings.inventory.sortOrder;
    fields.expandedColumns.checked = state.settings.inventory.expandedColumns;
    fields.mealPlanWeekStart.value = state.settings.planner.weekStart;
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
   * @param {{general: {theme: 'light' | 'dark', startPanel: string}, inventory: {viewMode: string, sortOrder: string, expandedColumns: boolean}, planner: {weekStart: string}}} nextSettings
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
