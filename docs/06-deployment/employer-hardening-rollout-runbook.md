# Employer hardening rollout runbook

## Mục tiêu và giới hạn

Runbook này là gate vận hành ER-8 cho toàn bộ hardening cổng Nhà tuyển dụng.
Mọi bước audit mặc định chỉ đọc; không có command nào trong tài liệu được tự
thêm `--apply`. Dữ liệu thật, provider SMS và production flag chỉ được thay đổi
sau khi người vận hành duyệt dry-run report, backup và rollback rehearsal.

Các kiểm soát IDOR, private/quarantine download, final admin decision và job
approval guard luôn fail-closed, không có kill switch để bỏ qua bảo mật.

## Cấu hình canonical

Các flag rollout thực sự được code sử dụng:

```env
UPLOAD_QUARANTINE_ENABLED=false
EMPLOYER_UPLOAD_SESSION_REQUIRED=false
CANDIDATE_UPLOAD_SESSION_REQUIRED=false
EMPLOYER_SMS_OTP_ENABLED=false
EMPLOYER_EVENT_RETENTION_DAYS=730
```

- `UPLOAD_QUARANTINE_ENABLED` mở shared upload session sau khi ClamAV ready.
- Hai flag `*_UPLOAD_SESSION_REQUIRED` chỉ bật sau khi domain tương ứng đã qua
  clean/EICAR/outage rehearsal; production fail startup nếu strict nhưng
  quarantine chưa sẵn sàng.
- `EMPLOYER_SMS_OTP_ENABLED` chỉ bật sau khi gateway HTTPS, sender, template,
  hai secret độc lập và worker queue `auth-sms` đã được xác minh.
- Company request V2, verification final decision, permission/hold và website
  notification là contract additive đã always-on; rollback code vẫn giữ schema
  và audit, không mở compatibility path kém an toàn.

## Gate đọc trước deploy

Repo dùng PostgreSQL Docker 16 tại host `127.0.0.1:5433`. Chạy audit local:

```bash
cd backend
DB_HOST=127.0.0.1 DB_PORT=5433 DB_NAME=ai_career_coach \
DB_USER=postgres DB_PASSWORD=postgres \
.venv/bin/python manage.py audit_employer_workflow_rollout --json
```

Report chỉ chứa flag, blocker code và số đếm tổng hợp; không có email, phone,
public ID, filename, storage key, checksum hoặc provider secret. Lưu exact JSON
vào release evidence. Các warning `legacy_*` là cohort cần đối soát, không phải
bằng chứng mới và không được tự đổi thành `clean/current/explicit_admin`.

Trước khi bật strict trên staging, chạy probe thật:

```bash
docker compose exec -T backend python manage.py \
  audit_employer_workflow_rollout --strict --probe-scanner --json
```

Gate chỉ pass khi schema ER-7 đã apply, DPA policy hợp lệ, expected upload
purpose đủ, scanner ready, SMS config ready, route/beat schedule đầy đủ,
retention tối thiểu 730 ngày và không còn challenge phone legacy đang active.

## Trình tự rollout

1. Backup PostgreSQL và snapshot private/quarantine object inventory; không copy
   secret hoặc PII vào ticket.
2. Deploy schema additive, chạy `migrate --plan`, sau đó `migrate`; chạy lại
   audit không strict và lưu report trước/sau.
3. Xác minh worker lắng nghe đồng thời `auth-sms` và `upload-scan`; beat phải có
   scanner dispatch/cleanup, SMS recovery/purge, email outbox sweep và employer
   event retention.
4. Bật `UPLOAD_QUARANTINE_ENABLED` nội bộ; chạy readiness, clean file, EICAR,
   scanner outage, timeout/retry/cancel/expiry và kiểm tra không có storage URL.
5. QA Chrome bằng tài khoản test cho employer GPKD/DPA/company media/update
   proof và candidate import/template/apply/avatar. Xác nhận UI không báo thành
   công trước `clean`, lỗi/rejected/expired không tạo business record.
6. Bật `EMPLOYER_UPLOAD_SESSION_REQUIRED`, soak; sau đó bật
   `CANDIDATE_UPLOAD_SESSION_REQUIRED` và soak riêng. Không bật hai strict flag
   cùng một lần trên production.
7. Cấu hình SMS gateway thật, chạy `check_employer_sms_readiness
   --require-enabled`, gửi challenge bằng số test đã phê duyệt; xác nhận queue,
   retry, webhook/provider ID redacted và không có OTP/phone trong log/broker.
8. Chạy DPA dry-run theo
   [`employer-dpa-evidence-rollout.md`](employer-dpa-evidence-rollout.md).
   `--apply` dùng rollout ID bất biến, batch/cursor và chỉ sau ops review.
9. Kiểm tra admin final decision, revoke/expire/reapprove, ba lần final reject,
   source-specific hold và public job visibility. Không mutate business status
   để mô phỏng hold.
10. Bật production theo cohort, theo dõi ít nhất một chu kỳ retention/sweep
    ngắn và một chu kỳ nghiệp vụ đầy đủ trước compatibility cleanup.

## Monitoring và ngưỡng dừng

Log collector đọc metric PII-free:

- `upload_scan_result`, `upload_scan_duration_ms`, `upload_session_state`;
- `employer_sms_dispatch`, `employer_sms_recovery`, `employer_sms_retention`;
- `employer_notification_event`, `employer_notification_retention`.

Dừng rollout khi scanner readiness fail, queue age tăng liên tục hai lần quan
sát, tỷ lệ scan error/provider retry tăng đột biến, unread/outbox drift, public
job còn hiện dưới active hold, hoặc dry-run/apply cohort count lệch ngoài các
account đã hợp lệ thay đổi trong lúc chạy.

Không log raw request body, phone/OTP, DPA IP/session, filename, file hash,
threat signature, storage key, scanner endpoint/version hoặc admin identity.

## Rollback

- Tắt strict flag của domain vừa bật; giữ quarantine và authorization boundary.
- Với scanner outage, dừng claim/submit mới, giữ session ở trạng thái retryable;
  không chuyển file sang clean thủ công.
- Với SMS, tắt `EMPLOYER_SMS_OTP_ENABLED`; challenge mới fail closed. Không bật
  lại OTP email legacy.
- Với DPA rollout, dừng batch; release chỉ exact DPA hold theo quy trình duyệt,
  không gỡ verification/account/moderation hold.
- Không reverse migration đang chứa revision, event, evidence, notification,
  upload session hoặc compliance link. Không xóa legacy source trong rollback.
- Rollback code phải chạy lại audit report và các permission/download/job
  visibility regression trước khi mở traffic.

## Compatibility cleanup sau soak

Chỉ mở nhánh `refactor/employer-workflow-compat-cleanup` khi:

1. report không còn active legacy phone challenge;
2. mọi frontend consumer canonical đã được kiểm bằng source search và telemetry;
3. legacy DPA/verification/upload cohort có quyết định vận hành tường minh;
4. hai release liên tiếp không cần rollback compatibility;
5. OpenAPI deprecation window đã được công bố.

Cleanup không được xóa evidence. Các field legacy chỉ được ngừng đọc trước,
quan sát soak, rồi mới bỏ serializer/schema trong release riêng.
