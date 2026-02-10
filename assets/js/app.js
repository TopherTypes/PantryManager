import { initializeInventoryController } from './controllers/inventoryController.js';
import { initializeBarcodeController } from './controllers/barcodeController.js';
import { initializeRecipeController } from './controllers/recipeController.js';
import { initializePlannerController } from './controllers/plannerController.js';

/**
 * PantryManager bootstrap entrypoint.
 *
 * The root module owns only orchestration/wiring so feature controllers remain
 * independently testable and easier to evolve.
 */
(function bootstrapPantryManager() {
  const navButtons = document.querySelectorAll('.app-nav button[data-target]');
  const panels = document.querySelectorAll('.panel');

  /**
   * Render active navigation/panel state.
   * @param {string} targetId - Panel ID to make active.
   */
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

  const inventoryController = initializeInventoryController();
  initializeBarcodeController(inventoryController);
  const recipeController = initializeRecipeController(inventoryController);
  initializePlannerController(inventoryController, recipeController);
})();
