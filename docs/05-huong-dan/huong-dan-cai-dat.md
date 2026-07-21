# 05 - Hướng dẫn cài đặt & chạy local

## Yêu cầu
- Python 3.11 (khóa qua `.python-version`; dùng đúng major/minor cho local, CI và deploy)
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
cp .env.example .env   # chỉnh DB_USER/DB_PASSWORD nếu khác PostgreSQL local
python manage.py migrate

# Seed dữ liệu nền (chạy theo đúng thứ tự này — job_categories cần skills,
# province_merges cần locations)
python manage.py seed_skills
python manage.py seed_locations
python manage.py seed_province_merges
python manage.py seed_job_categories
python manage.py seed_sitecontent
python manage.py seed_cv_catalog     # mẫu CV + nội dung mẫu — thiếu thì trang /mau-cv rỗng
python manage.py seed_services       # nhóm/gói dịch vụ cho trang báo giá NTD

# Seed dữ liệu demo cho trang chủ/danh sách việc làm (tuỳ chọn nhưng nên chạy khi dev UI)
python manage.py seed_demo_jobs
python manage.py seed_blog           # bài viết mẫu cho trang cẩm nang

python manage.py createsuperuser
python manage.py runserver 8000
```

Email (xác thực, reset password, 2FA, OTP điện thoại) và tác vụ nặng (render PDF,
thumbnail CV) đều chạy bất đồng bộ. Chạy thêm hai process từ thư mục `backend`:

```bash
# Terminal worker: BẮT BUỘC khai đủ 3 queue. Settings route task sang
# auth-email và cv-export; phần còn lại vào default. Thiếu queue nào thì task
# của queue đó im lặng không chạy (không lỗi, không log).
venv/bin/celery -A config worker -l info -Q default,auth-email,cv-export

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
cp .env.example .env
npm run dev   # http://localhost:5173
```

`frontend/.env` mặc định trỏ API về backend local:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_RECAPTCHA_SITE_KEY=
```

Khi đã cài `node_modules` từ trước, chỉ cần chạy:

```bash
cd frontend
npm run dev
```
