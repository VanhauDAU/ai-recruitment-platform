# AI Career Coach Platform

Website hỗ trợ tạo CV, phân tích CV và luyện phỏng vấn thông minh ứng dụng AI. Đồ án tốt nghiệp CNTT.

## Công nghệ chính

| Thành phần | Công nghệ |
|---|---|
| Frontend | ReactJS + Vite, Tailwind CSS, Ant Design |
| Backend | Django + Django REST Framework, JWT (simplejwt) |
| Database | PostgreSQL |
| AI | PyMuPDF, scikit-learn |

## Cấu trúc dự án

```
backend/    Django project (config/ + apps: accounts, skills, candidates, employers,
            cv_templates, cvs, jobs, applications, interviews, ai_core, dashboard)
frontend/   React + Vite app
docs/       Tài liệu dự án — xem docs/README.md
```

## Bắt đầu nhanh

Xem [docs/05-huong-dan](docs/05-huong-dan/README.md) để cài đặt và chạy dự án local.

## Tài liệu

Xem [docs/README.md](docs/README.md) cho toàn bộ tài liệu: phân tích, tổng quan, database, API, deployment, thuật toán AI, frontend.
