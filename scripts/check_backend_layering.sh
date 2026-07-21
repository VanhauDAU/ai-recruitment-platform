#!/usr/bin/env bash
# Gác tầng backend phần import-linter không phủ được (subpackage của external):
# services/ và selectors/ KHÔNG được import máy móc HTTP của DRF.
# Được phép: rest_framework.exceptions (ADR-0010), rest_framework_simplejwt.
# Chạy: ./scripts/check_backend_layering.sh (CI gọi trong backend-ci)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

violations=$(grep -rnE "from rest_framework import|from rest_framework\.(serializers|views|generics|viewsets|response|decorators) import" \
  apps/*/services apps/*/selectors --include="*.py" 2>/dev/null | grep -v __pycache__ || true)

if [ -n "$violations" ]; then
  echo "✗ services/selectors đang import máy móc HTTP của DRF (cấm theo ADR-0010):"
  echo "$violations" | sed 's/^/    /'
  echo "  Gợi ý: raise rest_framework.exceptions.* hoặc exception domain; view lo phần HTTP."
  exit 1
fi
echo "✓ Layering backend OK — services/selectors sạch DRF HTTP machinery."
