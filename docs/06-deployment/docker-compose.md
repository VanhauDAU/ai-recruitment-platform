# Chạy dự án local bằng Docker Compose

## Máy mới chỉ cần Docker

```bash
git clone https://github.com/VanhauDAU/ai-recruitment-platform.git
cd ai-recruitment-platform
cp backend/.env.example backend/.env       # điền tối thiểu SECRET_KEY
docker compose up
```

- Frontend (vite dev): http://localhost:5173
- Backend API: http://localhost:8000/api
- Swagger UI: http://localhost:8000/api/docs/

### Kiểm thử bằng điện thoại trong mạng LAN

Frontend dev proxy cả `/api` và `/media`, vì vậy điện thoại không cần
truy cập trực tiếp các cổng backend. Kết nối điện thoại và máy dev vào cùng một
mạng Wi-Fi, lấy IP LAN của máy dev rồi mở:

```text
http://<IP-LAN>:5173
```

Ví dụ `http://192.168.1.144:5173`. Nếu đổi mạng Wi-Fi, chỉ URL trên điện thoại
thay đổi; không cần sửa `VITE_API_BASE_URL`, CORS hoặc `ALLOWED_HOSTS`.
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
  `worker` (Celery tác vụ chung), `ai-worker` (chỉ queue `ai-generation`,
  concurrency 2), `beat` (Celery beat) và `frontend` (vite).
- `frontend_node_modules` được giữ trong named volume. Entrypoint chỉ chạy
  `npm ci` khi `package-lock.json` thay đổi hoặc volume còn trống, nên restart
  frontend không còn cài lại toàn bộ dependency.
- **Queue Celery**: worker chung nghe `default`, `auth-email`, `auth-sms`,
  `cv-export`, `upload-scan` và `candidate-email`.
  `ai-generation` chỉ do `ai-worker` nghe để provider latency không chiếm pool
  email/export/scan. Không gộp queue AI vào worker chung khi lên production.
- **`CELERY_BROKER_URL` được override tường minh** trong compose: settings chỉ
  fallback về `REDIS_URL` khi biến vắng mặt, mà `.env` lại set sẵn `127.0.0.1`.

Repository hiện chỉ duy trì Compose cho phát triển local. Cấu hình production cũ
được giữ trong tag `procv-pre-local-only-2026-09-27`; việc triển khai lại cần một
kế hoạch riêng, không ghép vào quy trình local này.

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
  python manage.py seed_cv_templates && \
  python manage.py seed_services && \
  python manage.py seed_demo_jobs"
```

`seed_cv_templates` dựng 10 mẫu CV (template + version đã publish + mapping
section + localization 4 ngôn ngữ + danh mục + màu). Thêm `--snapshots` để xếp
hàng render ảnh preview thật cho từng màu — cần worker Celery có WeasyPrint;
không chạy thì catalogue dùng ảnh giữ chỗ theo màu chủ đạo.

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
docker compose exec backend python manage.py bootstrap_admin_mfa <email> \
  --mark-email-verified --no-input

# Backup DB
docker compose exec db pg_dump -U postgres ai_career_coach > backup-$(date +%F).sql

# Khôi phục
cat backup-YYYY-MM-DD.sql | docker compose exec -T db psql -U postgres ai_career_coach

# Log
docker compose logs -f backend worker ai-worker

# Dựng lại service local sau khi đổi code
docker compose up -d --build
```

### Giới hạn tài nguyên và dung lượng

Compose đã đặt các mặc định an toàn, có thể override trong file `.env` ở root:

| Biến | Mặc định local | Ý nghĩa |
| --- | ---: | --- |
| `AI_RUNTIME_ENABLED` | `true` | Hard switch toàn generative AI; Site Setting chỉ được thu hẹp rollout. |
| AI worker concurrency | `2` | Giới hạn tài nguyên local cho queue AI. |
| `DOCKER_LOG_MAX_SIZE` | `10m` | Kích thước mỗi file log container. |
| `DOCKER_LOG_MAX_FILES` | `3` | Số file log giữ cho mỗi container. |

### Theo dõi và dọn Docker an toàn

```bash
# CPU/RAM/PID theo thời gian thực
docker stats

# Dung lượng image, volume và build cache
docker system df -v

# Giữ Buildx cache hữu ích trong ngân sách 5GB, không đụng image/volume
sh scripts/docker_maintenance.sh
```

Không chạy `docker system prune --volumes` trên máy đang giữ dữ liệu local: lệnh
đó có thể xóa nhầm Postgres và media. Backend Dockerfile dùng BuildKit cache
mount; build cache chỉ hỗ trợ build nhanh và không được sử dụng lúc container
đang chạy.

## Kiểm chứng đã chạy (2026-07-21)

- `docker compose up`: migrate sạch (gồm extension `unaccent`), API v2 trả 200,
  endpoint v1 trả 404 đúng như sau AR-P3.
- WeasyPrint render PDF tiếng Việt trong container: OK (4.004 bytes).
- Worker nhận và chạy task trên cả `cv-export` lẫn `auth-email`.

## Ghi chú

- Ảnh backend cài sẵn system libs cho WeasyPrint (pango/cairo/gdk-pixbuf) và
  fonts Noto/DejaVu — render PDF tiếng Việt hoạt động trong container.
- `requirements-ai.txt` (PyMuPDF, scikit-learn...) chưa đưa vào image; khi làm
  Giai đoạn AI sẽ thêm build arg riêng.
- `scripts/check_all.sh` tự fallback chạy backend qua compose khi máy không có
  `backend/venv`.
- `createsuperuser` + `bootstrap_admin_mfa` là break-glass có quyền máy chủ,
  không phải cách bật `/admin/` ở production. Mọi lần sử dụng phải có ticket và
  nhật ký vận hành.
