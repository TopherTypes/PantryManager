# MVP Clarifications Log

This document captures finalized decisions for all implementation-blocking ambiguities listed in `mvp-scope.md`.

## Decision response format (recorded)

Each ambiguity is resolved using:

- **Decision**
- **Rationale**
- **Owner**
- **Target date**

## Finalized decisions

| ID | Topic | Decision | Rationale | Owner | Target date | Status |
|---|---|---|---|---|---|---|
| Q1 | Identity and accounts | MVP is **single user**. Cross-device continuity will be enabled via **Google Drive-backed sync/import-export** for that same user. | User wants personal-only usage with cross-device access. | Product (User) | 2026-02-09 | Finalized |
| Q2 | Barcode integrations | Use local product matching first, then public barcode data sources. Candidate public providers/libraries identified: **Open Food Facts API** (open food catalog), **UPCitemdb API** (UPC lookup), **Barcode Lookup API** (commercial catalog), plus scanner libraries **ZXing-JS** and **QuaggaJS** for client-side barcode capture. | Meets requirement to identify public options while supporting staged provider adoption and client-side scanning. | Product (User) | 2026-02-09 | Finalized |
| Q3 | Units and conversions | Support **variable units** with conversions between inventory and recipe units via canonical unit families (mass, volume, count) and product-specific overrides where needed. | Recipe/inventory matching requires flexible conversions rather than a fixed narrow unit set. | Product (User) | 2026-02-09 | Finalized |
| Q4 | Nutrition requirements | MVP nutrition fields: **calories, protein, carbs, sugars, fats**. | Provides practical minimum macro-oriented nutrition view for MVP. | Product (User) | 2026-02-09 | Finalized |
| Q5 | Recommendation ranking | Support multiple ranking views, with **expiry urgency as primary ranking for meal recommendation**. | Reduces food waste while allowing future specialized ranking views. | Product (User) | 2026-02-09 | Finalized |
| Q6 | Meal plan complexity | Include **portion multipliers**. Exclude leftovers from MVP. **Batch cooking deferred** to future development. | Keeps planning usable now while limiting complexity. | Product (User) | 2026-02-09 | Finalized (with partial deferment) |
| Q7 | Shopping list grouping | Group by **store location/section** using a **generic functional taxonomy**. | Reflects real shopping flow without overfitting to a specific retailer. | Product (User) | 2026-02-09 | Finalized |
| Q8 | Data lifecycle | Archived data retained **30 days**, then deleted; **pricing data retained 12 months**. | Balances storage hygiene with longer-term price trend usefulness. | Product (User) | 2026-02-09 | Finalized |

## Architecture-impacting outcomes and ADR linkage

The following finalized decisions are architecture-impacting and are formalized in `docs/decisions/adr-0002-mvp-data-sync-and-domain-policies.md`:

- Q1: Single-user model plus Google Drive sync approach.
- Q2: Barcode provider adapter strategy and fallback sequence.
- Q3: Unit-family canonicalization and conversion policy direction.
- Q8: Retention windows and purge behavior.

## Ambiguity closure verification

All eight previously open ambiguities (Q1–Q8) now have either:

- a concrete finalized decision, or
- an explicit scoped deferment (Q6 batch-cooking only).

No ambiguity remains unclassified.

## Conflict check against existing architecture and ADR claims

- No conflicts with `ADR 0001` (static frontend foundation). The new decisions are compatible with a static web app.
- Constraint note: Google Drive sync implies Google API integration and user authorization flow, but this does **not** conflict with “no full authentication/role management” because the app remains single-user and does not introduce multi-user account roles.
