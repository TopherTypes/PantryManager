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

- **Storage choice**: localStorage vs IndexedDB.
- **Sync strategy**: no sync vs optional cloud export/import.
- **Barcode provider abstraction**: single provider vs pluggable providers.
- **Nutrition schema depth**: macros only vs full nutrient panel.
