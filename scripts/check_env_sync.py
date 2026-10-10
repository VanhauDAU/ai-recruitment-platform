#!/usr/bin/env python3
"""Validate env consumers against the minimal and optional catalogs."""

from __future__ import annotations

import ast
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY_PATTERN = re.compile(r'^[A-Z][A-Z0-9_]*$')
DECLARATION_PATTERN = re.compile(r'^([A-Z][A-Z0-9_]*)=(.*)$')

BACKEND_CATALOGS = (
    Path('backend/.env.example'),
    Path('backend/.env.optional.example'),
)
FRONTEND_CATALOGS = (
    Path('frontend/.env.example'),
    Path('frontend/.env.optional.example'),
)

# Process-owned values are intentionally not copied into application catalogs.
# Every exception names its owner and why application startup must not own it.
BACKEND_PROCESS_KEYS = {
    'APP_REVISION': 'audit_job_services_legacy: revision metadata supplied by release tooling',
    'DJANGO_SETTINGS_MODULE': 'Django entrypoints/CI: selects settings before backend/.env loads',
    'USER': 'operating system shell: actor label fallback for management commands',
}
FRONTEND_PROCESS_KEYS = {
    'CI': 'CI runner: selects non-interactive reporting and server reuse policy',
    'PROD': 'Vite built-in: generated mode flag, not a user-supplied variable',
}
COMPOSE_PROCESS_KEYS = {
    'AI_WORKER_MAX_TASKS_PER_CHILD': 'Compose resource tuning with an inline default',
    'AI_WORKER_PIDS_LIMIT': 'Compose resource tuning with an inline default',
    'BACKEND_IMAGE': 'Compose image override with an inline local default',
    'BACKEND_PIDS_LIMIT': 'Compose resource tuning with an inline default',
    'BEAT_PIDS_LIMIT': 'Compose resource tuning with an inline default',
    'CELERY_WORKER_CONCURRENCY': 'Compose worker tuning with an inline default',
    'CELERY_WORKER_MAX_TASKS_PER_CHILD': 'Compose worker tuning with an inline default',
    'CLAMAV_CPU_LIMIT': 'Compose resource tuning with an inline default',
    'CLAMAV_MEMORY_LIMIT': 'Compose resource tuning with an inline default',
    'CLAMAV_PLATFORM': 'Compose host compatibility override with an inline default',
    'CLAMD_STARTUP_TIMEOUT': 'ClamAV container startup tuning with an inline default',
    'DOCKER_LOG_MAX_FILES': 'Docker log rotation override with an inline default',
    'DOCKER_LOG_MAX_SIZE': 'Docker log rotation override with an inline default',
    'FRESHCLAM_CHECKS': 'ClamAV update cadence with an inline default',
    'FRONTEND_PIDS_LIMIT': 'Compose resource tuning with an inline default',
    'WORKER_PIDS_LIMIT': 'Compose resource tuning with an inline default',
}


def catalog_declarations(paths: tuple[Path, ...]) -> tuple[dict[str, Path], list[str]]:
    declarations: dict[str, Path] = {}
    errors: list[str] = []
    for relative_path in paths:
        path = ROOT / relative_path
        if not path.is_file():
            errors.append(f'missing catalog: {relative_path}')
            continue
        seen_in_file: set[str] = set()
        for line_number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
            match = DECLARATION_PATTERN.match(line)
            if not match:
                continue
            key = match.group(1)
            if key in seen_in_file:
                errors.append(f'{relative_path}:{line_number}: duplicate declaration {key}')
            elif key in declarations:
                errors.append(
                    f'{relative_path}:{line_number}: {key} already declared in {declarations[key]}'
                )
            seen_in_file.add(key)
            declarations[key] = relative_path
    return declarations, errors


def call_name(node: ast.Call) -> str:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ''


def literal_key(node: ast.AST) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value if KEY_PATTERN.fullmatch(node.value) else None
    return None


def is_os_environ_call(node: ast.Call) -> bool:
    return (
        isinstance(node.func, ast.Attribute)
        and node.func.attr in {'get', 'setdefault'}
        and isinstance(node.func.value, ast.Attribute)
        and isinstance(node.func.value.value, ast.Name)
        and node.func.value.value.id == 'os'
        and node.func.value.attr == 'environ'
    )


def backend_consumers() -> dict[str, set[str]]:
    consumers: dict[str, set[str]] = defaultdict(set)
    roots = (ROOT / 'backend/config', ROOT / 'backend/apps', ROOT / 'backend/common')
    for source_root in roots:
        for path in source_root.rglob('*.py'):
            relative = path.relative_to(ROOT)
            if 'migrations' in relative.parts or 'tests' in relative.parts:
                continue
            try:
                text = path.read_text(encoding='utf-8')
                tree = ast.parse(text)
            except (OSError, SyntaxError) as error:
                raise RuntimeError(f'cannot parse {relative}: {error}') from error

            for node in ast.walk(tree):
                key: str | None = None
                if isinstance(node, ast.Call) and node.args:
                    name = call_name(node)
                    if name in {
                        'config',
                        '_provider_api_key',
                        'getenv',
                    } or is_os_environ_call(node):
                        key = literal_key(node.args[0])
                elif (
                    isinstance(node, ast.Subscript)
                    and isinstance(node.value, ast.Attribute)
                    and isinstance(node.value.value, ast.Name)
                    and node.value.value.id == 'os'
                    and node.value.attr == 'environ'
                ):
                    key = literal_key(node.slice)
                if key:
                    consumers[key].add(f'{relative}:{getattr(node, "lineno", 0)}')

            for match in re.finditer(r"['\"]env_var['\"]\s*:\s*['\"]([A-Z][A-Z0-9_]+)['\"]", text):
                consumers[match.group(1)].add(f'{relative}:dynamic-env-var')
    return consumers


def frontend_consumers() -> dict[str, set[str]]:
    consumers: dict[str, set[str]] = defaultdict(set)
    paths = [ROOT / 'frontend/vite.config.js', ROOT / 'frontend/playwright.config.js']
    paths.extend((ROOT / 'frontend/src').rglob('*.js'))
    paths.extend((ROOT / 'frontend/src').rglob('*.jsx'))
    patterns = (
        re.compile(r'import\.meta\.env\.([A-Z][A-Z0-9_]*)'),
        re.compile(r'process\.env\.([A-Z][A-Z0-9_]*)'),
    )
    for path in paths:
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        text = path.read_text(encoding='utf-8')
        for pattern in patterns:
            for match in pattern.finditer(text):
                consumers[match.group(1)].add(str(relative))
    return consumers


def compose_consumers() -> set[str]:
    text = (ROOT / 'docker-compose.yml').read_text(encoding='utf-8')
    return set(re.findall(r'\$\{([A-Z][A-Z0-9_]*)', text))


def report_missing(
    label: str,
    consumers: dict[str, set[str]],
    declared: set[str],
    exceptions: dict[str, str],
) -> list[str]:
    errors: list[str] = []
    for key in sorted(set(consumers) - declared - set(exceptions)):
        locations = ', '.join(sorted(consumers[key]))
        errors.append(f'{label}: {key} is consumed at {locations} but is not cataloged')
    return errors


def main() -> int:
    backend_declared, errors = catalog_declarations(BACKEND_CATALOGS)
    frontend_declared, frontend_errors = catalog_declarations(FRONTEND_CATALOGS)
    errors.extend(frontend_errors)

    backend_read = backend_consumers()
    frontend_read = frontend_consumers()
    errors.extend(
        report_missing('backend', backend_read, set(backend_declared), BACKEND_PROCESS_KEYS)
    )
    errors.extend(
        report_missing('frontend', frontend_read, set(frontend_declared), FRONTEND_PROCESS_KEYS)
    )

    unused_backend = set(backend_declared) - set(backend_read)
    unused_frontend = set(frontend_declared) - set(frontend_read)
    for key in sorted(unused_backend):
        errors.append(f'backend: {key} is cataloged but has no runtime or dynamic consumer')
    for key in sorted(unused_frontend):
        errors.append(f'frontend: {key} is cataloged but has no runtime/tooling consumer')

    forbidden_frontend = sorted(
        key
        for key in frontend_declared
        if key.startswith('VITE_')
        and any(
            token in key
            for token in (
                'SECRET',
                'PASSWORD',
                'PRIVATE_KEY',
                'ACCESS_KEY',
                'API_TOKEN',
            )
        )
    )
    if forbidden_frontend:
        errors.append('frontend: secret-like VITE_* declarations: ' + ', '.join(forbidden_frontend))

    compose_read = compose_consumers()
    compose_known = set(backend_declared) | set(frontend_declared) | set(COMPOSE_PROCESS_KEYS)
    for key in sorted(compose_read - compose_known):
        errors.append(f'compose: {key} has no application catalog or owned Compose exception')

    if errors:
        print('Env catalog check failed:', file=sys.stderr)
        for error in errors:
            print(f'  - {error}', file=sys.stderr)
        return 1

    print(
        'Env catalog check passed: '
        f'{len(backend_read)} backend consumer(s), {len(backend_declared)} backend declaration(s); '
        f'{len(frontend_read)} frontend consumer(s), {len(frontend_declared)} frontend declaration(s); '
        f'{len(compose_read)} Compose interpolation key(s).'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
