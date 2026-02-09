# Architecture Overview (Draft)

## Purpose

Define an initial architecture direction for PantryManager as a static web app hosted on GitHub Pages, aligned with accepted MVP scope clarifications and the canonical data model.

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
- Robust input validation for units and dates, including custom-unit conversion linkage where applicable.
- Fast page load on static hosting.

## Decision alignment status

Finalized decisions from ADR 0002 and clarifications are in effect:

- **Sync strategy**: single-user with Google Drive-backed sync/import-export.
- **Barcode provider abstraction**: adapter-based pluggable providers with local-first lookup.
- **Nutrition schema depth**: MVP minimum fields are calories, protein, carbs, sugars, fats, and nutrition is mandatory for inventory records.
- **Unit conversion policy**: canonical unit families with conversion support; unknown units require custom-unit creation before use.
- **Retention policy**: 30-day archive window for most data and 12-month pricing retention.
- **Barcode validation policy**: barcode verification is not required for accepting barcode values.

Canonical entity contracts, field naming, and relationships are specified in `docs/architecture/data-model.md`.

Implementation design decision still pending:

- **Storage technology selection**: localStorage vs IndexedDB.
