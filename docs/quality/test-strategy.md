# Quality Test Strategy (MVP)

## Purpose

This document defines QA and verification expectations for PantryManager's MVP capabilities and captures the product-owner-approved quality gates for MVP delivery.

## 1) Current documentation gap review

The following quality gate gaps were identified during initial review of `README.md`, `CONTRIBUTING.md`, and architecture/product docs:

1. No explicit manual test checklist per MVP feature area.
2. No browser support matrix (minimum versions or supported engine list).
3. No accessibility baseline definition.
4. No explicit CI quality gate contract.
5. No release criteria/checklist defining "ready to ship" conditions.
6. No canonical acceptance criteria matrix mapping each MVP capability to pass/fail verification outcomes.
7. No explicit documentation-update verification checklist.

## 2) Product-owner quality gate decisions (confirmed)

The following quality gate decisions are now confirmed:

1. **Manual test checklist depth**: smoke testing is sufficient for MVP.
2. **Browser support targets**: Chrome and Edge only.
3. **Accessibility baseline**: WCAG 2.1 AA or WCAG 2.2 AA baseline is acceptable.
4. **CI expectations**: checks are not required before merge.
5. **Release criteria strictness**: accepted as proposed (all feature acceptance criteria pass, and P0/P1 defects are closed or explicitly accepted by owner sign-off).

## 3) MVP capability verification matrix

The following expectations are complete for each MVP capability.

### 3.1 Inventory management

**Acceptance criteria**
- Users can add, edit, and delete inventory items.
- Required fields (`name`, `quantity`, `unit`, `price`, nutrition bundle) are validated before save.
- Filters return correct matches by product name, expiry date, and category.
- Unit handling enforces canonical units or custom-unit creation workflow.

**Verification checks (smoke level for MVP)**
- Manual CRUD flow checks (valid and invalid payload paths).
- Validation checks for missing nutrition and missing price.
- Filter correctness checks across mixed inventory records.

### 3.2 Recipe management

**Acceptance criteria**
- Users can add, edit, and delete recipes.
- Recipes require at least one ingredient and positive quantity/unit per ingredient.
- Optional preparation notes persist without corrupting recipe payload.

**Verification checks (smoke level for MVP)**
- Manual CRUD tests for recipe lifecycle.
- Boundary tests: zero or negative servings/ingredient quantities are blocked.
- Link integrity checks for `inventoryItemId` references.

### 3.3 Recommendation engine

**Acceptance criteria**
- Recommender marks recipes as satisfiable only when all required ingredients are available.
- Unsatisfied recipes expose deterministic missing-ingredient breakdown.
- Ranking prioritizes expiry urgency according to documented policy.

**Verification checks (smoke level for MVP)**
- Deterministic fixture scenarios for full-match and partial-match recipes.
- Priority ordering checks where multiple recipes are eligible.
- Explainability check: recommendation output includes missing ingredient details.

### 3.4 Weekly meal planning

**Acceptance criteria**
- Users can assign recipes to weekly slots.
- Portion multiplier correctly scales required ingredient totals.
- Planner output remains stable after edits/deletions of entries.

**Verification checks (smoke level for MVP)**
- Manual create/update/delete plan entry tests.
- Aggregation checks comparing expected ingredient totals to computed results.
- Regression checks when recipe definitions change.

### 3.5 Shopping list generation

**Acceptance criteria**
- Shopping list computes missing quantity = required - available (floored at 0).
- Output groups items by configured store section taxonomy.
- Generated items trace back to meal plan source entries.

**Verification checks (smoke level for MVP)**
- Computation checks for no-deficit, deficit, and mixed scenarios.
- Grouping checks with multiple sections and uncategorized fallback.
- Traceability checks for source meal plan links.

### 3.6 Barcode-assisted updates

**Acceptance criteria**
- App attempts local barcode match before provider lookup.
- Unknown barcode path calls Open Food Facts adapter.
- Transient provider failures retry up to 3 attempts before manual fallback.
- User confirmation is required before provider data creates/updates inventory.
- Missing mandatory nutrition fields from provider mapping block save until manually completed.

**Verification checks (smoke level for MVP)**
- Happy-path local match and provider match tests.
- Retry/fallback simulation for timeout/network failures.
- Not-found and malformed payload scenarios route to manual entry.
- Offline mode check enforces local-only lookup with warning.

## 4) Documentation update checks (quality gate)

Every change that impacts behavior, scope, or architecture must satisfy:

1. `README.md` reflects user-visible capability changes.
2. `docs/product-requirements/mvp-scope.md` reflects scope/capability contract changes.
3. `docs/architecture/overview.md` reflects architecture-impacting changes.
4. ADRs are updated/added when decisions are durable and architectural.
5. This test strategy is updated when acceptance criteria or quality gates change.

## 5) Conflicts between confirmed QA gates and current project status

1. **Automated test coverage constraint**
   - The project remains in scaffolding phase with wireframe-level implementation, so capability-level automated tests are not yet available.
2. **Accessibility compliance evidence constraint**
   - The accessibility baseline is now defined, but audit evidence/process is not yet documented in repo workflows.
3. **Release execution constraint**
   - Release criteria are defined, but a release checklist artifact and defect tracking workflow are not yet formalized in repository docs.

## 6) Interim enforcement policy (until implementation matures)

1. Run and document smoke-level manual checks for affected MVP capabilities in each PR.
2. Validate behavior at least in supported browsers (Chrome and Edge).
3. Record accessibility checks against WCAG 2.1 AA or 2.2 AA for touched user journeys.
4. Treat unresolved P0/P1 defects as release blockers unless explicitly accepted by owner sign-off.
5. Include documentation-update verification in every PR.


## 7) Implemented contribution workflow and CI checks

The following checks are now wired into repository workflow where possible:

1. **Smoke checks**
   - Script: `scripts/qa/smoke-checks.sh`
   - CI command: `npm run qa:smoke`
2. **Browser coverage baseline check**
   - Script: `scripts/qa/browser-baseline-check.sh`
   - CI command: `npm run qa:browser-baseline`
   - Enforces documented support target: Chrome + Edge.
3. **Accessibility baseline check (static guardrail)**
   - Script: `scripts/qa/a11y-check.mjs`
   - CI command: `npm run qa:a11y`
   - Validates foundational semantic markers pending full WCAG audit automation.
4. **Documentation update verification**
   - Script: `scripts/qa/doc-update-check.sh`
   - CI command: `npm run qa:docs`
   - Fails when architecture/product/ADR updates are made without top-level contributor docs updates.
5. **Automated tests**
   - CI command: `npm test`
   - Includes retention and sync policy unit tests.

Checks are executed in GitHub Actions workflow `.github/workflows/qa.yml` on push to `main` and pull requests.
