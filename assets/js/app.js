import { initializeInventoryController } from './controllers/inventoryController.js';
import { initializeBarcodeController } from './controllers/barcodeController.js';
import { initializeRecipeController } from './controllers/recipeController.js';
import { initializePlannerController } from './controllers/plannerController.js';
import { initializeSyncController } from './controllers/syncController.js';
import { initializeSettingsController } from './controllers/settingsController.js';

/**
 * PantryManager bootstrap entrypoint.
 * The root module wires shell navigation and cross-feature orchestration.
 */
(function bootstrapPantryManager() {
  const navButtons = document.querySelectorAll('[data-target]');
  const panels = document.querySelectorAll('.panel');
  const globalSearch = document.getElementById('global-search');
  const moreToggle = document.getElementById('bottom-nav-more');
  const mobileMenuToggle = document.getElementById('mobile-more-toggle');
  const mobileMoreMenu = document.getElementById('mobile-more-menu');
  const toastRegion = document.getElementById('toast-region');

  /**
   * Render currently active panel and active nav styles in every nav surface.
   * @param {string} targetId - Panel ID to activate.
   */
  function showPanel(targetId) {
    panels.forEach((panel) => panel.classList.toggle('is-active', panel.id === targetId));
    navButtons.forEach((button) => {
      const isActive = button.getAttribute('data-target') === targetId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    mobileMoreMenu.hidden = true;
    if (mobileMenuToggle) {
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Lightweight app-wide toast utility for user feedback.
   * @param {{message: string}} detail
   */
  function pushToast({ message }) {
    if (!message || !toastRegion) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastRegion.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  navButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      if (targetId) showPanel(targetId);
    });
    if (index === 0 && button.getAttribute('data-target') === 'inventory') {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'page');
    }
  });

  moreToggle?.addEventListener('click', () => {
    mobileMoreMenu.hidden = !mobileMoreMenu.hidden;
  });

  mobileMenuToggle?.addEventListener('click', () => {
    const nextExpanded = mobileMenuToggle.getAttribute('aria-expanded') !== 'true';
    mobileMenuToggle.setAttribute('aria-expanded', String(nextExpanded));
    mobileMoreMenu.hidden = !nextExpanded;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== globalSearch) {
      event.preventDefault();
      globalSearch?.focus();
    }
  });

  window.addEventListener('app:toast', (event) => {
    pushToast(event.detail || {});
  });

  const inventoryController = initializeInventoryController({ showPanel });
  initializeBarcodeController(inventoryController);
  const recipeController = initializeRecipeController(inventoryController);
  const plannerController = initializePlannerController(inventoryController, recipeController);
  const settingsController = initializeSettingsController({ showPanel });
  initializeSyncController(inventoryController, recipeController, plannerController, settingsController);
})();
