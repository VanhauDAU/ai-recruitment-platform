# 04 - API

Phạm vi:
- Danh sách endpoint theo module (auth, candidate, employer, cv, jobs, applications, ai, interviews)
- Request/response mẫu, mã lỗi

## Tài liệu API tương tác (Swagger / OpenAPI)

Dùng `drf-spectacular` (OpenAPI 3). Chạy backend rồi mở:

| URL | Mô tả |
|---|---|
| `/api/docs/` | **Swagger UI** — xem + thử API trực tiếp trên trình duyệt |
| `/api/redoc/` | ReDoc — tài liệu dạng đọc |
| `/api/schema/` | File schema OpenAPI 3 (YAML) để import vào Postman/Insomnia |

Xác thực trong Swagger UI: gọi `POST /api/auth/login/` lấy `access`, bấm **Authorize**, nhập `Bearer <access_token>`. Xuất schema ra file: `python manage.py spectacular --file schema.yml`.

## Đã triển khai

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/register/` | Đăng ký tài khoản (candidate/employer) |
| POST | `/api/auth/login/` | Đăng nhập, nhận access/refresh JWT (kèm `portal` để chặn sai vai trò theo cổng) |
| POST | `/api/auth/refresh/` | Làm mới access token |
| GET | `/api/auth/me/` | Thông tin tài khoản hiện tại |
| POST | `/api/auth/verify/send/` | Gửi lại email xác thực (429 kèm `retry_after` khi còn cooldown) |
| POST | `/api/auth/verify/confirm/` | Xác nhận email bằng `token` trong link (public) |
| POST | `/api/auth/change-email/` | Đổi email → reset xác thực + gửi lại link |
| POST | `/api/auth/password-reset/` | Gửi email chứa link đặt lại mật khẩu (public, cần `captcha_token`). **Luôn trả 200 kèm cùng một `detail`** dù email có tồn tại hay không — chống dò danh sách email. Cooldown 60s/tài khoản (im lặng), throttle 5/phút theo IP |
| GET | `/api/auth/password-reset/validate/?token=` | Kiểm tra link còn hiệu lực, **không tiêu token**; 200 → `{email, role}`, 400 → link sai/hết hạn. Dùng để hiện ngay màn "hết hạn" thay vì bắt user gõ xong mật khẩu mới báo lỗi |
| POST | `/api/auth/password-reset/confirm/` | Đổi `token` + `password` lấy mật khẩu mới (public — token là bằng chứng, không cần captcha). Token dùng **một lần**, TTL 30 phút. Trả `{detail, role}` để frontend điều hướng về đúng cổng đăng nhập. Throttle riêng 10/phút (`password_reset_confirm`) |
| POST | `/api/auth/avatar/` | Upload avatar vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`; DB lưu storage key) |
| GET | `/api/auth/oauth/{provider}/start/?portal=main\|employer&next=/...` | Bắt đầu social login (`provider` = google/facebook/linkedin), redirect sang provider. Cổng `employer` chỉ chấp nhận google |
| GET | `/api/auth/oauth/{provider}/callback/` | Provider gọi lại; verify state, tạo/liên kết user, redirect về trang callback frontend kèm `one_time_code` (hoặc `?error=`) |
| POST | `/api/auth/oauth/complete/` | Đổi `one_time_code` (1 lần dùng, TTL 60s) lấy `{user, access, refresh}` |
| GET/PUT | `/api/candidate/profile/` | Xem/cập nhật hồ sơ ứng viên (tự tạo khi cần) |
| GET/PUT | `/api/employer/profile/` | Xem/cập nhật hồ sơ công ty |
| POST | `/api/employer/profile/create/` | Tạo hồ sơ công ty |
| POST | `/api/employer/profile/logo/` | Upload logo công ty vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`) |
| POST | `/api/employer/profile/cover/` | Upload cover công ty vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`) |
| GET | `/api/locations/?level=&parent=&search=` | Tra cứu địa điểm (cascading tỉnh -> xã/phường), public — không phân trang (trả tối đa 500 bản ghi/lần) |
| GET | `/api/jobs/categories/` | Danh sách ngành nghề (taxonomy 3 cấp: nhóm nghề/nghề/vị trí chuyên môn), public, có phân trang mặc định |
| GET | `/api/jobs/benefits/` | Danh mục quyền lợi chuẩn hóa (đang active), public, không phân trang |
| GET | `/api/jobs/languages/` | Danh mục ngoại ngữ (đang active), public, không phân trang |
| GET | `/api/jobs/stats/` | Thống kê thị trường việc làm cho dashboard trang chủ (số job/công ty, job mới 24h, tăng trưởng 7 ngày, nhu cầu theo ngành, job mới nhất), public |
| GET | `/api/cv-templates/` | Danh sách mẫu CV, public |
| GET | `/api/cv-templates/{slug}/` | Chi tiết mẫu CV, public |
| GET/POST | `/api/cvs/` | Candidate: xem danh sách/tạo CV (builder, cần `template`) |
| GET/PUT/PATCH/DELETE | `/api/cvs/{public_id}/` | Candidate: xem/sửa/xóa mềm CV của chính mình |
| POST | `/api/cvs/upload/` | Candidate: upload CV có sẵn (PDF/DOCX, multipart `file`) |
| GET | `/api/jobs/?category=&location=&work_type=&employment_type=&experience_level=&search=` | Danh sách job đang active, public. `category`/`location` nhận **nhiều giá trị** (`?location=1&location=2`); `category` ở bất kỳ cấp nào trong taxonomy 3 cấp tự mở rộng xuống danh mục con; `location` là id tỉnh tự khớp mọi job ở phường/xã trực thuộc. Response mỗi job có `locations_detail` (danh sách `{id, name, level}`), `number_of_vacancies`, `education_level` |
| GET | `/api/jobs/{slug}/` | Chi tiết job (tăng `view_count`), public. Ngoài dữ liệu nested thô còn trả **view-model nhóm sẵn** cho màn chi tiết: `primary_specialization`/`domain_knowledge` (`{id,name,slug}`), `workplace_groups` (nhóm theo tỉnh/thành, mỗi dòng địa chỉ có `display` ghép sẵn), `requirement_tags`, `benefit_tags`, `language_requirements[].proficiency_label` |
| GET/POST | `/api/jobs/mine/` | Employer: xem/tạo tin tuyển dụng của mình — nested writes cho `job_skills`, `category_assignments`, `job_locations`, `work_schedules`, `job_benefits`, `language_requirements`, `application_contact` |
| GET/PUT/PATCH/DELETE | `/api/jobs/mine/{public_id}/` | Employer: sửa/xóa tin của mình |
| GET/POST | `/api/applications/` | Candidate: xem danh sách/ứng tuyển (job + cv theo `public_id`, chặn ứng tuyển trùng) |
| GET | `/api/applications/employer/?job=` | Employer: xem hồ sơ ứng tuyển vào job của mình |
| PATCH | `/api/applications/employer/{public_id}/` | Employer: cập nhật `status`/`employer_note` (tự set mốc thời gian tương ứng) |
| GET | `/api/site/settings/` | Cấu hình site công khai dạng `{key: value}` (chỉ key `is_public=true`), public. **Cache 1h**, tự invalidate khi admin sửa qua API/Django admin |
| GET | `/api/site/link-groups/?placement=footer_seo` | Cụm link SEO đang bật kèm items đã resolve, public |
| GET | `/api/site/link-groups/?placement=footer_nav` | Các cột menu điều hướng footer, public |
| GET | `/api/site/banners/?placement=home_hero` | Banner đang bật theo order, public |
| GET | `/api/site/admin/settings/` | **Admin**: toàn bộ cấu hình gộp theo 15 nhóm `{groups: [{key, label, settings: [...]}]}`, mỗi setting kèm metadata (`value_type`, `options`, `order`, `is_public`, `env_configured`) để frontend tự render form |
| PATCH | `/api/site/admin/settings/` | **Admin**: bulk update, body `{"values": {key: value}}`, validate theo `value_type` (boolean/number/color hex/select choices), từ chối key kiểu `env` → `{"updated": [...], "errors": {...}}` |
| POST | `/api/site/admin/settings/upload/` | **Admin**: upload ảnh cho setting kiểu image (multipart `file` + `key`) → `{"key", "value", "url"}`; ảnh favicon tự resize về tối đa 256×256 |

**Quy ước ảnh (media):** DB lưu **storage key** (vd `site/settings/logo.png`), không lưu URL tuyệt đối; API resolve ra URL công khai theo domain/CDN hiện tại tại thời điểm trả về. Đổi domain hoặc bật `MEDIA_PUBLIC_BASE_URL` không cần sửa dữ liệu. Chuyển dữ liệu URL cũ sang key bằng `python manage.py normalize_media_references --apply`.
