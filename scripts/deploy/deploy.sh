#!/usr/bin/env bash
# Triển khai một commit lên VPS: build image trong worktree tạm (bản đang chạy chưa bị
# đụng), gắn tag theo commit, sao lưu DB nếu có migration mới, rồi mới chuyển code,
# áp migration, khởi động lại stack, chờ sẵn sàng và gọi thử qua nginx.
#   scripts/deploy/deploy.sh                      # origin/main mới nhất
#   scripts/deploy/deploy.sh <commit|tag>         # một bản cụ thể, build lại
#   scripts/deploy/deploy.sh --skip-build <sha>   # rollback bằng image đã gắn tag, không build
#   scripts/deploy/deploy.sh --skip-build         # khởi động lại với image :prod đang có
#   scripts/deploy/deploy.sh --dry-run [...]      # chỉ in kế hoạch, không thay đổi gì
#   --no-backup                                   # bỏ sao lưu tự động trước migration
#
# Image procv-*:prod (backend, ml-worker, web) được gắn thêm tag 12 ký tự đầu của
# commit; giữ 3 tag gần nhất mỗi image. `deploy/history.log` ghi cả lần thất bại.
# Rollback code KHÔNG lùi migration: bản sao lưu pre-deploy-<sha> + restore_db.sh.
set -euo pipefail
# shellcheck source=scripts/deploy/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SKIP_BUILD=false
DRY_RUN=false
AUTO_BACKUP=true
REF=""
KEEP_IMAGES="${DEPLOY_KEEP_IMAGES:-3}"

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --dry-run) DRY_RUN=true ;;
    --no-backup) AUTO_BACKUP=false ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*) die "Tham số lạ: $arg (xem --help)" ;;
    *)
      [[ -z "$REF" ]] || die "Chỉ nhận một commit/tag."
      REF="$arg"
      ;;
  esac
done

cd "$ROOT"
acquire_lock deploy

if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short >&2
  die "Có file tracked bị sửa trực tiếp trên VPS; commit/stash trước khi deploy."
fi

PREV_SHA="$(git rev-parse HEAD)"
if [[ "$SKIP_BUILD" == true && -z "$REF" ]]; then
  REF=HEAD # chỉ khởi động lại: giữ code và image đang có
else
  REF="${REF:-origin/main}"
  log "==> Lấy code"
  git fetch --prune --tags origin
fi
SHA="$(git rev-parse --verify --quiet "$REF^{commit}")" || die "Không tìm thấy commit '$REF'."
TAG="${SHA:0:12}"
# Danh sách image lấy từ file compose của chính commit đích.
mapfile -t IMAGES < <(git show "$SHA:docker-compose.prod.yml" | grep -oE 'procv-[a-z0-9-]+:prod' | sed 's/:prod$//' | sort -u)
((${#IMAGES[@]} > 0)) || die "docker-compose.prod.yml của $TAG không có image procv-*:prod."

image_id() { docker image inspect -f '{{.Id}}' "$1" 2>/dev/null || true; }
missing_tags() {
  local img
  for img in "${IMAGES[@]}"; do [[ -n "$(image_id "$img:$TAG")" ]] || printf '%s ' "$img:$TAG"; done
}

if [[ "$SKIP_BUILD" == false ]]; then
  MODE="build"
elif [[ "$REF" == HEAD ]]; then
  MODE="restart"
else
  MODE="retag"
  missing="$(missing_tags)"
  [[ -z "$missing" ]] || die "Chưa có image ${missing}— deploy lại không kèm --skip-build để build."
fi

log "    $MODE $TAG ($(git log -1 --format=%s "$SHA")), đang chạy ${PREV_SHA:0:12}"
log "    image: ${IMAGES[*]}"
if [[ "$DRY_RUN" == true ]]; then
  log "--dry-run: dừng ở đây, không build/không đổi tag/không khởi động lại."
  exit 0
fi

# --- Ghi lịch sử + hoàn tác tag khi thất bại -------------------------------------
STEP="chuẩn bị"
SWITCHED=false
BUILD_DIR=""
declare -A PREV_IDS=()
for img in "${IMAGES[@]}"; do PREV_IDS[$img]="$(image_id "$img:prod")"; done

restore_prod_tags() {
  local img
  for img in "${IMAGES[@]}"; do
    [[ -z "${PREV_IDS[$img]}" ]] || docker tag "${PREV_IDS[$img]}" "$img:prod"
  done
}
on_exit() {
  local rc=$?
  if [[ -n "$BUILD_DIR" ]]; then
    git -C "$ROOT" worktree remove --force "$BUILD_DIR/src" 2>/dev/null || true
    rm -rf "$BUILD_DIR"
  fi
  ((rc == 0)) && return
  mkdir -p "$ROOT/deploy"
  printf '%s %s %s FAIL:%s\n' "$(date -Iseconds)" "$TAG" "$REF" "${STEP// /_}" >>"$ROOT/deploy/history.log"
  if [[ "$SWITCHED" == false ]]; then
    restore_prod_tags
    log "Deploy THẤT BẠI ở bước '$STEP' trước khi chuyển bản: stack cũ (${PREV_SHA:0:12}) vẫn nguyên." >&2
  else
    log "Deploy THẤT BẠI ở bước '$STEP' sau khi chuyển bản. Rollback:" >&2
    log "    scripts/deploy/deploy.sh --skip-build ${PREV_SHA:0:12}" >&2
  fi
}
trap on_exit EXIT
trap 'exit 130' INT TERM HUP

# --- 1. Image -------------------------------------------------------------------
case "$MODE" in
  build)
    STEP="build image"
    # Build từ worktree tạm của commit đích: thư mục đang chạy giữ nguyên code cũ tới
    # khi build xong. Env file symlink vào để compose nội suy được (.dockerignore loại .env).
    BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/procv-build.XXXXXX")"
    git worktree add --quiet --detach "$BUILD_DIR/src" "$SHA"
    ln -s "$ROOT/backend/.env" "$BUILD_DIR/src/backend/.env"
    ln -s "$ROOT/frontend/.env" "$BUILD_DIR/src/frontend/.env"
    log "==> Build image $TAG"
    docker compose \
      --project-directory "$BUILD_DIR/src" \
      --env-file "$ROOT/backend/.env" --env-file "$ROOT/frontend/.env" \
      -f "$BUILD_DIR/src/docker-compose.prod.yml" \
      build --pull
    for img in "${IMAGES[@]}"; do docker tag "$img:prod" "$img:$TAG"; done
    ;;
  retag)
    STEP="gắn lại tag :prod"
    log "==> Dùng image đã có $TAG"
    for img in "${IMAGES[@]}"; do docker tag "$img:$TAG" "$img:prod"; done
    ;;
esac

# --- 2. Sao lưu nếu image mới có migration chưa áp -------------------------------
# `migrate --check` chạy bằng image :prod MỚI trên DB hiện tại. Mã khác 0 (có migration
# mới, hoặc không kiểm được) đều sao lưu trước — thà thừa một bản còn hơn thiếu.
if [[ "$AUTO_BACKUP" == true && "$MODE" != restart ]] && db_has_schema; then
  STEP="kiểm tra migration"
  if "$COMPOSE" run --rm --no-deps -T migrate python manage.py migrate --check --noinput >/dev/null 2>&1; then
    log "==> Không có migration mới, bỏ qua sao lưu"
  else
    STEP="sao lưu trước migration"
    log "==> Có migration mới: sao lưu DB trước"
    "$ROOT/scripts/deploy/backup_db.sh" --label "pre-deploy-$TAG"
  fi
fi

# --- 3. Chuyển code + khởi động --------------------------------------------------
if [[ "$SHA" != "$PREV_SHA" ]]; then
  STEP="checkout"
  git checkout --quiet --detach "$SHA"
fi
SWITCHED=true

# `up` chạy service migrate trước (depends_on service_completed_successfully):
# migration lỗi thì up dừng ở đó, container backend/worker cũ chưa bị tạo lại.
STEP="khởi động stack"
log "==> Khởi động stack (migrate chạy trước)"
if ! "$COMPOSE" up -d --remove-orphans; then
  "$COMPOSE" logs --tail 80 migrate >&2 || true
  exit 1
fi

STEP="chờ healthcheck"
log "==> Chờ healthcheck backend + web"
deadline=$((SECONDS + 300))
until [[ "$("$COMPOSE" ps --format '{{.Health}}' backend)" == healthy \
&& "$("$COMPOSE" ps --format '{{.Health}}' web)" == healthy ]]; do
  if ((SECONDS > deadline)); then
    "$COMPOSE" ps >&2
    "$COMPOSE" logs --tail 80 backend web >&2
    die "Quá 5 phút chưa healthy."
  fi
  sleep 5
done
wait_ready 120

STEP="gọi thử qua nginx"
log "==> Gọi thử qua nginx"
via_nginx() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
    --resolve procv.site:443:127.0.0.1 -k "https://procv.site$1"
}
code="$(via_nginx /api/health/ready/)"
[[ "$code" != 404 ]] || code="$(via_nginx /api/health/)"
[[ "$code" == 200 ]] || die "Health qua nginx trả $code."
[[ "$(via_nginx /viec-lam)" == 200 ]] || die "/viec-lam qua nginx không trả 200."

# --- 4. Dọn dẹp ------------------------------------------------------------------
STEP="dọn image"
old_tags() {
  # Tag commit (12 ký tự hex) sắp theo thời điểm build, mới → cũ; bỏ tag đang chạy và
  # KEEP_IMAGES-1 tag mới nhất còn lại.
  docker image ls "$1" --format '{{.Tag}}' | { grep -E '^[0-9a-f]{12}$' || true; } \
    | while read -r t; do printf '%s %s\n' "$(docker image inspect -f '{{.Created}}' "$1:$t")" "$t"; done \
    | sort -r | awk -v cur="$TAG" '$2 != cur {print $2}' | tail -n +"$KEEP_IMAGES"
}
for img in "${IMAGES[@]}"; do
  for t in $(old_tags "$img"); do docker image rm "$img:$t" >/dev/null 2>&1 || true; done
done
docker image prune -f >/dev/null
docker builder prune -f --keep-storage 10GB >/dev/null 2>&1 \
  || docker builder prune -f --max-used-space 10GB >/dev/null 2>&1 || true

mkdir -p "$ROOT/deploy"
printf '%s %s %s ok\n' "$(date -Iseconds)" "$TAG" "$REF" >>"$ROOT/deploy/history.log"
log "==> Đã deploy $TAG"
