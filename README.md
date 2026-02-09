# PantryManager

PantryManager is a GitHub Pages-hosted HTML web app for managing kitchen inventory, recipes, meal plans, and barcode-assisted product updates.

## Project status

> 🚧 **Scaffolding phase**: This repository currently contains the initial project structure, wireframe UI, and planning documentation.

## Goals

- Track food products in the kitchen, including quantities, prices, expiry dates, and nutritional information.
- Maintain recipes with ingredient requirements.
- Recommend recipes based on currently available ingredients.
- Organize weekly meal plans and generate shopping lists to fill ingredient gaps.
- Streamline updates through barcode scanning for known items.
- Integrate with public barcode services for unknown items.

## Tech direction (initial)

- **Hosting**: GitHub Pages
- **Frontend**: Semantic HTML, CSS, and vanilla JavaScript
- **Data persistence (candidate)**: Browser local storage (short-term), optional future cloud sync
- **Barcode integration (candidate)**: Public APIs such as Open Food Facts

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
│   │   └── overview.md             # System architecture draft
│   ├── product-requirements/
│   │   └── mvp-scope.md            # MVP scope and open questions
│   └── decisions/
│       └── adr-0001-frontend-foundation.md
└── .github/
    └── workflows/
        └── pages.yml               # GitHub Pages deployment workflow
```

## Open ambiguities to resolve

The following areas are intentionally left open and are documented for follow-up:

1. Authentication and multi-user support requirements.
2. Preferred barcode APIs and rate limits.
3. Nutritional information schema depth (basic macros vs. full nutrient profile).
4. Unit normalization strategy (g/ml/units and conversion behavior).
5. Rules for expiry-date handling (timezone, partial packages, confidence level).
6. Recommendation algorithm priorities (cost, nutrition goals, expiry-first, etc.).
7. Meal plan model details (servings per meal, leftovers, constraints).
8. Offline-first behavior and sync conflict handling.

See `docs/product-requirements/mvp-scope.md` for details.

## Quick start

Open `index.html` directly in a browser for static preview, or run a local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Next implementation milestones

1. Define canonical domain models and ID strategy.
2. Build inventory CRUD flows.
3. Build recipe CRUD + matching engine.
4. Build weekly planner + shopping list generation.
5. Integrate barcode scan + external product lookup.
6. Add automated tests and CI quality checks.
