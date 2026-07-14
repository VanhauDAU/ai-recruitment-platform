#!/usr/bin/env bash
# Dựng môi trường backend từ đầu, khóa đúng Python theo .python-version.
# Dùng: ./scripts/bootstrap-backend.sh
#
# - Kiểm tra Python major/minor khớp .python-version (mặc định 3.11).
# - Tạo venv, cài dependencies.
# - Chạy Django system check + migrate + kiểm tra migration treo.
# Không seed dữ liệu và không chạy test ở đây (xem scripts/check_all.sh).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

REQUIRED="$(cat "$ROOT/.python-version" 2>/dev/null || echo '3.11')"
REQUIRED="${REQUIRED%%.*}.$(echo "$REQUIRED" | cut -d. -f2)"  # normalize to major.minor

# Chọn interpreter: ưu tiên pythonX.Y khớp .python-version.
PY_BIN="python${REQUIRED}"
if ! command -v "$PY_BIN" >/dev/null 2>&1; then
  PY_BIN="python3"
fi

step "Kiểm tra Python (${REQUIRED})"
ACTUAL="$("$PY_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
if [ "$ACTUAL" != "$REQUIRED" ]; then
  printf '\033[1;31mLỗi: cần Python %s nhưng %s là %s.\033[0m\n' "$REQUIRED" "$PY_BIN" "$ACTUAL" >&2
  printf 'Cài đúng phiên bản (pyenv install %s hoặc brew install python@%s) rồi chạy lại.\n' "$REQUIRED" "$REQUIRED" >&2
  exit 1
fi

step "Tạo virtualenv (backend/venv)"
if [ ! -d venv ]; then
  "$PY_BIN" -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate

step "Cài dependencies"
pip install --upgrade pip >/dev/null
pip install -r requirements.txt

if [ ! -f .env ] && [ -f .env.example ]; then
  step "Tạo .env từ .env.example (chỉnh DB_* nếu PostgreSQL local khác)"
  cp .env.example .env
fi

step "Django system check"
python manage.py check

step "Kiểm tra migration treo"
python manage.py makemigrations --check --dry-run

step "Áp dụng migrations"
python manage.py migrate

printf '\n\033[1;32m✓ Backend sẵn sàng (Python %s). Tiếp: seed dữ liệu hoặc ./scripts/check_all.sh\033[0m\n' "$REQUIRED"
