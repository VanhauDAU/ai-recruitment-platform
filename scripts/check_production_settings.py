#!/usr/bin/env python3
"""Nạp config.settings.production với cấu hình của docker-compose.prod.yml.

Bắt sớm (trên CI, trước khi lên VPS) hai loại lỗi chỉ lộ ra lúc deploy:
- production.py thêm điều kiện fail-fast mới mà `x-prod-env` chưa đáp ứng;
- `manage.py check --deploy` cảnh báo cấu hình bảo mật (HSTS, cookie, SSL...).

Giá trị cố định lấy đúng từ `x-prod-env`; bí mật là giá trị giả đủ định dạng.
Không đọc backend/.env (BACKEND_IGNORE_ENV_FILE=1) để kết quả không phụ thuộc máy.
Chạy từ thư mục gốc repo: python scripts/check_production_settings.py
"""

import os
import subprocess
import sys
from pathlib import Path

import yaml
from cryptography.fernet import Fernet

ROOT = Path(__file__).resolve().parent.parent


def _fake(prefix):
    return f'{prefix}-' + 'x' * 48


def production_env():
    compose = yaml.safe_load((ROOT / 'docker-compose.prod.yml').read_text())
    env = {key: str(value) for key, value in compose['x-prod-env'].items()}
    env.update(
        {
            'BACKEND_IGNORE_ENV_FILE': '1',
            'SECRET_KEY': _fake('secret'),
            'JWT_SIGNING_KEY': _fake('jwt'),
            'DB_NAME': 'procv',
            'DB_USER': 'procv',
            'DB_PASSWORD': _fake('db'),
            'RECAPTCHA_SECRET_KEY': _fake('recaptcha'),
            'EMAIL_HOST_USER': 'no-reply@procv.site',
            'EMAIL_HOST_PASSWORD': _fake('smtp'),
            'AI_MODEL_PRICING_USD': '{"gemini-2.5-flash": {"input": 0.3, "output": 2.5}}',
            'R2_ENDPOINT_URL': 'https://account.r2.cloudflarestorage.com',
            'EMPLOYER_DPA_POLICY_VERSION': '2026-12',
            'EMPLOYER_DPA_DOCUMENT_URL': 'https://procv.site/documents/dpa.pdf',
            'EMPLOYER_DPA_DOCUMENT_SHA256': 'a' * 64,
            'EMPLOYER_SMS_OTP_ENABLED': 'False',
            'CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY': Fernet.generate_key().decode(),
        }
    )
    for bucket in ('PUBLIC', 'PRIVATE', 'QUARANTINE'):
        env[f'R2_{bucket}_BUCKET'] = f'procv-{bucket.lower()}'
        env[f'R2_{bucket}_ACCESS_KEY_ID'] = _fake(f'{bucket.lower()}-id')
        env[f'R2_{bucket}_SECRET_ACCESS_KEY'] = _fake(f'{bucket.lower()}-secret')
    return env


# Cấu hình sai phải làm production.py từ chối khởi động (mỗi ca đổi một biến).
REJECTED_CASES = [
    ('SECRET_KEY mẫu trong .env.example', {'SECRET_KEY': 'django-insecure-local-only-' + 'x' * 40}),
    ('ALLOWED_HOSTS chứa *', {'ALLOWED_HOSTS': 'procv.site,*'}),
    ('CORS origin http://', {'CORS_ALLOWED_ORIGINS': 'http://procv.site'}),
]


def rejected_cases_failures(base):
    failures = []
    for label, overrides in REJECTED_CASES:
        result = subprocess.run(
            [sys.executable, '-c', 'import config.settings.production'],
            cwd=ROOT / 'backend',
            env={**base, **production_env(), **overrides},
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0 or 'ImproperlyConfigured' not in result.stderr:
            failures.append(label)
    return failures


def main():
    # Chỉ giữ biến hệ thống cần để chạy Python; mọi cấu hình còn lại do script cấp.
    base = {key: os.environ[key] for key in ('PATH', 'HOME', 'LANG') if key in os.environ}
    result = subprocess.run(
        [sys.executable, 'manage.py', 'check', '--deploy', '--fail-level', 'WARNING'],
        cwd=ROOT / 'backend',
        env={**base, **production_env()},
        check=False,
    )
    if result.returncode:
        return result.returncode
    failures = rejected_cases_failures(base)
    for label in failures:
        print(f'production.py không chặn cấu hình sai: {label}', file=sys.stderr)
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
