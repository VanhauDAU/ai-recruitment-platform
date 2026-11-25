#!/usr/bin/env bash
# Khôi phục PostgreSQL production từ một bản pg_dump -Fc (backup_db.sh hoặc dump
# lấy từ máy dev cho lần nạp dữ liệu đầu). Ghi đè toàn bộ dữ liệu hiện có.
#   scripts/deploy/restore_db.sh backups/procv-20261201-0300.dump
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="$ROOT/scripts/deploy/compose.sh"
DUMP="${1:?Cách dùng: restore_db.sh <file.dump>}"
APP_SERVICES=(web backend realtime worker ai-worker ml-worker beat)

[[ -f "$DUMP" ]] || { echo "Không thấy $DUMP" >&2; exit 1; }

read -r -p "Ghi đè database production bằng $DUMP? Gõ 'procv' để tiếp tục: " answer
[[ "$answer" == procv ]] || { echo "Đã hủy."; exit 1; }

echo "==> Dừng ứng dụng"
"$COMPOSE" stop "${APP_SERVICES[@]}"
"$COMPOSE" up -d db redis

# --no-owner/--no-privileges: dump từ dev có thể thuộc user khác DB_USER.
echo "==> pg_restore"
"$COMPOSE" exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  < "$DUMP"

echo "==> Áp migration của code hiện tại rồi bật lại"
"$COMPOSE" up -d
"$COMPOSE" ps
