# 03 - Database

Phạm vi:
- ERD và mô tả chi tiết từng bảng
- Quy ước thiết kế (public_id, slug, soft-delete, JSONB, status)
- Thứ tự triển khai theo giai đoạn (mục 7 tài liệu database v1.4)

Nguồn: database_hoan_chinh_ai_recruitment_cv_builder v1.4.

## Bảng đã triển khai

| Bảng | App Django | Ghi chú |
|---|---|---|
| `users` | `backend/apps/accounts` | Custom User kế thừa AbstractUser, role candidate/employer/admin; `provider` (local/google/facebook/linkedin/github), `email_verified` |
| `social_accounts` | `backend/apps/accounts` | Liên kết OAuth (Google/Facebook/LinkedIn) với user; UNIQUE(provider, provider_user_id), lưu `raw_profile` |
| `skills` | `backend/apps/skills` | Nguồn kỹ năng chuẩn duy nhất, seed 34 kỹ năng qua `seed_skills` |
| `candidate_profiles` | `backend/apps/candidates` | Tự tạo rỗng khi candidate đăng ký (signal) |
| `employer_profiles` | `backend/apps/employers` | Tạo qua API riêng (bắt buộc `company_name`) |
| `job_categories` | `backend/apps/jobs` | Danh mục ngành nghề, self-referential parent, taxonomy 3 cấp (nhóm nghề → nghề → vị trí chuyên môn: 8/24/61), seed qua `seed_job_categories` |
| `locations` | `backend/apps/locations` | 2 cấp tỉnh/xã, seed thật qua `seed_locations` (provinces.open-api.vn) |
| `cv_templates` | `backend/apps/cv_templates` | Quản lý qua Django admin, API chỉ đọc (list/detail) |
| `user_cvs` | `backend/apps/cvs` | CV builder + upload (PDF/DOCX), soft-delete |
| `cv_skills` | `backend/apps/cvs` | Nested trong API `user_cvs` |
| `jobs` | `backend/apps/jobs` | `locations` là ManyToManyField (không phải FK đơn) — một job có thể tuyển nhiều tỉnh/phường; `employer_profile` gắn theo tài khoản employer; có thêm `number_of_vacancies`, `education_level` |
| `job_skills` | `backend/apps/jobs` | Nested trong API `jobs`, UNIQUE(job, skill) |
| `applications` | `backend/apps/applications` | UNIQUE(candidate, job) — chặn ứng tuyển trùng ở cả serializer lẫn DB constraint |

**Ghi chú triển khai khác PRD/DB doc:**
- PRD mục 13.2 không liệt kê app riêng cho `job_categories`/`locations`/`skills`/`employer_profiles` — đã tách thành app Django riêng (`jobs` chứa job_categories, `locations`, `skills`, `employers`) để tránh phụ thuộc vòng và rõ trách nhiệm từng app.
- Quy trình duyệt job (draft → active) chưa có API — job tạo ra mặc định `status=draft`, hiện phải kích hoạt thủ công qua admin/shell.
- Các trường ảnh (`avatar_url`, `company_logo_url`, `cover_image_url`, `logo_url`, `Banner.image_url`, `SiteSetting` kiểu image, `UserCv.*_url`) lưu **storage key** chứ không phải URL tuyệt đối — URL công khai được resolve khi trả API theo domain/CDN hiện tại. Xem quy ước media ở [../04-api/tai-lieu-api.md](../04-api/tai-lieu-api.md).
- `jobs.location` (bản đầu, PROTECT FK) đã đổi thành `jobs.locations` (M2M) để hỗ trợ tuyển nhiều địa điểm; migration `0003_...` tự chuyển dữ liệu `location` cũ sang bảng M2M trước khi xoá cột — không mất dữ liệu job đã tạo trước đó.
- Tất cả app Django được gom vào `backend/apps/` (thay vì nằm trực tiếp dưới `backend/`) để thư mục gốc backend gọn hơn; `backend/common/` (tiện ích dùng chung như `public_id`) và `backend/config/` (settings/urls) vẫn ở ngoài `apps/` vì không phải Django app.

Trạng thái đầy đủ theo từng giai đoạn: xem [../TIEN-DO-DU-AN.md](../TIEN-DO-DU-AN.md).
