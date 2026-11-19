#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# External consumers must use a slice's public index:
# `@/features/<cổng>/<module>/<slice>` (frontend/ARCHITECTURE.md). Internal slice
# code uses relative imports, so this only rejects alias imports that reach past
# the slice index into another feature's implementation.
pattern="from ['\"]@/features/[^/'\"]+/[^/'\"]+/[^/'\"]+/"
if command -v rg >/dev/null 2>&1; then
  matches="$(rg -n "$pattern" frontend/src -g '*.{js,jsx}' || true)"
else
  matches="$(grep -rnE "$pattern" frontend/src --include='*.js' --include='*.jsx' || true)"
fi
if [[ -n "$matches" ]]; then
  printf '%s\n' "$matches"
  echo "Feature boundary failed: import feature public APIs from @/features/<cổng>/<module>/<slice>." >&2
  exit 1
fi
echo "✓ Ranh giới feature OK — không có deep import vào feature khác."
