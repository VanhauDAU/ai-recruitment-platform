#!/usr/bin/env python3
"""Inventory hotspot cho kế hoạch tái cấu trúc (Giai đoạn 0.5).

Liệt kê file lớn (>300 / >500 dòng) và "import nóng" (module được import bởi
nhiều file) để chọn điểm cần tách trước. Chạy lại được nhiều lần để so mốc.

Cách dùng:
    python scripts/codebase_inventory.py                 # in ra màn hình
    python scripts/codebase_inventory.py --out docs/09-refactor/baseline/inventory.md
"""

from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Khu vực khảo sát + đuôi file tương ứng.
SCAN_DIRS = [
    ('frontend/src', {'.js', '.jsx', '.ts', '.tsx'}),
    ('backend/apps', {'.py'}),
    ('backend/common', {'.py'}),
    ('backend/config', {'.py'}),
]
IGNORE_PARTS = {'__pycache__', 'node_modules', 'migrations', 'dist', '.venv', 'venv'}

WARN_LINES = 300
CRIT_LINES = 500

# Bắt import "nội bộ" (alias @/… ở FE, from apps.… ở BE) để đo phụ thuộc.
JS_IMPORT = re.compile(r"""import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]""")
PY_IMPORT = re.compile(r"""^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))""", re.M)


def iter_files():
    for rel, exts in SCAN_DIRS:
        base = ROOT / rel
        if not base.exists():
            continue
        for path in base.rglob('*'):
            if path.suffix not in exts or not path.is_file():
                continue
            if IGNORE_PARTS & set(path.parts):
                continue
            yield path


def count_lines(path: Path) -> int:
    try:
        return sum(1 for _ in path.open(encoding='utf-8', errors='ignore'))
    except OSError:
        return 0


def extract_imports(path: Path) -> list[str]:
    text = path.read_text(encoding='utf-8', errors='ignore')
    if path.suffix == '.py':
        mods = []
        for a, b in PY_IMPORT.findall(text):
            mod = a or b
            if mod.startswith(('apps.', 'common.', 'config.')):
                mods.append(mod)
        return mods
    # JS/TS: chỉ tính import nội bộ (alias @ hoặc tương đối), bỏ package ngoài.
    return [m for m in JS_IMPORT.findall(text) if m.startswith(('@/', '.', '..'))]


def build_report() -> str:
    sizes: list[tuple[int, str]] = []
    import_counter: Counter[str] = Counter()
    total = 0

    for path in iter_files():
        total += 1
        rel = path.relative_to(ROOT).as_posix()
        sizes.append((count_lines(path), rel))
        for mod in extract_imports(path):
            import_counter[mod] += 1

    sizes.sort(reverse=True)
    crit = [(n, f) for n, f in sizes if n >= CRIT_LINES]
    warn = [(n, f) for n, f in sizes if WARN_LINES <= n < CRIT_LINES]

    lines = ['# Inventory hotspot (baseline tái cấu trúc)', '']
    lines.append(f'- Tổng file quét: **{total}**')
    lines.append(f'- File ≥ {CRIT_LINES} dòng: **{len(crit)}**')
    lines.append(f'- File {WARN_LINES}–{CRIT_LINES - 1} dòng: **{len(warn)}**')
    lines.append('')

    lines.append(f'## File ≥ {CRIT_LINES} dòng (ưu tiên tách)')
    lines.append('')
    lines += [f'- `{f}` — {n} dòng' for n, f in crit] or ['- (không có)']
    lines.append('')

    lines.append(f'## File {WARN_LINES}–{CRIT_LINES - 1} dòng (theo dõi)')
    lines.append('')
    lines += [f'- `{f}` — {n} dòng' for n, f in warn] or ['- (không có)']
    lines.append('')

    lines.append('## Import nội bộ nóng (module được import ≥ 5 lần)')
    lines.append('')
    hot = [(mod, c) for mod, c in import_counter.most_common() if c >= 5]
    lines += [f'- `{mod}` — {c} nơi import' for mod, c in hot] or ['- (không có)']
    lines.append('')

    return '\n'.join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', help='Ghi ra file markdown thay vì in màn hình')
    args = parser.parse_args()

    report = build_report()
    if args.out:
        out = ROOT / args.out
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report + '\n', encoding='utf-8')
        print(f'Đã ghi inventory vào {args.out}')
    else:
        print(report)


if __name__ == '__main__':
    main()
