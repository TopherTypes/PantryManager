# Contributing to PantryManager

This repository is maintained by two contributors only:

- **Repository owner** (final approver and merger)
- **Codex** (implementation assistant)

This guide defines the expected workflow for both contributors and removes ambiguity for first-time or automated contributions.

## 1) Operating model

1. All implementation work starts from `main`.
2. Codex creates short-lived branches for isolated changes.
3. The repository owner is the sole approver and decides when to merge.
4. There is no minimum reviewer requirement.

## 2) Branch naming convention

Use this naming scheme for every Codex-created branch:

- `codex/feat/<short-kebab-description>` for features
- `codex/fix/<short-kebab-description>` for bug fixes
- `codex/docs/<short-kebab-description>` for documentation updates
- `codex/chore/<short-kebab-description>` for maintenance

Examples:

- `codex/feat/inventory-crud-skeleton`
- `codex/fix/expiry-filter-ordering`
- `codex/docs/contributing-policy-refresh`

## 3) Commit policy

Use **Conventional Commits** for all commits.

Format:

```text
<type>(<optional-scope>): <short summary>
```

Allowed types:

- `feat`, `fix`, `docs`, `chore`, `refactor`, `test`

Examples:

- `docs(contributing): define codex branch and PR policy`
- `fix(inventory): prevent negative quantity on decrement`
- `feat(recipes): add missing ingredient highlighting`

Commit rules:

1. Keep commits focused to one logical change.
2. Use imperative tense in summaries.
3. Avoid "WIP" commits in final PR history.

## 4) Development and validation workflow

1. Create a branch from `main` using the naming convention above.
2. Make the minimal scoped change.
3. Validate locally as needed. For static preview:

   ```bash
   python3 -m http.server 8080
   ```

4. Verify changed behavior and scan for regressions.
5. Ensure only intended files are modified.
6. Commit using the commit policy above.

## 5) Pull request structure (required)

Every PR opened by Codex must include these sections in order:

1. **Summary**
   - What changed.
2. **Motivation**
   - Why the change is needed.
3. **Changes made**
   - File-level or behavior-level breakdown.
4. **Validation**
   - Commands run and manual checks performed.
5. **Documentation updates**
   - What docs changed, or why none were required.
6. **Risks / follow-ups**
   - Known limitations or deferred tasks.

If the change affects visible UI behavior, include screenshots.

## 6) Review and approval policy

1. The repository owner is the only approver.
2. No minimum number of reviewers is required.
3. Codex should still provide clear validation evidence in the PR.

## 7) Merge strategy

Default strategy: **direct merge to `main` by repository owner** after approval.

Notes:

- A separate merge queue is not required.
- Squash/rebase is optional and owner-discretionary.
- Keep PR scope small to make direct merges safe.

## 8) Documentation update policy

Update documentation whenever behavior, process, architecture, or scope changes.

Relevant docs include:

- `README.md` for onboarding and top-level workflow notes.
- `docs/product-requirements/mvp-scope.md` for scope/capability changes.
- `docs/architecture/overview.md` for architecture-level impact.
- `docs/decisions/*.md` for durable technical decisions.

When no docs are updated, explain why in the PR under **Documentation updates**.

## 9) Codex execution expectations

When Codex performs repository work, it should:

1. Follow this workflow exactly.
2. Keep changes narrowly scoped to the request.
3. Include reproducible validation commands in PR/testing notes.
4. Flag conflicts between new changes and existing documentation statements.
5. Avoid introducing process ambiguity; prefer explicit rules.
