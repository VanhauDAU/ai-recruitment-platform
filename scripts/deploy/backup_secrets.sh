#!/usr/bin/env bash
# Đóng gói bí mật chỉ có trên VPS (backend/.env, frontend/.env, deploy/certs) → mã hóa
# age → đẩy lên R2 (tiền tố secrets/ của bucket sao lưu DB). Chạy TAY mỗi lần sửa một
# trong các file đó; không đặt cron.
#   scripts/deploy/backup_secrets.sh
#   scripts/deploy/backup_secrets.sh --output /dev/shm/procv-secrets.tar.gz.age   # thêm bản cục bộ để tải về
#
# Bản này chỉ là lưới an toàn thứ hai: nguồn chính là password manager của chủ dự án
# (giữ cả khóa riêng age — không có khóa thì không giải mã được chính bản này).
# Giải mã: age -d -i <khóa> procv-secrets-....tar.gz.age | tar -xzf - -C /srv/procv
# Cấu hình: BACKUP_AGE_RECIPIENT, BACKUP_RCLONE_REMOTE (như backup_db.sh).
set -euo pipefail
# shellcheck source=scripts/deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

OUTPUT=""
while (($#)); do
  case "$1" in
    --output)
      OUTPUT="${2:?--output cần đường dẫn file}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "Tham số lạ: $1 (xem --help)" ;;
  esac
done

age_recipient_args
REMOTE="$(backup_remote)"
[[ -n "$REMOTE" || -n "$OUTPUT" ]] || die "Chưa đặt BACKUP_RCLONE_REMOTE; dùng --output để chỉ lưu cục bộ."
[[ -z "$REMOTE" ]] || command -v rclone >/dev/null || die "Thiếu rclone: sudo apt-get install -y rclone"

ITEMS=()
for item in backend/.env frontend/.env deploy/certs; do
  if [[ -e "$ROOT/$item" ]]; then
    ITEMS+=("$item")
  else
    log "Cảnh báo: không có $item, bỏ qua."
  fi
done
[[ -f "$ROOT/backend/.env" ]] || die "Không có backend/.env — không có gì đáng sao lưu."

umask 077
name="procv-secrets-$(hostname -s)-$(date +%Y%m%d-%H%M%S).tar.gz.age"
tmp="$(mktemp "${TMPDIR:-/tmp}/procv-secrets.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
trap 'exit 130' INT TERM HUP

# pipefail: tar lỗi (file không đọc được) làm hỏng cả lệnh, không ra bản thiếu.
tar -C "$ROOT" -czf - "${ITEMS[@]}" | age "${AGE_ARGS[@]}" -o "$tmp"
log "Đã đóng gói ${ITEMS[*]} ($(du -h "$tmp" | cut -f1))."

if [[ -n "$REMOTE" ]]; then
  rclone copyto --s3-no-check-bucket "$tmp" "$REMOTE/secrets/$name"
  log "Đã đẩy lên $REMOTE/secrets/$name"
fi
if [[ -n "$OUTPUT" ]]; then
  cp "$tmp" "$OUTPUT"
  log "Bản cục bộ: $OUTPUT — tải về rồi xóa: shred -u $OUTPUT"
fi
