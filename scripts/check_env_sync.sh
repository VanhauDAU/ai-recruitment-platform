#!/usr/bin/env bash
# Validate the minimal and optional env catalogs for backend, frontend and Compose.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec python3 "$ROOT/scripts/check_env_sync.py"
