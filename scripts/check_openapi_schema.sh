#!/usr/bin/env bash
# Cổng OpenAPI (ADR-0022): drf-spectacular không được có lỗi/cảnh báo nào và
# schema sinh từ code phải khớp docs/04-api/openapi.yaml (không drift).
# Chạy từ bất kỳ đâu. BACKEND_RUN đổi cách gọi python (mặc định chạy trong backend/),
# ví dụ: BACKEND_RUN="docker compose exec -T backend python".
# Cập nhật schema: (cd backend && python manage.py spectacular --file ../docs/04-api/openapi.yaml)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

COMMITTED="$ROOT/docs/04-api/openapi.yaml"
read -r -a run <<<"${BACKEND_RUN:-python}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if ! "${run[@]}" manage.py spectacular --validate --fail-on-warn >"$tmp/schema.yaml" 2>"$tmp/log.txt"; then
  echo "✗ drf-spectacular báo lỗi/cảnh báo — thêm @extend_schema, type hint hoặc ENUM_NAME_OVERRIDES:"
  grep -E '(Error|Warning)' "$tmp/log.txt" | sort -u | head -30 | sed 's/^/    /'
  exit 1
fi

if ! diff -q "$tmp/schema.yaml" "$COMMITTED" >/dev/null; then
  echo "✗ docs/04-api/openapi.yaml lệch so với code. Sinh lại và commit:"
  echo "    (cd backend && python manage.py spectacular --file ../docs/04-api/openapi.yaml)"
  diff -u "$COMMITTED" "$tmp/schema.yaml" | head -40 | sed 's/^/    /'
  exit 1
fi
echo "✓ OpenAPI sạch (0 lỗi, 0 cảnh báo) và khớp docs/04-api/openapi.yaml."
