# ADR-0033: Hạn phiên đăng nhập riêng theo cổng (NIST SP 800-63B-4)

**Trạng thái:** Đã chấp nhận
**Ngày:** 26/11/2026
**Owner:** Xác thực (`apps/accounts/services/session_policy.py`)

## Bối cảnh

Trước ADR này ba cổng dùng chung một bộ hạn phiên: access token 15 phút (admin 5 phút),
refresh token 7 ngày, tự đăng xuất sau 30 phút không hoạt động. Có hai vấn đề:

- **Một mức cho ba mức rủi ro khác nhau.** Ứng viên chỉ quản lý hồ sơ của chính mình và kỳ
  vọng giữ đăng nhập lâu như các trang việc làm khác. Nhà tuyển dụng (NTD) đọc dữ liệu cá
  nhân của nhiều ứng viên và thanh toán dịch vụ. Admin có quyền trên toàn hệ thống. Mức
  30 phút/7 ngày vừa quá chặt cho ứng viên vừa quá lỏng cho admin.
- **Ngưỡng không hoạt động không bao giờ chạy.** Frontend chỉ gọi `/auth/refresh/` khi gặp
  401, mà refresh chỉ kiểm phiên còn sống và chưa quá hạn tuyệt đối, không kiểm idle. Access
  token hết hạn sau 15 phút, sớm hơn ngưỡng idle 30 phút, nên mọi lần quay lại sau thời gian
  rảnh đều được refresh thành công và `last_seen_at` được làm mới. Kiểm idle ở tầng access
  chỉ bắt được access token còn hạn nhưng đã rảnh quá 30 phút, điều không thể xảy ra.

## Quyết định

1. **Mỗi cổng một chính sách gồm ba mốc**, đọc qua `session_policy.policy_for(role)`:

   | Cổng | Mức NIST | Access token | Tự đăng xuất khi không hoạt động | Hạn tối đa |
   |---|---|---|---|---|
   | Ứng viên | AAL1 | 15 phút | 7 ngày | 30 ngày |
   | NTD | AAL2 | 15 phút | 1 giờ | 24 giờ |
   | Admin | AAL3 | 5 phút | 15 phút | 12 giờ |

   Ngưỡng của NTD và admin lấy đúng giới hạn idle/xác thực lại của AAL2 và AAL3 trong NIST
   SP 800-63B-4. AAL1 chỉ yêu cầu xác thực lại ít nhất 30 ngày một lần. Ngưỡng idle 7 ngày
   của ứng viên là lựa chọn sản phẩm, để thiết bị bỏ quên không giữ phiên suốt 30 ngày.
2. **Hạn tối đa tính từ lần đăng nhập và không gia hạn khi refresh.** `AuthSession.expires_at`
   đặt lúc đăng nhập. Refresh JWT phát ra (kể cả khi xoay vòng) có `exp` bằng đúng mốc đó.
   Cookie HttpOnly sống bằng phần còn lại của JWT. Chỉ đăng nhập lại mới mở phiên mới.
3. **Kiểm idle ở cả refresh lẫn access.** `locked_refresh_session` thu hồi phiên đã rảnh quá
   ngưỡng của cổng và từ chối refresh, giống như access token bị từ chối.
4. **Cấu hình bằng env, chín khóa `AUTH_<CỔNG>_{ACCESS_MINUTES, IDLE_MINUTES, MAX_AGE_HOURS}`.**
   Đặt `IDLE_MINUTES=0` để tắt idle của một cổng. Bỏ `JWT_ACCESS_TOKEN_MINUTES`,
   `JWT_REFRESH_TOKEN_DAYS`, `ADMIN_ACCESS_TOKEN_MINUTES` và
   `AUTH_SESSION_IDLE_TIMEOUT_SECONDS`. `SIMPLE_JWT` chỉ còn giữ trần chung, gồm access ngắn
   nhất và phiên dài nhất. Mọi luồng phát token đều đặt lại `exp` theo cổng. Trang Cấu hình
   hệ thống của admin hiện một dòng chỉ đọc cho mỗi cổng.

## Hệ quả

- NTD phải đăng nhập lại mỗi ngày và sau một giờ rời máy. Admin phải đăng nhập lại sau
  15 phút rảnh và mỗi 12 giờ.
- Ứng viên giữ đăng nhập tới 30 ngày nếu quay lại ít nhất 7 ngày một lần.
- Phiên đang mở lúc deploy giữ `expires_at` cũ (tối đa 7 ngày) nhưng chịu ngay ngưỡng idle mới.
- Tab chỉ mở WebSocket vẫn không tính là hoạt động (ADR-0028), nên chạm ngưỡng idle như cũ.
- `AUTH_SESSION_TOUCH_INTERVAL_SECONDS` (5 phút) phải nhỏ hơn ngưỡng idle ngắn nhất (15 phút).
