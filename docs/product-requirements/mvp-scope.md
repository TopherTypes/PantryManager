# MVP Scope

## MVP capabilities

### 1) Inventory management
- Add/edit/delete products.
- Store quantity, unit, mandatory purchase price, expiry date, category, and mandatory nutrition fields.
- Search and filter by product name, expiry date, and category.
- Require app-defined units or explicit custom-unit creation with conversion relationships where feasible.

### 2) Recipe management
- Add/edit/delete recipes.
- Define ingredients per recipe with quantity/unit per serving.
- Store optional preparation notes.

### 3) Recommendation engine (basic)
- Suggest recipes where all ingredients are present.
- Provide "missing ingredients" list when a recipe is not fully satisfiable.
- Meal recommendation ranking prioritizes expiry urgency.

### 4) Weekly meal planning
- Assign recipes to weekly slots.
- Calculate ingredient requirements for all planned meals.
- Support portion multipliers.

### 5) Shopping list generation
- Compare planned ingredient requirements against inventory.
- Generate list of missing quantities.
- Group shopping items by store location/section using a generic functional taxonomy.

### 6) Barcode-assisted updates
- Match scanned barcode to known local products first.
- If unknown, query Open Food Facts through an adapter contract and require user confirmation before import.
- Retry provider lookup up to 3 times for transient failures before falling back to manual entry.
- Accept barcode values without requiring external barcode verification to pass validation.

### 7) Data and sync model
- Single-user product scope.
- Cross-device continuity via Google Drive-backed sync/import-export.

### 8) Data lifecycle and retention
- Archive most data for 30 days before deletion.
- Retain pricing data for 12 months.


## Barcode integration behavior contract (MVP)

### Functional flow

1. User scans or enters a barcode.
2. App attempts local barcode match first.
3. If local match is not found, app calls Open Food Facts through adapter abstraction.
4. On transient failures, app retries lookup up to 3 times before routing to manual entry.
5. App displays a prefilled draft and requires explicit user confirmation before save.

### Provider response mapping requirements

Adapters must map provider payloads into the PantryManager canonical draft fields:

- `barcode`
- `name`
- `brand` (optional)
- `quantity` + `unit` (optional)
- `category` (optional)
- `caloriesPer100`, `proteinPer100`, `carbsPer100`, `sugarsPer100`, `fatsPer100`

If any required nutrition field is missing, the app must require manual completion before save.

### Failure-state behavior

- Timeout/network failure: retry up to 3 times, then continue with manual entry.
- Quota/rate-limit response: continue with manual entry and show explanatory messaging.
- Not-found response: show “No provider match” and continue with manual entry.
- Malformed provider payload: discard payload and continue with manual entry.
- Offline mode: warn the user, skip provider calls, and continue with local match/manual entry.

### Non-functional integration constraints (confirmed)

- Open Food Facts is the approved provider API for MVP.
- Barcode scanning is hardware-handled; no dedicated barcode reader API integration is required.
- Timeout/retry policy is fixed at 3 retry attempts for transient failures.
- Offline fallback is local-only lookup plus manual entry.
- Data privacy requirements remain applicable to outbound requests and telemetry/logging.

## Nutrition scope for MVP

Required nutrition fields:
- caloriesPer100
- proteinPer100
- carbsPer100
- sugarsPer100
- fatsPer100

## Out of scope for initial MVP

- Multi-user collaboration.
- Full authentication and role management.
- Native mobile packaging.
- Advanced AI meal optimization.
- Leftovers support.

## Deferred decisions

- Batch cooking workflows are deferred to future development.

## Clarification and data-model tracking

Finalized ambiguity decisions and architecture-impact linkage are tracked in `docs/product-requirements/clarifications.md` and ADR 0002.

Canonical entity definitions, constraints, and relationships are tracked in `docs/architecture/data-model.md`.
