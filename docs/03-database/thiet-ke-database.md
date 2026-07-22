# 03 - Database

Phạm vi:
- ERD và mô tả chi tiết từng bảng
- Quy ước thiết kế (public_id, slug, soft-delete, JSONB, status)
- Thứ tự triển khai theo giai đoạn (mục 7 tài liệu database v1.4)

Nguồn: database_hoan_chinh_ai_recruitment_cv_builder v1.4.

Thiết kế nâng cấp chuyên sâu cho quy trình đăng tin và trang chi tiết việc làm:
[Kế hoạch nâng cấp database tin tuyển dụng](./ke-hoach-nang-cap-job-posting.md).

Quyết định hiện hành về chiến dịch, quota, phân quyền tin và pipeline ứng viên:
[Chiến dịch tuyển dụng, vòng đời tin và pipeline ứng viên](./ke-hoach-chien-dich-va-vong-doi-tin.md).

Kế hoạch tách công ty khỏi nhà tuyển dụng (nhiều HR/công ty, onboarding xác thực kiểu TopCV):
[Kế hoạch thiết kế lại công ty & nhà tuyển dụng](./ke-hoach-thiet-ke-lai-cong-ty-nha-tuyen-dung.md).

Thiết kế database cho Cẩm nang nghề nghiệp (blog `/blog`: bài viết, danh mục, thẻ, bài ghim sidebar, banner):
[Kế hoạch database cẩm nang nghề nghiệp - blog](./ke-hoach-database-cam-nang-nghe-nghiep-blog.md).

Thiết kế onboarding và preference tìm việc cho ứng viên:
[Kế hoạch onboarding ứng viên](./ke-hoach-onboarding-ung-vien.md).

## Bảng đã triển khai

| Bảng | App Django | Ghi chú |
|---|---|---|
| `users` | `backend/apps/accounts` | Custom User kế thừa AbstractUser, role candidate/employer/admin; `provider` (local/google/facebook/linkedin/github), `email_verified` |
| `social_accounts` | `backend/apps/accounts` | Liên kết OAuth (Google/Facebook/LinkedIn) với user; UNIQUE(provider, provider_user_id), lưu `raw_profile` |
| `skills`, `skill_groups` | `backend/apps/skills` | Nguồn kỹ năng chuẩn duy nhất; nhóm kỹ năng là taxonomy mở thay cho choices IT hard-code |
| `candidate_profiles` | `backend/apps/candidates` | Tự tạo rỗng khi candidate đăng ký (signal) |
| `companies` | `backend/apps/employers` | Pháp nhân tuyển dụng (doanh nghiệp/hộ kinh doanh), `tax_code` unique, `verification_status`; thay thế `employer_profiles` cũ — dữ liệu đổ qua migration `0007` (gộp theo tax_code), bảng cũ đã xóa ở migration `0008` ([kế hoạch](./ke-hoach-thiet-ke-lai-cong-ty-nha-tuyen-dung.md)) |
| `company_industries` | `backend/apps/employers` | M2M công ty–lĩnh vực + `is_primary` (partial unique: đúng 1 lĩnh vực chính/công ty) |
| `company_images` | `backend/apps/employers` | Ảnh giới thiệu công ty, khuyến nghị 3:2 |
| `company_documents` | `backend/apps/employers` | Giấy tờ xác thực (ĐKDN, ủy quyền, định danh, DLCN) + luồng duyệt |
| `company_update_requests` | `backend/apps/employers` | Cập nhật công ty chờ duyệt; đổi MST/tên bắt buộc lý do + giấy tờ; tối đa 1 request pending/công ty |
| `recruiter_profiles` | `backend/apps/employers` | 1-1 user, FK company (PROTECT, gán rồi không đổi); membership owner/member + trạng thái duyệt; `verified_phone` partial unique |
| `phone_otps` | `backend/apps/employers` | OTP xác thực SĐT (hash, expires, attempts) — gửi qua email trước khi có SMS gateway |
| `job_categories`, `job_category_localizations` | `backend/apps/jobs` | Taxonomy 3 cấp có public identity; localization/alias 4 ngôn ngữ cấu hình trong admin, picker CV chỉ đọc vị trí chuyên môn và `name_vi` |
| `locations` | `backend/apps/locations` | 2 cấp tỉnh/xã, seed thật qua `seed_locations` (provinces.open-api.vn) |
| `cv_templates` | `backend/apps/cv_templates` | Identity/catalogue; version published hiện hành, localization và legacy dual-read fields |
| `cv_categories`, `cv_template_category_links` | `backend/apps/cv_templates` | Taxonomy many-to-many style/feature/position/audience; link giữ thứ tự theo template |
| `cv_colors`, `cv_template_color_links` | `backend/apps/cv_templates` | Palette màu dùng lại; link theo template giữ thumbnail/preview URL, thứ tự và đúng tối đa một màu mặc định |
| `cv_template_versions`, `cv_template_sections` | `backend/apps/cv_templates` | Renderer/layout/style contract bất biến sau publish và mapping section theo region |
| `cv_content_blueprints`, `cv_sample_contents` | `backend/apps/cv_templates` | Blueprint generic theo locale/experience; curated sample là optional override theo vị trí. Resolver tạo canonical preview dùng chung cho mọi template |
| `user_cvs` | `backend/apps/cvs` | CV builder + upload (PDF/DOCX), soft-delete |
| `cv_skills` | `backend/apps/cvs` | Nested trong API `user_cvs` |
| `jobs` | `backend/apps/jobs` | Tin tuyển dụng lõi đã tinh gọn; lương dùng `salary_type`, có tuổi, giới tính, học vấn, kinh nghiệm và số lượng tuyển |
| `recruitment_campaigns` | `backend/apps/employers` | Chiến dịch do một recruiter sở hữu; nhóm tùy chọn các tin cùng chủ sở hữu và mục tiêu/phễu tuyển dụng |
| `job_status_history` | `backend/apps/jobs` | Lịch sử xuất bản/đóng/mở lại/sao chép tin với actor |
| `job_category_assignments` | `backend/apps/jobs` | Một vị trí chuyên môn chính và nhiều kiến thức chuyên ngành |
| `job_locations` | `backend/apps/jobs` | Nhiều địa điểm kèm địa chỉ cụ thể; API ghi mới bắt buộc chọn phường/xã |
| `job_work_schedules` | `backend/apps/jobs` | Nhiều khung ngày/giờ có cấu trúc và ghi chú bổ sung |
| `job_skills` | `backend/apps/jobs` | Nested trong API `jobs`, UNIQUE(job, skill) |
| `benefits`, `job_benefits` | `backend/apps/jobs` | Danh mục quyền lợi chuẩn hóa và quan hệ theo tin |
| `languages`, `job_language_requirements` | `backend/apps/jobs` | Yêu cầu ngoại ngữ, trình độ/chứng chỉ và mức bắt buộc |
| `job_application_contacts`, `job_application_emails` | `backend/apps/jobs` | Người nhận hồ sơ nội bộ và tối đa 5 email; không trả qua public API |
| `applications`, `application_status_history` | `backend/apps/applications` | UNIQUE(candidate, job), snapshot CV bất biến, pipeline recruiter và timeline ứng viên đã lọc |
| `blog_postcategory` | `backend/apps/blog` | Danh mục bài viết cẩm nang (taxonomy phẳng 1 cấp), seed 6 danh mục qua `seed_blog` |
| `blog_post` | `backend/apps/blog` | Bài viết blog: `public_id`, slug SEO, `content` HTML, FK `related_job_category`→`jobs.JobCategory`, vòng đời draft→pending→published→archived, permission `can_publish_post` |
| `blog_tag`, `blog_post_tags` | `backend/apps/blog` | Thẻ bài viết + M2M UNIQUE(post, tag) |
| `blog_pinnedpost` | `backend/apps/blog` | Bài ghim theo `placement` (khối "Tài liệu hỗ trợ tìm việc"), FK trỏ thẳng bài viết |

**Ghi chú triển khai khác PRD/DB doc:**
- PRD mục 13.2 không liệt kê app riêng cho `job_categories`/`locations`/`skills`/`employer_profiles` — đã tách thành app Django riêng (`jobs` chứa job_categories, `locations`, `skills`, `employers`) để tránh phụ thuộc vòng và rõ trách nhiệm từng app.
- `posted_by` là ranh giới quyền: chỉ người tạo tin nhìn/sửa tin và các ứng tuyển của tin, kể cả khi nhiều recruiter cùng company. Tin đi theo `draft → pending → active|rejected`; admin duyệt/từ chối tại API moderation, lý do từ chối lưu trên `jobs.rejected_reason` và audit tại `job_status_history`.
- Các trường ảnh (`avatar_url`, `Company.logo_url`/`cover_image_url`, `CompanyImage.image_url`, `CompanyDocument.file_url`, `JobCategory.logo_url`, `Banner.image_url`, `SiteSetting` kiểu image, `UserCv.*_url`) lưu **storage key** chứ không phải URL tuyệt đối — URL công khai được resolve khi trả API theo domain/CDN hiện tại. Xem quy ước media ở [../04-api/tai-lieu-api.md](../04-api/tai-lieu-api.md).
- `jobs.locations` M2M cũ đã được migration `0013` chuyển sang `job_locations` trước khi xóa. Cả 61 liên kết hiện có được giữ nguyên; API mới yêu cầu phường/xã và địa chỉ cụ thể.
- Tất cả app Django được gom vào `backend/apps/` (thay vì nằm trực tiếp dưới `backend/`) để thư mục gốc backend gọn hơn; `backend/common/` (tiện ích dùng chung như `public_id`) và `backend/config/` (settings/urls) vẫn ở ngoài `apps/` vì không phải Django app.

Trạng thái đầy đủ theo từng giai đoạn: xem [../TIEN-DO-DU-AN.md](../TIEN-DO-DU-AN.md).
