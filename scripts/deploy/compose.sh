#!/usr/bin/env bash
# docker compose cho production: nạp backend/.env + frontend/.env để nội suy
# ${...} trong docker-compose.prod.yml. Mọi script deploy gọi qua đây.
#   scripts/deploy/compose.sh ps
#   scripts/deploy/compose.sh logs -f backend
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

for env_file in backend/.env frontend/.env; do
  if [[ ! -f "$ROOT/$env_file" ]]; then
    echo "Thiếu $env_file — xem docs/06-deployment/huong-dan-deployment.md" >&2
    exit 1
  fi
done

exec docker compose \
  --project-directory "$ROOT" \
  --env-file "$ROOT/backend/.env" \
  --env-file "$ROOT/frontend/.env" \
  -f "$ROOT/docker-compose.prod.yml" \
  "$@"
