# Phân quyền admin theo phòng ban — RBAC Giai đoạn 1

## Mục tiêu và ranh giới

Giai đoạn 1 thay mô hình “mọi tài khoản `role=admin` đều có toàn quyền” bằng:

```text
AdminPermission ← AdminRole ← AdminMembership → User
                       ↓
                  Department
```

Quyền hiệu dụng là hợp các permission thuộc membership còn hiệu lực. Cả
membership, role và department đều phải active. `is_superuser=True` là đường
thoát vận hành và bypass mọi permission. `rank` chỉ phục vụ hiển thị và chọn
membership chính; không cấp quyền.

Frontend lọc menu và `PermissionGuard` chỉ cải thiện trải nghiệm. Ranh giới bảo
mật là `HasAdminPermission` tại backend. G1 mới siết site settings, catalogue
dịch vụ/lead, catalogue CV và kiểm duyệt tin; dashboard và blog được chuyển ở G2.

## Bảng dữ liệu

| Bảng | Trách nhiệm | Quy tắc quan trọng |
| --- | --- | --- |
| `accounts_adminpermission` | Mirror registry permission trong code | Code bị bỏ được deprecate, không tự xoá |
| `accounts_department` | Đơn vị tổ chức | Chỉ deactivate/reactivate, không hard-delete qua API |
| `accounts_adminrole` | Chức danh trong một phòng ban | Unique `(department, code)`; M2M permission |
| `accounts_adminmembership` | Lịch sử gán chức danh cho admin | Partial unique cho active `(user, role)` và active primary |
| `accounts_adminaccessauditlog` | Nhật ký thay đổi quyền | Luôn ghi cùng transaction; chỉ lưu public ID |

Membership đã thu hồi được giữ nguyên với `revoked_at`/`revoked_by`. Gán lại
cùng role tạo row mới để lịch sử không bị viết lại. `AdminRole` được bảo vệ bằng
`PROTECT` từ membership.

## Registry và vòng đời permission

Nguồn sự thật là
`backend/apps/accounts/constants/admin_permissions.py`. Command:

```bash
python manage.py sync_admin_permissions
python manage.py purge_deprecated_admin_permissions --confirm
python manage.py export_admin_permissions
```

`sync_admin_permissions` hoạt động hai chiều:

- code mới được tạo hoặc cập nhật nhãn/mô tả;
- code biến mất chuyển `is_active=False`, giữ M2M với role;
- code xuất hiện lại được kích hoạt và phục hồi grant cũ;
- cache của mọi user bị ảnh hưởng được xoá sau commit.

`purge` từ chối permission còn được role tham chiếu, trừ khi có `--force`.
File JSON frontend được sinh trực tiếp từ registry Python, không đọc database.
CI chạy `scripts/check_admin_permissions_sync.sh` để ngăn hai phía lệch nhau.

## Ma trận seed G1

| Phòng ban | Role | Rank | Permission active |
| --- | --- | ---: | --- |
| Nội dung & CV (`content-cv`) | `staff` | 10 | `dashboard.view`, `cv_template.view`, `.create`, `.edit` |
| Nội dung & CV | `manager` | 100 | quyền staff + `cv_template.publish`, `.archive`, `.delete` |
| Kiểm duyệt tin (`job-moderation`) | `staff` | 10 | `dashboard.view`, `job_moderation.view`, `.approve`, `.reject` |
| Kiểm duyệt tin | `manager` | 100 | giống staff trong G1 |
| Dịch vụ NTD (`employer-services`) | `staff` | 10 | `dashboard.view`, `service_catalog.view`, `consultation_lead.view`, `.manage` |
| Dịch vụ NTD | `manager` | 100 | quyền staff + `service_catalog.manage` |

`site_setting.*` không thuộc phòng ban nào và chỉ superuser dùng ở G1. `blog.*`
có trong registry nhưng chưa seed vì blog vẫn dùng Django Groups. Seed là hội
tụ: chạy lại sẽ sửa rank/trạng thái và exact-sync tập permission active, đồng
thời giữ grant deprecated để rollback an toàn.

```bash
python manage.py seed_admin_access --actor-email root@example.com \
  --assign moderator@example.com:job-moderation:staff
```

## Primary membership và cache

Membership hiệu lực đầu tiên tự thành primary. Khi primary bị thu hồi, hoặc
role/department của nó bị khoá, hệ thống chọn ứng viên theo `rank` giảm dần,
`assigned_at` tăng dần, rồi `id` tăng dần. Reactivate không tự đảo về primary
cũ; chỉ chọn lại nếu user hiện chưa có primary hiệu lực.

Cache dùng key `admin_perms:{user_id}`, TTL 60 giây và invalidation qua
`transaction.on_commit`. Redis lỗi thì selector query database; không có nhánh
fail-open.

## Audit và dữ liệu nhạy cảm

Audit log luôn bật, không phụ thuộc `admin_action_log_enabled`. Payload chỉ chứa
public ID, email cần thiết và before/after thực sự thay đổi. Không được ghi OTP,
TOTP secret, backup code, access/refresh token, mật khẩu hoặc toàn bộ object
User.

## Phát hành

Triển khai thành hai release:

1. **G1.1:** schema, registry, services/selectors, command, `/auth/me` và frontend.
2. Gán membership thật, chạy `check_admin_access_readiness` đến khi exit 0.
3. **G1.2:** bật `HasAdminPermission` cho các endpoint nguy hiểm.

Quy trình chi tiết: [runbook RBAC admin](../06-deployment/admin-rbac-g1-runbook.md).

## G2

G2 bổ sung UI/API CRUD phòng ban/chức danh/nhân viên, audit viewer, quyền tạm
thời, siết dashboard, hợp nhất Django Groups của blog và định nghĩa riêng quy
tắc “ai quản lý được ai”.
