#!/usr/bin/env bash
# Dựng môi trường backend từ đầu, khóa đúng Python theo .python-version.
# Dùng: ./scripts/bootstrap-backend.sh [--recreate]
#
# - Kiểm tra Python major/minor khớp .python-version (mặc định 3.11).
# - Từ chối cài dependencies vào venv cũ sai phiên bản (dùng --recreate để tạo lại).
# - Tạo venv, cài dependencies.
# - Chạy Django system check + migrate + kiểm tra migration treo.
# Không seed dữ liệu và không chạy test ở đây (xem scripts/check_all.sh).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[1;31mLỗi: %s\033[0m\n' "$1" >&2; }

RECREATE=0
for arg in "$@"; do
  case "$arg" in
    --recreate) RECREATE=1 ;;
    *) fail "Tham số không hợp lệ: $arg (chỉ hỗ trợ --recreate)"; exit 2 ;;
  esac
done

REQUIRED="$(cat "$ROOT/.python-version" 2>/dev/null || echo '3.11')"
REQUIRED="${REQUIRED%%.*}.$(echo "$REQUIRED" | cut -d. -f2)"  # normalize to major.minor

# major.minor của một interpreter bất kỳ; rỗng nếu không chạy được.
py_minor() { "$1" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true; }

# Chọn interpreter: ưu tiên pythonX.Y khớp .python-version.
PY_BIN="python${REQUIRED}"
if ! command -v "$PY_BIN" >/dev/null 2>&1; then
  PY_BIN="python3"
fi

step "Kiểm tra Python (${REQUIRED})"
ACTUAL="$(py_minor "$PY_BIN")"
if [ "$ACTUAL" != "$REQUIRED" ]; then
  fail "cần Python $REQUIRED nhưng $PY_BIN là ${ACTUAL:-không chạy được}."
  printf 'Cài đúng phiên bản (pyenv install %s hoặc brew install python@%s) rồi chạy lại.\n' "$REQUIRED" "$REQUIRED" >&2
  exit 1
fi

step "Chuẩn bị virtualenv (backend/venv)"
if [ -d venv ]; then
  # venv đã tồn tại: KHÔNG cài đè lên venv sai phiên bản (đây là bẫy hay gặp —
  # venv cũ tạo bằng Python khác sẽ nuốt dependencies và gây lỗi khó hiểu).
  VENV_VER="$(py_minor venv/bin/python)"
  if [ "$VENV_VER" = "$REQUIRED" ]; then
    printf 'venv hiện có dùng Python %s — tái sử dụng.\n' "$VENV_VER"
  elif [ "$RECREATE" -eq 1 ]; then
    printf 'venv hiện có là Python %s (cần %s) — xóa và tạo lại (--recreate).\n' "${VENV_VER:-hỏng}" "$REQUIRED"
    rm -rf venv
    "$PY_BIN" -m venv venv
  else
    fail "backend/venv đang dùng Python ${VENV_VER:-không xác định} nhưng cần $REQUIRED."
    printf 'KHÔNG cài dependencies vào venv sai phiên bản. Chọn một cách:\n' >&2
    printf '  1) Xóa rồi chạy lại:  rm -rf backend/venv && ./scripts/bootstrap-backend.sh\n' >&2
    printf '  2) Tự động tạo lại:   ./scripts/bootstrap-backend.sh --recreate\n' >&2
    exit 1
  fi
else
  "$PY_BIN" -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate

# Chốt chặn cuối: interpreter đang active phải đúng phiên bản trước khi cài.
ACTIVE_VER="$(py_minor python)"
if [ "$ACTIVE_VER" != "$REQUIRED" ]; then
  fail "interpreter trong venv là ${ACTIVE_VER:-không xác định}, không phải $REQUIRED. Dừng để tránh cài nhầm."
  exit 1
fi

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
