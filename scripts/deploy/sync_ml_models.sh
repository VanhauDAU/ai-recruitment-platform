#!/usr/bin/env bash
# Chạy trên MÁY DEV: đẩy mô hình đối sánh CV–JD lên VPS (ml/models bị gitignore).
# Chỉ đồng bộ thư mục MATCHING_MODEL_PATH đang dùng trong docker-compose.prod.yml.
#   scripts/deploy/sync_ml_models.sh deploy@<ip-vps>
#   MODEL=multilingual-e5-base/zs-v1 REMOTE_ROOT=/srv/procv scripts/deploy/sync_ml_models.sh deploy@<ip-vps>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${1:?Cách dùng: sync_ml_models.sh <user@host>}"
MODEL="${MODEL:-multilingual-e5-base/zs-v1}"
REMOTE_ROOT="${REMOTE_ROOT:-/srv/procv}"

[[ -d "$ROOT/ml/models/$MODEL" ]] || { echo "Không thấy ml/models/$MODEL" >&2; exit 1; }

ssh "$HOST" "mkdir -p '$REMOTE_ROOT/ml/models/$MODEL'"
rsync -az --delete --progress \
  "$ROOT/ml/models/$MODEL/" "$HOST:$REMOTE_ROOT/ml/models/$MODEL/"
echo "Đã đồng bộ $MODEL. Trên VPS: scripts/deploy/compose.sh restart ml-worker"
