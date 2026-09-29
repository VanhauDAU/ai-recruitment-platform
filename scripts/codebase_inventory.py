#!/usr/bin/env python3
"""Inventory hotspot cho kế hoạch tái cấu trúc (Giai đoạn 0.5).

Liệt kê file lớn (>300 / >500 dòng) và "import nóng" (module được import bởi
nhiều file) để chọn điểm cần tách trước. Chạy lại được nhiều lần để so mốc.

Cách dùng:
    python scripts/codebase_inventory.py                 # in ra màn hình
    python scripts/codebase_inventory.py --out docs/99-tien-do/baseline/code-hotspots.md
    python scripts/codebase_inventory.py --tracked-manifest docs/baseline/tracked-files.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import subprocess
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


def tracked_file_owner_and_purpose(relative_path: str) -> tuple[str, str]:
    """Return a stable, coarse ownership label for the P0 tracked-file manifest."""

    parts = relative_path.split('/')
    if relative_path.startswith('backend/apps/') and len(parts) >= 3:
        app = parts[2]
        if '/migrations/' in relative_path:
            return f'backend/{app}', 'migration-history'
        if '/tests/' in relative_path or parts[-1].startswith('test_'):
            return f'backend/{app}', 'backend-regression-test'
        return f'backend/{app}', 'backend-domain-code'
    if relative_path.startswith('backend/common/'):
        return 'backend/platform', 'backend-shared-infrastructure'
    if relative_path.startswith('backend/config/'):
        return 'backend/platform', 'django-configuration'
    if relative_path.startswith('backend/'):
        return 'backend/platform', 'backend-tooling-or-dependency'
    if relative_path.startswith('frontend/src/'):
        layer = parts[2] if len(parts) >= 3 else 'src'
        return f'frontend/{layer}', 'frontend-source'
    if relative_path.startswith('frontend/tests/'):
        return 'frontend/quality', 'browser-regression-test'
    if relative_path.startswith('frontend/public/'):
        return 'frontend/assets', 'static-public-asset'
    if relative_path.startswith('frontend/'):
        return 'frontend/platform', 'frontend-tooling-or-dependency'
    if relative_path.startswith('docs/'):
        topic = parts[1] if len(parts) >= 2 else 'index'
        return f'docs/{topic}', 'project-documentation'
    if relative_path.startswith('scripts/'):
        return 'repository/tooling', 'cross-repository-check-or-automation'
    if relative_path.startswith('.github/'):
        return 'repository/ci', 'github-automation'
    if relative_path.startswith(('private-media/', 'public-media/')):
        return 'unverified-media', 'tracked-test-like-or-runtime-media'
    if relative_path.startswith('deploy/') or relative_path == 'docker-compose.prod.yml':
        return 'deployment', 'production-deployment-candidate'
    if relative_path == 'docker-compose.yml':
        return 'repository/local-tooling', 'local-compose'
    return 'repository/root', 'repository-metadata-or-entrypoint'


def write_tracked_manifest(output_path: Path) -> None:
    """Write every file from HEAD with Git blob, size, owner and purpose."""

    result = subprocess.run(
        ['git', 'ls-files', '--stage', '-z'],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    tracked_files = []
    for item in result.stdout.split(b'\0'):
        if not item:
            continue
        metadata, raw_path = item.split(b'\t', 1)
        _mode, blob, stage = metadata.decode('ascii').split()
        if stage != '0':
            raise RuntimeError('Manifest requires an index without unresolved merge entries')
        tracked_files.append((raw_path.decode('utf-8', errors='surrogateescape'), blob))
    tracked_files.sort()

    size_result = subprocess.run(
        ['git', 'cat-file', '--batch-check=%(objectname) %(objectsize)'],
        cwd=ROOT,
        check=True,
        input=''.join(f'{blob}\n' for _path, blob in tracked_files),
        text=True,
        capture_output=True,
    )
    sizes = [int(line.rsplit(' ', 1)[1]) for line in size_result.stdout.splitlines()]
    if len(sizes) != len(tracked_files):
        raise RuntimeError('Git blob size output did not match the tracked-file list')

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.writer(stream, lineterminator='\n')
        writer.writerow(['path', 'size_bytes', 'git_blob', 'owner', 'purpose'])
        for (relative_path, blob), size in zip(tracked_files, sizes, strict=True):
            owner, purpose = tracked_file_owner_and_purpose(relative_path)
            writer.writerow([relative_path, size, blob, owner, purpose])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', help='Ghi ra file markdown thay vì in màn hình')
    parser.add_argument(
        '--tracked-manifest',
        help='Ghi CSV của toàn bộ file được Git theo dõi, gồm size/blob/owner/purpose',
    )
    args = parser.parse_args()

    report = build_report()
    if args.out:
        out = ROOT / args.out
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report + '\n', encoding='utf-8')
        print(f'Đã ghi inventory vào {args.out}')
    else:
        print(report)
    if args.tracked_manifest:
        manifest_path = ROOT / args.tracked_manifest
        write_tracked_manifest(manifest_path)
        print(f'Đã ghi tracked-file manifest vào {args.tracked_manifest}')


if __name__ == '__main__':
    main()
