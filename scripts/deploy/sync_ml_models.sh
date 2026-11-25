#!/usr/bin/env bash
# Chạy trên MÁY DEV: đẩy mô hình đối sánh CV–JD lên VPS (ml/models bị gitignore).
# Chỉ đồng bộ thư mục MATCHING_MODEL_PATH đang dùng trong docker-compose.prod.yml.
#   scripts/deploy/sync_ml_models.sh deploy@<ip-vps>
#   MODEL=multilingual-e5-base/zs-v1 REMOTE_ROOT=/srv/procv scripts/deploy/sync_ml_models.sh deploy@<ip-vps>
#   SSH_KEY=~/.ssh/procv_azure scripts/deploy/sync_ml_models.sh deploy@<ip-vps>   # key riêng
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${1:?Cách dùng: sync_ml_models.sh <user@host>}"
MODEL="${MODEL:-multilingual-e5-base/zs-v1}"
REMOTE_ROOT="${REMOTE_ROOT:-/srv/procv}"
SSH_CMD=(ssh)
[[ -z "${SSH_KEY:-}" ]] || SSH_CMD+=(-i "$SSH_KEY")

[[ -d "$ROOT/ml/models/$MODEL" ]] || { echo "Không thấy ml/models/$MODEL" >&2; exit 1; }

"${SSH_CMD[@]}" "$HOST" "mkdir -p '$REMOTE_ROOT/ml/models/$MODEL'"
rsync -az --delete --progress -e "${SSH_CMD[*]}" \
  "$ROOT/ml/models/$MODEL/" "$HOST:$REMOTE_ROOT/ml/models/$MODEL/"
# rsync -a giữ nguyên quyền file của máy dev (vd. model.safetensors 600), trong khi
# ml-worker chạy bằng uid khác chủ file trên VPS: phải cho mọi user đọc được.
"${SSH_CMD[@]}" "$HOST" "chmod -R a+rX '$REMOTE_ROOT/ml/models'"
echo "Đã đồng bộ $MODEL. Trên VPS: scripts/deploy/compose.sh restart ml-worker"
