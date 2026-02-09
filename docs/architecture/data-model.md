# Data Model Specification (MVP)

## Purpose

Define canonical MVP entities, field contracts, relationship rules, and validation constraints for PantryManager. This specification aligns seed data, product requirements, and architecture guidance.

## Canonical conventions (confirmed)

The following conventions are confirmed and form the canonical schema baseline:

1. **Required vs optional**
   - Required fields are explicitly marked in each entity table below.
   - Optional fields may be absent or `null`.
2. **Units and nutrition basis**
   - Inventory and recipe quantities use unit-family-aware units (`mass`, `volume`, `count`).
   - Units must already exist in the app dictionary, or a custom unit must be created with conversion relationships where feasible.
   - Nutrition values are normalized as **per 100g/ml equivalent** where applicable and represented using explicit `Per100` field names.
3. **ID format**
   - IDs are stable, lowercase, and prefixed by entity (`item_`, `recipe_`, `plan_`, `shop_`).
   - Pattern: `^[a-z]+_[a-z0-9_]+_[0-9]{3,}$`.
4. **Date and time**
   - Date-only values use `YYYY-MM-DD`.
   - Date-time values use UTC ISO-8601 (`YYYY-MM-DDTHH:mm:ssZ`).
5. **Validation shape**
   - `quantity > 0` for stock and ingredient usage.
   - `price >= 0`.
   - Enum-constrained values for unit and shopping taxonomy fields.
   - Barcode verification is not required for accepting a barcode value.

## Entity specifications

### 1) Seed metadata

| Field | Type | Required | Constraints | Notes |
|---|---|---:|---|---|
| `version` | string | Yes | Semver-like string | Schema/data contract version. |
| `description` | string | No | non-empty if present | Human-readable note. |
| `generatedAt` | datetime | No | ISO-8601 UTC | Optional provenance timestamp. |

### 2) Inventory item

| Field | Type | Required | Constraints | Notes |
|---|---|---:|---|---|
| `id` | string | Yes | ID pattern, unique | Primary key. |
| `name` | string | Yes | 1..120 chars | Display label. |
| `quantity` | number | Yes | `> 0` | On-hand amount. |
| `unit` | string | Yes | canonical unit enum | Must align to unit family. |
| `price` | number | Yes | `>= 0` | Current purchase price. |
| `currency` | string | No | ISO-4217 uppercase | Deprecated at item-level; app-global default is used. |
| `expiryDate` | date | No | `YYYY-MM-DD` | Optional for non-perishables. |
| `barcode` | string | No | digits plus provider-safe characters | Used for local-first lookup. |
| `category` | string | No | taxonomy value | Needed for inventory filtering in MVP requirements. |
| `nutrition` | object | Yes | see nested contract | Mandatory nutrition profile. |
| `createdAt` | datetime | No | ISO-8601 UTC | Audit field. |
| `updatedAt` | datetime | No | ISO-8601 UTC | Audit field. |
| `archivedAt` | datetime | No | ISO-8601 UTC | Retention lifecycle anchor. |

#### `nutrition` sub-object

| Field | Type | Required | Constraints |
|---|---|---:|---|
| `caloriesPer100` | number | Yes (if nutrition exists) | `>= 0` |
| `proteinPer100` | number | Yes (if nutrition exists) | `>= 0` |
| `carbsPer100` | number | Yes (if nutrition exists) | `>= 0` |
| `sugarsPer100` | number | Yes (if nutrition exists) | `>= 0` |
| `fatsPer100` | number | Yes (if nutrition exists) | `>= 0` |

### 3) Recipe

| Field | Type | Required | Constraints | Notes |
|---|---|---:|---|---|
| `id` | string | Yes | ID pattern, unique | Primary key. |
| `name` | string | Yes | 1..120 chars | Recipe title. |
| `servings` | number | Yes | integer `>= 1` | Base servings. |
| `ingredients` | array | Yes | at least 1 | Ingredient list. |
| `preparationNotes` | string | No | free text | Optional MVP notes. |
| `createdAt` | datetime | No | ISO-8601 UTC | Audit field. |
| `updatedAt` | datetime | No | ISO-8601 UTC | Audit field. |

#### Recipe ingredient

| Field | Type | Required | Constraints | Notes |
|---|---|---:|---|---|
| `inventoryItemId` | string | Yes | FK -> `inventory.id` | Required; recipes use inventory-linked ingredients only in MVP. |
| `quantity` | number | Yes | `> 0` | Quantity per base serving definition. |
| `unit` | string | Yes | canonical unit enum | Unit conversion applies in matching. |

### 4) Meal plan entry

| Field | Type | Required | Constraints | Notes |
|---|---|---:|---|---|
| `id` | string | Yes | ID pattern, unique | Primary key. |
| `date` | date | Yes | `YYYY-MM-DD` | Planning day. |
| `slot` | string | Yes | enum (`breakfast`,`lunch`,`dinner`,`snack`) | Weekly slot assignment. |
| `recipeId` | string | Yes | FK -> `recipes.id` | Planned recipe. |
| `portionMultiplier` | number | Yes | `> 0` | MVP-supported scaling. |
| `notes` | string | No | free text | Optional override notes. |

### 5) Shopping list item

| Field | Type | Required | Constraints | Notes |
|---|---|---:|---|---|
| `id` | string | Yes | ID pattern, unique | Primary key. |
| `ingredientName` | string | Yes | non-empty | Display name. |
| `inventoryItemId` | string | No | FK -> `inventory.id` | Present when mapped to known product. |
| `requiredQuantity` | number | Yes | `> 0` | Planned demand. |
| `availableQuantity` | number | Yes | `>= 0` | Current stock baseline. |
| `missingQuantity` | number | Yes | `>= 0` | Computed shortfall. |
| `unit` | string | Yes | canonical unit enum | Shared unit for quantity fields. |
| `storeSection` | string | No | taxonomy enum/string | Grouping key for MVP shopping flow. |
| `sourceMealPlanEntryIds` | array[string] | No | FK list | Traceability to plan rows. |

### 6) Price history record (retention-critical)

| Field | Type | Required | Constraints | Notes |
|---|---|---:|---|---|
| `id` | string | Yes | unique | Primary key. |
| `inventoryItemId` | string | Yes | FK -> `inventory.id` | Related product. |
| `price` | number | Yes | `>= 0` | Recorded unit price snapshot. |
| `currency` | string | No | ISO-4217 | Optional override; app-global default currency is `GBP` (`£`). |
| `recordedAt` | datetime | Yes | ISO-8601 UTC | Retained for 12 months. |

## Relationships

- `recipes.ingredients[].inventoryItemId` references `inventory.id` and is required.
- `mealPlan[].recipeId` references `recipes.id`.
- `shoppingList[].inventoryItemId` optionally references `inventory.id`.
- `shoppingList[].sourceMealPlanEntryIds[]` references `mealPlan.id`.
- `priceHistory[].inventoryItemId` references `inventory.id`.

## Coverage verification against MVP + seed data

### Represented in `data/seed.example.json`

- `metadata`, `inventory`, `recipes`, `mealPlan`, and `shoppingList` are all modeled.
- Existing seed nutrition fields (`caloriesPer100`, `proteinPer100`, `carbsPer100`) are retained and extended with mandatory MVP fields (`sugarsPer100`, `fatsPer100`).
- Seed ingredient linkage via `inventoryItemId` is preserved.

### Represented in MVP requirements

- Inventory filters by `name`, `expiryDate`, and `category` are supported.
- Recipe notes and per-serving ingredient quantities are supported.
- Weekly planning and portion multipliers are supported through `mealPlan` entries.
- Shopping list grouping by store section is supported with `storeSection`.
- Barcode workflows are supported with optional `barcode` on inventory items, without hard validation dependency on external barcode verification.
- Retention policy is represented through `archivedAt` and `priceHistory.recordedAt` windows.

## Known cross-document conflicts resolved by this spec

1. **Nutrition field naming mismatch**
   - Requirement docs list generic macros (`fats`), while seed data used `fatPer100` and omitted sugars.
   - Canonical choice: `fatsPer100` and `sugarsPer100` in nutrition object.
2. **MVP ambiguity status mismatch**
   - README listed multiple ambiguities as open although clarifications/ADR finalized them.
   - Canonical choice: mark those areas as resolved and link to clarifications + ADR.
3. **Architecture pending-state mismatch**
   - Architecture overview listed nutrition depth as pending, but ADR 0002 marks it accepted.
   - Canonical choice: remove pending status and reference accepted schema.

## Finalized schema decisions (from product-owner confirmations)

1. Nutrition is mandatory for inventory items.
2. Price is mandatory.
3. ID prefix policy is accepted.
4. Date/time policy is accepted (`YYYY-MM-DD` for date-only, UTC ISO-8601 for timestamps).
5. Nutrition values remain per-100.
6. Free-form recipe ingredients are out of MVP; ingredients must reference inventory items.
7. Currency is app-global with default `GBP` (`£`).
8. Decimal values are allowed for all numeric fields.
9. Units must be pre-defined or explicitly created as custom units with conversion relationships where possible; barcode verification is not required.
