#!/usr/bin/env bash
set -euo pipefail

# Browser baseline is defined in docs/quality/test-strategy.md as Chrome + Edge.
if ! rg -q "Chrome and Edge only" docs/quality/test-strategy.md; then
  echo "Browser baseline declaration missing from docs/quality/test-strategy.md" >&2
  exit 1
fi

echo "Browser baseline check passed: Chrome + Edge support target documented."
