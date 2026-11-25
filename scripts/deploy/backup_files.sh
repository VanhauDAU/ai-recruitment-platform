#!/usr/bin/env bash
# Sao lưu bucket file riêng tư (CV, tài liệu công ty, bản xuất) và bucket media công
# khai (avatar, logo, banner, ảnh bài đăng) sang hai bucket sao lưu riêng trên R2. Cron
# 03:30 hằng ngày (sau backup DB 03:00).
#   scripts/deploy/backup_files.sh
#
# Cấu hình (biến môi trường thắng, sau đó backend/.env):
#   BACKUP_FILES_REMOTE         đích file riêng tư, ví dụ r2-backup-files:procv-backups-files
#                               (bắt buộc)
#   BACKUP_PUBLIC_FILES_REMOTE  đích media công khai, ví dụ
#                               r2-backup-public:procv-backups-public-media; trống = cảnh
#                               báo và bỏ qua phần media công khai
#   HC_BACKUP_FILES_URL         URL ping healthchecks.io; trống = không ping
#   Nguồn dựng từ R2_ENDPOINT_URL + R2_PRIVATE_* / R2_PUBLIC_* + R2_*_BUCKET;
#   BACKUP_FILES_SOURCE / BACKUP_PUBLIC_FILES_SOURCE (remote:bucket) ghi đè.
#
# Vì sao `rclone copy --ignore-existing` mà không phải `sync`:
#   - sync xóa ở đích những gì nguồn đã xóa → xóa nhầm ở prod lan sang bản sao lưu.
#   - Bucket đích bật Bucket Lock: object không xóa/ghi đè được trong thời hạn khóa,
#     sync hay ghi đè sẽ lỗi. --ignore-existing chỉ tải object CHƯA có ở đích, không
#     bao giờ ghi đè hay xóa. Storage key của cả hai bucket là duy nhất (uuid/checksum,
#     storage đặt file_overwrite=False) nên không bỏ sót phiên bản.
#   - Lifecycle rule của bucket đích xóa object sau N ngày (> thời hạn khóa); file còn
#     sống ở nguồn sẽ được tải lại ở lần chạy kế tiếp, file đã bị người dùng xóa biến
#     mất khỏi bản sao lưu sau N ngày (phù hợp yêu cầu xóa dữ liệu cá nhân).
# Một bucket lỗi không chặn bucket còn lại; script thoát mã lỗi (ping /fail) nếu có
# bucket lỗi.
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
PUBLIC_DEST="$(env_get BACKUP_PUBLIC_FILES_REMOTE)"
# Dựng đủ remote trước khi chép: thiếu cấu hình thì dừng ngay, không sao lưu dở một nửa.
set_private_remote
[[ -z "$PUBLIC_DEST" ]] || set_public_remote
hc_ping "$HC_URL" start

# copy_bucket NGUỒN ĐÍCH: chép object chưa có ở đích, không ghi đè, không xóa.
# --metadata giữ Cache-Control/Content-Type của object (media công khai được phục vụ
# thẳng từ R2 với Cache-Control immutable) để bản khôi phục giống hệt bản gốc.
copy_bucket() {
  log "==> Sao lưu ${1#*:} → $2"
  rclone copy "$1" "$2" \
    --ignore-existing --metadata --s3-no-check-bucket --fast-list \
    --transfers 8 --checkers 16 \
    --stats 10m --stats-one-line --stats-log-level NOTICE
}

failed=()
copy_bucket "$PRIVATE_REMOTE" "$DEST" || failed+=(private)
public_note="media công khai: xong"
if [[ -n "$PUBLIC_DEST" ]]; then
  copy_bucket "$PUBLIC_REMOTE" "$PUBLIC_DEST" || failed+=(public)
else
  public_note="media công khai: BỎ QUA (chưa đặt BACKUP_PUBLIC_FILES_REMOTE)"
  log "Cảnh báo: chưa đặt BACKUP_PUBLIC_FILES_REMOTE, bỏ qua sao lưu media công khai." >&2
fi
((${#failed[@]} == 0)) || die "Sao lưu lỗi ở bucket: ${failed[*]}."
log "==> Xong ($public_note)"
hc_ping "$HC_URL" "" "backup_files.sh xong trên $(hostname); $public_note"
