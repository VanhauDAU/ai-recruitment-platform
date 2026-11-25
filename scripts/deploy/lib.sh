#!/usr/bin/env bash
# Hàm dùng chung cho deploy.sh và các script sao lưu/khôi phục. Chỉ để `source`:
#   . "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# Cần bash >= 4.1 (Ubuntu 24.04 có bash 5.2) và flock (util-linux).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="$ROOT/scripts/deploy/compose.sh"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
LOCK_DIR="${PROCV_LOCK_DIR:-$ROOT/backups/.locks}"
export ROOT COMPOSE BACKUP_DIR

# usage: in khối chú thích đầu script đang chạy (sau dòng shebang) làm trợ giúp.
usage() { awk 'NR > 1 && /^#/ {print; next} NR > 1 {exit}' "$0"; }
log() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }
die() {
  log "LỖI: $*" >&2
  exit 1
}

# env_get KHÓA [mặc định]: biến môi trường thắng, sau đó dòng `KHÓA=...` cuối cùng
# trong backend/.env. Đọc bằng grep, không `source` (giá trị có thể chứa $, khoảng trắng).
env_get() {
  local key="$1" default="${2:-}" line value
  if [[ -n "${!key:-}" ]]; then
    printf '%s' "${!key}"
    return
  fi
  line="$(grep -E "^${key}=" "$ROOT/backend/.env" 2>/dev/null | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "${value:-$default}"
}

# acquire_lock TÊN: giữ khóa flock tới khi tiến trình thoát; lần chạy thứ hai báo lỗi
# ngay thay vì chờ. Tiến trình con (restore_db.sh gọi backup_db.sh) thừa hưởng file
# descriptor nên không tự khóa lại khóa cha đang giữ (PROCV_LOCKS_HELD).
acquire_lock() {
  local name="$1" fd
  [[ ":${PROCV_LOCKS_HELD:-}:" == *":$name:"* ]] && return 0
  command -v flock >/dev/null || die "Thiếu flock (gói util-linux)."
  mkdir -p "$LOCK_DIR"
  exec {fd}>>"$LOCK_DIR/$name.lock"
  flock -n "$fd" || die "Đang có một tiến trình '$name' khác chạy ($LOCK_DIR/$name.lock)."
  export PROCV_LOCKS_HELD="${PROCV_LOCKS_HELD:-}:$name"
}

# rotate_log FILE [byte]: quá ngưỡng (mặc định 5 MB) thì đổi tên thành .1, giữ 3 bản.
rotate_log() {
  local file="$1" max="${2:-5242880}" i
  [[ -f "$file" ]] || return 0
  (($(wc -c <"$file") > max)) || return 0
  for i in 2 1; do
    [[ -f "$file.$i" ]] && mv -f "$file.$i" "$file.$((i + 1))"
  done
  mv -f "$file" "$file.1"
}

# hc_ping URL [start|fail] [nội dung]: báo healthchecks.io; URL trống thì bỏ qua.
# Lỗi mạng khi ping không làm hỏng lần sao lưu.
hc_ping() {
  local url="$1" suffix="${2:-}" body="${3:-}"
  [[ -n "$url" ]] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$body" "$url${suffix:+/$suffix}" \
    || log "Cảnh báo: không ping được healthchecks${suffix:+ ($suffix)}." >&2
}

# age_recipient_args: đổi BACKUP_AGE_RECIPIENT (một hoặc nhiều khóa age1..., cách nhau
# dấu phẩy/khoảng trắng) thành mảng AGE_ARGS=(-r k1 -r k2).
age_recipient_args() {
  local recipients key
  command -v age >/dev/null || die "Thiếu age: sudo apt-get install -y age"
  recipients="$(env_get BACKUP_AGE_RECIPIENT)"
  [[ -n "$recipients" ]] || die "Chưa đặt BACKUP_AGE_RECIPIENT (khóa công khai age1...) trong backend/.env."
  AGE_ARGS=()
  for key in ${recipients//,/ }; do
    [[ "$key" == age1* ]] || die "BACKUP_AGE_RECIPIENT chứa giá trị không phải khóa công khai age."
    AGE_ARGS+=(-r "$key")
  done
}

# Remote rclone của bucket sao lưu DB/secret. RCLONE_REMOTE là tên cũ, vẫn nhận.
backup_remote() { env_get BACKUP_RCLONE_REMOTE "$(env_get RCLONE_REMOTE)"; }

# _set_r2_remote TÊN_BIẾN TÊN_REMOTE BIẾN_GHI_ĐÈ TIỀN_TỐ_R2 BUCKET_MẶC_ĐỊNH: gán cho
# biến TÊN_BIẾN remote rclone `TÊN_REMOTE:<bucket>` của một bucket ứng dụng. Remote dựng
# từ R2_ENDPOINT_URL + <TIỀN_TỐ_R2>_ACCESS_KEY_ID/_SECRET_ACCESS_KEY sẵn có trong
# backend/.env qua biến RCLONE_CONFIG_<TÊN_REMOTE>_*: khóa không hiện trên dòng lệnh
# (argv, `ps`) và không phải chép thêm vào rclone.conf. BIẾN_GHI_ĐÈ (remote:bucket đã
# cấu hình) thắng, dùng khi diễn tập/kiểm thử.
_set_r2_remote() {
  local var="$1" remote="$2" override_key="$3" prefix="$4" default_bucket="$5"
  local value endpoint key secret upper
  value="$(env_get "$override_key")"
  if [[ -z "$value" ]]; then
    endpoint="$(env_get R2_ENDPOINT_URL)"
    key="$(env_get "${prefix}_ACCESS_KEY_ID")"
    secret="$(env_get "${prefix}_SECRET_ACCESS_KEY")"
    [[ -n "$endpoint" && -n "$key" && -n "$secret" ]] \
      || die "Thiếu R2_ENDPOINT_URL / ${prefix}_ACCESS_KEY_ID / ${prefix}_SECRET_ACCESS_KEY trong backend/.env."
    upper="${remote^^}"
    export "RCLONE_CONFIG_${upper}_TYPE=s3" "RCLONE_CONFIG_${upper}_PROVIDER=Cloudflare"
    export "RCLONE_CONFIG_${upper}_ENDPOINT=$endpoint"
    export "RCLONE_CONFIG_${upper}_ACCESS_KEY_ID=$key"
    export "RCLONE_CONFIG_${upper}_SECRET_ACCESS_KEY=$secret"
    export "RCLONE_CONFIG_${upper}_NO_CHECK_BUCKET=true"
    value="$remote:$(env_get "${prefix}_BUCKET" "$default_bucket")"
  fi
  printf -v "$var" '%s' "$value"
}

# set_private_remote: PRIVATE_REMOTE = bucket file riêng tư (CV, tài liệu công ty, bản
# xuất). BACKUP_FILES_SOURCE ghi đè.
set_private_remote() {
  _set_r2_remote PRIVATE_REMOTE procvprivate BACKUP_FILES_SOURCE R2_PRIVATE procv-private-files
}

# set_public_remote: PUBLIC_REMOTE = bucket media công khai (avatar, logo, banner, ảnh
# bài đăng). BACKUP_PUBLIC_FILES_SOURCE ghi đè.
set_public_remote() {
  _set_r2_remote PUBLIC_REMOTE procvpublic BACKUP_PUBLIC_FILES_SOURCE R2_PUBLIC procv-public-media
}

# Dịch vụ compose. Danh sách lấy từ file compose thay vì viết cứng để mọi nhánh
# (tách redis-broker/redis-cache, thêm email-worker...) dùng chung một script.
compose_services() { "$COMPOSE" config --services; }
redis_services() { compose_services | grep '^redis' || true; }
app_services() { compose_services | grep -Ev '^(db|redis.*)$' || true; }

# db_sql "SELECT ...": chạy một câu SQL trong container db, in kết quả thô.
db_sql() {
  # shellcheck disable=SC2016 # $POSTGRES_* nở trong container, không phải ở đây.
  "$COMPOSE" exec -T db sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -XAtq -v ON_ERROR_STOP=1 -c "$1"' sh "$1"
}

db_running() { [[ -n "$("$COMPOSE" ps --status running -q db 2>/dev/null)" ]]; }

# DB đã có schema Django chưa (VPS mới / DB trống thì không có gì để sao lưu).
db_has_schema() {
  db_running && [[ "$(db_sql "SELECT to_regclass('public.django_migrations') IS NOT NULL" 2>/dev/null)" == t ]]
}

# wait_ready [giây]: chờ backend trả 200 ở /api/health/ready/ (DB + redis); bản chưa
# có endpoint này (404) thì dùng /api/health/. Gọi trong container nên không phụ thuộc nginx.
READY_PY='
import urllib.error, urllib.request
def get(path):
    req = urllib.request.Request("http://127.0.0.1:8000" + path,
        headers={"Host": "procv.site", "X-Forwarded-Proto": "https"})
    try:
        return urllib.request.urlopen(req, timeout=5).status
    except urllib.error.HTTPError as exc:
        return exc.code
path = "/api/health/ready/"
code = get(path)
if code == 404:
    path = "/api/health/"
    code = get(path)
print(("ok " if code == 200 else "wait ") + path + " " + str(code))
'
wait_ready() {
  local deadline=$((SECONDS + ${1:-300})) result=""
  while :; do
    result="$("$COMPOSE" exec -T backend python -c "$READY_PY" 2>/dev/null || true)"
    if [[ "$result" == ok* ]]; then
      log "Backend sẵn sàng: ${result#ok }"
      return 0
    fi
    if ((SECONDS > deadline)); then
      log "Quá thời gian chờ backend sẵn sàng (${result:-không gọi được})." >&2
      return 1
    fi
    sleep 5
  done
}
