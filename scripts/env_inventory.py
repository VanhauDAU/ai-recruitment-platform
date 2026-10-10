#!/usr/bin/env python3
"""Emit the P4 env inventory without exposing real environment values."""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

from check_env_sync import (
    BACKEND_CATALOGS,
    BACKEND_PROCESS_KEYS,
    COMPOSE_PROCESS_KEYS,
    FRONTEND_CATALOGS,
    FRONTEND_PROCESS_KEYS,
    ROOT,
    backend_consumers,
    frontend_consumers,
)

DECLARATION_PATTERN = re.compile(r'^([A-Z][A-Z0-9_]*)=(.*)$')
SENSITIVE_TOKENS = (
    'SECRET',
    'PASSWORD',
    'TOKEN',
    'API_KEY',
    'ACCESS_KEY',
    'SIGNING_KEY',
    'ENCRYPTION_KEY',
    'HMAC_KEY',
)


def catalog_rows(paths: tuple[Path, ...]):
    for relative_path in paths:
        action = 'keep-minimal' if relative_path.name == '.env.example' else 'move-optional'
        for line in (ROOT / relative_path).read_text(encoding='utf-8').splitlines():
            match = DECLARATION_PATTERN.match(line)
            if match:
                yield match.group(1), match.group(2), str(relative_path), action


def value_type(name: str, value: str) -> str:
    lowered = value.lower()
    if lowered in {'true', 'false'}:
        return 'boolean'
    if re.fullmatch(r'-?\d+', value):
        return 'integer'
    if re.fullmatch(r'-?\d+\.\d+', value):
        return 'float'
    if value.startswith('{') or value.startswith('['):
        return 'json'
    if name.endswith(('_URL', '_ORIGINS')) or 'REDIS_URL' in name:
        return 'url/csv'
    if ',' in value:
        return 'csv'
    return 'string'


def owner(scope: str, name: str) -> str:
    if scope == 'frontend':
        return 'frontend-tooling' if not name.startswith('VITE_') else 'frontend-runtime'
    groups = (
        (('DB_',), 'database'),
        (('REDIS_', 'CELERY_'), 'cache-worker'),
        (('AI_', 'GEMINI_', 'GOOGLE_CLOUD_', 'OPENAI_', 'ANTHROPIC_'), 'ai'),
        (('OAUTH_',), 'oauth'),
        (('EMAIL_', 'DEFAULT_FROM_EMAIL'), 'email'),
        (
            ('R2_', 'MEDIA_', 'PUBLIC_MEDIA_', 'PRIVATE_MEDIA_', 'LEGACY_MEDIA_'),
            'storage',
        ),
        (('UPLOAD_', 'CLAMAV_', 'IMAGE_UPLOAD_'), 'upload'),
        (('EMPLOYER_SMS_',), 'sms'),
        (('VNPAY_',), 'payments'),
    )
    for prefixes, group in groups:
        if name.startswith(prefixes):
            return group
    return 'backend-policy'


def safe_default(name: str, value: str) -> str:
    if any(token in name for token in SENSITIVE_TOKENS):
        return '<empty>' if not value else '<local-placeholder>'
    return value or '<empty>'


def emit_catalog(scope: str, paths: tuple[Path, ...], consumers, writer):
    for name, value, catalog, action in catalog_rows(paths):
        locations = ';'.join(sorted(consumers.get(name, {'dynamic/tooling'})))
        writer.writerow(
            (
                scope,
                name,
                catalog,
                locations,
                value_type(name, value),
                safe_default(name, value),
                'local baseline' if action == 'keep-minimal' else 'when enabling/overriding',
                owner(scope, name),
                'sensitive'
                if any(token in name for token in SENSITIVE_TOKENS)
                else 'public/config',
                action,
                'check_env_sync + affected-domain gate',
            )
        )


def emit_exceptions(scope: str, exceptions: dict[str, str], writer):
    for name, reason in sorted(exceptions.items()):
        writer.writerow(
            (
                scope,
                name,
                'process-only',
                reason,
                'string',
                '<owned default>',
                'when owner supplies it',
                reason.split(':', 1)[0],
                'public/config',
                'owned-exception',
                'check_env_sync',
            )
        )


def main() -> int:
    writer = csv.writer(sys.stdout, lineterminator='\n')
    writer.writerow(
        (
            'scope',
            'name',
            'catalog',
            'consumer_or_reason',
            'type',
            'documented_default',
            'required_when',
            'owner',
            'sensitivity',
            'action',
            'proof',
        )
    )
    emit_catalog('backend', BACKEND_CATALOGS, backend_consumers(), writer)
    emit_catalog('frontend', FRONTEND_CATALOGS, frontend_consumers(), writer)
    emit_exceptions('backend-process', BACKEND_PROCESS_KEYS, writer)
    emit_exceptions('frontend-process', FRONTEND_PROCESS_KEYS, writer)
    emit_exceptions('compose-process', COMPOSE_PROCESS_KEYS, writer)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
