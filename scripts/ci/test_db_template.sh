#!/usr/bin/env bash
# Lưu và nạp lại DB test đã migrate (template của backend/conftest.py) giữa các lần CI.
#
#   bash scripts/ci/test_db_template.sh restore <tệp dump>   # trước pytest, khi cache trúng
#   bash scripts/ci/test_db_template.sh save <tệp dump>      # sau pytest, khi cache trượt
#
# conftest.py dựng `test_<DB_NAME>_tpl` bằng `migrate` (60–90 giây trên runner) và
# gắn dấu vân tay migration vào COMMENT của DB; dấu khớp thì bỏ qua migrate. Mỗi shard
# CI là một PostgreSQL mới nên trước đây shard nào cũng migrate lại. Script này nạp
# bản dump từ cache rồi gắn đúng dấu vân tay mà conftest tính, nên conftest dùng
# luôn. Dump lệch (sai dấu) thì conftest tự dựng lại như cũ: cache sai chỉ chậm, không sai.
#
# Cần: POSTGRES_CONTAINER (id container service), DB_NAME; chạy trong backend/.
set -euo pipefail

action="${1:?restore|save}"
dump="${2:?đường dẫn tệp dump}"
template="test_${DB_NAME:?}_tpl"
psql() { docker exec -i "${POSTGRES_CONTAINER:?}" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

case "$action" in
  restore)
    fingerprint="$(python -c 'import conftest; print(conftest._fingerprint())')"
    psql -c "DROP DATABASE IF EXISTS \"$template\"" -c "CREATE DATABASE \"$template\""
    docker exec -i "$POSTGRES_CONTAINER" pg_restore -U postgres --no-owner --exit-on-error -d "$template" < "$dump"
    psql -c "COMMENT ON DATABASE \"$template\" IS '$fingerprint'"
    echo "Đã nạp $template từ $dump ($(du -h "$dump" | cut -f1))."
    ;;
  save)
    docker exec "$POSTGRES_CONTAINER" pg_dump -U postgres -Fc "$template" > "$dump"
    echo "Đã lưu $template vào $dump ($(du -h "$dump" | cut -f1))."
    ;;
  *)
    echo "Hành động không hỗ trợ: $action" >&2
    exit 2
    ;;
esac
