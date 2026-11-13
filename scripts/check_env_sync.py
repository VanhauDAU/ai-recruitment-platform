#!/usr/bin/env python3
"""Validate env consumers against backend/.env.example and frontend/.env.example.

Each service owns exactly one template. The gate fails when code reads a key the
template does not declare, the template declares a key nothing reads, a
template value cannot satisfy its ``config(cast=...)`` contract or differs from
the code default, or an env file appears outside ``backend/`` and ``frontend/``.
Local ``.env`` files are only reported by key name; values are never printed.
"""

from __future__ import annotations

import ast
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY_PATTERN = re.compile(r'^[A-Z][A-Z0-9_]*$')
DECLARATION_PATTERN = re.compile(r'^([A-Z][A-Z0-9_]*)=(.*)$')

BACKEND_TEMPLATE = Path('backend/.env.example')
FRONTEND_TEMPLATE = Path('frontend/.env.example')
LOCAL_ENV_FILES = {
    BACKEND_TEMPLATE: Path('backend/.env'),
    FRONTEND_TEMPLATE: Path('frontend/.env'),
}

# Process-owned values are intentionally not declared in a template. Every
# exception names its owner and why the service env file must not own it.
BACKEND_PROCESS_KEYS = {
    'DJANGO_SETTINGS_MODULE': 'Django entrypoints/CI: selects settings before backend/.env loads',
    'USER': 'operating system shell: actor label fallback for management commands',
}
FRONTEND_PROCESS_KEYS = {
    'ANALYZE': 'one-off CLI flag: `ANALYZE=1 npm run build` emits the bundle treemap',
    'CI': 'CI runner: selects non-interactive reporting and server reuse policy',
    'PLAYWRIGHT_PORT': 'Playwright runner: reads process env only, never frontend/.env',
    'PLAYWRIGHT_WEB_SERVER': 'Playwright runner: `preview` in CI, `dev` locally',
    'PORT': 'preview tooling: assigns a free port when 5173 is busy',
    'PROD': 'Vite built-in: generated mode flag, not a user-supplied variable',
}

# Template values that intentionally differ from the code fallback.
DOCUMENTED_DEFAULT_OVERRIDES = {
    'AI_MODEL_PRICING_USD': 'local zero-price map avoids accidental provider-cost claims',
    'CELERY_RESULT_BACKEND': 'an empty override preserves the disabled result backend',
    'EMAIL_FROM_NAME': 'local sample supplies the product display name',
    'OAUTH_CODE_TTL': 'local contract is 120 seconds; code fallback remains 60',
}

SECRET_LIKE_TOKENS = ('SECRET', 'PASSWORD', 'PRIVATE_KEY', 'ACCESS_KEY', 'API_TOKEN')


@dataclass(frozen=True)
class Declaration:
    line: int
    value: str


@dataclass(frozen=True)
class ConfigContract:
    path: Path
    line: int
    cast: str | None
    default: object


MISSING = object()


def parse_env_file(path: Path) -> tuple[dict[str, Declaration], set[str]]:
    """Return the last declaration of each key plus the keys declared twice."""
    declarations: dict[str, Declaration] = {}
    duplicates: set[str] = set()
    for line_number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        match = DECLARATION_PATTERN.match(line)
        if not match:
            continue
        key = match.group(1)
        if key in declarations:
            duplicates.add(key)
        declarations[key] = Declaration(line_number, match.group(2))
    return declarations, duplicates


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
                    if call_name(node) in {
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

            # Site Settings of type "env" resolve a key name at runtime.
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
        re.compile(r"setting\(\s*['\"]([A-Z][A-Z0-9_]*)['\"]"),
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


def config_contracts() -> dict[str, list[ConfigContract]]:
    contracts: dict[str, list[ConfigContract]] = defaultdict(list)
    for path in (ROOT / 'backend/config').rglob('*.py'):
        relative = path.relative_to(ROOT)
        if 'tests' in relative.parts:
            continue
        tree = ast.parse(path.read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or call_name(node) != 'config' or not node.args:
                continue
            key = literal_key(node.args[0])
            if not key:
                continue
            cast: str | None = None
            default: object = MISSING
            for keyword in node.keywords:
                if keyword.arg == 'cast':
                    if isinstance(keyword.value, ast.Name):
                        cast = keyword.value.id
                    elif isinstance(keyword.value, ast.Attribute):
                        cast = keyword.value.attr
                    elif isinstance(keyword.value, ast.Call):
                        cast = call_name(keyword.value)
                elif keyword.arg == 'default':
                    try:
                        default = ast.literal_eval(keyword.value)
                    except (ValueError, TypeError):
                        default = MISSING
            contracts[key].append(ConfigContract(relative, node.lineno, cast, default))
    return contracts


def normalized_value(value: str, cast: str | None) -> object:
    if cast == 'bool':
        lowered = value.lower()
        if lowered in {'true', 'yes', 'on', '1'}:
            return True
        if lowered in {'false', 'no', 'off', '0'}:
            return False
        raise ValueError('expected a boolean')
    if cast == 'int':
        return int(value)
    if cast == 'float':
        return float(value)
    if cast == 'Csv':
        return [part.strip() for part in value.split(',') if part.strip()]
    if cast == 'loads':
        return json.loads(value)
    return value


def invalid_cast_keys(
    declarations: dict[str, Declaration],
    contracts: dict[str, list[ConfigContract]],
) -> dict[str, ConfigContract]:
    invalid: dict[str, ConfigContract] = {}
    for key, declaration in declarations.items():
        for contract in contracts.get(key, []):
            try:
                normalized_value(declaration.value, contract.cast)
            except ValueError:
                invalid[key] = contract
                break
    return invalid


def validate_backend_template(
    declarations: dict[str, Declaration],
    contracts: dict[str, list[ConfigContract]],
) -> list[str]:
    errors = [
        f'{BACKEND_TEMPLATE}:{declarations[key].line}: {key} cannot satisfy '
        f'cast={contract.cast} at {contract.path}:{contract.line}'
        for key, contract in sorted(invalid_cast_keys(declarations, contracts).items())
    ]
    for key, declaration in declarations.items():
        if key in DOCUMENTED_DEFAULT_OVERRIDES:
            continue
        primary = next(
            (
                contract
                for contract in contracts.get(key, [])
                if contract.path == Path('backend/config/settings/base.py')
                and contract.default is not MISSING
            ),
            None,
        )
        if primary is None:
            continue
        try:
            template_value = normalized_value(declaration.value, primary.cast)
            code_default = (
                normalized_value(str(primary.default), 'Csv')
                if primary.cast == 'Csv' and isinstance(primary.default, str)
                else primary.default
            )
        except ValueError:
            continue
        if primary.cast == 'Csv' and isinstance(code_default, tuple):
            code_default = list(code_default)
        if template_value != code_default:
            errors.append(
                f'{BACKEND_TEMPLATE}:{declaration.line}: {key} documents '
                f'{declaration.value!r} but base.py:{primary.line} defaults to '
                f'{primary.default!r}; document the intentional override first'
            )
    return errors


def report_unowned(
    label: str,
    consumers: dict[str, set[str]],
    declared: set[str],
    exceptions: dict[str, str],
) -> list[str]:
    errors = [
        f'{label}: {key} is read at {", ".join(sorted(consumers[key]))} but not declared'
        for key in sorted(set(consumers) - declared - set(exceptions))
    ]
    errors.extend(
        f'{label}: {key} is declared but nothing reads it'
        for key in sorted(declared - set(consumers))
    )
    errors.extend(
        f'{label}: {key} is process-owned and must not be declared'
        for key in sorted(declared & set(exceptions))
    )
    return errors


def stray_env_files() -> list[str]:
    """Env files are owned by backend/ and frontend/ only."""
    allowed = {template.parent for template in LOCAL_ENV_FILES}
    errors = []
    for path in ROOT.glob('**/.env*'):
        relative = path.relative_to(ROOT)
        if path.is_dir() or {'node_modules', '.git', '.venv', 'venv'} & set(relative.parts):
            continue
        if relative.parent not in allowed or relative.name not in {'.env', '.env.example'}:
            errors.append(f'stray env file: {relative} (only backend/ and frontend/ own .env)')
    compose = (ROOT / 'docker-compose.yml').read_text(encoding='utf-8')
    for key in sorted(set(re.findall(r'\$\{([A-Za-z_][A-Za-z0-9_]*)', compose))):
        errors.append(f'docker-compose.yml interpolates ${{{key}}}; there is no root .env')
    return errors


def local_env_report(
    path: Path,
    template_keys: list[str],
    contracts: dict[str, list[ConfigContract]] | None = None,
) -> list[str]:
    if not path.is_file():
        return []
    declarations, duplicates = parse_env_file(path)
    checks = (
        ('missing key(s)', set(template_keys) - set(declarations)),
        ('unknown key(s)', set(declarations) - set(template_keys)),
        ('duplicate key(s)', duplicates),
        ('invalid value for cast', set(invalid_cast_keys(declarations, contracts or {}))),
        (
            'order differs from template',
            set()
            if [key for key in declarations if key in template_keys]
            == [key for key in template_keys if key in declarations]
            else {'run scripts/sync_local_env.py'},
        ),
    )
    return [
        f'{path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}: {label}: '
        f'{", ".join(sorted(names))}'
        for label, names in checks
        if names
    ]


def main() -> int:
    backend_declared, backend_duplicates = parse_env_file(ROOT / BACKEND_TEMPLATE)
    frontend_declared, frontend_duplicates = parse_env_file(ROOT / FRONTEND_TEMPLATE)
    contracts = config_contracts()

    errors = [f'{BACKEND_TEMPLATE}: duplicate {key}' for key in sorted(backend_duplicates)]
    errors.extend(f'{FRONTEND_TEMPLATE}: duplicate {key}' for key in sorted(frontend_duplicates))
    errors.extend(
        f'ownership: {key} is declared by both templates'
        for key in sorted(set(backend_declared) & set(frontend_declared))
    )
    errors.extend(stray_env_files())

    backend_read = backend_consumers()
    frontend_read = frontend_consumers()
    errors.extend(report_unowned('backend', backend_read, set(backend_declared), BACKEND_PROCESS_KEYS))
    errors.extend(
        report_unowned('frontend', frontend_read, set(frontend_declared), FRONTEND_PROCESS_KEYS)
    )
    errors.extend(validate_backend_template(backend_declared, contracts))
    errors.extend(
        f'frontend: {key} looks like a secret but VITE_* is bundled publicly'
        for key in sorted(frontend_declared)
        if key.startswith('VITE_') and any(token in key for token in SECRET_LIKE_TOKENS)
    )

    if errors:
        print('Env template check failed:', file=sys.stderr)
        for error in errors:
            print(f'  - {error}', file=sys.stderr)
        return 1

    local_messages = local_env_report(
        ROOT / LOCAL_ENV_FILES[BACKEND_TEMPLATE], list(backend_declared), contracts
    ) + local_env_report(ROOT / LOCAL_ENV_FILES[FRONTEND_TEMPLATE], list(frontend_declared))
    if local_messages:
        print('Local env report (values are never printed):')
        for message in local_messages:
            print(f'  - {message}')
    else:
        print('Local env files are in sync with their templates (or absent).')

    print(
        'Env template check passed: '
        f'backend {len(backend_declared)} key(s), frontend {len(frontend_declared)} key(s).'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
