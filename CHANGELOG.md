# Changelog

Tất cả thay đổi đáng chú ý của dự án sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html) khi bắt đầu phát hành phiên bản.

## [Unreleased]

### Added

- Khởi tạo file changelog để theo dõi thay đổi của dự án.
- Chốt công nghệ theo PRD: ReactJS + Vite (frontend), Django + Django REST Framework (backend), PostgreSQL, JWT (simplejwt).
- Scaffold Django project `backend/config` với các app: `accounts`, `skills`, `candidates`, `employers`, `cv_templates`, `cvs`, `jobs`, `applications`, `interviews`, `ai_core`, `dashboard`.
- Triển khai 4 bảng đầu của Giai đoạn 1 (theo tài liệu database v1.4, mục 7): `users` (custom User kế thừa AbstractUser, role candidate/employer/admin, public_id, status, soft-delete), `skills` (nguồn kỹ năng chuẩn duy nhất, seed 34 kỹ năng qua `seed_skills`), `candidate_profiles`, `employer_profiles`.
- API JWT auth (`/api/auth/register`, `/login`, `/refresh`, `/me`) và profile theo vai trò (`/api/candidate/profile`, `/api/employer/profile`), có phân quyền theo role.
- Local dev: PostgreSQL qua Homebrew (không dùng Docker ở giai đoạn đầu, theo khuyến nghị PRD mục 8.4).

### Removed

- Gỡ `backend/venv` cũ (thiết lập FastAPI/Alembic bị vô tình commit vào git) do đổi hướng backend sang Django.
