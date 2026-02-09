# Architecture Decision Records (ADRs)

This directory stores Architecture Decision Records (ADRs) for PantryManager.

## Purpose

ADRs capture durable architectural and product-architecture decisions so contributors can understand:

- Why a decision was made.
- What constraints shaped the decision.
- When to revisit or supersede the decision.
- Who is accountable for maintaining decision relevance.

## ADR lifecycle and governance policy

### Roles and approval authority

- **Authoring**: Codex may author ADRs on the maintainer's behalf.
- **Approval authority**: The project maintainer/user approves ADRs, usually in chat with Codex.
- **Approval quorum**: One maintainer approval is required before an ADR moves from `Proposed` to `Accepted`.

### Status lifecycle

ADRs use the following statuses:

1. **Proposed**: Draft decision ready for maintainer review.
2. **Accepted**: Maintainer-approved and active.
3. **Deprecated**: Still valid historically, but no longer preferred for new changes.
4. **Superseded**: Explicitly replaced by a newer ADR.
5. **Rejected**: Considered but not adopted.

### Status transitions

Allowed transitions are intentionally lightweight:

- `Proposed` -> `Accepted` (after maintainer approval)
- `Proposed` -> `Rejected`
- `Accepted` -> `Deprecated`
- `Accepted` -> `Superseded`
- `Deprecated` -> `Superseded`

Any non-listed transition requires a note in the ADR explaining why an exception is needed.

### Required metadata (for every ADR)

Each ADR must include the following top-level metadata fields:

- **Status**
- **Date**
- **Owner** (single accountable role/person)
- **Deciders** (approvers at time of acceptance)
- **Supersedes** (ADR number/link or `None`)
- **Superseded by** (ADR number/link or `None`)
- **Review cadence** (`None (event-driven)` by default unless explicitly set)

### Required sections (for every ADR)

- **Context**
- **Decision**
- **Alternatives considered**
- **Consequences** (positive and negative)
- **Revisit triggers**

Optional but recommended:

- **Follow-up**

### Decision triggers

Contributors should create or update an ADR when any of the following are true:

- The change affects cross-cutting architecture, data contracts, or long-term maintainability.
- The change introduces external vendor/tool lock-in or significant operational cost.
- The change modifies security/privacy posture or data-retention behavior.
- The team needs explicit rationale to preserve institutional memory.

### Ownership expectations

- The **Owner** ensures the ADR remains accurate and reviewable.
- **Deciders** approve acceptance and any later deprecation/supersession.
- If ownership is unknown, use `Unassigned` temporarily and assign it in the next ADR update.

### Review cadence policy

- There is no fixed recurring review cadence.
- ADRs are reviewed on an **event-driven basis** when a revisit trigger occurs or when a superseding decision is proposed.

### Supersession rules

When superseding an ADR:

1. Create a new ADR with status `Accepted` and set its `Supersedes` field.
2. Update the prior ADR status to `Superseded` and populate `Superseded by`.
3. Add reciprocal links in the ADR index table.

## ADR index

| ADR | Title | Status | Owner | Supersedes | Superseded by |
|---|---|---|---|---|---|
| [ADR 0001](./adr-0001-frontend-foundation.md) | Frontend Foundation for PantryManager | Accepted | Unassigned | None | None |
| [ADR 0002](./adr-0002-mvp-data-sync-and-domain-policies.md) | MVP Data Scope, Sync, and Domain Policies | Accepted | Unassigned | None | None |

## Governance input completeness check

| Input | Finalized policy | Usable by contributors? |
|---|---|---|
| ADR authorship policy | Codex may author ADRs on maintainer's behalf | Yes |
| ADR approval policy | Maintainer approval in chat; one approval required | Yes |
| Required section policy | `Alternatives considered` is mandatory | Yes |
| Status transition matrix | Defined in this README | Yes |
| Review cadence owner | No fixed cadence; event-driven review | Yes |

## Current policy vs existing decision record conflicts

No active conflicts are currently identified between this governance policy and ADR 0001/0002.

Historical note: older revisions previously lacked mandatory metadata and alternatives analysis; these gaps are now backfilled.
