#!/usr/bin/env bash
set -euo pipefail

# MVP smoke checks ensure core surface files and platform modules exist.
required_files=(
  "index.html"
  "assets/js/app.js"
  "assets/js/platform/googleDriveSync.js"
  "assets/js/platform/retentionPolicy.js"
  "docs/quality/test-strategy.md"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required smoke-check file: $file" >&2
    exit 1
  fi
done

echo "Smoke checks passed: required MVP surface files exist."
