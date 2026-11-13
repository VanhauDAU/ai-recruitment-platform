# 05 - Hướng dẫn cài đặt & chạy local

## Yêu cầu
- Python 3.11, khóa qua `.python-version` ở gốc repo và `backend/.python-version`;
  local và CI (`.github/workflows/backend-ci.yml`) phải cùng major.minor. Có thể
  dựng backend bằng `./scripts/bootstrap-backend.sh` (tự kiểm tra Python 3.11) hoặc
  `pyenv install 3.11`.
- Node.js 20.19+ hoặc 22.12+ (Vite 8 yêu cầu các bản này)
- PostgreSQL 16
- Redis 7+

## PostgreSQL (macOS, Homebrew)

```bash
brew services start postgresql@16
createdb ai_career_coach
```

Mặc định backend đọc database từ `backend/.env`:

```env
DB_NAME=ai_career_coach
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
```

Nếu PostgreSQL local dùng user/password khác, chỉnh lại các biến `DB_*` trong `backend/.env`.

## Backend

### Chọn môi trường Django

Entry point local mặc định là `config.settings.development`; không cần đặt biến
thêm để chạy các lệnh `manage.py`. Khi cần chọn tường minh:

```bash
# CI/test: cache LocMem, email in-memory và Celery eager
DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test

# Production: bắt buộc ENVIRONMENT=production và đầy đủ biến bảo mật
ENVIRONMENT=production DJANGO_SETTINGS_MODULE=config.settings.production python manage.py check
```

Không dùng `config.settings.production` cho local: module này dừng ngay nếu
`DEBUG=True`, thiếu `SECRET_KEY`, `ALLOWED_HOSTS`, `RECAPTCHA_SECRET_KEY` hoặc
`JWT_SIGNING_KEY` hợp lệ.

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Chỉ khi phát triển module AI/CV analysis:
# pip install -r requirements-ai.txt
cp .env.example .env   # catalog tích hợp/tuning: .env.optional.example
python manage.py migrate

# Seed dữ liệu nền (chạy theo đúng thứ tự này — job_categories cần skills,
# province_merges cần locations)
python manage.py seed_skills
python manage.py seed_locations
python manage.py seed_province_merges
python manage.py seed_job_categories
python manage.py seed_sitecontent
python manage.py seed_cv_catalog     # nội dung CV mẫu theo vị trí + blueprint + bảng màu
python manage.py seed_cv_templates   # 10 mẫu CV đã publish — thiếu thì trang /mau-cv rỗng
python manage.py sync_admin_permissions
python manage.py seed_admin_access

# Seed dữ liệu demo cho trang chủ/danh sách việc làm (tuỳ chọn nhưng nên chạy khi dev UI)
python manage.py seed_demo_jobs
python manage.py seed_blog           # bài viết mẫu cho trang cẩm nang

python manage.py createsuperuser
# Tùy chọn, khuyến nghị: tạo sẵn MFA Email từ CLI tin cậy.
python manage.py bootstrap_admin_mfa <email-admin> \
  --mark-email-verified --actor-email <email-superuser>

# Tài khoản nhân viên admin: không dùng createsuperuser vì sẽ bypass RBAC.
# Command hỏi mật khẩu tương tác và tạo is_superuser=False, is_staff=False:
python manage.py create_admin_user <email-nhan-vien> \
  --actor-email <email-superuser>
# Tùy chọn, khuyến nghị: bật MFA Email cho tài khoản nhân viên.
python manage.py bootstrap_admin_mfa <email-nhan-vien> \
  --mark-email-verified --actor-email <email-superuser>
python manage.py runserver 8000
```

Email (xác thực, reset password, 2FA, OTP điện thoại) và tác vụ nặng (render PDF,
thumbnail CV) đều chạy bất đồng bộ. Chạy thêm hai process từ thư mục `backend`:

```bash
# Terminal worker thường: phải nghe đủ queue không-AI đang được route.
venv/bin/celery -A config worker -l info \
  -Q default,auth-email,auth-sms,cv-export,upload-scan,candidate-email

# Terminal AI worker riêng để provider latency không chiếm pool thường.
venv/bin/celery -A config worker -l info -Q ai-generation --concurrency=2

# Terminal beat: quét lại job pending khi broker/worker từng bị gián đoạn
venv/bin/celery -A config beat -l info
```

Ghi chú:
- `seed_locations` lấy dữ liệu tỉnh/xã từ `provinces.open-api.vn`, nên cần có internet khi chạy lần đầu.
- Các lệnh seed hiện tại đều có thể chạy lại. Riêng `seed_demo_jobs` sẽ xoá dữ liệu demo cũ có email `@demo.local` rồi tạo lại.
- Nếu chưa cấu hình Google reCAPTCHA, có thể để trống `RECAPTCHA_SECRET_KEY` ở backend và `VITE_RECAPTCHA_SITE_KEY` ở frontend trong môi trường local.
- Social login (`OAUTH_*`) có thể để trống — nút đăng nhập mạng xã hội chỉ báo "chưa cấu hình" khi bấm. Cách lấy key từng provider: [social-login.md](social-login.md).
- Media upload cần `Pillow` (đã có trong `requirements.txt`) để resize favicon/ảnh.

Khi đã cài xong từ trước, chỉ cần chạy:

```bash
cd backend
source venv/bin/activate
python manage.py runserver 8000
```

Đồng thời giữ Redis, Celery worker và Celery Beat hoạt động như phần trên.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev   # http://localhost:5173
```

`frontend/.env.local` tối thiểu dùng proxy cùng origin:

```env
VITE_API_BASE_URL=/api
VITE_RECAPTCHA_SITE_KEY=
```

Branding, host ba cổng, consent, rollout và tooling xem trong
`frontend/.env.optional.example`; file catalog này không được tự động nạp.

Backend remote feed mặc định tắt. Bật theo surface trong `backend/.env`:

```dotenv
ANNOUNCEMENT_REMOTE_ENABLED_SURFACES=admin_workspace
```

Danh sách và thứ tự production xem
[vận hành và kill switch](../06-deployment/van-hanh-va-kill-switch.md).

Khi đã cài `node_modules` từ trước, chỉ cần chạy:

```bash
cd frontend
npm run dev
```

## Kiểm tra runtime trước khi bàn giao

```bash
cd backend
python --version                                    # 3.11.x
python manage.py check
python manage.py makemigrations --check --dry-run   # không có migration treo
pytest --cov --cov-fail-under=84
```

Toàn repo: `./scripts/check_all.sh`. Khi container backend Docker đang chạy, script
tự chạy Django/pytest trong container để không nối nhầm PostgreSQL trên host.

## Quy tắc migration: Expand → Backfill → Contract

Thay đổi schema nguy hiểm (đổi NOT NULL, thêm FK bắt buộc, backfill dữ liệu) tách
thành ba migration:

1. **Expand**: thêm cột hoặc FK ở dạng `null=True`; không backfill, không đổi NOT NULL.
2. **Backfill**: chỉ đụng dữ liệu (`RunPython`, `atomic = False`), idempotent.
3. **Contract**: kiểm tra không còn NULL rồi mới `AlterField` NOT NULL và thêm index.

Cách tách này cho các deferred FK trigger event được commit giữa các bước, tránh
lỗi PostgreSQL `cannot ALTER TABLE ... because it has pending trigger events` trên
database có dữ liệu cũ. Mẫu tham chiếu:
`backend/apps/applications/migrations/0004_application_snapshot_expand.py` →
`0005_application_snapshot_backfill.py` → `0006_application_snapshot_contract.py`,
kèm test nâng cấp `backend/apps/applications/tests/test_migrations.py`.

Container `backend` của Docker Compose chạy `manage.py migrate` mỗi lần khởi động
với code của nhánh đang checkout. Sao lưu database local trước khi viết một
migration xóa dữ liệu:

```bash
docker compose exec -T db pg_dump -U postgres -d ai_career_coach -Fc > backup.dump
```

Không được:

- `migrate --fake` để bỏ qua một migration đang lỗi trên dữ liệu thật.
- Reset hoặc drop database chỉ để migration chạy.
- Xóa migration đã áp dụng ở môi trường dùng chung.
- Gộp backfill dữ liệu và `ALTER` constraint nguy hiểm trong cùng một bước.
- Hard-delete `CvVersion` đang được `Application` tham chiếu.
