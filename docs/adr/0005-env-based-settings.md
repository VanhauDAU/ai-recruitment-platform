# ADR 0005 — Tách Django settings theo môi trường, giữ contract .env

**Trạng thái:** Accepted — 2026-07-13

## Bối cảnh

`backend/config/settings.py` (~376 dòng) tập trung mọi cấu hình: apps, middleware,
DRF, JWT, Redis/Celery, email, OAuth, và các kiểm tra production tương đối nghiêm
(`ENVIRONMENT=production` bắt buộc DEBUG=False, SECRET_KEY, ALLOWED_HOSTS, reCAPTCHA).
File dài, khó thấy khác biệt giữa các môi trường.

## Quyết định

Tách thành package settings theo môi trường, **giữ nguyên mọi validation và contract .env**:

```
config/settings/
  base.py          # apps/middleware/DRF/JWT chung
  development.py   # DEBUG, email dev, CORS mở
  test.py          # DB/test nhanh, chính sách Celery cho test
  production.py    # security/JWT/reCAPTCHA checks (giữ nguyên logic hiện có)
```

- Entry points (`manage.py`, `asgi.py`, `wsgi.py`, `celery.py`) chọn qua
  `DJANGO_SETTINGS_MODULE`; mặc định development.
- Không đổi tên biến `.env`; cập nhật `.env.example` mô tả theo môi trường.
- Tách bằng import từ `base`, KHÔNG copy-paste (tránh sót biến).

## Bất biến

- Không mất bất kỳ kiểm tra production nào (DEBUG/SECRET_KEY/ALLOWED_HOSTS/reCAPTCHA).
- JWT signing key, Redis, Celery, email, OAuth, docs flag hoạt động như trước.
- Development/test/production chạy độc lập.

## Hệ quả

- (+) Thấy rõ khác biệt môi trường; file ngắn hơn.
- (+) Test dùng settings riêng, nhanh và an toàn.
- (−) Rủi ro sót biến khi tách — bắt buộc test danh sách key quan trọng sau khi tách.

## Rủi ro

Tách bằng copy-paste thiếu biến là rủi ro lớn nhất; nghiệm thu bằng smoke test cho
cả ba môi trường + so sánh danh sách setting quan trọng trước/sau.
