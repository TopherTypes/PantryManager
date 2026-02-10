#!/usr/bin/env bash
set -euo pipefail

# Browser baseline is defined in docs/quality/test-strategy.md as Chrome + Edge.
#
# CI portability note:
# - Some runners may not have ripgrep (`rg`) preinstalled.
# - We therefore prefer `rg` when available for consistency with local workflows,
#   but always fall back to POSIX `grep` so this check does not fail due to tool absence.
pattern="Chrome and Edge only"
file="docs/quality/test-strategy.md"

if command -v rg >/dev/null 2>&1; then
  if ! rg -q "$pattern" "$file"; then
    echo "Browser baseline declaration missing from $file" >&2
    exit 1
  fi
else
  if ! grep -Fq "$pattern" "$file"; then
    echo "Browser baseline declaration missing from $file" >&2
    exit 1
  fi
fi

echo "Browser baseline check passed: Chrome + Edge support target documented."
