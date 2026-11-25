#!/usr/bin/env bash
# Chép ngược file riêng tư từ bucket sao lưu về bucket production. Không xóa gì ở
# đích: file mới tạo sau lần sao lưu vẫn giữ nguyên; file thiếu được chép lại, file
# khác nội dung bị thay bằng bản sao lưu.
#   scripts/deploy/restore_files.sh --dry-run                   # xem sẽ chép những gì
#   scripts/deploy/restore_files.sh --prefix cvs/2026/11/       # chỉ một tiền tố
#   scripts/deploy/restore_files.sh --from r2-backup-read:procv-backups-files
#
# Tùy chọn:
#   --from REMOTE:BUCKET  nguồn; mặc định BACKUP_FILES_REMOTE. Dùng khi khôi phục qua một
#                         remote khác (VPS mới, token tạm tạo trên dashboard; xem runbook).
#   --prefix ĐƯỜNG_DẪN    chỉ khôi phục object có tiền tố này (xóa nhầm một phần).
#   --dry-run             chỉ liệt kê, không chép.
#   --yes                 không hỏi xác nhận.
# Đích dựng từ R2_* trong backend/.env (như backup_files.sh); BACKUP_FILES_SOURCE ghi đè.
set -euo pipefail
# shellcheck source=scripts/deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SOURCE=""
PREFIX=""
DRY_RUN=false
ASSUME_YES=false
while (($#)); do
  case "$1" in
    --from)
      SOURCE="${2:?--from cần remote:bucket}"
      shift 2
      ;;
    --prefix)
      PREFIX="${2:?--prefix cần đường dẫn}"
      shift 2
      ;;
    --dry-run) DRY_RUN=true && shift ;;
    --yes) ASSUME_YES=true && shift ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "Tham số lạ: $1 (xem --help)" ;;
  esac
done

command -v rclone >/dev/null || die "Thiếu rclone: sudo apt-get install -y rclone"
SOURCE="${SOURCE:-$(env_get BACKUP_FILES_REMOTE)}"
[[ -n "$SOURCE" ]] || die "Chưa có nguồn: --from remote:bucket hoặc BACKUP_FILES_REMOTE."
[[ "$PREFIX" != *..* ]] || die "--prefix không được chứa '..'."
PREFIX="${PREFIX#/}"
set_private_remote
acquire_lock files

src="$SOURCE${PREFIX:+/$PREFIX}"
dst="$PRIVATE_REMOTE${PREFIX:+/$PREFIX}"
args=(copy "$src" "$dst" --s3-no-check-bucket --fast-list --transfers 8 --checkers 16)

if [[ "$DRY_RUN" == true ]]; then
  log "==> Thử (không chép): $src → ${dst#*:}"
  rclone "${args[@]}" --dry-run
  exit 0
fi

if [[ "$ASSUME_YES" == false ]]; then
  read -r -p "Chép $src vào bucket production ${dst#*:} (thay file khác nội dung)? Gõ 'procv' để tiếp tục: " answer
  [[ "$answer" == procv ]] || die "Đã hủy."
fi
log "==> Khôi phục $src → ${dst#*:}"
rclone "${args[@]}" --stats 1m --stats-one-line --stats-log-level NOTICE
log "==> Xong"
