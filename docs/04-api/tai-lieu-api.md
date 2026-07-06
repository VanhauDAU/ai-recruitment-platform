# 04 - API

Phạm vi:
- Danh sách endpoint theo module (auth, candidate, employer, cv, jobs, applications, ai, interviews)
- Request/response mẫu, mã lỗi

## Đã triển khai

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/register/` | Đăng ký tài khoản (candidate/employer) |
| POST | `/api/auth/login/` | Đăng nhập, nhận access/refresh JWT |
| POST | `/api/auth/refresh/` | Làm mới access token |
| GET | `/api/auth/me/` | Thông tin tài khoản hiện tại |
| GET/PUT | `/api/candidate/profile/` | Xem/cập nhật hồ sơ ứng viên (tự tạo khi cần) |
| GET/PUT | `/api/employer/profile/` | Xem/cập nhật hồ sơ công ty |
| POST | `/api/employer/profile/create/` | Tạo hồ sơ công ty |
| GET | `/api/locations/?level=&parent=&search=` | Tra cứu địa điểm (cascading tỉnh -> xã/phường), public |
| GET | `/api/jobs/categories/` | Danh sách ngành nghề, public |
| GET | `/api/cv-templates/` | Danh sách mẫu CV, public |
| GET | `/api/cv-templates/{slug}/` | Chi tiết mẫu CV, public |
| GET/POST | `/api/cvs/` | Candidate: xem danh sách/tạo CV (builder, cần `template`) |
| GET/PUT/PATCH/DELETE | `/api/cvs/{public_id}/` | Candidate: xem/sửa/xóa mềm CV của chính mình |
| POST | `/api/cvs/upload/` | Candidate: upload CV có sẵn (PDF/DOCX, multipart `file`) |
| GET | `/api/jobs/?category=&location=&work_type=&employment_type=&experience_level=&search=` | Danh sách job đang active, public |
| GET | `/api/jobs/{slug}/` | Chi tiết job (tăng `view_count`), public |
| GET/POST | `/api/jobs/mine/` | Employer: xem/tạo tin tuyển dụng của mình (kèm `job_skills` lồng) |
| GET/PUT/PATCH/DELETE | `/api/jobs/mine/{public_id}/` | Employer: sửa/xóa tin của mình |
| GET/POST | `/api/applications/` | Candidate: xem danh sách/ứng tuyển (job + cv theo `public_id`, chặn ứng tuyển trùng) |
| GET | `/api/applications/employer/?job=` | Employer: xem hồ sơ ứng tuyển vào job của mình |
| PATCH | `/api/applications/employer/{public_id}/` | Employer: cập nhật `status`/`employer_note` (tự set mốc thời gian tương ứng) |
