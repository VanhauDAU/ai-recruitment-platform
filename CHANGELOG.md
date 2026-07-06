# Changelog

Tất cả thay đổi đáng chú ý của dự án sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html) khi bắt đầu phát hành phiên bản. Trong giai đoạn chưa cắt phiên bản, thay đổi được nhóm theo ngày dưới `[Unreleased]`.

## [Unreleased]

### 2026-07-06

#### Added — Khởi tạo dự án + nền tảng (Giai đoạn 0 + 4 bảng đầu Giai đoạn 1)

- Khởi tạo file changelog để theo dõi thay đổi của dự án.
- Chốt công nghệ theo PRD: ReactJS + Vite (frontend), Django + Django REST Framework (backend), PostgreSQL, JWT (simplejwt).
- Scaffold Django project `backend/config` với các app: `accounts`, `skills`, `candidates`, `employers`, `cv_templates`, `cvs`, `jobs`, `applications`, `interviews`, `ai_core`, `dashboard`.
- Scaffold frontend React + Vite + Tailwind CSS + Ant Design, cấu trúc `src/{pages,components,layouts,services,hooks,routes}`.
- Triển khai 4 bảng đầu của Giai đoạn 1 (theo tài liệu database v1.4, mục 7): `users` (custom User kế thừa AbstractUser, role candidate/employer/admin, public_id, status, soft-delete), `skills` (nguồn kỹ năng chuẩn duy nhất, seed 34 kỹ năng qua `seed_skills`), `candidate_profiles`, `employer_profiles`.
- API JWT auth (`/api/auth/register`, `/login`, `/refresh`, `/me`) và profile theo vai trò (`/api/candidate/profile`, `/api/employer/profile`), có phân quyền theo role.
- Frontend: trang đăng ký/đăng nhập, dashboard shell theo vai trò (candidate/employer/admin), test end-to-end thành công.
- Cấu trúc `docs/` theo 8 chủ đề (01-phan-tich ... 08-frontend), mỗi thư mục một file tài liệu đặt tên cụ thể.
- Thêm `docs/TIEN-DO-DU-AN.md` theo dõi tiến độ toàn dự án theo từng giai đoạn.
- Local dev: PostgreSQL qua Homebrew (không dùng Docker ở giai đoạn đầu, theo khuyến nghị PRD mục 8.4).

#### Added — Hoàn thành Giai đoạn 1 (MVP lõi): 8 bảng còn lại

- `job_categories` — danh mục ngành nghề, self-referential parent.
- `locations` — địa điểm hành chính 2 cấp (tỉnh/xã), seed dữ liệu thật 34 tỉnh + 3.321 xã/phường từ `provinces.open-api.vn` qua management command `seed_locations`.
- `cv_templates` — mẫu CV, API public list/detail.
- `user_cvs` — CV Builder + upload CV có sẵn (PDF/DOCX), soft-delete.
- `cv_skills` — kỹ năng theo từng CV, lồng trong API `user_cvs`.
- `jobs` — tin tuyển dụng, API public list/detail (tăng `view_count`, lọc theo category/location/work_type/employment_type/experience_level/search) và employer CRUD.
- `job_skills` — kỹ năng yêu cầu của job, lồng trong API `jobs`.
- `applications` — hồ sơ ứng tuyển, UNIQUE(candidate, job) chặn ứng tuyển trùng (kiểm tra ở cả serializer và DB constraint), employer xem/cập nhật trạng thái (tự set mốc thời gian tương ứng).
- API tra cứu địa điểm `/api/locations/` (cascading tỉnh → xã) phục vụ chọn địa điểm khi đăng job.
- Test end-to-end toàn bộ luồng: đăng job → tạo CV → ứng tuyển → employer duyệt hồ sơ.

#### Fixed

- `ApplicationSerializer` trả lỗi 500 khi ứng tuyển trùng job (IntegrityError từ DB constraint) — thêm `validate_job()` để trả lỗi 400 rõ ràng trước khi chạm DB.
- `UserCvSerializer` yêu cầu `cv_type` trong payload dù giá trị được set ở server — chuyển `cv_type` sang `read_only_fields`.

#### Changed — Tái cấu trúc thư mục cho gọn hơn

- Backend: gom toàn bộ 12 Django app (`accounts`, `skills`, `candidates`, `employers`, `locations`, `cv_templates`, `cvs`, `jobs`, `applications`, `interviews`, `ai_core`, `dashboard`) vào `backend/apps/`, giữ `backend/config/` (settings/urls) và `backend/common/` (tiện ích dùng chung) ở ngoài vì không phải app. Cập nhật `AppConfig.name`, `INSTALLED_APPS`, toàn bộ import chéo giữa các app và `include()` trong `config/urls.py` sang `apps.<tên_app>`. Không phát sinh migration mới (app_label giữ nguyên), đã test lại toàn bộ API sau khi đổi.
- Frontend: đổi `src/services/` thành `src/api/` (chứa `api.js` và `authService.js`), cập nhật import ở `hooks/useAuth.jsx` và `pages/auth/Register.jsx`. Build và test đăng nhập lại thành công.

### Removed

- Gỡ `backend/venv` cũ (thiết lập FastAPI/Alembic bị vô tình commit vào git) do đổi hướng backend sang Django.
