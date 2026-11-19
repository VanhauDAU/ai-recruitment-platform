#!/usr/bin/env bash
# Dựng lại DB local từ baseline migration (ADR-0022 GĐ6) rồi seed dữ liệu nền.
#
#   ./scripts/reset_local_db.sh            # dữ liệu nền
#   ./scripts/reset_local_db.sh --demo     # thêm tin tuyển dụng và bài blog demo
#
# Biến môi trường: DB_NAME (mặc định ai_career_coach), BACKUP_DIR (mặc định
# ../ai-recruitment-platform-backups). Luôn pg_dump trước khi drop.
# Lệnh Django chạy trong container backend: manage.py trên host sẽ nối nhầm
# PostgreSQL của máy.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB="${DB_NAME:-ai_career_coach}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/../ai-recruitment-platform-backups}"
DEMO=false
[[ "${1:-}" == "--demo" ]] && DEMO=true

APP_SERVICES=(backend worker ai-worker ml-worker beat)
BASE_SEEDS=(
  seed_skills
  seed_locations
  seed_province_merges # cần locations
  seed_job_categories  # cần skills
  seed_sitecontent
  seed_cv_catalog
  seed_cv_templates
)
DEMO_SEEDS=(seed_demo_jobs seed_blog)

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
manage() { docker compose run --rm --no-deps -T -e DB_NAME="$DB" backend python manage.py "$@"; }

step "Bật db và redis"
docker compose up -d --wait db redis

step "Sao lưu $DB"
mkdir -p "$BACKUP_DIR"
if docker compose exec -T db psql -U postgres -lqt | cut -d'|' -f1 | grep -qw "$DB"; then
  backup="$BACKUP_DIR/$DB-before-reset-$(date +%Y%m%d-%H%M%S).dump"
  docker compose exec -T db pg_dump -U postgres -Fc "$DB" >"$backup"
  echo "Đã lưu $backup"
fi

running=()
# Chỉ dừng service khi reset đúng DB chúng đang dùng (DB khác = DB thử nghiệm).
if [[ "$DB" == "${APP_DB_NAME:-ai_career_coach}" ]]; then
  step "Dừng service đang giữ kết nối DB"
  for service in "${APP_SERVICES[@]}"; do
    if docker compose ps --status running --services 2>/dev/null | grep -qx "$service"; then
      running+=("$service")
    fi
  done
  if ((${#running[@]})); then docker compose stop "${running[@]}"; fi
fi

step "Tạo lại $DB"
docker compose exec -T db dropdb -U postgres --if-exists "$DB"
docker compose exec -T db createdb -U postgres "$DB"

step "Migrate (baseline + dữ liệu tham chiếu)"
manage migrate

step "Seed dữ liệu nền"
for command in "${BASE_SEEDS[@]}"; do manage "$command"; done
if [[ "$DEMO" == true ]]; then
  step "Seed dữ liệu demo"
  for command in "${DEMO_SEEDS[@]}"; do manage "$command"; done
fi

if ((${#running[@]})); then
  step "Khởi động lại ${running[*]}"
  docker compose start "${running[@]}"
fi

printf '\n\033[1;32m✓ %s đã sẵn sàng.\033[0m Tạo superuser: docker compose exec backend python manage.py createsuperuser\n' "$DB"
