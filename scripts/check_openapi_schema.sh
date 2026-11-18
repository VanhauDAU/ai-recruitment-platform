#!/usr/bin/env bash
# Cổng OpenAPI (ADR-0022):
#   1. schema sinh từ code phải khớp docs/04-api/openapi.yaml (không drift);
#   2. số lỗi/cảnh báo unique của drf-spectacular không được tăng so với
#      backend/openapi-baseline.txt — chỉ được giảm, mục tiêu về 0.
# Chạy từ bất kỳ đâu. BACKEND_RUN đổi cách gọi python (mặc định chạy trong backend/),
# ví dụ: BACKEND_RUN="docker compose exec -T backend python".
# Cập nhật schema: (cd backend && python manage.py spectacular --file ../docs/04-api/openapi.yaml)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

BASELINE="$ROOT/backend/openapi-baseline.txt"
COMMITTED="$ROOT/docs/04-api/openapi.yaml"
read -r -a run <<<"${BACKEND_RUN:-python}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

"${run[@]}" manage.py spectacular --validate >"$tmp/schema.yaml" 2>"$tmp/log.txt"

errors=$(grep -oE '^Errors: +[0-9]+ \(([0-9]+) unique\)' "$tmp/log.txt" | grep -oE '\(([0-9]+)' | tr -d '(' || echo 0)
warnings=$(grep -oE '^Warnings: +[0-9]+ \(([0-9]+) unique\)' "$tmp/log.txt" | grep -oE '\(([0-9]+)' | tr -d '(' || echo 0)
errors=${errors:-0}
warnings=${warnings:-0}
max_errors=$(grep -E '^errors=' "$BASELINE" | cut -d= -f2)
max_warnings=$(grep -E '^warnings=' "$BASELINE" | cut -d= -f2)

status=0
if ! diff -q "$tmp/schema.yaml" "$COMMITTED" >/dev/null; then
  echo "✗ docs/04-api/openapi.yaml lệch so với code. Sinh lại và commit:"
  echo "    (cd backend && python manage.py spectacular --file ../docs/04-api/openapi.yaml)"
  diff -u "$COMMITTED" "$tmp/schema.yaml" | head -40 | sed 's/^/    /'
  status=1
fi

if ((errors > max_errors || warnings > max_warnings)); then
  echo "✗ drf-spectacular: $errors lỗi / $warnings cảnh báo unique (baseline $max_errors / $max_warnings)."
  echo "  Thêm @extend_schema hoặc type hint cho view/serializer mới:"
  grep -E '(Error|Warning)' "$tmp/log.txt" | sort -u | head -30 | sed 's/^/    /'
  status=1
elif ((errors < max_errors || warnings < max_warnings)); then
  echo "✗ drf-spectacular đã giảm còn $errors lỗi / $warnings cảnh báo — hạ baseline trong backend/openapi-baseline.txt."
  status=1
fi

if ((status == 0)); then
  echo "✓ OpenAPI khớp docs/04-api/openapi.yaml ($errors lỗi / $warnings cảnh báo unique, mục tiêu 0)."
fi
exit "$status"
