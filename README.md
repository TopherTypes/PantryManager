# PantryManager

PantryManager is a GitHub Pages-hosted HTML web app for managing kitchen inventory, recipes, meal plans, and barcode-assisted product updates.

## Project status

> 🚧 **Scaffolding phase**: This repository currently contains the initial project structure, wireframe UI, and planning documentation.

## Goals

- Track food products in the kitchen, including quantities, mandatory prices, expiry dates, and mandatory nutritional information.
- Maintain recipes with ingredient requirements.
- Recommend recipes based on currently available ingredients.
- Organize weekly meal plans and generate shopping lists to fill ingredient gaps.
- Streamline updates through barcode scanning for known items.
- Integrate with Open Food Facts barcode product lookups for unknown items.

## Tech direction (initial)

- **Hosting**: GitHub Pages
- **Frontend**: Semantic HTML, CSS, and vanilla JavaScript
- **Data persistence (candidate)**: Browser local storage (short-term), optional future cloud sync
- **Barcode integration**: Open Food Facts product lookup API + hardware-provided barcode scanning

## Repository structure

```text
.
├── index.html                      # Initial wireframe UI
├── assets/
│   ├── css/
│   │   └── styles.css              # Shared app styles
│   ├── js/
│   │   └── app.js                  # Wireframe-level app interactions
│   └── images/                     # Static image assets (future)
├── data/
│   └── seed.example.json           # Example seed data shape
├── docs/
│   ├── architecture/
│   │   ├── overview.md             # System architecture draft
│   │   └── data-model.md           # Canonical MVP entity and field contract
│   ├── product-requirements/
│   │   ├── mvp-scope.md            # MVP scope
│   │   └── clarifications.md       # Finalized requirement decisions
│   └── decisions/
│       ├── adr-0001-frontend-foundation.md
│       └── adr-0002-mvp-data-sync-and-domain-policies.md
└── .github/
    └── workflows/
        └── pages.yml               # GitHub Pages deployment workflow
```

## Requirements and model decision status

Previously open MVP ambiguities are now finalized in `docs/product-requirements/clarifications.md` and ADR 0002.

Canonical field naming, validation constraints, and entity relationships are defined in `docs/architecture/data-model.md`.

Remaining implementation detail decisions should be tracked as ADRs if they materially affect architecture.

## Barcode product lookup integration contract (MVP)

PantryManager uses a **barcode product lookup adapter** contract with Open Food Facts as the MVP provider, so provider-specific behavior stays isolated from domain logic.

- **Lookup flow**
  1. Scan barcode.
  2. Attempt local product match by barcode first.
  3. If no local match, call the Open Food Facts provider adapter.
  4. Retry up to 3 times for transient lookup failures before switching to manual entry.
  5. Display mapped product preview and require user confirmation before creating/updating inventory.
- **Mapped fields (provider payload → PantryManager product draft)**
  - `barcode`
  - `name`
  - `brand` (optional)
  - `quantity` + `unit` (if parseable)
  - `category` (optional)
  - nutrition: `caloriesPer100`, `proteinPer100`, `carbsPer100`, `sugarsPer100`, `fatsPer100`
- **Failure handling**
  - Timeout/retry failures trigger up to 3 retries, then surface a non-blocking message and allow manual entry.
  - Not-found responses surface “No provider match” and allow manual entry.
  - Invalid/incomplete nutrition mapping requires manual completion before save (nutrition is mandatory in MVP).
  - Offline state warns the user, skips external lookup, and checks only locally stored barcode items.
- **Provider and platform decisions (confirmed)**
  - Open Food Facts is the approved barcode lookup API for MVP.
  - No dedicated barcode reader API is required; scanning input is provided by device hardware.
  - Retry policy is fixed at 3 attempts for transient lookup failures.
  - Offline behavior is local-only lookup with user warning.
  - Existing data privacy/logging constraints remain in effect for outbound lookups.

## Contributing

See `CONTRIBUTING.md` for the Codex + repository-owner contribution workflow, PR expectations, and documentation update policy.

## Quick start

Open `index.html` directly in a browser for static preview, or run a local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Next implementation milestones

1. Implement canonical domain models and ID strategy from `docs/architecture/data-model.md`.
2. Build inventory CRUD flows.
3. Build recipe CRUD + matching engine.
4. Build weekly planner + shopping list generation.
5. Integrate barcode scan + barcode product lookup adapter + user confirmation.
6. Add automated tests and CI quality checks.
