#!/bin/sh
# Vẽ lại toàn bộ hình (PNG) và dựng file Word mục 3.2 Mô hình hóa yêu cầu.
# Chạy từ thư mục gốc repo:  sh docs/01-phan-tich/mo-hinh-hoa-yeu-cau/cong-cu/build.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${TMPDIR:-/tmp}/procv-diagram-tools"
mkdir -p "$BIN"
for t in seqdraw actdraw ucdraw bw; do
  swiftc -O "$ROOT/cong-cu/$t.swift" -o "$BIN/$t"
done

mkdir -p "$ROOT/00-use-case-tong-quat/hinh"
"$BIN/bw" "$ROOT/../so-do-use-case.png" "$ROOT/00-use-case-tong-quat/hinh/use-case-tong-quat.png"

for g in "$ROOT"/[0-9][0-9]-*/; do
  [ -f "$g/use-case.uc" ] || continue
  mkdir -p "$g/hinh"
  "$BIN/ucdraw" "$g/use-case.uc" "$g/hinh/use-case.png"
  for f in "$g"/tuan-tu/*.seq; do "$BIN/seqdraw" "$f" "$g/hinh/tuan-tu_$(basename "$f" .seq).png"; done
  for f in "$g"/hoat-dong/*.act; do "$BIN/actdraw" "$f" "$g/hinh/hoat-dong_$(basename "$f" .act).png"; done
done

PY="$ROOT/../../../ml/.venv/bin/python"
[ -x "$PY" ] || PY=python3
"$PY" "$ROOT/cong-cu/build_docx.py"
