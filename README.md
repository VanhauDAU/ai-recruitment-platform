# ProCV Platform

Website hỗ trợ tạo CV, phân tích CV và luyện phỏng vấn thông minh ứng dụng AI. Đồ án tốt nghiệp CNTT.

> Tiến độ dự án theo từng giai đoạn: xem [docs/TIEN-DO-DU-AN.md](docs/TIEN-DO-DU-AN.md).

## Tính năng đã hoàn thành (Giai đoạn 1 — MVP lõi)

- Đăng ký/đăng nhập JWT, phân quyền theo vai trò (ứng viên / nhà tuyển dụng / admin)
- Xác thực email qua link, social login OAuth (Google/Facebook/LinkedIn cho ứng viên, Google cho nhà tuyển dụng)
- Bảo vệ đăng nhập/đăng ký: rate limit + Google reCAPTCHA v3
- Hồ sơ ứng viên, hồ sơ công ty
- Danh mục kỹ năng chuẩn, danh mục ngành nghề
- Danh mục địa điểm hành chính Việt Nam (34 tỉnh/thành + 3.321 xã/phường, dữ liệu thật)
- Mẫu CV, tạo/sửa/xóa CV (CV Builder), upload CV có sẵn (PDF/DOCX)
- Đăng tin tuyển dụng kèm kỹ năng yêu cầu, tìm kiếm/lọc tin tuyển dụng
- Ứng tuyển bằng CV đã chọn, nhà tuyển dụng xem và cập nhật trạng thái hồ sơ ứng tuyển

Chi tiết endpoint: [docs/04-api/tai-lieu-api.md](docs/04-api/tai-lieu-api.md).

## Công nghệ chính

| Thành phần | Công nghệ                                             |
| ---------- | ----------------------------------------------------- |
| Frontend   | ReactJS + Vite, Tailwind CSS, Ant Design              |
| Backend    | Django + Django REST Framework, JWT (simplejwt)       |
| Database   | PostgreSQL                                            |
| Cache/OAuth| Redis (token xác thực email, OAuth state/one-time code) |
| Ảnh        | Pillow (resize favicon/ảnh upload), storage nội bộ    |
| AI         | PyMuPDF, scikit-learn (đang triển khai ở Giai đoạn 2) |

## Cấu trúc dự án

```
backend/
  config/       Django settings, urls (root)
  common/       Tiện ích hạ tầng dùng chung, không phải Django app
  apps/         Toàn bộ Django app: accounts, skills, candidates, employers, locations,
                cv_templates, cvs, jobs, applications, interviews, ai_core, dashboard
frontend/
  src/
    pages/      Trang theo 3 cổng: main/ (ứng viên + khách), employer/, admin/
    components/ Component dùng chung
    layouts/    AuthLayout, DashboardLayout, MainLayout, EmployerMarketingLayout
    api/        api.js (axios + JWT interceptor), authService.js, ...
    config/     portals.js — cấu hình 3 cổng (base path, token key, điều hướng theo role)
    contexts/   React providers/context dùng toàn ứng dụng
    hooks/      Hooks tái sử dụng, chỉ chứa logic hook
    routes/     AppRoutes.jsx (mainRoutes/employerRoutes/adminRoutes), ProtectedRoute.jsx
docs/       Tài liệu dự án — xem docs/README.md
```

## Bắt đầu nhanh

```bash
# Backend
cd backend
source venv/bin/activate
brew services start redis
python manage.py runserver 8000        # http://localhost:8000

# Worker gửi email auth (terminal riêng, chạy từ backend/)
celery -A config worker -l info -Q auth-email

# Quét lại email job bị gián đoạn (terminal riêng, chạy từ backend/)
celery -A config beat -l info

# Frontend (terminal khác)
cd frontend
npm run dev                            # http://localhost:5173
```

Hướng dẫn cài đặt đầy đủ từ đầu (venv, PostgreSQL, seed dữ liệu): [docs/05-huong-dan/huong-dan-cai-dat.md](docs/05-huong-dan/huong-dan-cai-dat.md).

Tạo tài khoản quản trị riêng bằng `python manage.py createsuperuser`; không lưu credential mặc định trong source code.

## Kiểm tra chất lượng

```bash
# Backend
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test

# Frontend
cd frontend
npm run lint
npm test
npm run build
npm run test:e2e
```

## Tài liệu

Xem [docs/README.md](docs/README.md) cho toàn bộ tài liệu: phân tích, tổng quan, database, API, deployment, thuật toán AI, frontend.

## Changelog

Toàn bộ thay đổi được ghi lại theo ngày tại [CHANGELOG.md](CHANGELOG.md).
