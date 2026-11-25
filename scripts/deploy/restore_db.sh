#!/usr/bin/env bash
# Khôi phục PostgreSQL production từ bản của backup_db.sh (.dump.age) hoặc một dump
# thô -Fc (.dump, ví dụ dump máy dev cho lần nạp đầu). GHI ĐÈ toàn bộ dữ liệu hiện có.
#   scripts/deploy/restore_db.sh --identity /dev/shm/procv-age.key backups/procv-20261201-030000.dump.age
#   scripts/deploy/restore_db.sh --from-dev procv-initial.dump
#
# Tùy chọn:
#   --identity FILE     khóa riêng age để giải mã (hoặc biến BACKUP_AGE_IDENTITY). Khóa
#                       KHÔNG nằm thường trực trên VPS: chép vào /dev/shm (RAM) ngay trước
#                       khi chạy và `shred -u` ngay sau đó.
#   --from-dev          dump lấy từ máy dev: chạy purge_demo_accounts --confirm sau khi nạp.
#   --skip-safety-dump  không dump DB hiện tại trước khi ghi đè (DB trống tự bỏ qua).
#   --yes               không hỏi xác nhận (diễn tập theo kịch bản).
#
# Trình tự: giải mã → kiểm tra dump → xác nhận → dump an toàn DB hiện tại
# (backup_db.sh --label pre-restore) → dừng app, giữ web để nginx trả trang bảo trì →
# dropdb/createdb → pg_restore --exit-on-error --single-transaction → FLUSHALL mọi
# redis → up -d (migrate chạy trước) → chờ sẵn sàng → đối soát sau khôi phục.
# Runbook: docs/06-deployment/sao-luu-va-khoi-phuc.md.
set -euo pipefail
# shellcheck source=scripts/deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

IDENTITY="${BACKUP_AGE_IDENTITY:-}"
FROM_DEV=false
SAFETY_DUMP=true
ASSUME_YES=false
DUMP=""
while (($#)); do
  case "$1" in
    --identity)
      IDENTITY="${2:?--identity cần đường dẫn khóa}"
      shift 2
      ;;
    --from-dev) FROM_DEV=true && shift ;;
    --skip-safety-dump) SAFETY_DUMP=false && shift ;;
    --yes) ASSUME_YES=true && shift ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*) die "Tham số lạ: $1 (xem --help)" ;;
    *)
      [[ -z "$DUMP" ]] || die "Chỉ nhận một file dump."
      DUMP="$1"
      shift
      ;;
  esac
done
[[ -n "$DUMP" ]] || die "Cách dùng: restore_db.sh [--identity KHÓA] [--from-dev] <file.dump|file.dump.age> (xem --help)"
[[ -f "$DUMP" ]] || die "Không thấy $DUMP"

umask 077
mkdir -p "$BACKUP_DIR"
acquire_lock db
PLAIN=""
cleanup() { [[ -z "$PLAIN" ]] || rm -f "$PLAIN"; }
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

if [[ "$DUMP" == *.age ]]; then
  command -v age >/dev/null || die "Thiếu age: sudo apt-get install -y age"
  [[ -n "$IDENTITY" && -f "$IDENTITY" ]] || die "Bản .age cần --identity <file khóa riêng age>."
  PLAIN="$BACKUP_DIR/restore-$(date +%Y%m%d-%H%M%S).dump.tmp"
  log "==> Giải mã ${DUMP##*/}"
  age -d -i "$IDENTITY" -o "$PLAIN" "$DUMP" || die "Giải mã thất bại (sai khóa hoặc file hỏng)."
  SOURCE="$PLAIN"
else
  SOURCE="$DUMP"
fi

mapfile -t REDIS < <(redis_services)
log "==> Bật db + redis (${REDIS[*]:-không có})"
"$COMPOSE" up -d --wait db "${REDIS[@]}"

log "==> Kiểm tra bản dump"
toc="$("$COMPOSE" exec -T db pg_restore --list <"$SOURCE")" || die "pg_restore --list không đọc được $DUMP."
grep -q 'TABLE DATA public django_migrations ' <<<"$toc" || die "Bản dump không có bảng django_migrations — không phải DB ProCV?"
log "    $(grep -c ' TABLE DATA ' <<<"$toc") bảng."

if [[ "$ASSUME_YES" == false ]]; then
  read -r -p "Ghi đè database production bằng ${DUMP##*/}? Gõ 'procv' để tiếp tục: " answer
  [[ "$answer" == procv ]] || die "Đã hủy."
fi

SAFETY=""
if [[ "$SAFETY_DUMP" == true ]] && db_has_schema; then
  log "==> Dump an toàn DB hiện tại"
  "$ROOT/scripts/deploy/backup_db.sh" --label pre-restore
  SAFETY="$(find "$BACKUP_DIR" -maxdepth 1 -name 'procv-pre-restore-*.dump.age' | sort | tail -n 1)"
else
  log "==> Bỏ qua dump an toàn (DB trống hoặc --skip-safety-dump)"
fi

mapfile -t STOP < <(app_services | grep -vx web || true)
log "==> Bảo trì: dừng ${STOP[*]:-(không có)}; web giữ chạy để trả trang bảo trì"
((${#STOP[@]} == 0)) || "$COMPOSE" stop "${STOP[@]}"

# Tạo DB mới thay vì pg_restore --clean: không sót bảng/sequence/extension của schema
# cũ mà dump không biết tới.
log "==> dropdb/createdb"
# shellcheck disable=SC2016 # $POSTGRES_* nở trong container.
"$COMPOSE" exec -T db sh -c \
  'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'

# --no-owner/--no-privileges: dump từ dev có thể thuộc user khác DB_USER.
log "==> pg_restore"
# shellcheck disable=SC2016
if ! "$COMPOSE" exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error --single-transaction' \
  <"$SOURCE"; then
  log "pg_restore THẤT BẠI: DB đang trống, ứng dụng vẫn dừng (web trả trang bảo trì)." >&2
  [[ -z "$SAFETY" ]] || log "Nạp lại bản trước khi khôi phục: $0 --identity <khóa> --skip-safety-dump $SAFETY" >&2
  exit 1
fi

# Cache và hàng đợi Celery đang trỏ vào dữ liệu cũ (ID, phiên, task chờ).
for svc in "${REDIS[@]}"; do
  log "==> FLUSHALL $svc"
  [[ "$("$COMPOSE" exec -T "$svc" redis-cli FLUSHALL)" == OK ]] || die "FLUSHALL $svc thất bại."
done

log "==> Áp migration của code hiện tại rồi bật lại toàn bộ"
"$COMPOSE" up -d
wait_ready 300 || die "Backend chưa sẵn sàng; xem scripts/deploy/compose.sh logs migrate backend."

manage() { "$COMPOSE" exec -T backend python manage.py "$@"; }
has_command() { manage help "$1" >/dev/null 2>&1; }

# Chỉ đọc: in số lệch giữa trạng thái tài khoản và policy hold để quản trị duyệt.
if has_command reconcile_account_status_holds; then
  log "==> Đối soát policy hold (chỉ đọc)"
  manage reconcile_account_status_holds
  log "    Có số khác 0: duyệt rồi chạy ... manage.py reconcile_account_status_holds --apply"
else
  log "Cảnh báo: code hiện tại không có reconcile_account_status_holds, bỏ qua."
fi

if [[ "$FROM_DEV" == true ]]; then
  has_command purge_demo_accounts || die "Thiếu lệnh purge_demo_accounts: KHÔNG mở site khi còn tài khoản demo."
  log "==> Dọn tài khoản demo (@demo.local)"
  manage purge_demo_accounts --confirm
fi

"$COMPOSE" ps
log "==> Đã khôi phục ${DUMP##*/}. Việc tiếp theo:"
log "    - Tính lại embedding: scripts/deploy/compose.sh exec ml-worker python manage.py matching_backfill"
[[ -z "$SAFETY" ]] || log "    - Bản an toàn trước khi khôi phục: $SAFETY"
[[ -z "$IDENTITY" ]] || log "    - Xóa khóa riêng khỏi VPS: shred -u $IDENTITY"
