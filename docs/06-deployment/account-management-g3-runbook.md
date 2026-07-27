# Account Management G3 — rollout và kiểm tra staging

## 1. Phạm vi release

- Migration `accounts.0016`: thêm `AdminProvisioningScope`,
  `AdminInvitation`, loại outbox email `admin_invitation` và seed permission
  `account.*`.
- Migration `accounts.0017`: thêm index thiết bị/portal cho `AuthSession` để
  giữ truy vấn phiên tài khoản phẳng khi dữ liệu tăng.
- Route UI: `/admin/app/accounts`, `/admin/app/accounts/:publicId`,
  `/admin/app/invitation?token=...`.
- Không có xóa/anonymize/bulk write trong release này.

## 2. Triển khai

```bash
docker compose up -d db redis
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py sync_admin_permissions
docker compose up -d backend worker beat frontend
```

Không chạy `seed_admin_account_demo` trên staging/production. Tạo superuser gốc
bằng `createsuperuser`, sau đó bật/xác minh MFA theo runbook RBAC G1.

## 3. Cấu hình bắt buộc

- `ADMIN_FRONTEND_URL`: origin cổng Admin nhận email.
- `ADMIN_INVITATION_PATH`: mặc định `/admin/app/invitation`.
- `ADMIN_PASSWORD_RESET_PATH`: mặc định `/admin/app/reset-password`; link reset
  Admin luôn có thêm `portal=admin`, không dùng trang reset Ứng viên.
- Worker phải nghe queue `auth-email`; Redis và email provider phải healthy.
- Clock backend/worker đồng bộ để TTL 72 giờ và token version chính xác.

## 4. Smoke test staging

1. Superuser mở Phân quyền → **Cấp tài khoản**, tạo scope từ một role có
   `account.admin.invite` tới một role thường.
2. Đăng nhập bằng Admin nguồn; trang Tài khoản chỉ hiện tab được cấp và form
   Mời Admin chỉ trả role trong whitelist.
3. Gửi lời mời tới email chưa có Admin. Xác nhận email đến, link mở đúng tên,
   phòng ban và chức danh.
4. Đặt mật khẩu; xác nhận UI hiển thị đúng năm mã dự phòng một lần. Đăng nhập
   bằng email MFA và một mã dự phòng.
5. Kiểm tra tài khoản mới có đúng một `AdminMembership`, không có override cá
   nhân và không có action đổi role/khóa đối với người mời thường.
6. Gửi lại một lời mời khác; link cũ phải trả 400. Thu hồi lời mời; link mới
   cũng phải trả 400.
7. Tạo lời mời pending trong một scope, preview thu hồi scope phải báo đúng số
   ảnh hưởng; xác nhận phải thu hồi scope và lời mời trong cùng transaction.
8. Superuser thử đổi trạng thái và thu hồi phiên Candidate/Employer bằng
   preview; xác nhận audit có actor/reason/result nhưng không có token, mật
   khẩu, MFA secret hoặc mã dự phòng.

## 5. Quan sát và rollback

- Theo dõi outbox `AuthEmailJob` loại `admin_invitation`, log worker và tỷ lệ
  `failed`; không in `context` chứa token (context chỉ có public id + version).
- Theo dõi 403 `admin_permission_denied`, 409 `admin_resource_changed` và số
  lời mời pending/expired.
- Rollback code không tự xóa permission/scope/invitation để giữ audit. Migration
  reverse giữ permission rows; chỉ rollback schema sau khi đã xác nhận không
  còn code cũ đọc bảng mới.
