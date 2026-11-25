# ADR-0016: Gỡ xác thực hai bước (2FA/MFA)

**Trạng thái:** Đã chấp nhận  
**Ngày:** 13/11/2026  
**Owner:** Accounts

## Bối cảnh

App `accounts` hiện thực xác thực hai bước: mã qua email, ứng dụng xác thực
(TOTP, secret mã hóa Fernet), mã dự phòng, challenge khi đăng nhập bằng mật
khẩu, bước "đặt lại MFA" trong luồng khôi phục danh tính của quản trị viên,
bộ lọc/cột MFA trong quản trị tài khoản và lệnh `bootstrap_admin_mfa`. Không
cổng nào bắt buộc MFA. Mảng này nằm ngoài trọng tâm đồ án (tuyển dụng tích
hợp AI phân tích CV và đối sánh CV–JD) và làm tăng đáng kể chi phí bảo trì ở
cả ba cổng.

## Quyết định

1. Xóa toàn bộ 2FA: service, API `/api/auth/two-factor/*`, API admin
   `/api/admin/accounts/{id}/mfa-impact|reset-mfa/`, quyền `account.mfa.reset`,
   field `two_factor_*` trên `User`, loại email `two_factor`/`mfa_reset_notice`,
   biến môi trường `TWO_FACTOR_*` và giao diện ở cả ba cổng.
2. Đăng nhập bằng mật khẩu hoặc OAuth cấp token ngay; `/api/auth/me/` không còn
   `two_factor_enabled`/`mfa_methods`.
3. Luồng khôi phục danh tính của admin còn: đổi email → gửi link đặt lại mật khẩu.
4. `bootstrap_admin_mfa` được thay bằng `verify_admin_email` (chỉ đánh dấu email
   admin đã xác thực từ CLI và ghi audit `mark_email_verified`).

**Giữ nguyên** (không phải 2FA): xác thực số điện thoại nhà tuyển dụng bằng
SMS OTP, xác thực email, xác thực lại phiên (reauth) bằng mật khẩu/OAuth,
`User.auth_revision`.

## Hệ quả

- Secret TOTP, mã dự phòng và trạng thái bật 2FA bị xóa vĩnh viễn bởi migration
  `accounts.0030`; cần sao lưu cơ sở dữ liệu trước khi chạy.
- Audit log cũ (`self_mfa_enable`, `reset_account_mfa`, `bootstrap_mfa`…) và
  `AuthSession.auth_method='mfa'` được giữ làm lịch sử; frontend vẫn hiển thị
  nhãn cho các hành động này.
- Quyền `account.mfa.reset` được đánh dấu deprecated thay vì xóa dòng, giống
  cách `sync_permission_catalog` xử lý mã quyền bị gỡ.
