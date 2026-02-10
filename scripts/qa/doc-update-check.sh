#!/usr/bin/env bash
set -euo pipefail

# Documentation-update verification gate.
# If architecture or product-requirements docs changed, README or CONTRIBUTING should
# also change to keep top-level guidance aligned.

BASE_REF="${GITHUB_BASE_REF:-main}"

if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
  diff_range="$BASE_REF...HEAD"
else
  diff_range="HEAD~1...HEAD"
fi

changed_files="$(git diff --name-only "$diff_range" || true)"

if [[ -z "$changed_files" ]]; then
  echo "Doc update check skipped: no changed files detected in diff range $diff_range."
  exit 0
fi

needs_top_level_doc_update=0
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  if [[ "$path" == docs/architecture/* || "$path" == docs/product-requirements/* || "$path" == docs/decisions/* ]]; then
    needs_top_level_doc_update=1
    break
  fi
done <<< "$changed_files"

if [[ "$needs_top_level_doc_update" -eq 1 ]]; then
  if ! grep -Eq '^(README.md|CONTRIBUTING.md)$' <<< "$changed_files"; then
    echo "Documentation update check failed: architecture/product/ADR docs changed without README.md or CONTRIBUTING.md updates." >&2
    exit 1
  fi
fi

echo "Documentation update verification passed."
