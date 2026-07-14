# Frontend response contracts

Tài liệu này ghi lại kết quả đối chiếu các API với consumer thực tế trong
`frontend/src`. Mục tiêu là response theo use case, không phản chiếu nguyên model
hoặc cấu trúc database.

## Nguyên tắc

- DTO đọc danh sách, đọc chi tiết và ghi form là các serializer riêng.
- Field không được giao diện đọc không thuộc public contract.
- Quan hệ chỉ trả view-model nhỏ; dữ liệu ghi nested chỉ xuất hiện trong API form
  được bảo vệ tương ứng.
- `password`, quyền nội bộ và định danh database của user không xuất hiện trong
  resource response. `access`/`refresh` chỉ được trả ở endpoint xác thực có mục
  đích phát token (`register`, `login`, `oauth/complete`, `refresh`).
- Test contract so sánh tập key chính xác để một field model mới không tự động bị
  lộ ra API.

## Contract đã đối chiếu

| Màn hình / use case | Endpoint | DTO đọc | Field chính frontend sử dụng |
|---|---|---|---|
| Header, guard, tài khoản | `GET /api/auth/me/` | `SessionUserSerializer` | `public_id`, `email`, `role`, `full_name`, `phone`, `avatar_url`, `email_verified`, `two_factor_enabled`, `job_preferences_configured` |
| Sửa thông tin tài khoản | `PATCH /api/auth/me/` | `ProfileUpdateSerializer` → session DTO | request `full_name`, `phone`; response thống nhất như `/me` |
| Onboarding / cài đặt gợi ý | `GET/PATCH /api/candidate/profile/` | `CandidateProfileReadSerializer` / `CandidateProfileUpdateSerializer` | `gender` |
| Onboarding / cài đặt gợi ý | `GET/PUT /api/candidate/job-preferences/` | `CandidateJobPreferenceSerializer` | vị trí chuyên môn, vị trí khác, lương, kinh nghiệm, tỉnh, relocate và hai consent |
| Picker địa điểm | `GET /api/locations/` | `LocationLookupSerializer` | `id`, `name`, `level`, `parent`, `merged_from` |
| Picker vị trí chuyên môn | `GET /api/jobs/categories/` | `JobCategoryListSerializer` | `id`, `name`, `logo_url`, `parent`, `category_type` |
| Job card / kết quả tìm kiếm / việc đã lưu | `GET /api/jobs/` | `PublicJobListSerializer` | định danh public, tiêu đề/công ty, địa điểm, skill, loại việc, kinh nghiệm/cấp bậc/học vấn/tuổi, lương, badge/tier, thời gian đăng |
| Hover preview trang chủ | `GET /api/jobs/?view=preview` | `PublicJobPreviewSerializer` | list DTO + mô tả/yêu cầu/quyền lợi, lịch, địa chỉ, số lượng và hạn nộp |
| Chi tiết / quick view việc làm | `GET /api/jobs/{slug}/` | `JobDetailSerializer` | nội dung chi tiết, thông tin công ty tối thiểu, salary/deadline/view, location/schedule/language và các nhóm view-model |
| Bảng quản lý tin NTD | `GET /api/jobs/mine/` | `EmployerJobListSerializer` | `public_id`, `title`, `company_name`, `locations_detail`, `employment_type`, `deadline`, `status`, `application_count`, timestamps cần hiển thị |
| Form tin NTD | `POST/PATCH /api/jobs/mine/...` | `EmployerJobWriteSerializer`; response `EmployerJobDetailSerializer` | dữ liệu form và nested relation, gồm liên hệ nhận hồ sơ; endpoint có `IsEmployer` |
| Card blog / blog home | `GET /api/blog/`, `/api/blog/home/` | `PostListSerializer` | `public_id`, `title`, `slug`, `excerpt`, `thumbnail_url`, category link, `published_at` |
| Chi tiết blog | `GET /api/blog/{slug}/` | `PostDetailSerializer` | list identity + `content`, tags, related job category, `seo_title` |

Các catalog nhỏ (industry, benefit, language, skill), site settings/banner/link và
consent vốn đã dùng explicit field. Admin site settings cố ý trả metadata form
(`value_type`, `options`, `order`, `is_public`, `env_configured`) nhưng chỉ qua
permission admin.

## Query strategy

- Job list defer các cột rich text; chỉ prefetch location/skill, và chỉ thêm
  benefit/schedule khi `view=preview`.
- Job detail prefetch đúng các relation được DTO chi tiết và view-model sử dụng.
- Employer list dùng query riêng, không tải nội dung rich text hoặc toàn bộ nested
  form; detail/write dùng query đầy đủ riêng.
- Blog list dùng `select_related(category)` + `only()` các cột card; detail mới
  prefetch tags và related category.
- Location/category lookup dùng `only()` đúng các cột picker.

Khi thêm field frontend mới, cập nhật đồng thời serializer, selector/query,
contract test và bảng này. Không dùng `fields = '__all__'` trong API serializer.
