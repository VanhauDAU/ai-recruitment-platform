#!/usr/bin/env bash
# Sao lưu PostgreSQL production (pg_dump -Fc), giữ KEEP bản gần nhất trên VPS và
# đẩy một bản sang R2 nếu đã cấu hình rclone (RCLONE_REMOTE, ví dụ
# r2-backup:procv-backups). Cron 03:00 hằng ngày:
#   0 3 * * * /srv/procv/scripts/deploy/backup_db.sh >> /srv/procv/backups/backup.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="$ROOT/scripts/deploy/compose.sh"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP="${KEEP:-7}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
REMOTE_KEEP_DAYS="${REMOTE_KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
target="$BACKUP_DIR/procv-$(date +%Y%m%d-%H%M).dump"

# Biến POSTGRES_* có sẵn trong container db; không đưa mật khẩu ra dòng lệnh.
"$COMPOSE" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$target.tmp"
mv "$target.tmp" "$target"
chmod 600 "$target"
echo "$(date -Iseconds) backup $target ($(du -h "$target" | cut -f1))"

# Giữ KEEP bản mới nhất.
ls -1t "$BACKUP_DIR"/procv-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm -f

if [[ -n "$RCLONE_REMOTE" ]]; then
  rclone copy "$target" "$RCLONE_REMOTE/"
  rclone delete --min-age "${REMOTE_KEEP_DAYS}d" "$RCLONE_REMOTE/"
  echo "$(date -Iseconds) uploaded to $RCLONE_REMOTE"
fi
