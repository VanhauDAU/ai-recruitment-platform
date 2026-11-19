#!/usr/bin/env python3
"""Kiểm luật cấu trúc backend mà import-linter không diễn đạt được (ADR-0022).

Ba luật, áp cho code production trong ``backend/apps`` (bỏ qua migrations, tests):

* ``cross-app``  — app A chỉ được import từ app B các package công khai:
  ``apps.B.{models,domain,services,selectors,signals}``, ``apps.accounts.api.permissions``
  và — chỉ từ tầng ``api`` của A — ``apps.B.api.serializers`` (serializer lồng).
  Deep-import module nội bộ bị cấm.
* ``root-module`` — gốc app chỉ được chứa ``__init__``, ``apps``, ``admin``,
  ``checks``; mọi module khác phải thuộc một tầng.
* ``init-code``  — ``__init__.py`` chỉ được re-export (import, ``__all__``,
  docstring, khai báo ``Signal()``), không định nghĩa hàm/lớp hay chạy logic.

Mọi vi phạm làm fail CI — không có baseline hay whitelist.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / 'backend'
APPS_DIR = BACKEND / 'apps'

PUBLIC_SUBMODULES = {'models', 'domain', 'services', 'selectors', 'signals'}
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


def cross_app_violation(owner: str, target: str, *, from_api: bool) -> bool:
    parts = target.split('.')
    if len(parts) < 2 or parts[0] != 'apps' or parts[1] == owner:
        return False
    if target in SHARED_MODULES:
        return False
    if from_api and parts[2:] == ['api', 'serializers']:
        return False
    return not (len(parts) == 3 and parts[2] in PUBLIC_SUBMODULES)


def is_signal_declaration(value) -> bool:
    return (
        isinstance(value, ast.Call)
        and isinstance(value.func, ast.Name)
        and value.func.id == 'Signal'
    )


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
            if is_signal_declaration(stmt.value):
                continue  # signals/__init__.py khai báo Signal công khai (ADR-0022)
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
            if cross_app_violation(owner, target, from_api='api' in app_parts[1:-1]):
                violations.add(f'cross-app\t{rel}\t{target}')
    return violations


def main() -> int:
    violations = sorted(collect())
    if not violations:
        print('✓ Cấu trúc backend OK — import chéo app, module gốc app, __init__ (ADR-0022).')
        return 0
    print('✗ Vi phạm cấu trúc backend (ADR-0022):')
    for item in violations:
        rule, path, target = item.split('\t')
        print(f'  [{rule}] {path}' + (f' → {target}' if target != '-' else ''))
    return 1


if __name__ == '__main__':
    sys.exit(main())
