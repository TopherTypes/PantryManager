/**
 * Wireframe-level panel navigation.
 *
 * This script keeps interaction intentionally lightweight so the project can
 * validate information architecture before feature-level implementation.
 */
(function initializeWireframeNavigation() {
  const navButtons = document.querySelectorAll('.app-nav button[data-target]');
  const panels = document.querySelectorAll('.panel');

  /**
   * Activate a panel by ID and update button active states.
   * @param {string} targetId - ID of panel section to show.
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

    // Mark first button as default selection for better initial affordance.
    if (index === 0) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'page');
    }
  });
})();
