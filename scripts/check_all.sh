#!/usr/bin/env bash
# Kiểm tra chất lượng toàn repo bằng MỘT lệnh (khớp với CI).
# Dùng: ./scripts/check_all.sh
#
# Backend: system check + migration treo + test.
# Frontend: lint + unit test + build.
# Trả về mã lỗi khác 0 nếu bất kỳ bước nào fail (dừng ngay).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

# ---- Backend ----
# Chạy từ trong backend/ vì Django discover test theo thư mục hiện tại.
step "Backend: kích hoạt venv"
# shellcheck disable=SC1091
if [ -f backend/venv/bin/activate ]; then
  source backend/venv/bin/activate
fi

pushd backend >/dev/null

step "Backend: Django system check"
python manage.py check

step "Backend: kiểm tra migration treo"
python manage.py makemigrations --check --dry-run

step "Backend: test suite"
python manage.py test

popd >/dev/null

# ---- Frontend ----
step "Frontend: lint"
npm --prefix frontend run lint

step "Frontend: unit test"
npm --prefix frontend test

step "Frontend: build"
npm --prefix frontend run build

printf '\n\033[1;32m✓ Tất cả quality gate đều xanh.\033[0m\n'
