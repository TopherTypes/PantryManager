# ADR 0001: Frontend Foundation for PantryManager

- **Status**: Accepted (initial scaffold)
- **Date**: 2026-02-09

## Context

PantryManager needs a low-friction start compatible with GitHub Pages and fast iteration on UI and domain modeling.

## Decision

Start with a static frontend stack:

- Semantic HTML
- Vanilla CSS
- Vanilla JavaScript modules (incrementally)

## Consequences

### Positive

- Zero build step needed for first iterations.
- Easy deployment to GitHub Pages.
- Minimal tooling overhead while requirements are still evolving.

### Negative

- Potential manual complexity as application grows.
- Future migration may be needed if state management grows significantly.

## Revisit triggers

- UI complexity requires component abstractions.
- Performance or maintainability issues appear.
- Need for stronger type safety becomes critical.
