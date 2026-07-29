# Account Management G3 — rollout và kiểm tra staging

## 1. Phạm vi release

- Migration `accounts.0016`: thêm `AdminProvisioningScope`,
  `AdminInvitation`, loại outbox email `admin_invitation` và seed permission
  `account.*`.
- Migration `accounts.0017`: thêm index thiết bị/portal cho `AuthSession` để
  giữ truy vấn phiên tài khoản phẳng khi dữ liệu tăng.
- Migration `accounts.0020`: thêm `auth_revision` cho tài khoản/phiên, hai
  permission khôi phục danh tính, trạng thái outbox `cancelled` và hai loại
  thông báo bảo mật. Migration không gán quyền mới cho role nào.
- Bộ migration trạng thái `accounts.0021`, `employers.0029`, `jobs.0032` thêm
  transition evidence và policy hold không ghi đè trạng thái nghiệp vụ. Quy
  trình triển khai/rollback riêng tại
  [account status enforcement runbook](./account-status-enforcement-runbook.md).
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

Sau migrate phải chạy `sync_admin_permissions`, export lại permission catalog
frontend và xác nhận `account.email.manage`/`account.mfa.reset` chưa được gán
cho bất kỳ role support nào.

## 3. Cấu hình bắt buộc

- `ADMIN_FRONTEND_URL`: origin cổng Admin nhận email.
- `ADMIN_INVITATION_PATH`: mặc định `/admin/app/invitation`.
- `ADMIN_PASSWORD_RESET_PATH`: mặc định `/admin/app/reset-password`; link reset
  Admin luôn có thêm `portal=admin`, không dùng trang reset Ứng viên.
- Worker phải nghe queue `auth-email`; Redis và email provider phải healthy.
- Clock backend/worker đồng bộ để TTL 72 giờ và token version chính xác.
- `DJANGO_ADMIN_ENABLED=True` chỉ dùng trong development. Test đặt flag này
  thành false; production fail-fast nếu flag true và `/admin/` luôn trả 404.

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
9. Superuser đổi email một tài khoản test, kiểm tra mật khẩu thành unusable,
   mọi phiên/OAuth bị thu hồi, email mới chưa verified và email cũ nhận cảnh
   báo. Nếu impact báo còn MFA, reset MFA rồi mới gửi password reset.
10. Xác nhận JWT/refresh, password-reset link, MFA challenge và OAuth code phát
    trước recovery đều bị từ chối; verification link đã gửi tới email mới vẫn
    dùng được sau bước reset MFA.
11. Kiểm tra `/admin/` trả 404 bằng đúng production image/config.

## 5. Khôi phục danh tính tài khoản P0

- Không bật endpoint hoặc liên kết **Quên mật khẩu** công khai trên trang đăng
  nhập Admin. Trang `/admin/app/reset-password` chỉ nhận token do workflow quản
  trị phát hành.
- P0 chỉ superuser vận hành. Không gán `account.email.manage` hoặc
  `account.mfa.reset` cho support. P1 four-eyes/two-person approval phải hoàn
  thành trước khi mở rộng hai quyền này ra ngoài superuser.
- Tài khoản `PENDING` phải revoke/resend invitation; không dùng recovery.
  Tài khoản soft-deleted không thuộc P0 và không được coi là đã xử lý.
- Trước thao tác, xác minh người dùng ngoài hệ thống và ghi evidence cụ thể
  (20–500 ký tự). Evidence chỉ nằm trong audit, không đưa vào email/outbox.

Checklist vận hành bắt buộc:

1. Mở hồ sơ tài khoản, đối chiếu public ID, role, status, email, MFA và OAuth.
2. Preview **Đổi email đăng nhập**, đọc đầy đủ impact rồi confirm. Xác nhận email
   đã chuẩn hóa, password unusable, `email_verified=false`, mọi phiên và OAuth
   link đã bị thu hồi.
3. Nếu impact cho thấy còn email MFA, TOTP hoặc backup code, preview rồi
   **Reset toàn bộ MFA**. Reset MFA không đổi password, OAuth, email, trạng thái
   hay email verification.
4. Nếu tài khoản inactive/banned, xử lý status bằng action độc lập có
   reason/audit; recovery không tự mở khóa.
5. Chỉ sau lần thay đổi `auth_revision` cuối cùng mới chọn **Gửi đặt lại mật
   khẩu**. Link cũ phải được coi là vô hiệu và phát lại.
6. Người dùng đặt mật khẩu mới; việc dùng được link xác nhận quyền sở hữu email
   mới.
7. Người dùng đăng nhập, cấu hình lại MFA và liên kết lại OAuth nếu cần.

Đổi email và reset MFA là hai audit action độc lập. Đổi email giữ cấu hình MFA
để impact bước sau nhìn thấy chính xác nhưng mọi code/challenge cũ bị vô hiệu
bởi `auth_revision`. Các password-reset/MFA/OAuth code pending tại thời điểm
deploy sẽ fail-closed và phải phát lại.

- Chỉ gửi link cho tài khoản đang hoạt động. Không mở khóa tài khoản bị cấm chỉ
  để reset mật khẩu; việc mở khóa là một quyết định riêng có reason/audit.
- Sau khi người nhận dùng link, token phải hết hiệu lực và toàn bộ refresh
  session cũ bị thu hồi. Không gửi mật khẩu qua email hoặc tự đăng nhập người
  dùng sau khi reset.
- Duy trì tối thiểu hai superuser độc lập, bật TOTP và cất mã dự phòng ở kho bí
  mật ngoại tuyến.

Break-glass khi mất toàn bộ superuser chỉ được thực hiện bởi người có quyền máy
chủ, không qua `/admin/` và không sửa password hash trực tiếp:

```bash
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py bootstrap_admin_mfa \
  <email> --mark-email-verified --no-input
```

Ghi ticket/sự kiện vận hành, người thực hiện, bằng chứng phê duyệt và thời điểm;
sau đó kiểm tra audit `bootstrap_mfa`, thu hồi phiên không cần thiết và bổ sung
superuser dự phòng.

## 6. Quan sát và rollback

- Theo dõi outbox `AuthEmailJob` loại `admin_invitation`,
  `email_changed_notice`, `mfa_reset_notice`, log worker và tỷ lệ
  `failed`/`cancelled`; không in token, URL, evidence hoặc OAuth profile.
- Theo dõi action `send_account_password_reset`; mọi bản ghi phải có `reason`
  và `target_public_id`, tuyệt đối không chứa token hoặc URL reset đầy đủ.
- Theo dõi 403 `admin_permission_denied`, 409 `admin_resource_changed` và số
  lời mời pending/expired.
- Theo dõi audit `change_account_email` và `reset_account_mfa`; payload phải có
  reason/evidence và số ảnh hưởng, không có secret hoặc backup-code hash.
- Rollback code không tự xóa permission/scope/invitation để giữ audit. Migration
  reverse giữ permission rows; chỉ rollback schema sau khi đã xác nhận không
  còn code cũ đọc bảng mới.
