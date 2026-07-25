#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED="$ROOT/frontend/src/entities/admin-access/model/admin-permissions.generated.json"
GENERATED="$(mktemp "$ROOT/backend/.admin-permissions.XXXXXX")"
trap 'rm -f "$GENERATED"' EXIT

if [ -x "$ROOT/backend/venv/bin/python" ]; then
  (cd "$ROOT/backend" && ./venv/bin/python manage.py export_admin_permissions --output "$GENERATED")
elif python3 -c 'import django' >/dev/null 2>&1; then
  (cd "$ROOT/backend" && python3 manage.py export_admin_permissions --output "$GENERATED")
elif docker compose version >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
  docker compose run --rm backend python manage.py export_admin_permissions \
    --output "/app/$(basename "$GENERATED")"
else
  echo "Không tìm thấy Python có Django hoặc Docker đang chạy." >&2
  exit 1
fi

if ! diff -u "$EXPECTED" "$GENERATED"; then
  echo "Permission frontend lệch registry backend. Chạy export_admin_permissions và commit file sinh ra." >&2
  exit 1
fi

echo "✓ Admin permission registry đồng bộ backend ↔ frontend."
