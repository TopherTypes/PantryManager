# MVP Scope and Open Questions

## MVP capabilities

### 1) Inventory management
- Add/edit/delete products.
- Store quantity, unit, purchase price, expiry date, and optional nutrition fields.
- Search and filter by product name, expiry date, and category.

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
- If unknown, query a public barcode database and allow user confirmation before import.
- Support provider fallback behavior through adapter abstraction.

### 7) Data and sync model
- Single-user product scope.
- Cross-device continuity via Google Drive-backed sync/import-export.

### 8) Data lifecycle and retention
- Archive most data for 30 days before deletion.
- Retain pricing data for 12 months.

## Nutrition scope for MVP

Required nutrition fields:
- Calories
- Protein
- Carbs
- Sugars
- Fats

## Out of scope for initial MVP

- Multi-user collaboration.
- Full authentication and role management.
- Native mobile packaging.
- Advanced AI meal optimization.
- Leftovers support.

## Deferred decisions

- Batch cooking workflows are deferred to future development.

## Clarification tracking

Finalized ambiguity decisions and architecture-impact linkage are tracked in `docs/product-requirements/clarifications.md`.
