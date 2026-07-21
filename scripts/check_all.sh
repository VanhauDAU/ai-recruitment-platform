#!/usr/bin/env bash
# Kiểm tra chất lượng toàn repo bằng MỘT lệnh (khớp với CI).
# Dùng: ./scripts/check_all.sh
#
# Backend: ruff + system check + migration treo + test.
# Frontend: env-sync + boundary + lint + kiến trúc + unit test + build.
# Backend chạy qua venv local nếu có; không có venv thì fallback Docker Compose.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

# ---- Chọn cách chạy lệnh backend ----
if [ -x backend/venv/bin/python ]; then
  run_be() { (cd backend && ./venv/bin/python "$@"); }
  run_ruff() { (cd backend && ./venv/bin/ruff "$@"); }
elif docker compose version >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
  run_be() { docker compose run --rm backend python "$@"; }
  run_ruff() { docker compose run --rm backend ruff "$@"; }
else
  echo "Không tìm thấy backend/venv và Docker daemon không chạy — cần một trong hai." >&2
  exit 1
fi

# ---- Backend ----
step "Backend: ruff check + format"
run_ruff check .
run_ruff format --check .

step "Backend: Django system check"
run_be manage.py check

step "Backend: kiểm tra migration treo"
run_be manage.py makemigrations --check --dry-run

step "Backend: test suite"
run_be manage.py test

# ---- Đồng bộ env ----
step "Env: .env.example đồng bộ với code"
"$ROOT/scripts/check_env_sync.sh"

# ---- Frontend ----
step "Frontend: ranh giới API (axios chỉ trong shared/api)"
"$ROOT/scripts/check_api_boundary.sh"

step "Frontend: ranh giới feature (không deep-import feature khác)"
"$ROOT/scripts/check_feature_boundary.sh"

step "Frontend: lint"
npm --prefix frontend run lint

step "Frontend: kiến trúc (dependency-cruiser)"
npm --prefix frontend run check:architecture

step "Frontend: unit test"
npm --prefix frontend test

step "Frontend: build"
npm --prefix frontend run build

printf '\n\033[1;32m✓ Tất cả quality gate đều xanh.\033[0m\n'
