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
| POST | `/api/auth/login/` | Đăng nhập, nhận access/refresh JWT |
| POST | `/api/auth/refresh/` | Làm mới access token |
| GET | `/api/auth/me/` | Thông tin tài khoản hiện tại |
| POST | `/api/auth/avatar/` | Upload avatar vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`) |
| GET/PUT | `/api/candidate/profile/` | Xem/cập nhật hồ sơ ứng viên (tự tạo khi cần) |
| GET/PUT | `/api/employer/profile/` | Xem/cập nhật hồ sơ công ty |
| POST | `/api/employer/profile/create/` | Tạo hồ sơ công ty |
| POST | `/api/employer/profile/logo/` | Upload logo công ty vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`) |
| POST | `/api/employer/profile/cover/` | Upload cover công ty vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`) |
| GET | `/api/locations/?level=&parent=&search=` | Tra cứu địa điểm (cascading tỉnh -> xã/phường), public — không phân trang (trả tối đa 500 bản ghi/lần) |
| GET | `/api/jobs/categories/` | Danh sách ngành nghề (taxonomy 3 cấp: nhóm nghề/nghề/vị trí chuyên môn), public, có phân trang mặc định |
| GET | `/api/jobs/stats/` | Thống kê thị trường việc làm cho dashboard trang chủ (số job/công ty, job mới 24h, tăng trưởng 7 ngày, nhu cầu theo ngành, job mới nhất), public |
| GET | `/api/cv-templates/` | Danh sách mẫu CV, public |
| GET | `/api/cv-templates/{slug}/` | Chi tiết mẫu CV, public |
| GET/POST | `/api/cvs/` | Candidate: xem danh sách/tạo CV (builder, cần `template`) |
| GET/PUT/PATCH/DELETE | `/api/cvs/{public_id}/` | Candidate: xem/sửa/xóa mềm CV của chính mình |
| POST | `/api/cvs/upload/` | Candidate: upload CV có sẵn (PDF/DOCX, multipart `file`) |
| GET | `/api/jobs/?category=&location=&work_type=&employment_type=&experience_level=&search=` | Danh sách job đang active, public. `category`/`location` nhận **nhiều giá trị** (`?location=1&location=2`); `category` ở bất kỳ cấp nào trong taxonomy 3 cấp tự mở rộng xuống danh mục con; `location` là id tỉnh tự khớp mọi job ở phường/xã trực thuộc. Response mỗi job có `locations_detail` (danh sách `{id, name, level}`), `number_of_vacancies`, `education_level` |
| GET | `/api/jobs/{slug}/` | Chi tiết job (tăng `view_count`), public |
| GET/POST | `/api/jobs/mine/` | Employer: xem/tạo tin tuyển dụng của mình (kèm `job_skills` lồng) |
| GET/PUT/PATCH/DELETE | `/api/jobs/mine/{public_id}/` | Employer: sửa/xóa tin của mình |
| GET/POST | `/api/applications/` | Candidate: xem danh sách/ứng tuyển (job + cv theo `public_id`, chặn ứng tuyển trùng) |
| GET | `/api/applications/employer/?job=` | Employer: xem hồ sơ ứng tuyển vào job của mình |
| PATCH | `/api/applications/employer/{public_id}/` | Employer: cập nhật `status`/`employer_note` (tự set mốc thời gian tương ứng) |
