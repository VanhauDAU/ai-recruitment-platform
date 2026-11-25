#!/usr/bin/env bash
# Sao lưu PostgreSQL production: pg_dump -Fc → kiểm tra (pg_restore --list + ngưỡng
# kích thước) → mã hóa age → đẩy lên R2. Trên VPS chỉ còn bản đã mã hóa.
#   scripts/deploy/backup_db.sh                          # bản định kỳ (cron 03:00)
#   scripts/deploy/backup_db.sh --label pre-deploy-abc   # bản đột xuất, không tính vào xoay vòng
#
# Cấu hình (biến môi trường thắng, sau đó backend/.env):
#   BACKUP_AGE_RECIPIENT  khóa công khai age (age1...), nhiều khóa cách nhau dấu phẩy
#   BACKUP_RCLONE_REMOTE  ví dụ r2-backup:procv-backups; trống = chỉ giữ trên VPS
#   HC_BACKUP_DB_URL      URL ping healthchecks.io của bản định kỳ; trống = không ping
# Chỉ qua biến môi trường: BACKUP_DIR (mặc định backups/), BACKUP_KEEP_DAILY=7,
#   BACKUP_KEEP_WEEKLY=4, BACKUP_KEEP_MONTHLY=6, BACKUP_KEEP_ADHOC=5,
#   BACKUP_MIN_BYTES=102400, BACKUP_MIN_FREE_MB=1024.
#
# Script KHÔNG BAO GIỜ xóa trên R2: bucket bật Bucket Lock, thời hạn lưu do lifecycle
# rule theo tiền tố daily/ weekly/ monthly/ adhoc/ quyết định. Bản đầu tiên thành công
# của mỗi tuần ISO / mỗi tháng được đẩy thêm vào weekly/ / monthly/.
# Runbook: docs/06-deployment/sao-luu-va-khoi-phuc.md.
set -euo pipefail
# shellcheck source=scripts/deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

LABEL=""
while (($#)); do
  case "$1" in
    --label)
      LABEL="${2:?--label cần một tên}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "Tham số lạ: $1 (xem --help)" ;;
  esac
done
[[ -z "$LABEL" || "$LABEL" =~ ^[a-z][a-z0-9-]*$ ]] || die "--label chỉ gồm a-z, 0-9, '-' và bắt đầu bằng chữ."

KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-6}"
KEEP_ADHOC="${BACKUP_KEEP_ADHOC:-5}"
MIN_BYTES="${BACKUP_MIN_BYTES:-102400}"
MIN_FREE_MB="${BACKUP_MIN_FREE_MB:-1024}"
REMOTE="$(backup_remote)"
# Chỉ bản định kỳ báo healthchecks: bản đột xuất thất bại đã dừng deploy/restore gọi nó.
HC_URL=""
[[ -n "$LABEL" ]] || HC_URL="$(env_get HC_BACKUP_DB_URL)"

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
acquire_lock db
rotate_log "$BACKUP_DIR/backup.log"
exec > >(tee -a "$BACKUP_DIR/backup.log") 2>&1

STEP="kiểm tra cấu hình"
TMP_FILES=()
on_exit() {
  local rc=$?
  ((${#TMP_FILES[@]} == 0)) || rm -f "${TMP_FILES[@]}"
  if ((rc != 0)); then
    log "Sao lưu THẤT BẠI ở bước: $STEP (mã $rc)"
    hc_ping "$HC_URL" fail "backup_db.sh thất bại ở bước: $STEP (mã $rc) trên $(hostname)"
  fi
}
trap on_exit EXIT
trap 'exit 130' INT TERM HUP

age_recipient_args
[[ -z "$REMOTE" ]] || command -v rclone >/dev/null || die "Thiếu rclone: sudo apt-get install -y rclone"
hc_ping "$HC_URL" start
db_running || die "Container db không chạy (scripts/deploy/compose.sh up -d db)."

STEP="kiểm tra dung lượng trống"
db_bytes="$(db_sql 'SELECT pg_database_size(current_database())')"
free_kb="$(df -Pk "$BACKUP_DIR" | awk 'NR == 2 {print $4}')"
# Bản -Fc nén nhỏ hơn DB nhiều; cần chỗ cho bản thô + bản mã hóa cùng lúc, cộng dự phòng
# để Postgres (chung ổ) không bị đầy đĩa giữa chừng.
need_kb=$((db_bytes / 1024 + MIN_FREE_MB * 1024))
((free_kb >= need_kb)) \
  || die "Ổ đĩa còn $((free_kb / 1024)) MB, cần ít nhất $((need_kb / 1024)) MB (DB $((db_bytes / 1048576)) MB + dự phòng $MIN_FREE_MB MB)."

STEP="pg_dump"
name="procv-${LABEL:+$LABEL-}$(date +%Y%m%d-%H%M%S).dump"
plain="$BACKUP_DIR/$name.tmp"
final="$BACKUP_DIR/$name.age"
TMP_FILES+=("$plain" "$final.tmp")
# Biến POSTGRES_* có sẵn trong container db; không đưa mật khẩu ra dòng lệnh.
# shellcheck disable=SC2016
"$COMPOSE" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$plain"

STEP="kiểm tra bản dump"
size="$(wc -c <"$plain" | tr -d ' ')"
((size >= MIN_BYTES)) || die "Bản dump chỉ $size byte, dưới ngưỡng BACKUP_MIN_BYTES=$MIN_BYTES."
toc="$("$COMPOSE" exec -T db pg_restore --list <"$plain")" || die "pg_restore --list không đọc được bản dump."
grep -q 'TABLE DATA public django_migrations ' <<<"$toc" || die "Bản dump không có dữ liệu bảng django_migrations."
log "Dump hợp lệ: $size byte, $(grep -c ' TABLE DATA ' <<<"$toc") bảng."

STEP="mã hóa age"
age "${AGE_ARGS[@]}" -o "$final.tmp" "$plain"
rm -f "$plain"
mv "$final.tmp" "$final"
log "Đã sao lưu $final ($(du -h "$final" | cut -f1))."

# Bậc lưu trên R2: định kỳ → daily/, thêm weekly/ và monthly/ cho bản đầu tiên của
# tuần/tháng (đánh dấu trong .last-weekly/.last-monthly, chỉ ghi khi đẩy thành công).
if [[ -n "$REMOTE" ]]; then
  STEP="đẩy lên R2"
  week="$(date +%G-W%V)"
  month="$(date +%Y-%m)"
  if [[ -n "$LABEL" ]]; then
    tiers=(adhoc)
  else
    tiers=(daily)
    [[ "$(cat "$BACKUP_DIR/.last-weekly" 2>/dev/null)" == "$week" ]] || tiers+=(weekly)
    [[ "$(cat "$BACKUP_DIR/.last-monthly" 2>/dev/null)" == "$month" ]] || tiers+=(monthly)
  fi
  for tier in "${tiers[@]}"; do
    # copyto một file tên mới (có giây): không bao giờ ghi đè hay xóa object cũ.
    rclone copyto --s3-no-check-bucket "$final" "$REMOTE/$tier/${final##*/}"
    case "$tier" in
      weekly) echo "$week" >"$BACKUP_DIR/.last-weekly" ;;
      monthly) echo "$month" >"$BACKUP_DIR/.last-monthly" ;;
    esac
  done
  log "Đã đẩy lên $REMOTE (${tiers[*]})."
else
  log "Cảnh báo: chưa đặt BACKUP_RCLONE_REMOTE — bản sao lưu chỉ nằm trên VPS."
fi

STEP="xoay vòng bản cục bộ"
iso_week() { date -d "$1" +%G-W%V 2>/dev/null || date -j -f %Y%m%d "$1" +%G-W%V; }
prune_local() {
  local -A keep=() days=() weeks=() months=()
  local files=() file stamp day week month i
  shopt -s nullglob
  files=("$BACKUP_DIR"/procv-[0-9]*.dump.age)
  # Tên chứa thời điểm nên thứ tự glob là cũ → mới; duyệt ngược để giữ bản mới nhất mỗi kỳ.
  for ((i = ${#files[@]} - 1; i >= 0; i--)); do
    file="${files[i]}"
    stamp="${file##*/procv-}"
    day="${stamp:0:8}"
    week="$(iso_week "$day")"
    month="${day:0:6}"
    if [[ -z "${days[$day]:-}" ]] && ((${#days[@]} < KEEP_DAILY)); then days[$day]=1 keep[$file]=1; fi
    if [[ -z "${weeks[$week]:-}" ]] && ((${#weeks[@]} < KEEP_WEEKLY)); then weeks[$week]=1 keep[$file]=1; fi
    if [[ -z "${months[$month]:-}" ]] && ((${#months[@]} < KEEP_MONTHLY)); then months[$month]=1 keep[$file]=1; fi
    [[ -n "${keep[$file]:-}" ]] || { rm -f "$file" && log "Xóa bản cục bộ cũ ${file##*/}"; }
  done
  # Bản đột xuất (pre-deploy-*, pre-restore...): giữ KEEP_ADHOC bản mới nhất, sắp theo
  # thời điểm cuối tên chứ không theo nhãn.
  files=("$BACKUP_DIR"/procv-[a-z]*.dump.age)
  if ((${#files[@]} > KEEP_ADHOC)); then
    printf '%s\n' "${files[@]}" \
      | sed -E 's/^(.*-([0-9]{8}-[0-9]{6})\.dump\.age)$/\2 \1/' | sort -r \
      | tail -n +"$((KEEP_ADHOC + 1))" | cut -d' ' -f2- \
      | while IFS= read -r file; do rm -f "$file" && log "Xóa bản đột xuất cũ ${file##*/}"; done
  fi
  files=("$BACKUP_DIR"/procv-*.dump)
  ((${#files[@]} == 0)) \
    || log "Cảnh báo: còn ${#files[@]} bản dump CHƯA mã hóa từ script cũ trong $BACKUP_DIR; xóa khi đã có bản .age."
}
prune_local

STEP="hoàn tất"
hc_ping "$HC_URL" "" "$(du -h "$final" | cut -f1) ${final##*/}"
