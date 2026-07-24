#!/usr/bin/env bash
# Kiểm tra chất lượng toàn repo bằng MỘT lệnh (khớp với CI).
# Dùng: ./scripts/check_all.sh
#
# Docs: kiểm tra link Markdown nội bộ trên các file được Git track.
# Backend: ruff + architecture + system check + migration state + coverage gate.
# Frontend: env-sync + boundary + lint + architecture + coverage + build/budget + E2E smoke.
# Backend chạy qua venv local nếu có; không có venv thì fallback Docker Compose.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

step "Docs: liên kết Markdown nội bộ"
python3 "$ROOT/scripts/check_markdown_links.py"

# ---- Chọn cách chạy lệnh backend ----
if [ -x backend/venv/bin/python ]; then
  run_be() { (cd backend && ./venv/bin/python "$@"); }
  run_ruff() { (cd backend && ./venv/bin/ruff "$@"); }
  run_lint_imports() { (cd backend && ./venv/bin/lint-imports "$@"); }
  run_pytest() { (cd backend && ./venv/bin/pytest "$@"); }
elif docker compose version >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
  run_be() { docker compose run --rm backend python "$@"; }
  run_ruff() { docker compose run --rm backend ruff "$@"; }
  run_lint_imports() { docker compose run --rm backend lint-imports "$@"; }
  run_pytest() { docker compose run --rm backend pytest "$@"; }
else
  echo "Không tìm thấy backend/venv và Docker daemon không chạy — cần một trong hai." >&2
  exit 1
fi

# ---- Backend ----
step "Backend: ruff check + format"
run_ruff check .
run_ruff format --check .

step "Backend: kiến trúc layer (import-linter)"
run_lint_imports

step "Backend: layering DRF"
"$ROOT/scripts/check_backend_layering.sh"

step "Backend: Django system check"
run_be manage.py check

step "Backend: kiểm tra migration treo"
run_be manage.py makemigrations --check --dry-run

step "Backend: test suite + coverage gate"
run_pytest --cov --cov-fail-under=84

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

step "Frontend: unit test + coverage"
npm --prefix frontend run test:coverage

step "Frontend: build"
npm --prefix frontend run build

step "Frontend: bundle budget"
npm --prefix frontend run check:bundle-budget

step "Frontend: E2E smoke"
npm --prefix frontend run test:e2e:smoke

printf '\n\033[1;32m✓ Tất cả quality gate đều xanh.\033[0m\n'
