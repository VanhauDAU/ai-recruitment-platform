#!/usr/bin/env bash
# Gác tầng backend phần import-linter không phủ được (subpackage của external):
# services/, selectors/, tasks/ và signals/ KHÔNG được import máy móc HTTP của DRF.
# Được phép: rest_framework.exceptions, rest_framework_simplejwt (ADR-0022).
# Chạy: ./scripts/check_backend_layering.sh (CI gọi trong backend-ci)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

shopt -s nullglob
targets=(apps/*/services apps/*/selectors apps/*/tasks apps/*/tasks.py apps/*/signals apps/*/signals.py)

violations=$(grep -rnE "from rest_framework import|from rest_framework\.(serializers|views|generics|viewsets|response|decorators|request|pagination|permissions|renderers|parsers) import" \
  "${targets[@]}" --include="*.py" 2>/dev/null | grep -v __pycache__ || true)

if [ -n "$violations" ]; then
  echo "✗ services/selectors/tasks/signals đang import máy móc HTTP của DRF (cấm theo ADR-0022):"
  echo "$violations" | sed 's/^/    /'
  echo "  Gợi ý: raise rest_framework.exceptions.* hoặc exception domain; view lo phần HTTP."
  exit 1
fi
echo "✓ Layering backend OK — services/selectors/tasks/signals sạch DRF HTTP machinery."
