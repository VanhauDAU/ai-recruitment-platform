#!/usr/bin/env bash
# Chép ngược file từ bucket sao lưu về bucket production (riêng tư hoặc media công
# khai). Không xóa gì ở đích: file mới tạo sau lần sao lưu vẫn giữ nguyên; file thiếu
# được chép lại, file khác nội dung bị thay bằng bản sao lưu.
#   scripts/deploy/restore_files.sh --dry-run                   # xem sẽ chép những gì
#   scripts/deploy/restore_files.sh --prefix cvs/2026/11/       # chỉ một tiền tố
#   scripts/deploy/restore_files.sh --from r2-backup-read:procv-backups-files
#   scripts/deploy/restore_files.sh --bucket public --dry-run   # media công khai
#
# Tùy chọn:
#   --bucket private|public  bucket cần khôi phục (mặc định private).
#                         private: nguồn BACKUP_FILES_REMOTE → bucket R2_PRIVATE_BUCKET
#                         (đích dựng từ R2_PRIVATE_*; BACKUP_FILES_SOURCE ghi đè).
#                         public: nguồn BACKUP_PUBLIC_FILES_REMOTE → bucket R2_PUBLIC_BUCKET
#                         (đích dựng từ R2_PUBLIC_*; BACKUP_PUBLIC_FILES_SOURCE ghi đè).
#   --from REMOTE:BUCKET  nguồn, thay mặc định của --bucket. Dùng khi khôi phục qua một
#                         remote khác (VPS mới, token tạm tạo trên dashboard; xem runbook).
#   --prefix ĐƯỜNG_DẪN    chỉ khôi phục object có tiền tố này (xóa nhầm một phần).
#   --dry-run             chỉ liệt kê, không chép.
#   --yes                 không hỏi xác nhận.
set -euo pipefail
# shellcheck source=scripts/deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SOURCE=""
BUCKET=private
PREFIX=""
DRY_RUN=false
ASSUME_YES=false
while (($#)); do
  case "$1" in
    --from)
      SOURCE="${2:?--from cần remote:bucket}"
      shift 2
      ;;
    --bucket)
      BUCKET="${2:?--bucket cần private hoặc public}"
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
case "$BUCKET" in
  private) source_key=BACKUP_FILES_REMOTE ;;
  public) source_key=BACKUP_PUBLIC_FILES_REMOTE ;;
  *) die "--bucket chỉ nhận private hoặc public (nhận: $BUCKET)." ;;
esac
SOURCE="${SOURCE:-$(env_get "$source_key")}"
[[ -n "$SOURCE" ]] || die "Chưa có nguồn: --from remote:bucket hoặc $source_key."
[[ "$PREFIX" != *..* ]] || die "--prefix không được chứa '..'."
PREFIX="${PREFIX#/}"
if [[ "$BUCKET" == public ]]; then
  set_public_remote
  TARGET="$PUBLIC_REMOTE"
else
  set_private_remote
  TARGET="$PRIVATE_REMOTE"
fi
acquire_lock files

src="$SOURCE${PREFIX:+/$PREFIX}"
dst="$TARGET${PREFIX:+/$PREFIX}"
args=(copy "$src" "$dst" --metadata --s3-no-check-bucket --fast-list --transfers 8 --checkers 16)

if [[ "$DRY_RUN" == true ]]; then
  log "==> Thử (không chép): $src → ${dst#*:}"
  rclone "${args[@]}" --dry-run
  exit 0
fi

if [[ "$ASSUME_YES" == false ]]; then
  read -r -p "Chép $src vào bucket production ($BUCKET) ${dst#*:} (thay file khác nội dung)? Gõ 'procv' để tiếp tục: " answer
  [[ "$answer" == procv ]] || die "Đã hủy."
fi
log "==> Khôi phục $src → ${dst#*:}"
rclone "${args[@]}" --stats 1m --stats-one-line --stats-log-level NOTICE
log "==> Xong"
