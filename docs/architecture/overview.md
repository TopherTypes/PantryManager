# Architecture Overview (Draft)

## Purpose

Define an initial architecture direction for PantryManager as a static web app hosted on GitHub Pages.

## Proposed high-level components

1. **Presentation layer** (HTML/CSS/JS)
   - Inventory, recipes, recommendations, planner, shopping list, barcode workflows.
2. **Domain logic layer** (JS modules)
   - Inventory math, recipe matching, weekly plan aggregation, shopping list computation.
3. **Persistence layer** (browser)
   - Local storage or IndexedDB for local-first persistence.
4. **Integration adapters** (public APIs)
   - Barcode lookup and optional nutritional enrichment.

## Data flow (initial)

- User actions update in-memory state.
- State changes are persisted to browser storage.
- Recommendation and planning engines derive computed views from core entities.
- External barcode lookups are called only when needed and then mapped into internal models.

## Non-functional priorities

- Offline usability for core local operations.
- Explainable recommendation outputs.
- Robust input validation for units and dates.
- Fast page load on static hosting.

## Ambiguities / decisions pending

Resolved in ADR 0002:

- **Sync strategy**: single-user with Google Drive-backed sync/import-export.
- **Barcode provider abstraction**: adapter-based pluggable providers with local-first lookup.
- **Nutrition schema depth**: MVP minimum fields are calories, protein, carbs, sugars, fats.

Still pending:

- **Storage choice**: localStorage vs IndexedDB (to be selected during implementation design).
