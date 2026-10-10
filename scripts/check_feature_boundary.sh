#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# External consumers must use a feature's public index, e.g. `@/features/auth`.
# Internal feature code uses relative imports, so this only rejects alias imports
# that reach into another feature implementation.
if command -v rg >/dev/null 2>&1; then
  matches="$(rg -n "from ['\"]@/features/[^/'\"]+/" frontend/src -g '*.{js,jsx}' | rg -v "@/features/[^/]+/routes" || true)"
else
  matches="$(grep -rnE "from ['\"]@/features/[^/'\"]+/" frontend/src --include='*.js' --include='*.jsx' | grep -v "@/features/[^/]\+/routes" || true)"
fi
if [[ -n "$matches" ]]; then
  printf '%s\n' "$matches"
  echo "Feature boundary failed: import feature public APIs from @/features/<name>." >&2
  exit 1
fi
echo "✓ Ranh giới feature OK — không có deep import vào feature khác."
