# ProCV Platform

Website hỗ trợ tạo CV, phân tích CV và luyện phỏng vấn thông minh ứng dụng AI. Đồ án tốt nghiệp CNTT.

> Tiến độ dự án theo từng giai đoạn: xem [docs/TIEN-DO-DU-AN.md](docs/TIEN-DO-DU-AN.md).

## Tính năng đã hoàn thành (Giai đoạn 1 — MVP lõi)

- Đăng ký/đăng nhập JWT, phân quyền theo vai trò (ứng viên / nhà tuyển dụng / admin)
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
| AI         | PyMuPDF, scikit-learn (đang triển khai ở Giai đoạn 2) |

## Cấu trúc dự án

```
backend/
  config/       Django settings, urls (root)
  common/       Tiện ích dùng chung, không phải app (vd. common/public_id.py)
  apps/         Toàn bộ Django app: accounts, skills, candidates, employers, locations,
                cv_templates, cvs, jobs, applications, interviews, ai_core, dashboard
frontend/
  src/
    pages/      Trang theo route, chia theo role: auth/, candidate/, employer/, admin/
    components/ Component dùng chung
    layouts/    AuthLayout, DashboardLayout
    api/        api.js (axios + JWT interceptor), authService.js
    hooks/      useAuth.jsx (AuthContext)
    routes/     AppRoutes.jsx, ProtectedRoute.jsx
docs/       Tài liệu dự án — xem docs/README.md
```

## Bắt đầu nhanh

```bash
# Backend
cd backend
source venv/bin/activate
python manage.py runserver 8000        # http://localhost:8000

# Frontend (terminal khác)
cd frontend
npm run dev                            # http://localhost:5173
```

Hướng dẫn cài đặt đầy đủ từ đầu (venv, PostgreSQL, seed dữ liệu): [docs/05-huong-dan/huong-dan-cai-dat.md](docs/05-huong-dan/huong-dan-cai-dat.md).

**Tài khoản admin có sẵn:** `admin@aicareercoach.local` / `Admin@12345` (Django admin tại `/admin/`).

## Tài liệu

Xem [docs/README.md](docs/README.md) cho toàn bộ tài liệu: phân tích, tổng quan, database, API, deployment, thuật toán AI, frontend.

## Changelog

Toàn bộ thay đổi được ghi lại theo ngày tại [CHANGELOG.md](CHANGELOG.md).
