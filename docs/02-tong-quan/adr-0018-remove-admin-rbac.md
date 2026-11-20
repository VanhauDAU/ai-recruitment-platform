# ADR-0018: Gỡ phân quyền theo phòng ban/chức danh, còn hai cấp quản trị

**Trạng thái:** Đã chấp nhận  
**Ngày:** 14/11/2026  
**Owner:** Accounts

## Bối cảnh

Cổng quản trị đang phân quyền nhiều tầng: 56 mã quyền (`AdminPermission`) gán
vào chức danh (`AdminRole`) thuộc phòng ban (`Department`), nhân viên được gán
chức danh qua `AdminMembership`; lời mời admin phải chọn chức danh và đi qua
whitelist "Cấp tài khoản" (`AdminProvisioningScope`). Trang `/access-control`
(Phòng ban, Chức danh, Nhân viên, Cấp tài khoản), impact preview cho từng thay
đổi quyền, cache quyền và bộ lệnh đồng bộ danh mục quyền phục vụ riêng mảng
này. Quản lý nhân sự nội bộ nằm ngoài trọng tâm đồ án (tuyển dụng tích hợp AI
phân tích CV và đối sánh CV–JD) nhưng lại chạm vào gần như mọi endpoint quản
trị ở backend lẫn frontend.

## Quyết định

1. Còn **hai cấp**: `is_superuser` và admin thường (`role='admin'`).
   - Admin thường dùng mọi chức năng nghiệp vụ: kiểm duyệt tin và báo cáo, công
     ty, xác thực nhà tuyển dụng, domain, yêu cầu cập nhật, báo cáo công ty,
     tài khoản ứng viên/NTD, blog, trợ giúp, thông báo, mẫu CV, CV người dùng.
   - Chỉ superuser: xem và thao tác tài khoản quản trị, mời quản trị viên, site
     settings, cấu hình AI, cấm/khôi phục tài khoản bị cấm, gỡ policy hold, xem
     nhật ký toàn hệ thống (`?scope=all`).
2. `HasAdminPermission` được thay bằng `AdminPortalPermission`: mọi admin còn
   truy cập được đều qua, view khai báo `require_superuser` (bool hoặc theo
   action) cho thao tác nhạy cảm. Service dùng `require_admin` /
   `require_superuser`.
3. Xóa model `AdminPermission`, `Department`, `AdminRole`, `AdminMembership`,
   `AdminProvisioningScope`, danh mục mã quyền, API `/api/admin/departments|
   roles|permissions|memberships|staff|provisioning-scopes/`, trang
   `/access-control`, lệnh `seed_admin_access`, `sync_admin_permissions`,
   `export_admin_permissions`, `purge_deprecated_admin_permissions`,
   `check_admin_access_readiness` và bước CI đồng bộ quyền frontend–backend.
4. Tạo tài khoản quản trị:
   - Superuser đầu tiên: `python manage.py createsuperuser`.
   - Admin tiếp theo: superuser mời qua email (`/api/admin/account-invitations/`,
     payload `email`, `full_name`, `reason`); người được mời mở link
     `/invitation` (hạn 72 giờ, dùng một lần) để đặt mật khẩu. Không có tự đăng
     ký. `create_admin_user` vẫn dùng được từ CLI.
   - Quên mật khẩu: giữ nguyên — trang đăng nhập admin không có tự khôi phục,
     superuser gửi link đặt lại từ trang quản lý tài khoản.
5. `/api/auth/me/` và payload tài khoản quản trị chỉ còn
   `admin_access: {"is_superuser": bool}`.
6. Nhóm site settings `admin_roles` (bốn khóa chưa từng được đọc) bị xóa.

**Giữ nguyên:** đăng nhập theo cổng, cookie refresh riêng cổng admin,
`AuthSession`, nhật ký `AdminAccessAuditLog` + `record_admin_action` (audit
dùng chung toàn hệ thống), impact token cho thao tác tài khoản nguy hiểm.

## Hệ quả

- Migration `accounts.0034_remove_admin_rbac` xóa vĩnh viễn phòng ban, chức
  danh, gán nhân viên, phạm vi cấp tài khoản và danh mục quyền; lời mời cũ mất
  liên kết chức danh. Cần `pg_dump` trước khi chạy (container backend tự
  migrate khi khởi động).
- Admin thường hiện có tự động có toàn quyền nghiệp vụ; tài khoản cần hạn chế
  phải được khóa hoặc chuyển sang superuser quản lý.
- Audit log cũ (`assign_membership`, `set_role_permissions`,
  `create_department`…) được giữ làm lịch sử; frontend vẫn hiển thị nhãn.
- Không còn phân tách quyền giữa người soạn và người duyệt (blog, trợ giúp,
  mẫu CV); quy trình trạng thái nội dung vẫn giữ, mọi thao tác có audit. Blog và
  trợ giúp sau đó bỏ hẳn bước tự duyệt
  ([ADR-0024](./adr-0024-content-publish-without-review.md)).
