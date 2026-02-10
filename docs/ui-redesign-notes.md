# UI Redesign Notes

## What changed and why
- Replaced the previous tab-row navigation with a responsive app shell: sticky top bar, desktop sidebar, and mobile bottom navigation with a More menu.
- Converted Inventory into a workspace model with:
  - Header actions (Add item, Scan barcode, Import placeholder).
  - KPI summary cards (expiring soon, low stock heuristic, pantry value).
  - Compact toolbar (search, quick chips, more filters panel, sort, view toggle).
  - Table/cards view with better hierarchy and lower visual noise.
- Removed the permanent Add Product panel and moved add/edit into a modal dialog.
- Added an item details drawer (desktop right drawer, full-width sheet behavior on mobile) for barcode/nutrition-heavy fields.
- Added bulk selection and bulk actions (bulk delete, bulk set category).
- Added shared toast/snackbar behavior for non-intrusive status messages.
- Added perceived loading affordances for recommendations, meal plan generation, and barcode lookup.

## Front-end architecture refactors
- Kept domain logic and data model unchanged.
- Updated `app.js` shell orchestration for multi-surface nav + toast events.
- Refactored inventory controller into smaller named rendering and state-update functions (workspace rendering, summary rendering, drawer rendering, save handler, row action handler).
- Preserved existing controller contracts used by barcode/recipe/planner/sync workflows.

## Design system extension points
- Core tokens are in `:root` in `assets/css/styles.css`:
  - spacing (`--space-*`)
  - radii (`--radius-*`)
  - shadows (`--shadow-*`)
  - semantic colors (`--accent`, `--muted`, `--danger`)
- To extend visual consistency, add component-level classes and consume only token values.

## Data model / storage / migration impact
- No data schema changes.
- No storage key changes (`app-state`, `sync-envelope`, `device-id` unchanged).
- No migration step required.
