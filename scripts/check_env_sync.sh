#!/usr/bin/env bash
# Validate backend/.env.example and frontend/.env.example against the code.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 -m unittest discover -s "$ROOT/scripts/tests" -p 'test_check_env_sync.py' -q
exec python3 "$ROOT/scripts/check_env_sync.py"
