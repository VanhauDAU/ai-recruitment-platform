# Giai đoạn 7 — Django settings theo môi trường

**Ngày:** 2026-07-13 · **Trạng thái:** hoàn tất.

## Source → target

| Trước | Sau | Trách nhiệm |
| --- | --- | --- |
| `config/settings.py` | `config/settings/base.py` | App, middleware, DB, DRF, JWT, Redis, Celery, email, OAuth, media và API docs chung |
| một module settings | `config/settings/development.py` | Entry mặc định local; chặn nhầm `ENVIRONMENT=production` |
| một module settings | `config/settings/test.py` | LocMem cache, email in-memory, Celery eager, tắt HTTPS redirect |
| một module settings | `config/settings/production.py` | Kiểm tra bắt buộc DEBUG/SECRET_KEY/ALLOWED_HOSTS/reCAPTCHA/JWT signing key |

## Entry point

- `manage.py`, ASGI, WSGI và Celery mặc định `config.settings.development`.
- Backend CI đặt tường minh `DJANGO_SETTINGS_MODULE=config.settings.test`.
- Production bắt buộc đồng thời `ENVIRONMENT=production` và
  `DJANGO_SETTINGS_MODULE=config.settings.production`.
- Không đổi tên biến trong `.env`; `.env.example` và hướng dẫn cài đặt ghi rõ
  cách chọn module.

## Xác nhận

- `manage.py check` xanh với development, test và production (bộ biến production hợp lệ).
- `makemigrations --check --dry-run` không phát sinh migration.
- Toàn bộ backend suite: 77/77 pass bằng `config.settings.test`.
