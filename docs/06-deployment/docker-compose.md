# Chạy dự án bằng Docker Compose

## Dev (máy mới chỉ cần Docker)

```bash
git clone https://github.com/VanhauDAU/ai-recruitment-platform.git
cd ai-recruitment-platform
cp backend/.env.example backend/.env       # điền tối thiểu SECRET_KEY
docker compose up
```

- Frontend (vite dev): http://localhost:5173
- Backend API: http://localhost:8000/api
- Swagger UI: http://localhost:8000/api/docs/
- `DB_HOST`/`REDIS_URL` được compose override trỏ vào service `db`/`redis` —
  không cần sửa `.env`.
- **Postgres của compose ở host cổng `5433`** (trong mạng compose vẫn là
  `db:5432`). Tránh trùng Postgres cài trực tiếp trên máy đang giữ 5432: cả hai
  đều là DB `ai_career_coach` / `postgres:postgres` nên nếu dùng chung cổng thì
  DBeaver, `psql` và backend chạy ngoài Docker luôn nối vào Postgres local mà
  không báo lỗi gì. Kết nối DBeaver vào DB trong Docker:
  `localhost:5433/ai_career_coach`, user `postgres`, password `postgres`.
- Muốn backend chạy ngoài Docker dùng DB trong Docker thì đặt `DB_PORT=5433`
  trong `backend/.env` (mặc định `5432` = Postgres local).
- Service: `db` (postgres 16), `redis`, `backend` (runserver + auto migrate),
  `worker` (celery), `beat` (celery beat), `frontend` (vite).
- **Queue Celery**: settings route task sang 3 queue (`default`, `auth-email`,
  `cv-export`). Worker trong compose khai đủ `-Q default,auth-email,cv-export`
  — bỏ cờ này thì email xác thực và export CV im lặng không chạy.
- **`CELERY_BROKER_URL` được override tường minh** trong compose: settings chỉ
  fallback về `REDIS_URL` khi biến vắng mặt, mà `.env` lại set sẵn `127.0.0.1`.

## Production (VPS + Docker Compose)

```bash
# 1. Chuẩn bị env
cp backend/.env.example backend/.env
# Điền: ENVIRONMENT=production, SECRET_KEY, JWT_SIGNING_KEY, DB_PASSWORD,
# ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, EMAIL_*, R2_*, RECAPTCHA_SECRET_KEY,
# TWO_FACTOR_TOTP_ENCRYPTION_KEY...
# Settings production FAIL-FAST: thiếu biến nào sẽ liệt kê đầy đủ khi start.

# 2. Biến build frontend (compose interpolation) — file .env ở root repo
echo 'VITE_API_BASE_URL=https://<domain>/api' >> .env
echo 'VITE_RECAPTCHA_SITE_KEY=<site-key>' >> .env

# 3. Chạy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- `nginx` (cổng 80/443) reverse proxy: `/` → frontend tĩnh, `/api` + `/admin` →
  gunicorn, `/static` + `/media` serve trực tiếp từ volume.
- DB và Redis **không** expose ra ngoài host ở production.
- Cấu hình nginx: `deploy/nginx/procv.conf`. TLS: thêm server block 443 +
  certbot khi trỏ domain.

## Seed dữ liệu (lần đầu — DB Docker khởi tạo rỗng)

`docker compose up` chỉ chạy `migrate`, **không** seed. Trang chủ sẽ hiện
"0 việc làm" và `/mau-cv` rỗng cho tới khi chạy:

```bash
docker compose exec backend sh -c "\
  python manage.py seed_skills && \
  python manage.py seed_locations && \
  python manage.py seed_province_merges && \
  python manage.py seed_job_categories && \
  python manage.py seed_sitecontent && \
  python manage.py seed_cv_catalog && \
  python manage.py seed_services && \
  python manage.py seed_demo_jobs"
```

`seed_locations` gọi `provinces.open-api.vn` nên cần internet ở lần chạy đầu.
Mọi lệnh seed đều chạy lại được.

### Demo Account Management G3

Sau khi backend đã migrate, tạo bộ tài khoản quản trị demo bằng lệnh idempotent:

```bash
docker compose exec backend python manage.py seed_admin_account_demo
```

Lệnh chỉ chạy mặc định khi `DEBUG=True`, đặt lại mật khẩu và mã dự phòng demo
mỗi lần chạy để môi trường local luôn đăng nhập được:

| Persona | Email | Mật khẩu | Mã dự phòng |
| --- | --- | --- | --- |
| Superuser | `admin-root@demo.local` | `AdminDemo123!` | `91000001` … `91000005` |
| Nhân sự cấp tài khoản | `hr-provisioner@demo.local` | `AdminDemo123!` | `92000001` … `92000005` |
| Nhân viên kiểm duyệt | `moderator-admin@demo.local` | `AdminDemo123!` | `93000001` … `93000005` |

Persona Nhân sự có `account.admin.invite` và được whitelist cấp ba chức danh
thường: kiểm duyệt, nội dung và chăm sóc khách hàng. Persona này không thể cấp
chức danh chứa quyền cấp phát hoặc quản trị đặc quyền. Không dùng các thông tin
demo trên staging/production.

## Vận hành

```bash
# Migrate thủ công / tạo superuser
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser

# Backup DB
docker compose exec db pg_dump -U postgres ai_career_coach > backup-$(date +%F).sql

# Khôi phục
cat backup-YYYY-MM-DD.sql | docker compose exec -T db psql -U postgres ai_career_coach

# Log
docker compose logs -f backend worker

# Rollback code: checkout commit cũ rồi build lại
git checkout <commit> && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Kiểm chứng đã chạy (2026-07-21)

- `docker compose up`: migrate sạch (gồm extension `unaccent`), API v2 trả 200,
  endpoint v1 trả 404 đúng như sau AR-P3.
- WeasyPrint render PDF tiếng Việt trong container: OK (4.004 bytes).
- Worker nhận và chạy task trên cả `cv-export` lẫn `auth-email`.
- Image prod frontend (vite build → nginx) build thành công.

## Ghi chú

- Ảnh backend cài sẵn system libs cho WeasyPrint (pango/cairo/gdk-pixbuf) và
  fonts Noto/DejaVu — render PDF tiếng Việt hoạt động trong container.
- `requirements-ai.txt` (PyMuPDF, scikit-learn...) chưa đưa vào image; khi làm
  Giai đoạn AI sẽ thêm build arg riêng.
- `scripts/check_all.sh` tự fallback chạy backend qua compose khi máy không có
  `backend/venv`.
