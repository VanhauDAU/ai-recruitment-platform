#!/usr/bin/env bash
# Xóa cache và output có thể tái tạo mà không đụng tới env, dependencies hoặc media.
# Dùng: ./scripts/clean_artifacts.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Coverage/build/test output ở các vị trí đã biết.
rm -rf -- \
  .coverage \
  .vite \
  htmlcov \
  backend/.coverage \
  backend/coverage.json \
  backend/htmlcov \
  backend/pytest-results.xml \
  frontend/.vite \
  frontend/coverage \
  frontend/dist \
  frontend/dist-ssr \
  frontend/test-results \
  frontend/playwright-report \
  frontend/blob-report \
  frontend/node_modules/.vite

# Không có package manifest ở root, nên node_modules tại đây chỉ là cache thừa.
if [ ! -f package.json ]; then
  rm -rf -- node_modules
fi

# Bỏ cache tooling ngoài dependencies; venv và node_modules được giữ nguyên.
find . \
  -path ./.git -prune -o \
  -path ./backend/venv -prune -o \
  -path ./frontend/node_modules -prune -o \
  -type d \( \
    -name __pycache__ -o \
    -name .pytest_cache -o \
    -name .ruff_cache -o \
    -name .mypy_cache -o \
    -name .import_linter_cache \
  \) -prune -exec rm -rf -- {} +

# Metadata macOS và coverage shard không có giá trị với source tree.
find . \
  -path ./.git -prune -o \
  -path ./backend/venv -prune -o \
  -path ./frontend/node_modules -prune -o \
  -type f \( -name .DS_Store -o -name '.coverage.*' \) -delete

printf '✓ Đã dọn cache và artifact có thể tái tạo.\n'
