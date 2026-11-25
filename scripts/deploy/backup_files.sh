#!/usr/bin/env bash
# Sao lưu bucket file riêng tư (CV, tài liệu công ty, bản xuất) sang bucket sao lưu
# riêng trên R2. Cron 03:30 hằng ngày (sau backup DB 03:00).
#   scripts/deploy/backup_files.sh
#
# Cấu hình (biến môi trường thắng, sau đó backend/.env):
#   BACKUP_FILES_REMOTE  đích, ví dụ r2-backup-files:procv-backups-files (bắt buộc)
#   HC_BACKUP_FILES_URL  URL ping healthchecks.io; trống = không ping
#   Nguồn dựng từ R2_ENDPOINT_URL + R2_PRIVATE_* + R2_PRIVATE_BUCKET; BACKUP_FILES_SOURCE
#   (remote:bucket) ghi đè.
#
# Vì sao `rclone copy --ignore-existing` mà không phải `sync`:
#   - sync xóa ở đích những gì nguồn đã xóa → xóa nhầm ở prod lan sang bản sao lưu.
#   - Bucket đích bật Bucket Lock: object không xóa/ghi đè được trong thời hạn khóa,
#     sync hay ghi đè sẽ lỗi. --ignore-existing chỉ tải object CHƯA có ở đích, không
#     bao giờ ghi đè hay xóa. Storage key của file riêng tư là duy nhất (không ghi
#     đè cùng key) nên không bỏ sót phiên bản.
#   - Lifecycle rule của bucket đích xóa object sau N ngày (> thời hạn khóa); file còn
#     sống ở nguồn sẽ được tải lại ở lần chạy kế tiếp, file đã bị người dùng xóa biến
#     mất khỏi bản sao lưu sau N ngày (phù hợp yêu cầu xóa dữ liệu cá nhân).
set -euo pipefail
# shellcheck source=scripts/deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

case "${1:-}" in
  "") ;;
  -h | --help)
    usage
    exit 0
    ;;
  *) die "Tham số lạ: $1 (xem --help)" ;;
esac

umask 077
mkdir -p "$BACKUP_DIR"
acquire_lock files
rotate_log "$BACKUP_DIR/backup-files.log"
exec > >(tee -a "$BACKUP_DIR/backup-files.log") 2>&1

HC_URL="$(env_get HC_BACKUP_FILES_URL)"
on_exit() {
  local rc=$?
  ((rc == 0)) || {
    log "Sao lưu file THẤT BẠI (mã $rc)"
    hc_ping "$HC_URL" fail "backup_files.sh thất bại (mã $rc) trên $(hostname)"
  }
}
trap on_exit EXIT
trap 'exit 130' INT TERM HUP

command -v rclone >/dev/null || die "Thiếu rclone: sudo apt-get install -y rclone"
DEST="$(env_get BACKUP_FILES_REMOTE)"
[[ -n "$DEST" ]] || die "Chưa đặt BACKUP_FILES_REMOTE (ví dụ r2-backup-files:procv-backups-files)."
set_private_remote
hc_ping "$HC_URL" start

log "==> Sao lưu ${PRIVATE_REMOTE#*:} → $DEST"
rclone copy "$PRIVATE_REMOTE" "$DEST" \
  --ignore-existing --s3-no-check-bucket --fast-list \
  --transfers 8 --checkers 16 \
  --stats 10m --stats-one-line --stats-log-level NOTICE
log "==> Xong"
hc_ping "$HC_URL" "" "backup_files.sh xong trên $(hostname)"
