#!/usr/bin/env bash
# Cưỡng chế ranh giới API (ADR 0002): mọi thứ HTTP phải qua shared/api.
# Fail nếu có `axios.create` hoặc `import ... from 'axios'` ngoài shared/api.
# Dùng: ./scripts/check_api_boundary.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/frontend/src"

# Bắt cả axios.create lẫn import axios; loại trừ thư mục shared/api.
violations="$(grep -rnE "axios\.create|from ['\"]axios['\"]" "$SRC" \
  --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
  | grep -v "/shared/api/" || true)"

if [ -n "$violations" ]; then
  echo "✗ Vi phạm ranh giới API — axios chỉ được dùng trong frontend/src/shared/api:" >&2
  echo "$violations" >&2
  exit 1
fi

echo "✓ Ranh giới API OK — không có axios ngoài shared/api."
