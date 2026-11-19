#!/usr/bin/env python3
"""Kiểm luật cấu trúc backend mà import-linter không diễn đạt được (ADR-0022).

Ba luật, áp cho code production trong ``backend/apps`` (bỏ qua migrations, tests):

* ``cross-app``  — app A chỉ được import từ app B các module công khai:
  ``apps.B.models``, ``apps.B.services``, ``apps.B.selectors``, ``apps.B.signals``
  và ``apps.accounts.api.permissions``. Deep-import nội bộ bị cấm.
* ``root-module`` — gốc app chỉ được chứa ``__init__``, ``apps``, ``admin``,
  ``checks``; mọi module khác phải thuộc một tầng.
* ``init-code``  — ``__init__.py`` chỉ được re-export (import, ``__all__``,
  docstring), không định nghĩa hàm/lớp hay chạy logic.

Vi phạm có sẵn được ghi trong ``backend/import-baseline.txt``. Vi phạm mới làm
fail; mục baseline đã hết vi phạm cũng làm fail để baseline chỉ giảm. Chạy với
``--update-baseline`` để ghi lại baseline sau khi đã sửa bớt vi phạm.
"""

from __future__ import annotations

import argparse
import ast
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / 'backend'
APPS_DIR = BACKEND / 'apps'
BASELINE = BACKEND / 'import-baseline.txt'

PUBLIC_SUBMODULES = {'models', 'services', 'selectors', 'signals'}
SHARED_MODULES = {'apps.accounts.api.permissions'}
ROOT_ALLOWED = {'__init__.py', 'apps.py', 'admin.py', 'checks.py'}


def module_name(path: Path) -> str:
    parts = list(path.relative_to(BACKEND).with_suffix('').parts)
    if parts[-1] == '__init__':
        parts.pop()
    return '.'.join(parts)


def is_production(path: Path) -> bool:
    parts = path.relative_to(APPS_DIR).parts
    return 'migrations' not in parts and 'tests' not in parts


def resolve(node: ast.ImportFrom, current: str, is_package: bool) -> str:
    if node.level == 0:
        return node.module or ''
    base = current.split('.')
    if not is_package:
        base = base[:-1]
    base = base[: len(base) - (node.level - 1)]
    return '.'.join(base + ([node.module] if node.module else []))


def imported_modules(tree: ast.AST, current: str, is_package: bool):
    """Yield (lineno, module) cho mọi import, kể cả import lười trong hàm."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield node.lineno, alias.name
        elif isinstance(node, ast.ImportFrom):
            target = resolve(node, current, is_package)
            for alias in node.names:
                # `from apps.b import services` nghĩa là module apps.b.services.
                # `from apps.b.services import pdf_renderer` là deep-import submodule.
                if target.startswith('apps.') and (
                    target.count('.') == 1 or is_submodule(target, alias.name)
                ):
                    yield node.lineno, f'{target}.{alias.name}'
                else:
                    yield node.lineno, target


def is_submodule(package: str, name: str) -> bool:
    base = BACKEND.joinpath(*package.split('.'))
    if not base.is_dir():
        return False
    # So tên chính xác: hệ thống file macOS không phân biệt hoa thường.
    entries = {entry.name for entry in base.iterdir()}
    return f'{name}.py' in entries or (name in entries and (base / name / '__init__.py').exists())


def cross_app_violation(owner: str, target: str) -> bool:
    parts = target.split('.')
    if len(parts) < 2 or parts[0] != 'apps' or parts[1] == owner:
        return False
    if target in SHARED_MODULES:
        return False
    return not (len(parts) == 3 and parts[2] in PUBLIC_SUBMODULES)


def init_has_code(tree: ast.Module) -> bool:
    for stmt in tree.body:
        if isinstance(stmt, (ast.Import, ast.ImportFrom)):
            continue
        if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant):
            continue  # docstring
        if isinstance(stmt, (ast.Assign, ast.AnnAssign)):
            targets = stmt.targets if isinstance(stmt, ast.Assign) else [stmt.target]
            if all(isinstance(t, ast.Name) and t.id == '__all__' for t in targets):
                continue
        return True
    return False


def collect() -> set[str]:
    violations: set[str] = set()
    for path in sorted(APPS_DIR.rglob('*.py')):
        if not is_production(path):
            continue
        rel = path.relative_to(BACKEND).as_posix()
        app_parts = path.relative_to(APPS_DIR).parts
        if len(app_parts) == 1:
            continue  # apps/__init__.py
        owner = app_parts[0]
        if len(app_parts) == 2 and path.name not in ROOT_ALLOWED:
            violations.add(f'root-module\t{rel}\t-')
        tree = ast.parse(path.read_text(encoding='utf-8'), filename=rel)
        if path.name == '__init__.py' and init_has_code(tree):
            violations.add(f'init-code\t{rel}\t-')
        current = module_name(path)
        for _lineno, target in imported_modules(tree, current, path.name == '__init__.py'):
            if cross_app_violation(owner, target):
                violations.add(f'cross-app\t{rel}\t{target}')
    return violations


def read_baseline() -> set[str]:
    if not BASELINE.exists():
        return set()
    lines = BASELINE.read_text(encoding='utf-8').splitlines()
    return {line for line in lines if line and not line.startswith('#')}


def write_baseline(violations: set[str]) -> None:
    header = (
        '# Vi phạm cấu trúc còn tồn tại (ADR-0022) — chỉ được giảm, không thêm.\n'
        '# Sinh bằng: python scripts/check_backend_imports.py --update-baseline\n'
        '# rule<TAB>file<TAB>module bị import\n'
    )
    BASELINE.write_text(header + ''.join(f'{v}\n' for v in sorted(violations)), encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--update-baseline', action='store_true')
    args = parser.parse_args()

    current = collect()
    if args.update_baseline:
        write_baseline(current)
        print(f'Đã ghi {len(current)} vi phạm vào {BASELINE.relative_to(BACKEND.parent)}')
        return 0

    baseline = read_baseline()
    new = sorted(current - baseline)
    fixed = sorted(baseline - current)
    if new:
        print('✗ Vi phạm cấu trúc backend mới (ADR-0022):')
        for item in new:
            rule, path, target = item.split('\t')
            print(f'  [{rule}] {path}' + (f' → {target}' if target != '-' else ''))
    if fixed:
        print('✗ Baseline có mục đã được sửa — chạy lại với --update-baseline:')
        for item in fixed:
            print(f'  {item.replace(chr(9), " ")}')
    if new or fixed:
        return 1
    print(f'✓ Cấu trúc backend: không có vi phạm mới ({len(baseline)} mục baseline còn lại)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
