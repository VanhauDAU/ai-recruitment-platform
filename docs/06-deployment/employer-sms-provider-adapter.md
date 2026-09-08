# Employer SMS verification — adapter và live workflow ER-6A

## 1. Phạm vi và trạng thái

Tài liệu này mô tả hạ tầng provider-neutral và live workflow SMS. Code đã chuyển
endpoint/UI phone verification sang exact challenge; production vẫn tắt cho tới
khi hoàn tất gateway sandbox và rollout gate. Cụ thể:

- không chọn hoặc khóa cứng một nhà cung cấp trả phí;
- endpoint/UI dùng challenge ID; employer account PATCH không được đổi phone;
- production giữ `EMPLOYER_SMS_OTP_ENABLED=False` cho tới khi Product/Ops duyệt
  gateway, sender và template;
- khi flag tắt, dispatch SMS fail closed và không fallback email;
- account cũ không bị gắn marker, deadline, hold hoặc thay đổi phone proof;
- account mới, đổi số và self-reverify đều dùng SMS challenge; không còn email
  OTP fallback.

## 2. Boundary dữ liệu

`PhoneOtp` được mở rộng thành challenge có `public_id`, `purpose` và state
dispatch. Ba purpose SMS là `initial_verification`, `phone_change`, `reverify`;
`legacy_email` chỉ còn là enum đọc dữ liệu lịch sử; endpoint/task tạo OTP email
đã bị xóa và không được dùng làm fallback.

Challenge SMS mới:

- chỉ nhận số di động Việt Nam và chuẩn hóa thành `+84[35789]xxxxxxxx`;
- để trống cột plaintext `phone`;
- mã hóa riêng destination và OTP bằng Fernet key dành cho SMS;
- lưu OTP hash bằng HMAC gắn với `challenge.public_id`, không dùng SHA-256 trần;
- Celery chỉ nhận `challenge_public_id`, không nhận phone, OTP hoặc ciphertext;
- dùng chính public ID làm idempotency key khi gọi adapter;
- xóa OTP ciphertext ngay khi provider nhận thành công;
- xóa toàn bộ phone/ciphertext/hash/provider message ID của challenge sau 30
  ngày.

`RecruiterProfile.verified_phone` chuyển sang nullable cho bản ghi mới nhưng
migration không backfill/normalize dữ liệu cũ. Migration chỉ vô hiệu OTP legacy
chưa dùng và còn hạn tại thời điểm cutover; `verified_phone` và
`phone_verified_at` hiện hữu giữ nguyên.

`EmployerPhoneVerificationEvent` là evidence append-only, không chứa phone,
OTP, ciphertext, hash hoặc provider response. Event giữ 730 ngày (xấp xỉ 24
tháng), sau đó retention task mới được phép xóa.

## 3. Hợp đồng HTTP trung lập

Live API contract:

- `POST /api/employer/phone/send-otp/` nhận `phone,password`, trả `202` với
  trạng thái challenge redacted;
- `GET /api/employer/phone/challenges/{public_id}/` chỉ actor sở hữu được poll;
- `POST /api/employer/phone/verify/` nhận exact `challenge_id,code`;
- cooldown 60 giây, TTL 10 phút, tối đa năm lần sai; resend vô hiệu challenge
  active cũ;
- `/api/employer/phone/check/` chỉ validate format và luôn trả generic;
  uniqueness được recheck sau khi mã đúng trong transaction.

Adapter `http` gửi request provider như sau:

Adapter `http` gửi `POST` tới `EMPLOYER_SMS_ENDPOINT_URL`:

```http
Authorization: Bearer <EMPLOYER_SMS_API_TOKEN>
Content-Type: application/json
Idempotency-Key: <challenge_public_id>
```

```json
{
  "to": "+84912345678",
  "sender": "<approved-sender>",
  "template_id": "<approved-template>",
  "template_parameters": {
    "code": "123456",
    "ttl_minutes": "10"
  }
}
```

Gateway adapter nội bộ phải trả response 2xx:

```json
{"message_id": "opaque-provider-message-id"}
```

HTTP `429` và `5xx` là lỗi tạm thời; timeout/connection error cũng retry tối đa
ba lần với backoff, đồng thời global dispatch budget là bốn lần kể cả recovery
sau worker crash. Adapter không follow redirect để tránh gửi token/phone/OTP sang
host khác. Các lỗi `4xx`, payload response sai hoặc cấu hình sai là lỗi terminal.
Lần retry cuối chuyển row sang `failed/provider_retries_exhausted`;
worker không claim lại row terminal. Muốn thử lại phải tạo challenge mới, challenge
cũ bị invalidated.

Không ghi provider response body vào log vì body có thể phản chiếu phone/OTP.

## 4. Cấu hình

```dotenv
EMPLOYER_SMS_OTP_ENABLED=False
EMPLOYER_SMS_PROVIDER=disabled
EMPLOYER_SMS_ENDPOINT_URL=
EMPLOYER_SMS_API_TOKEN=
EMPLOYER_SMS_SENDER=
EMPLOYER_SMS_TEMPLATE_ID=
EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY=
EMPLOYER_SMS_CHALLENGE_HMAC_KEY=
EMPLOYER_SMS_CONNECT_TIMEOUT_SECONDS=2
EMPLOYER_SMS_READ_TIMEOUT_SECONDS=5
EMPLOYER_SMS_DISPATCH_STALE_SECONDS=300
```

Yêu cầu production khi bật flag:

- provider phải là `http`; `fake` chỉ dùng development/test;
- endpoint phải dùng HTTPS;
- token, sender, template đều không rỗng;
- encryption key là Fernet key riêng;
- HMAC key riêng có ít nhất 32 ký tự;
- không dùng lại `SECRET_KEY`, JWT signing key hoặc TOTP key.

Production settings fail startup nếu flag bật mà thiếu/sai bất kỳ điều kiện
nào. Kiểm tra cấu hình trước deploy, không gửi SMS thật:

```bash
cd backend
python manage.py check_employer_sms_readiness
python manage.py check_employer_sms_readiness --require-enabled
```

Lệnh đầu trả `DISABLED` thành công khi flag tắt. Lệnh thứ hai dùng cho release
gate và fail nếu chưa bật/readiness chưa đạt.

## 5. Worker, recovery và retention

- Queue riêng: `auth-sms`.
- `dispatch_employer_sms_challenge(challenge_public_id)`: claim một row, gọi
  provider, ghi state/event/metric redacted.
- `recover_stale_employer_sms_dispatches`: mỗi phút đưa row `dispatching` quá
  stale threshold về `retry_pending`, rồi enqueue lại với cùng idempotency key.
- `purge_employer_sms_verification_data`: mỗi ngày xóa PII/ciphertext challenge
  quá 30 ngày và event quá 730 ngày theo batch.

Metrics được phép: `employer_sms_dispatch`, `employer_sms_recovery`,
`employer_sms_retention`. Tag chỉ gồm state/purpose/failure code ổn định; cấm raw
phone, OTP, ciphertext, authorization header và provider response.

## 6. Thứ tự rollout/rollback

1. Deploy expand migration trong khi SMS flag vẫn tắt.
2. Xác nhận migration report: OTP legacy còn hạn bị invalidated, phone proof cũ
   không đổi.
3. Chạy worker có queue `auth-sms` và Celery beat mới.
4. Chọn gateway/sender/template qua quyết định Product/Ops riêng; cấu hình secret
   ở secret manager.
5. Chạy readiness command và smoke bằng provider `fake` ở non-production, sau đó
   gateway sandbox/staging.
6. Xác nhận live endpoint/UI đã deploy trong khi flag vẫn tắt và response
   `PHONE_SMS_DISABLED` hiển thị fail-closed.
7. Chỉ bật production sau gate outage/retry/replay/throttle/uniqueness và smoke
   sandbox đạt.

Rollback: tắt `EMPLOYER_SMS_OTP_ENABLED`; không reverse migration và không xóa
event/challenge. Dispatch mới dừng fail closed, không giả thành công và không
chuyển mã qua email.

Xác nhận rendered Compose trước rollout:

```bash
docker compose config
docker compose config | grep 'default,auth-email,auth-sms,cv-export,upload-scan'
```
