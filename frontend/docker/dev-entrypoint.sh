#!/bin/sh
set -eu

lock_file=/app/package-lock.json
stamp_file=/app/node_modules/.package-lock.sha256
current_hash="$(sha256sum "$lock_file" | cut -d ' ' -f 1)"
installed_hash=""

if [ -f "$stamp_file" ]; then
  installed_hash="$(sed -n '1p' "$stamp_file")"
fi

# node_modules là named volume. Chỉ npm ci khi lockfile đổi hoặc volume mới,
# thay vì xoá/cài lại hàng trăm MB dependency ở mọi lần docker compose up.
if [ "$current_hash" != "$installed_hash" ] || [ ! -x /app/node_modules/.bin/vite ]; then
  npm ci --no-audit --no-fund
  printf '%s\n' "$current_hash" > "$stamp_file"
fi

exec npm run dev -- --host 0.0.0.0
