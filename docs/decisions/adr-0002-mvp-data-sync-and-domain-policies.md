# ADR 0002: MVP Data Scope, Sync, and Domain Policies

- **Status**: Accepted
- **Date**: 2026-02-09
- **Owner**: Unassigned
- **Deciders**: Project maintainer (approved in chat with Codex)
- **Supersedes**: None
- **Superseded by**: None
- **Review cadence**: None (event-driven)

## Context

MVP requirement clarifications finalized decisions on user scope, sync behavior, barcode integration approach, conversion flexibility, and data retention windows. These choices materially affect architecture and domain modeling.

## Decision

### 1) User and sync scope
- PantryManager remains a **single-user** application.
- Cross-device continuity is provided through **Google Drive-backed sync/import-export** for that same user.

### 2) Barcode integration strategy
- Use a **local-first lookup**: local catalog match before external query.
- External barcode integrations must be implemented behind an adapter to support provider substitution/fallback.
- Initial provider candidates include Open Food Facts API, UPCitemdb API, and Barcode Lookup API; scanning can use ZXing-JS or QuaggaJS.

### 3) Units and conversions
- Support variable units through canonical unit families (mass, volume, count).
- Permit recipe/inventory conversions through standard mappings, with product-specific overrides where necessary.

### 4) Nutrition minimum schema
- MVP nutrition fields are: calories, protein, carbs, sugars, fats.

### 5) Recommendation ranking baseline
- Meal recommendations prioritize expiry urgency as primary ranking.
- Additional ranking views may be added without replacing the expiry-first default.

### 6) Meal planning complexity
- Include portion multipliers in MVP.
- Exclude leftovers from MVP.
- Defer batch cooking workflows.

### 7) Shopping list grouping
- Group shopping outputs by store location/section via a generic functional taxonomy.

### 8) Data lifecycle
- Retain archived non-pricing data for 30 days, then purge.
- Retain pricing history for 12 months.

## Alternatives considered

- **Multi-user-first scope for MVP**: Rejected to avoid auth/collaboration complexity before validating core single-user pantry workflows.
- **Cloud-first authoritative backend for all data operations**: Rejected for MVP to preserve low-infrastructure operation and simpler deployment constraints.
- **No external barcode integration in MVP**: Rejected because barcode-assisted entry is core to reducing user friction.

## Consequences

### Positive
- Requirements ambiguity is removed for core implementation paths.
- Architecture now has explicit guidance for sync boundaries, integration abstraction, and retention policy.
- Domain model scope is clearer for nutrition, planning, and recommendation behavior.

### Negative / Risks
- Google Drive sync introduces integration complexity and authorization handling in a static app architecture.
- Broad unit conversion support increases validation and testing complexity.
- External barcode providers may differ in data quality, rate limits, and licensing constraints.

## Revisit triggers

- Google Drive API policy changes or quota limitations materially affect reliability.
- Barcode provider terms, costs, or uptime no longer meet MVP constraints.
- Conversion error rates or support burden indicate simplification is required.
- Data-retention obligations change due to legal or product policy updates.

## Follow-up

- Add technical design notes for Google Drive sync token and error handling.
- Define and document canonical unit dictionaries and conversion safety rules.
- Select initial production barcode provider(s) after cost/uptime/licensing review.
