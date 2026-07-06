# 03 - Database

Phạm vi:
- ERD và mô tả chi tiết từng bảng
- Quy ước thiết kế (public_id, slug, soft-delete, JSONB, status)
- Thứ tự triển khai theo giai đoạn (mục 7 tài liệu database v1.4)

Nguồn: database_hoan_chinh_ai_recruitment_cv_builder v1.4.

## Bảng đã triển khai

| Bảng | App Django | Ghi chú |
|---|---|---|
| `users` | `backend/apps/accounts` | Custom User kế thừa AbstractUser, role candidate/employer/admin |
| `skills` | `backend/apps/skills` | Nguồn kỹ năng chuẩn duy nhất, seed 34 kỹ năng qua `seed_skills` |
| `candidate_profiles` | `backend/apps/candidates` | Tự tạo rỗng khi candidate đăng ký (signal) |
| `employer_profiles` | `backend/apps/employers` | Tạo qua API riêng (bắt buộc `company_name`) |
| `job_categories` | `backend/apps/jobs` | Danh mục ngành nghề, self-referential parent |
| `locations` | `backend/apps/locations` | 2 cấp tỉnh/xã, seed thật qua `seed_locations` (provinces.open-api.vn) |
| `cv_templates` | `backend/apps/cv_templates` | Quản lý qua Django admin, API chỉ đọc (list/detail) |
| `user_cvs` | `backend/apps/cvs` | CV builder + upload (PDF/DOCX), soft-delete |
| `cv_skills` | `backend/apps/cvs` | Nested trong API `user_cvs` |
| `jobs` | `backend/apps/jobs` | `location` bắt buộc (PROTECT), `employer_profile` gắn theo tài khoản employer |
| `job_skills` | `backend/apps/jobs` | Nested trong API `jobs`, UNIQUE(job, skill) |
| `applications` | `backend/apps/applications` | UNIQUE(candidate, job) — chặn ứng tuyển trùng ở cả serializer lẫn DB constraint |

**Ghi chú triển khai khác PRD/DB doc:**
- PRD mục 13.2 không liệt kê app riêng cho `job_categories`/`locations`/`skills`/`employer_profiles` — đã tách thành app Django riêng (`jobs` chứa job_categories, `locations`, `skills`, `employers`) để tránh phụ thuộc vòng và rõ trách nhiệm từng app.
- Quy trình duyệt job (draft → active) chưa có API — job tạo ra mặc định `status=draft`, hiện phải kích hoạt thủ công qua admin/shell.
- Tất cả app Django được gom vào `backend/apps/` (thay vì nằm trực tiếp dưới `backend/`) để thư mục gốc backend gọn hơn; `backend/common/` (tiện ích dùng chung như `public_id`) và `backend/config/` (settings/urls) vẫn ở ngoài `apps/` vì không phải Django app.

Trạng thái đầy đủ theo từng giai đoạn: xem [../TIEN-DO-DU-AN.md](../TIEN-DO-DU-AN.md).
