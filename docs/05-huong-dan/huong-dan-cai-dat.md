# 05 - Hướng dẫn cài đặt & chạy local

## Yêu cầu
- Python 3.13
- Node.js 20.19+ hoặc 22.12+ (Vite 8 yêu cầu các bản này)
- PostgreSQL 16

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

```bash
cd backend
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # chỉnh DB_USER/DB_PASSWORD nếu khác PostgreSQL local
python manage.py migrate

# Seed dữ liệu nền
python manage.py seed_skills
python manage.py seed_locations
python manage.py seed_province_merges
python manage.py seed_job_categories
python manage.py seed_sitecontent

# Seed dữ liệu demo cho trang chủ/danh sách việc làm (tuỳ chọn nhưng nên chạy khi dev UI)
python manage.py seed_demo_jobs

python manage.py createsuperuser
python manage.py runserver 8000
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
