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

## 5. Khôi phục mật khẩu Admin

- Không bật endpoint hoặc liên kết **Quên mật khẩu** công khai trên trang đăng
  nhập Admin. Trang `/admin/app/reset-password` chỉ nhận token do workflow quản
  trị phát hành.
- Admin mất mật khẩu phải liên hệ superuser/bộ phận kỹ thuật qua kênh nội bộ đã
  xác minh. Superuser mở hồ sơ tài khoản, chọn **Gửi đặt lại mật khẩu**, nhập lý
  do hỗ trợ và kiểm tra đúng email trước khi xác nhận.
- Chỉ gửi link cho tài khoản đang hoạt động. Không mở khóa tài khoản bị cấm chỉ
  để reset mật khẩu; việc mở khóa là một quyết định riêng có reason/audit.
- Sau khi người nhận dùng link, token phải hết hiệu lực và toàn bộ refresh
  session cũ bị thu hồi. Không gửi mật khẩu qua email hoặc tự đăng nhập người
  dùng sau khi reset.
- Duy trì tối thiểu hai superuser độc lập, bật TOTP và cất mã dự phòng ở kho bí
  mật ngoại tuyến. Nếu superuser cuối cùng mất quyền truy cập, dùng quy trình
  break-glass do hai người phê duyệt trên backend; không sửa password hash trực
  tiếp trong database. Sau khôi phục phải thu hồi mọi phiên, kiểm tra MFA và ghi
  ticket vận hành liên kết với audit.

## 6. Quan sát và rollback

- Theo dõi outbox `AuthEmailJob` loại `admin_invitation`, log worker và tỷ lệ
  `failed`; không in `context` chứa token (context chỉ có public id + version).
- Theo dõi action `send_account_password_reset`; mọi bản ghi phải có `reason`
  và `target_public_id`, tuyệt đối không chứa token hoặc URL reset đầy đủ.
- Theo dõi 403 `admin_permission_denied`, 409 `admin_resource_changed` và số
  lời mời pending/expired.
- Rollback code không tự xóa permission/scope/invitation để giữ audit. Migration
  reverse giữ permission rows; chỉ rollback schema sau khi đã xác nhận không
  còn code cũ đọc bảng mới.
