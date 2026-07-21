#!/usr/bin/env bash
# Đồng bộ .env.example với code: mọi biến code ĐỌC phải được khai trong
# .env.example (kèm comment), nếu không người deploy sẽ không biết biến tồn tại.
# Chạy: ./scripts/check_env_sync.sh  (CI gọi trong backend-ci và frontend-ci)

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail=0

# ---- Backend: decouple config('KEY') vs backend/.env.example ----
# Dùng python để bắt cả trường hợp config( xuống dòng và biến đọc động qua
# helper (_provider_api_key('X_API_KEY')).
be_read=$(python3 - <<'PY'
import pathlib, re
pat = re.compile(r"config\(\s*['\"]([A-Z][A-Z0-9_]+)['\"]|_provider_api_key\(\s*['\"]([A-Z][A-Z0-9_]+)['\"]")
keys = set()
for base in ('backend/config', 'backend/apps', 'backend/common'):
    for p in pathlib.Path(base).rglob('*.py'):
        for m in pat.finditer(p.read_text(encoding='utf-8', errors='ignore')):
            keys.add(m.group(1) or m.group(2))
print('\n'.join(sorted(keys)))
PY
)
be_declared=$(grep -oE "^[A-Z][A-Z0-9_]+" backend/.env.example | sort -u)

be_missing=$(comm -23 <(echo "$be_read") <(echo "$be_declared"))
if [ -n "$be_missing" ]; then
  echo "✗ Backend đọc các biến sau nhưng .env.example KHÔNG khai báo:"
  echo "$be_missing" | sed 's/^/    /'
  fail=1
fi

# ---- Frontend: import.meta.env.VITE_* vs frontend/.env.example ----
fe_read=$(grep -rhoE "import\.meta\.env\.(VITE_[A-Z0-9_]+)" frontend/src --include="*.js" --include="*.jsx" \
  | sed -E 's/.*\.(VITE_[A-Z0-9_]+)/\1/' | sort -u)
fe_declared=$(grep -oE "^VITE_[A-Z0-9_]+" frontend/.env.example | sort -u)

fe_missing=$(comm -23 <(echo "$fe_read") <(echo "$fe_declared"))
if [ -n "$fe_missing" ]; then
  echo "✗ Frontend đọc các biến sau nhưng frontend/.env.example KHÔNG khai báo:"
  echo "$fe_missing" | sed 's/^/    /'
  fail=1
fi

# ---- Biến khai thừa (cảnh báo, không fail — có thể dùng ở docs/deploy) ----
be_unused=$(comm -13 <(echo "$be_read") <(echo "$be_declared"))
[ -n "$be_unused" ] && { echo "⚠ Backend .env.example khai nhưng code không đọc trực tiếp:"; echo "$be_unused" | sed 's/^/    /'; }

if [ "$fail" -eq 0 ]; then
  echo "✓ .env.example đồng bộ với code (backend + frontend)."
fi
exit "$fail"
