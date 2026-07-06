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
