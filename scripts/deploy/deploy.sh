#!/usr/bin/env bash
# Triển khai một commit lên VPS: build image, áp migration, khởi động lại stack,
# chờ healthcheck rồi gọi thử qua nginx.
#   scripts/deploy/deploy.sh                 # origin/main mới nhất
#   scripts/deploy/deploy.sh <commit|tag>    # rollback về bản cũ
#   scripts/deploy/deploy.sh --skip-build    # chỉ khởi động lại với image đang có
#
# Migration phá dữ liệu không tự lùi khi rollback code: chạy backup_db.sh trước,
# khôi phục bằng restore_db.sh nếu cần.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="$ROOT/scripts/deploy/compose.sh"
SKIP_BUILD=false
REF=origin/main

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) REF="$arg" ;;
  esac
done

cd "$ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Có file tracked bị sửa trực tiếp trên VPS; commit/stash trước khi deploy." >&2
  git status --short >&2
  exit 1
fi

echo "==> Lấy code $REF"
git fetch --prune --tags origin
git checkout --quiet --detach "$REF"
COMMIT="$(git rev-parse --short HEAD)"
echo "    commit $COMMIT: $(git log -1 --format=%s)"

if [[ "$SKIP_BUILD" == false ]]; then
  echo "==> Build image"
  "$COMPOSE" build --pull
fi

# `up` chạy service migrate trước (depends_on service_completed_successfully):
# migration lỗi thì up dừng ở đó, container backend/worker cũ chưa bị tạo lại.
echo "==> Khởi động stack (migrate chạy trước)"
if ! "$COMPOSE" up -d --remove-orphans; then
  echo "Khởi động thất bại. Log migrate:" >&2
  "$COMPOSE" logs --tail 80 migrate >&2 || true
  exit 1
fi

echo "==> Chờ healthcheck backend + web"
deadline=$((SECONDS + 300))
until [[ "$("$COMPOSE" ps --format '{{.Health}}' backend)" == healthy \
      && "$("$COMPOSE" ps --format '{{.Health}}' web)" == healthy ]]; do
  if (( SECONDS > deadline )); then
    echo "Quá 5 phút chưa healthy." >&2
    "$COMPOSE" ps >&2
    "$COMPOSE" logs --tail 80 backend web >&2
    exit 1
  fi
  sleep 5
done

echo "==> Gọi thử qua nginx"
curl -fsS --max-time 10 --resolve procv.site:443:127.0.0.1 -k \
  https://procv.site/api/health/ >/dev/null
curl -fsS --max-time 10 --resolve procv.site:443:127.0.0.1 -k \
  https://procv.site/viec-lam -o /dev/null

docker image prune -f >/dev/null
printf '%s %s %s\n' "$(date -Iseconds)" "$COMMIT" "$REF" >> "$ROOT/deploy/history.log"
echo "==> Đã deploy $COMMIT"
