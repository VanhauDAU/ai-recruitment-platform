#!/usr/bin/env python3
"""Validate env consumers against the minimal and optional catalogs."""

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

BACKEND_CATALOGS = (
    Path('backend/.env.example'),
    Path('backend/.env.optional.example'),
)
FRONTEND_CATALOGS = (
    Path('frontend/.env.example'),
    Path('frontend/.env.optional.example'),
)
COMPOSE_CATALOGS = (Path('.env.example'),)

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
    'COMPOSE_PROFILES': 'Docker Compose CLI: selects optional local service profiles',
}

# These application keys are intentionally replaced only to address service
# discovery inside the Docker network. Product flags must keep their app-owned
# env source and therefore do not belong in this allowlist.
COMPOSE_APPLICATION_OVERRIDES = {
    'CLAMAV_HOST': 'Docker service discovery: scanner hostname is clamav',
    'CLAMAV_PORT': 'Docker service discovery: scanner uses its container port',
}

RETIRED_BACKEND_KEYS = {
    'SPEECH_TTS_BASE_URL',
    'SPEECH_TTS_INTERNAL_TOKEN',
    'SPEECH_TTS_CONNECT_TIMEOUT_SECONDS',
    'SPEECH_TTS_READ_TIMEOUT_SECONDS',
    'SPEECH_DEFAULT_VOICE_ID',
    'SPEECH_DEFAULT_STYLE',
    'SPEECH_MODEL_REVISION',
    'SPEECH_MAX_TEXT_CHARS',
    'SPEECH_MAX_ADHOC_TEXT_CHARS',
    'SPEECH_GENERATION_TIMEOUT_SECONDS',
    'SPEECH_ARTIFACT_POLL_INTERVAL_SECONDS',
    'SPEECH_ARTIFACT_DOWNLOAD_TIMEOUT_SECONDS',
    'SPEECH_ARTIFACT_RETENTION_DAYS',
    'SPEECH_CAPABILITIES_CACHE_SECONDS',
}

# Catalog values may intentionally be operational overrides rather than code
# fallbacks. Every divergence from the primary base settings must be explicit.
DOCUMENTED_DEFAULT_OVERRIDES = {
    'AI_MODEL_PRICING_USD': 'local zero-price map avoids accidental provider-cost claims',
    'CELERY_RESULT_BACKEND': 'an empty override preserves the legacy disabled result backend',
    'EMAIL_FROM_NAME': 'local sample supplies the product display name',
    'OAUTH_CODE_TTL': 'legacy local contract is 120 seconds; code fallback remains 60 pending auth change',
}


@dataclass(frozen=True)
class Declaration:
    path: Path
    line: int
    value: str


@dataclass(frozen=True)
class ConfigContract:
    path: Path
    line: int
    cast: str | None
    default: object


MISSING = object()


def catalog_declarations(
    paths: tuple[Path, ...],
) -> tuple[dict[str, Declaration], list[str]]:
    declarations: dict[str, Declaration] = {}
    errors: list[str] = []
    for relative_path in paths:
        path = ROOT / relative_path
        if not path.is_file():
            errors.append(f'missing catalog: {relative_path}')
            continue
        seen_in_file: set[str] = set()
        for line_number, line in enumerate(
            path.read_text(encoding='utf-8').splitlines(), 1
        ):
            match = DECLARATION_PATTERN.match(line)
            if not match:
                continue
            key = match.group(1)
            if key in seen_in_file:
                errors.append(
                    f'{relative_path}:{line_number}: duplicate declaration {key}'
                )
            elif key in declarations:
                errors.append(
                    f'{relative_path}:{line_number}: {key} already declared in '
                    f'{declarations[key].path}:{declarations[key].line}'
                )
            seen_in_file.add(key)
            declarations[key] = Declaration(relative_path, line_number, match.group(2))
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

            for match in re.finditer(
                r"['\"]env_var['\"]\s*:\s*['\"]([A-Z][A-Z0-9_]+)['\"]", text
            ):
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


def compose_consumers() -> set[str]:
    text = (ROOT / 'docker-compose.yml').read_text(encoding='utf-8')
    return set(re.findall(r'\$\{([A-Z][A-Z0-9_]*)', text))


def config_contracts() -> dict[str, list[ConfigContract]]:
    contracts: dict[str, list[ConfigContract]] = defaultdict(list)
    for path in (ROOT / 'backend/config').rglob('*.py'):
        relative = path.relative_to(ROOT)
        if 'tests' in relative.parts:
            continue
        tree = ast.parse(path.read_text(encoding='utf-8'))
        for node in ast.walk(tree):
            if (
                not isinstance(node, ast.Call)
                or call_name(node) != 'config'
                or not node.args
            ):
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
    return value


def validate_backend_values(
    declarations: dict[str, Declaration],
    contracts: dict[str, list[ConfigContract]],
) -> list[str]:
    errors: list[str] = []
    for key, declaration in declarations.items():
        if declaration.value.startswith(('{', '[')):
            try:
                json.loads(declaration.value)
            except json.JSONDecodeError as error:
                errors.append(
                    f'{declaration.path}:{declaration.line}: {key} has invalid JSON: {error.msg}'
                )
        for contract in contracts.get(key, []):
            try:
                normalized_value(declaration.value, contract.cast)
            except ValueError as error:
                errors.append(
                    f'{declaration.path}:{declaration.line}: {key} cannot satisfy '
                    f'{contract.cast} at {contract.path}:{contract.line}: {error}'
                )

        primary = [
            contract
            for contract in contracts.get(key, [])
            if contract.path == Path('backend/config/settings/base.py')
            and contract.default is not MISSING
        ]
        if not primary or key in DOCUMENTED_DEFAULT_OVERRIDES:
            continue
        contract = primary[0]
        try:
            catalog_value = normalized_value(declaration.value, contract.cast)
        except ValueError:
            continue
        if contract.cast == 'Csv':
            code_default = (
                list(contract.default)
                if isinstance(contract.default, (list, tuple))
                else normalized_value(str(contract.default), 'Csv')
            )
        else:
            code_default = contract.default
        if catalog_value != code_default:
            errors.append(
                f'{declaration.path}:{declaration.line}: {key} documents {declaration.value!r} '
                f'but base.py:{contract.line} defaults to {contract.default!r}; '
                'document the intentional override before changing either value'
            )
    return errors


def local_env_report(
    label: str,
    path: Path,
    allowed: set[str],
    required: set[str],
    retired: set[str] | None = None,
) -> list[str]:
    if not path.is_file():
        return []
    retired = retired or set()
    keys: dict[str, tuple[int, bool]] = {}
    duplicate: set[str] = set()
    for line_number, line in enumerate(
        path.read_text(encoding='utf-8').splitlines(), 1
    ):
        match = DECLARATION_PATTERN.match(line)
        if not match:
            continue
        key, value = match.groups()
        if key in keys:
            duplicate.add(key)
        keys[key] = (line_number, not value.strip())

    messages: list[str] = []
    checks = (
        ('missing required key(s)', required - set(keys)),
        ('unknown key(s)', set(keys) - allowed - retired),
        ('retired key(s)', set(keys) & retired),
        ('duplicate key(s)', duplicate),
        (
            'required key(s) with an empty value',
            {key for key in required if key in keys and keys[key][1]},
        ),
    )
    for description, names in checks:
        if names:
            messages.append(f'{label}: {description}: {", ".join(sorted(names))}')
    return messages


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
    compose_declared, compose_errors = catalog_declarations(COMPOSE_CATALOGS)
    errors.extend(frontend_errors)
    errors.extend(compose_errors)

    cross_scope = (
        (set(backend_declared) & set(frontend_declared))
        | (set(backend_declared) & set(compose_declared))
        | (set(frontend_declared) & set(compose_declared))
    )
    for key in sorted(cross_scope):
        errors.append(f'ownership: {key} is declared by more than one env catalog')

    backend_read = backend_consumers()
    frontend_read = frontend_consumers()
    errors.extend(
        report_missing(
            'backend', backend_read, set(backend_declared), BACKEND_PROCESS_KEYS
        )
    )
    errors.extend(
        report_missing(
            'frontend', frontend_read, set(frontend_declared), FRONTEND_PROCESS_KEYS
        )
    )
    errors.extend(validate_backend_values(backend_declared, config_contracts()))

    unused_backend = set(backend_declared) - set(backend_read)
    unused_frontend = set(frontend_declared) - set(frontend_read)
    unused_compose = (
        set(compose_declared) - compose_consumers() - set(COMPOSE_PROCESS_KEYS)
    )
    for key in sorted(unused_backend):
        errors.append(
            f'backend: {key} is cataloged but has no runtime or dynamic consumer'
        )
    for key in sorted(unused_frontend):
        errors.append(
            f'frontend: {key} is cataloged but has no runtime/tooling consumer'
        )
    for key in sorted(unused_compose):
        errors.append(f'compose: {key} is cataloged but has no Compose consumer')

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
        errors.append(
            'frontend: secret-like VITE_* declarations: '
            + ', '.join(forbidden_frontend)
        )

    compose_read = compose_consumers()
    compose_known = (
        set(backend_declared) | set(frontend_declared) | set(compose_declared)
    )
    for key in sorted(compose_read - compose_known):
        errors.append(f'compose: {key} has no application or Compose catalog')

    application_interpolation = compose_read & (
        set(backend_declared) | set(frontend_declared)
    )
    for key in sorted(application_interpolation - set(COMPOSE_APPLICATION_OVERRIDES)):
        errors.append(
            f'compose: {key} overrides an application-owned value without a documented '
            'service-discovery exception'
        )

    local_messages: list[str] = []
    local_messages.extend(
        local_env_report(
            'backend/.env',
            ROOT / 'backend/.env',
            set(backend_declared),
            set(catalog_declarations((Path('backend/.env.example'),))[0]),
            RETIRED_BACKEND_KEYS,
        )
    )
    frontend_local = (
        ROOT / 'frontend/.env.local'
        if (ROOT / 'frontend/.env.local').is_file()
        else ROOT / 'frontend/.env'
    )
    local_messages.extend(
        local_env_report(
            str(frontend_local.relative_to(ROOT)),
            frontend_local,
            set(frontend_declared),
            set(catalog_declarations((Path('frontend/.env.example'),))[0]),
        )
    )
    local_messages.extend(
        local_env_report(
            '.env',
            ROOT / '.env',
            set(compose_declared),
            set(),
        )
    )

    if errors:
        print('Env catalog check failed:', file=sys.stderr)
        for error in errors:
            print(f'  - {error}', file=sys.stderr)
        return 1

    if local_messages:
        print('Local env report (informational; values are never printed):')
        for message in local_messages:
            print(f'  - {message}')
    else:
        print(
            'Local env report: no missing, unknown, retired, duplicate or invalid-empty keys.'
        )

    print(
        'Env catalog check passed: '
        f'{len(backend_read)} backend consumer(s), {len(backend_declared)} backend declaration(s); '
        f'{len(frontend_read)} frontend consumer(s), {len(frontend_declared)} frontend declaration(s); '
        f'{len(compose_read)} Compose interpolation key(s), '
        f'{len(compose_declared)} Compose declaration(s).'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
