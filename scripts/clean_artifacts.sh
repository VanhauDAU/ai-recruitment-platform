#!/usr/bin/env bash
# Xóa cache và output có thể tái tạo mà không đụng tới env, dependencies hoặc media.
# Dùng: ./scripts/clean_artifacts.sh [--dry-run]

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

dry_run=false
case "${1:-}" in
  '') ;;
  --dry-run) dry_run=true ;;
  -h|--help)
    printf 'Dùng: %s [--dry-run]\n' "$0"
    exit 0
    ;;
  *)
    printf 'Tham số không hỗ trợ: %s\n' "$1" >&2
    exit 2
    ;;
esac

remove_path() {
  local target="$1"
  if [ ! -e "$target" ] && [ ! -L "$target" ]; then
    return
  fi
  if [ "$dry_run" = true ]; then
    printf '[dry-run] %s\n' "$target"
  else
    rm -rf -- "$target"
  fi
}

# Coverage/build/test output ở các vị trí đã biết.
known_artifacts=(
  .coverage
  .vite
  htmlcov
  backend/.coverage
  backend/coverage.json
  backend/htmlcov
  backend/pytest-results.xml
  frontend/.vite
  frontend/coverage
  frontend/dist
  frontend/dist-ssr
  frontend/test-results
  frontend/playwright-report
  frontend/blob-report
)
for artifact in "${known_artifacts[@]}"; do
  remove_path "$artifact"
done

# Bỏ cache tooling ngoài dependencies; venv và node_modules được giữ nguyên.
while IFS= read -r -d '' cache_dir; do
  remove_path "$cache_dir"
done < <(find . \
  -path ./.git -prune -o \
  -path ./.venv -prune -o \
  -path ./venv -prune -o \
  -path ./node_modules -prune -o \
  -path ./backend/.venv -prune -o \
  -path ./backend/venv -prune -o \
  -path ./frontend/node_modules -prune -o \
  -type d \( \
    -name __pycache__ -o \
    -name .pytest_cache -o \
    -name .ruff_cache -o \
    -name .mypy_cache -o \
    -name .import_linter_cache \
  \) -prune -print0)

# Metadata macOS và coverage shard không có giá trị với source tree.
while IFS= read -r -d '' artifact_file; do
  remove_path "$artifact_file"
done < <(find . \
  -path ./.git -prune -o \
  -path ./.venv -prune -o \
  -path ./venv -prune -o \
  -path ./node_modules -prune -o \
  -path ./backend/.venv -prune -o \
  -path ./backend/venv -prune -o \
  -path ./frontend/node_modules -prune -o \
  -type f \( -name .DS_Store -o -name '.coverage.*' \) -print0)

if [ "$dry_run" = true ]; then
  printf '✓ Dry-run hoàn tất; chưa xóa tệp nào.\n'
else
  printf '✓ Đã dọn cache và artifact có thể tái tạo.\n'
fi
