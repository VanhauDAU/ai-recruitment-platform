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
- Đăng tin tuyển dụng có cấu trúc (danh mục theo vai trò, địa điểm phường/xã, lịch làm việc theo ca, quyền lợi, yêu cầu ngoại ngữ, kỹ năng), tìm kiếm/lọc tin (danh mục 3 cấp, địa điểm, mức lương, cấp bậc, hình thức làm việc...), tìm kiếm tiếng Việt không dấu
- Trang chi tiết việc làm: tag tóm tắt yêu cầu/quyền lợi/chuyên môn, địa điểm nhóm theo tỉnh/thành, yêu cầu ngoại ngữ kèm chứng chỉ, thanh anchor điều hướng nhanh, responsive mobile
- Ứng tuyển bằng CV đã chọn, nhà tuyển dụng xem và cập nhật trạng thái hồ sơ ứng tuyển
- Việc làm đã lưu, phân hạng tin (thường/nổi bật/TOP) + nhãn dịch vụ (HOT/GẤP/Flash), trang thương hiệu riêng cho công ty (`/brand/<company>/tuyen-dung/<job>`)
- Trang quản trị `/admin/settings`: cấu hình 15 nhóm site settings (banner, footer, liên hệ, SEO...) không cần sửa code
- Form góp ý người dùng + cụm nút hỗ trợ nổi (Việc làm đã lưu / Góp ý / Hỗ trợ)

Chi tiết endpoint: [docs/04-api/tai-lieu-api.md](docs/04-api/tai-lieu-api.md). Nhật ký đầy đủ theo từng ngày: [CHANGELOG.md](CHANGELOG.md).

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
    app/        Composition root: providers, layouts, guards, router/lazy registry
    pages/      Route composition theo 3 cổng: main/, employer/, admin/
    widgets/    Khối UI lớn ghép nhiều feature/entity
    features/   Workflow/hành động người dùng (auth, tạo/sửa/xuất CV, ...)
    entities/   Domain API/model/UI tái sử dụng (cv, cv-template, job, session, ...)
    shared/     HTTP client, config, hooks và UI nguyên tử không biết domain
    test/       Vitest setup
docs/       Tài liệu dự án — xem docs/README.md
```

## Bắt đầu nhanh

### Cách 1 — Docker Compose (khuyến nghị, chỉ cần Docker)

```bash
cp backend/.env.example backend/.env    # điền tối thiểu SECRET_KEY
docker compose up
# Frontend: http://localhost:5173 · API: http://localhost:8000/api · Swagger: /api/docs/
```

Đầy đủ (gồm production trên VPS): [docs/06-deployment/docker-compose.md](docs/06-deployment/docker-compose.md).

### Cách 2 — Chạy trực tiếp (venv + PostgreSQL + Redis local)

```bash
# Backend
cd backend
source venv/bin/activate
brew services start redis
python manage.py runserver 8000        # http://localhost:8000

# Worker Celery (terminal riêng, chạy từ backend/).
# BẮT BUỘC khai đủ 3 queue: settings route task sang auth-email (email xác thực,
# 2FA, OTP điện thoại) và cv-export (render PDF, thumbnail); phần còn lại vào
# default. Thiếu queue nào thì task của queue đó im lặng không chạy.
celery -A config worker -l info -Q default,auth-email,cv-export

# Beat: quét lại job bị gián đoạn + dọn file import hết hạn (terminal riêng)
celery -A config beat -l info

# Frontend (terminal khác)
cd frontend
npm run dev                            # http://localhost:5173
```

Hướng dẫn cài đặt đầy đủ từ đầu (venv, PostgreSQL, seed dữ liệu): [docs/05-huong-dan/huong-dan-cai-dat.md](docs/05-huong-dan/huong-dan-cai-dat.md).

Tạo tài khoản quản trị riêng bằng `python manage.py createsuperuser`; không lưu credential mặc định trong source code.

## Kiểm tra chất lượng

Một lệnh kiểm tra toàn repo (khớp với CI — backend check/migration/test + frontend lint/test/build):

```bash
./scripts/check_all.sh
```

Hoặc chạy thủ công từng phần:

```bash
# Backend
cd backend
ruff check . && ruff format --check .   # lint + format
lint-imports                            # kiến trúc layer (ADR-0010)
python manage.py check
python manage.py makemigrations --check --dry-run
pytest --cov --cov-fail-under=84        # test + coverage gate

# Frontend
cd frontend
npm run lint
npm run check:architecture
npm run test:coverage
npm run build
npm run test:e2e:smoke
```

CI (GitHub Actions) tự chạy `backend-ci` và `frontend-ci` trên mọi pull request đụng
tới `backend/` hoặc `frontend/`. Quyết định kiến trúc của đợt tái cấu trúc: [docs/adr/](docs/adr/).

## Tài liệu

- [Tài liệu dự án](docs/README.md)
- [Kiến trúc CV Builder](docs/03-database/cv-builder-architecture-foundation.md)
- [Kế hoạch CV Builder](docs/03-database/ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md)

Xem [docs/README.md](docs/README.md) cho toàn bộ tài liệu: phân tích, tổng quan, database, API, deployment, thuật toán AI, frontend.

## Changelog

Toàn bộ thay đổi được ghi lại theo ngày tại [CHANGELOG.md](CHANGELOG.md).
