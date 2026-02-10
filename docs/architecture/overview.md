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
5. **Platform services** (sync + lifecycle)
   - Google Drive sync/import/export client with conflict resolution and payload migration.
   - Retention-policy job engine for archival/deletion windows.

## Data flow (initial)

- User actions update in-memory state.
- State changes are persisted to browser storage.
- Recommendation and planning engines derive computed views from core entities.
- External barcode lookups are called only when needed and then mapped into internal models.


## Sync and lifecycle policy implementation notes

### Google Drive sync/import/export path

- The MVP sync path writes a single envelope into Google Drive `appDataFolder` scoped to the single user.
- Sync records store `exportedAtUtc` in ISO UTC to avoid local-time-zone ordering ambiguity.
- Conflict resolution compares local and remote snapshots using a drift tolerance window.
  - If timestamps are effectively equal (within tolerance), local state wins deterministic tie-break.
  - If one snapshot is clearly newer, newest snapshot wins.
- Payload migration is versioned to handle older envelope formats during import.

### Retention jobs and windows

- Non-pricing data is archived after 30 days of inactivity.
- Archived non-pricing data is deleted after a 30-day archive window.
- Pricing history is retained for 12 months, then deleted.
- Retention job comparisons normalize date-only values to UTC midnight to reduce time-zone drift.

## Non-functional priorities

- Offline usability for core local operations.
- Explainable recommendation outputs.
- Robust input validation for units and dates, including custom-unit conversion linkage where applicable.
- Fast page load on static hosting.

## Decision alignment status

Finalized decisions from ADR 0002 and clarifications are in effect:

- **Sync strategy**: single-user with Google Drive-backed sync/import-export.
- **Barcode provider abstraction**: adapter boundary retained with Open Food Facts as the MVP provider and local-first lookup.
- **Nutrition schema depth**: MVP minimum fields are calories, protein, carbs, sugars, fats, and nutrition is mandatory for inventory records.
- **Unit conversion policy**: canonical unit families with conversion support; unknown units require custom-unit creation before use.
- **Retention policy**: 30-day archive window for most data and 12-month pricing retention.
- **Barcode validation policy**: barcode verification is not required for accepting barcode values.

Canonical entity contracts, field naming, and relationships are specified in `docs/architecture/data-model.md`.

## Barcode product lookup contract

### Adapter boundary

- Domain logic calls a provider-agnostic `BarcodeLookupAdapter` interface for unknown barcodes.
- Open Food Facts is the configured MVP provider implementation behind that adapter.
- Barcode scan input is supplied by hardware; no dedicated barcode reader API integration is required.
- Provider adapters normalize provider-specific payloads and errors into a canonical response model.

### Canonical mapped response

Adapters map provider responses into these MVP fields before UI presentation:

- `barcode`
- `name`
- `brand` (optional)
- `quantity` + `unit` (optional when not parseable)
- `category` (optional)
- `nutrition.caloriesPer100`
- `nutrition.proteinPer100`
- `nutrition.carbsPer100`
- `nutrition.sugarsPer100`
- `nutrition.fatsPer100`

### User confirmation and save rules

- Provider lookup results are always treated as a draft until user confirmation.
- Users can edit mapped values before save.
- Save is blocked if mandatory MVP nutrition fields remain missing after mapping.
- Barcode value acceptance does not require successful external verification.

### Failure and resilience states

- **Timeout/network error**: retry up to 3 times; if still failing, route to manual entry with explanatory message.
- **Rate-limited/quota exceeded**: route directly to manual entry with explanatory message.
- **Provider not found**: show “No provider match” and route to manual entry.
- **Malformed payload**: mark provider response invalid, log client-side diagnostic event, and route to manual entry.
- **Offline state**: warn the user, skip provider call, and use local-match/manual-entry flow only.

### Confirmed integration decisions

- Open Food Facts is the approved barcode lookup API for MVP.
- Retry policy is fixed at 3 attempts for transient errors.
- Offline flow must warn users and run local-only barcode matching.
- Dedicated barcode reader API integration is out of scope because scanning is hardware-handled.
- Data privacy constraints for outbound barcode requests and client-side logs remain applicable.

Implementation design decision still pending:

- **Storage technology selection**: localStorage vs IndexedDB.

## Front-end module wiring

The runtime uses ES modules end-to-end from the HTML bootstrap.

- `index.html` loads `assets/js/app.js` via `<script type="module">`.
- `assets/js/app.js` only performs orchestration and feature-controller wiring.
- Feature controllers are split by UI concern under `assets/js/controllers/`:
  - `inventoryController.js`
  - `recipeController.js`
  - `barcodeController.js`
  - `plannerController.js`
- Controllers own DOM reads/writes, event handlers, and rendering concerns only.
- Business rules are delegated to `assets/js/domain/*.js` modules.
- Canonical input validation is delegated to `assets/js/validation/validators.js` (+ constraints).

### Dependency direction

To prevent domain/UI coupling, dependencies flow in one direction:

1. **Bootstrap** imports controllers and wires cross-controller collaboration.
2. **Controllers** import pure domain + validation modules.
3. **Domain/validation modules** never import controller modules.

This keeps browser-specific logic at the edge and enables unit testing of business rules without DOM setup.
