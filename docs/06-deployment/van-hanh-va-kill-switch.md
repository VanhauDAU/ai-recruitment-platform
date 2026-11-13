# Vận hành, kill switch và lệnh kiểm tra

Tài liệu tham chiếu vận hành cho các cờ rollout, lệnh quản trị và tín hiệu
giám sát còn tồn tại trong code. Biến môi trường chung xem
[`cau-hinh-env.md`](../05-huong-dan/cau-hinh-env.md); dịch vụ Docker xem
[`docker-compose.md`](./docker-compose.md).

## Nguyên tắc chung

- Cờ backend đọc từ env lúc khởi động (`backend/config/settings/base.py`). Đổi
  cờ phải rolling restart process liên quan (web, `worker`, `ai-worker`).
- Biến `VITE_*` được nhúng lúc build; đổi phải build và deploy lại frontend.
- `production.py` gom lỗi cấu hình và raise `ImproperlyConfigured` một lần: cấu
  hình sai làm process không khởi động thay vì chạy ở trạng thái nửa vời.
- Rollback ưu tiên tắt cờ hoặc rollback code. Không reverse migration, không
  xóa audit/revision/evidence/transition và không dùng SQL để sửa trạng thái
  nghiệp vụ (job, campaign, account).
- Lệnh audit/preflight mặc định chỉ đọc. Lệnh có `--apply`/`--repair`/
  `--confirm` chỉ chạy sau khi người vận hành duyệt báo cáo dry-run và có backup.
- Trên máy dev, chạy `manage.py` qua `docker compose exec backend ...` để vào
  đúng PostgreSQL của stack.
- Các kiểm soát IDOR, tải file private/quarantine, quyết định xác thực cuối của
  admin và guard trạng thái tài khoản luôn fail-closed, không có kill switch.

Metric sản phẩm ghi qua `common.metrics.record_metric` vào logger
`product.metrics`, chỉ có tag enum/bucket; không chứa PII, raw input, token,
URL hay error message.

## Bảng tổng hợp cờ

| Cờ | Nơi | Mặc định | Giá trị an toàn khi sự cố |
| --- | --- | --- | --- |
| `DJANGO_ADMIN_ENABLED` | backend env | `DEBUG` | `False` (production bắt buộc) |
| `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES` | backend env | rỗng | rỗng hoặc bỏ surface lỗi |
| `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES` | frontend build | rỗng (= `none`) | `none` |
| `KNOWLEDGEBASE_PUBLIC_ENABLED` | backend env | `not IS_PRODUCTION` | `False` |
| `KNOWLEDGEBASE_SEARCH_INDEX_ENABLED` | backend env | `False` | `False` |
| `UPLOAD_QUARANTINE_ENABLED` | backend env | `False` | giữ `True` nếu đã bật; xem mục upload |
| `EMPLOYER_UPLOAD_SESSION_REQUIRED` | backend env | `False` | `False` |
| `CANDIDATE_UPLOAD_SESSION_REQUIRED` | backend env | `False` | `False` |
| `EMPLOYER_SMS_OTP_ENABLED` | backend env | `False` | `False` |
| `AI_RUNTIME_ENABLED` | backend env | `not IS_PRODUCTION` | `False` |
| `ai_job_generation_enabled` | Site Setting | `False` | `False` |
| `ai_enabled` | Site Setting | `True` | `False` (tắt import CV bằng AI) |

## Quyền admin và tài khoản

### Lệnh quản trị (`backend/apps/accounts/management/commands`)

| Lệnh | Mục đích |
| --- | --- |
| `sync_admin_permissions [--actor-email]` | Đồng bộ registry permission vào DB. Permission bị bỏ khỏi registry được deprecate, giữ M2M; đưa code cũ trở lại rồi sync sẽ phục hồi grant. Chạy sau mỗi `migrate`. |
| `seed_admin_access [--actor-email] [--assign email:department:role]` | Seed hội tụ phòng ban/chức danh hệ thống (`is_system_managed=True`); bản ghi đã tùy chỉnh qua UI không bị ghi đè. `--assign` bắt buộc `--actor-email`. |
| `check_admin_access_readiness` | Hard gate, exit khác 0 khi admin thường không có membership hiệu lực, membership không sinh permission, primary trỏ vào role/department bị khóa hoặc một user có nhiều primary. Permission deprecated còn gắn role chỉ là warning. Cảnh báo admin có membership chưa bật MFA. |
| `create_admin_user <email> [--actor-email]` | Tạo admin thường, không bypass RBAC. Không dùng `createsuperuser` cho nhân viên. |
| `bootstrap_admin_mfa <email> [--mark-email-verified] [--actor-email] [--no-input]` | Bật email MFA cho admin vừa tạo. `--mark-email-verified` chỉ dùng khi người vận hành kiểm soát hộp thư; automation phải thêm `--no-input`. |
| `export_admin_permissions [--output]` | Xuất contract permission cho frontend (`frontend/src/entities/admin-access/model/admin-permissions.generated.json`) từ registry Python, không cần DB. |
| `purge_deprecated_admin_permissions --confirm [--force]` | Xóa vĩnh viễn permission đã deprecate. Không ghi audit revision. |
| `reconcile_account_status_holds [--apply]` | Đối soát hold của campaign/job với trạng thái tài khoản. `--apply` chỉ thêm `ban_review`/`legacy_lock` (fail-closed), không tự gỡ hold của tài khoản active. |
| `seed_admin_account_demo` | Dữ liệu demo; **không** chạy trên staging/production. |

`seed_admin_access` và `purge_deprecated_admin_permissions` chỉ chạy trong cửa
sổ deploy/maintenance, không đồng thời với thao tác RBAC trên UI.

Trình tự sau khi deploy code có migration `accounts`:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py sync_admin_permissions
docker compose exec backend python manage.py check_admin_access_readiness
docker compose exec backend python manage.py reconcile_account_status_holds
```

### Cấu hình

- `DJANGO_ADMIN_ENABLED`: production fail-fast nếu `True`; khi tắt, `/admin/`
  trả 404. Mọi quản trị đi qua `/admin/app`.
- `ADMIN_FRONTEND_URL`, `ADMIN_INVITATION_PATH` (mặc định
  `/admin/app/invitation`), `ADMIN_PASSWORD_RESET_PATH` (mặc định
  `/admin/app/reset-password`) dựng link trong email mời và đặt lại mật khẩu.
- Worker phải nghe queue `auth-email` (lời mời, reset, thông báo bảo mật,
  `account_status_notice`).

### Quy tắc vận hành còn hiệu lực

- Superuser bypass toàn bộ RBAC. Duy trì tối thiểu hai superuser độc lập có
  TOTP; mã dự phòng cất ngoại tuyến.
- Permission `account.status.ban`, `account.resource_hold.release`,
  `account.email.manage`, `account.mfa.reset` được seed nhưng không gán mặc
  định cho role nào; chỉ superuser dùng cho tới khi có quy trình four-eyes.
- Trang đăng nhập Admin không có "Quên mật khẩu" công khai; reset chỉ qua link
  do workflow quản trị phát hành.
- Khôi phục danh tính (đổi email, reset MFA, gửi reset mật khẩu) và đổi trạng
  thái tài khoản đều theo preview → confirm có lý do/evidence, nghiệp vụ chi tiết
  xem [`flow-audit-2026-07.md`](../02-tong-quan/flow-audit-2026-07.md) và
  [`thiet-ke-database.md`](../03-database/thiet-ke-database.md). Không bao giờ
  mở `BANNED → ACTIVE` trực tiếp: phải qua `INACTIVE`, gỡ hold, rồi mở lại.
- Break-glass khi mất toàn bộ superuser: người có quyền máy chủ chạy
  `createsuperuser` rồi `bootstrap_admin_mfa <email> --mark-email-verified
  --no-input`; ghi ticket, kiểm tra audit `bootstrap_mfa`, bổ sung superuser dự
  phòng. Không sửa password hash trực tiếp.

### Rollback

- Rollback code, không reverse migration, không xóa permission/scope/invitation
  hoặc transition. Permission bị gỡ khỏi registry phục hồi bằng
  `sync_admin_permissions` sau khi đưa code trở lại.
- Trước khi chạy worker cũ không hiểu `account_status_notice`, drain hoặc
  cancel có kiểm soát các job outbox pending loại này.
- Sau rollback chạy `reconcile_account_status_holds` (chỉ đọc) và xác nhận mọi
  account có hold vẫn `is_active=false`.

### Giám sát

- 403 `admin_permission_denied`, 409 `admin_resource_changed`/stale impact,
  400 vi phạm state machine, 403 từ write guard sau khi khóa tài khoản.
- Outbox `AuthEmailJob` theo loại (`admin_invitation`, `email_changed_notice`,
  `mfa_reset_notice`, `account_status_notice`): tỷ lệ `failed`/`cancelled`.
- Số hold `temporary_lock`/`ban_review`/`legacy_lock` theo trạng thái tài khoản.
- Audit có actor, reason/evidence, số ảnh hưởng; không có token, URL reset,
  mật khẩu, MFA secret hay backup code.

## Thông báo đa cổng (announcement)

Bốn surface: `admin_workspace`, `employer_marketing`, `employer_workspace`,
`candidate`. Hai lớp điều khiển độc lập:

- `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES` (backend, CSV): kill switch runtime.
  Surface không có trong danh sách trả `remote_enabled=false`, `items=[]` và
  không query bảng announcement. Production fail-fast nếu chứa surface không
  hợp lệ; backend không nhận `all`/`none`.
- `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES` (frontend build): compatibility gate.
  Nhận danh sách, `all` hoặc `none`/rỗng. Surface không bật hiển thị banner
  legacy; error boundary của strip cũng trả về banner legacy khi render lỗi.

Kill switch remote không tắt nhãn hệ thống do code sở hữu (xác thực email, DPA,
nhắc nhu cầu công việc). Nghiệp vụ và quản trị nội dung xem
[`quan-tri-thong-bao-da-cong.md`](../05-huong-dan/quan-tri-thong-bao-da-cong.md)
và [`dai-thong-bao-da-cong.md`](../08-frontend/dai-thong-bao-da-cong.md).

Lệnh chỉ đọc trước khi mở một surface:

```bash
python manage.py announcement_rollout_preflight --require-live-surface candidate --json
```

`status=error` chặn rollout; báo cáo liệt kê surface bật, nhóm rotation và
critical đang live thiếu `ends_at`. Mở surface theo thứ tự admin → employer
marketing → employer workspace → candidate, bật cả hai lớp cho từng surface.

Rollback:

1. Tắt một surface: bỏ khỏi `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES`, rolling
   restart backend, gọi `GET /api/site/announcements/active/?surface=...` xác
   nhận `remote_enabled=false`. Không cần rebuild frontend, không archive dữ
   liệu.
2. Trả toàn bộ về banner legacy: tắt remote backend, build frontend với
   `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES=none`.

Giám sát: `announcement_feed_latency_ms`, `announcement_runtime`
(`feed_error`, `render_error`, `contract_error`), `announcement_analytics`,
`announcement_event_batch_size`, `announcement_throttle`; HTTP feed 5xx/p95,
admin 403/409, event 429. Throttle của hai endpoint telemetry fail-open khi
cache lỗi và phát `announcement_throttle{event=fail_open,reason=cache_error}`;
dedupe analytics vẫn fail-closed nên aggregate không tăng khi Redis lỗi. Dừng
mở surface mới khi `render_error`/`contract_error` > 0, feed 5xx tăng, p95
vượt khoảng 500 ms kéo dài, hoặc có header overlap/mất nhãn hệ thống.

## CV Builder và import CV

Không có cờ rollout riêng. Điều kiện vận hành:

- Worker nghe queue `cv-export` (thumbnail, export PDF, import). Worker cần
  quyền ghi media và cache Fontconfig (`XDG_CACHE_HOME`) cho WeasyPrint.
- Beat chạy `dispatch-pending-cv-export-jobs`, `dispatch-pending-cv-import-jobs`
  (60 giây) và `purge-expired-cv-import-sources` (hằng ngày, theo
  `CV_IMPORT_SOURCE_RETENTION_DAYS`, mặc định 30).
- Import CV bằng AI tắt được qua Site Setting `ai_enabled=false` (job import trả
  `ai_disabled`). Khóa provider đọc từ env (`GEMINI_API_KEY`, …), không lưu DB.
  Chi tiết thuật toán xem [`thuat-toan-ai.md`](../07-algorithms/thuat-toan-ai.md).

Lệnh:

| Lệnh | Mục đích |
| --- | --- |
| `seed_cv_templates [--snapshots]` | Seed mẫu CV, phiên bản publish, taxonomy, màu (idempotent). `--snapshots` xếp hàng render thumbnail, cần worker có PDF engine. |
| `seed_cv_catalog` | Seed taxonomy, màu và nội dung mẫu theo vị trí (idempotent). |
| `cv_snapshot_preflight [--repair]` | Kiểm tra application thiếu snapshot CV. Mặc định chỉ đọc; `--repair` backfill idempotent. |

Rollback: rollback web/frontend về release trước; không reverse migration. Nếu
render/provider lỗi, dừng worker import/snapshot; draft, version cũ và asset
public cũ không bị thay đổi vì pointer chỉ đổi khi asset mới ghi xong. Chính
sách CV hiện là hard-delete; row archive mềm từ dữ liệu cũ không tự purge.

Giám sát: `cv_preview_latency_ms`, `cv_preview_cache_hit`,
`cv_autosave_conflict`, `cv_import_duration_ms`, `cv_import_failure` (tag
`failure_code`; `scanned_pdf_ocr_unavailable` là giới hạn đã biết, không phải
lỗi hệ thống), `cv_snapshot_duration_ms`, `cv_snapshot_failure`, tuổi queue
`cv-export`.

## Nhà tuyển dụng: upload, SMS, DPA

### Cờ

- `UPLOAD_QUARANTINE_ENABLED`: mở upload session dùng chung (quarantine +
  ClamAV). Chỉ bật khi dịch vụ `clamav` (profile `scanner`) sẵn sàng và worker
  nghe `upload-scan`. Production kiểm tra cấu hình upload khi bật.
- `EMPLOYER_UPLOAD_SESSION_REQUIRED`, `CANDIDATE_UPLOAD_SESSION_REQUIRED`: bắt
  buộc upload qua session đã scan `clean`. Production fail-fast nếu bật mà
  quarantine tắt. Bật lần lượt từng domain, không bật cả hai cùng lúc.
- `EMPLOYER_SMS_OTP_ENABLED`: khi `True`, production bắt buộc
  `EMPLOYER_SMS_PROVIDER=http`, endpoint HTTPS, token, sender, template, khóa
  Fernet `EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY` và
  `EMPLOYER_SMS_CHALLENGE_HMAC_KEY` ≥ 32 ký tự, hai khóa không trùng secret khác.
  Worker phải nghe `auth-sms`. Chi tiết:
  [`employer-sms-provider-adapter.md`](./employer-sms-provider-adapter.md).
- `EMPLOYER_EVENT_RETENTION_DAYS` (mặc định 730): audit chặn nếu < 730.

Ranh giới lưu trữ upload xem
[`employer-upload-storage-boundary-runbook.md`](./employer-upload-storage-boundary-runbook.md);
DPA xem [`employer-dpa-evidence-rollout.md`](./employer-dpa-evidence-rollout.md).

### Lệnh (`backend/apps/employers`, `backend/apps/uploads`)

| Lệnh | Mục đích |
| --- | --- |
| `audit_employer_workflow_rollout [--strict] [--probe-scanner] [--json]` | Báo cáo readiness chỉ đọc, không PII: cờ, cấu hình SMS, DPA policy, route queue, beat schedule (scan upload, dọn session, SMS recovery/purge, thông báo xác thực, retention event), retention và schema. `--strict` biến cờ chưa bật và scanner chưa probe thành blocker. |
| `check_upload_scanner_readiness [--json]` | Probe scanner, không lộ endpoint/version. |
| `check_employer_sms_readiness [--require-enabled]` | Kiểm cấu hình SMS, không gửi tin. |
| `rollout_employer_dpa_compliance --phase ... --rollout-id ... [--apply] [--batch-size] [--cursor]` | Ân hạn DPA hoặc áp hold DPA hết hạn; dry-run mặc định, `--rollout-id` bất biến. |
| `classify_legacy_employer_verifications [--apply] [--batch-size] [--case-cursor] [--company-cursor]` | Phân loại cohort xác thực legacy; dry-run mặc định. |
| `reconcile_employer_verifications` | Kiểm tương thích; không tự duyệt (quyết định cuối luôn do admin). |

### Rollback

- Tắt strict flag của domain vừa bật; giữ quarantine và ranh giới phân quyền.
- Scanner lỗi: dừng nhận upload mới, session giữ trạng thái có thể retry;
  không chuyển file sang `clean` thủ công.
- SMS lỗi: `EMPLOYER_SMS_OTP_ENABLED=False`; challenge mới fail-closed, không
  bật lại OTP email legacy.
- DPA: dừng batch; chỉ gỡ đúng hold DPA theo quy trình duyệt, không gỡ hold
  xác thực/tài khoản/kiểm duyệt.
- Sau rollback code chạy lại `audit_employer_workflow_rollout`.

### Giám sát

`upload_scan_result`, `upload_scan_duration_ms`, `upload_session_state`,
`employer_sms_dispatch`, `employer_sms_recovery`, `employer_sms_retention`,
`employer_notification_event`, `employer_notification_retention`. Dừng khi
scanner readiness fail, tuổi queue `upload-scan`/`auth-sms` tăng liên tục, tỷ lệ
scan error/provider retry tăng đột biến, hoặc tin công khai vẫn hiện khi có hold.

## Trung tâm trợ giúp (knowledgebase)

- `KNOWLEDGEBASE_PUBLIC_ENABLED`: mở API `/api/knowledgebase/`, SEO shell
  `/tro-giup` và entry point frontend.
- `KNOWLEDGEBASE_SEARCH_INDEX_ENABLED`: cho phép `index, follow` và đưa
  `/sitemaps/knowledgebase.xml` vào sitemap index. Không vượt được public
  switch hay Site Setting `seo_robots_index`.

Frontend không có env flag riêng; nó đọc `knowledgebase_public_enabled` và
`knowledgebase_search_index_enabled` (đã AND với public switch) từ
`GET /api/site/settings/`. Đặc tả nghiệp vụ xem
[`dac-ta-trung-tam-tro-giup.md`](../01-phan-tich/dac-ta-trung-tam-tro-giup.md).

Gate trước khi bật:

```bash
python manage.py check_knowledgebase_readiness --json
```

Chỉ tiếp tục khi exit 0 và `ready=true` (đủ category active, không có bài quá
hạn review, link nội bộ lạ, metadata thiếu hay media/alt lỗi). Thứ tự bật:
public (index tắt) → smoke → index.

Rollback theo thứ tự giảm ảnh hưởng: tắt index trước (trở lại `noindex`, gỡ
sitemap), sau đó tắt public nếu cần (API và `/tro-giup` trả 404/`noindex`).
Admin workspace vẫn hoạt động, nội dung và revision không đổi; bật lại trả về
đúng dữ liệu cũ. Phải tắt index ngay khi lộ draft hoặc canonical sai.

Giám sát: `knowledgebase_public_request`, `knowledgebase_public_latency_ms`,
error status, search `result_bucket=zero`. Chưa có ngưỡng cứng; đặt alert theo
baseline production.

## AI tạo tin tuyển dụng

Kiến trúc xem [`ai-job-post-generation.md`](../07-algorithms/ai-job-post-generation.md)
và [`thuat-toan-ai.md`](../07-algorithms/thuat-toan-ai.md).

### Hai lớp switch

- `AI_RUNTIME_ENABLED` (env): hard switch của toàn bộ runtime `ai_core`; Site
  Setting không vượt qua được.
- Site Setting tab AI: `ai_job_generation_enabled` (soft switch),
  `ai_job_generation_model`, `ai_job_generation_model_allowlist` (chỉ thu hẹp
  env allowlist), `ai_job_generation_daily_limit` (không vượt env cap),
  `ai_job_generation_rollout_percent` (0–100, bucket ổn định theo SHA-256
  `public_id` công ty), `ai_job_generation_company_allowlist` (xét trước tỷ lệ).
  Policy được cache `AI_POLICY_CACHE_SECONDS` (mặc định 60).

### Biến môi trường và ràng buộc production

| Biến | Mặc định | Production |
| --- | --- | --- |
| `AI_PROVIDER_BACKEND` | `gemini_developer` | `gemini_developer` hoặc `vertex`; không fallback |
| `AI_JOB_GENERATION_MODEL` / `_MODEL_ALLOWLIST` | `gemini-3.5-flash-lite` | model phải nằm trong allowlist |
| `AI_JOB_GENERATION_DAILY_LIMIT` | 10 | > 0 |
| `AI_JOB_GENERATION_LEASE_SECONDS` | 85 | đúng 85 |
| `AI_JOB_GENERATION_CONTENT_RETENTION_DAYS` | 90 | đúng 90 |
| `AI_INVOCATION_METADATA_RETENTION_DAYS` | 365 | đúng 365 |
| `AI_PROVIDER_TIMEOUT_SECONDS` | 40 | (0, 40] |
| `AI_PROVIDER_MAX_ATTEMPTS` | 2 | 1 hoặc 2 |
| `AI_PROVIDER_RETRY_BASE_SECONDS` | 0.5 | (0, 5] |
| `AI_MODEL_PRICING_USD` | `{}` | khi bật runtime phải có giá input/output cho model đang dùng |
| `GEMINI_API_KEY` | rỗng | bắt buộc với `gemini_developer` |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | rỗng / `global` | bắt buộc với `vertex` (credential qua ADC/service account) |

Secret không đưa vào Site Setting, frontend, log hay ticket.

### Worker và lịch

- `ai-worker` chỉ nghe queue `ai-generation`, concurrency 2.
- Beat: `recover-stale-job-ai-generations` (5 giây),
  `purge-expired-job-ai-generation-content` và
  `purge-expired-ai-runtime-metadata` (hằng ngày).
- Throttle tạo mới `ai_job_generation` 3/phút; quota theo NTD/ngày, retry nội
  bộ cùng generation không trừ lượt.

### Rollback và sự cố

1. Dừng use case: `ai_job_generation_enabled=false`.
2. Nghi lộ dữ liệu/credential: thêm `AI_RUNTIME_ENABLED=False`, rolling restart
   backend và `ai-worker`; nếu provider nguy hiểm, dừng `ai-worker` sau khi tắt
   hard switch.
3. Xác nhận tạo mới trả 503 `job_ai_generation_disabled`, generation đang poll
   đi tới trạng thái terminal, form nhập tay vẫn lưu nháp được.
4. Rotate/revoke credential nếu có khả năng lộ. Không xóa row, không reverse
   migration; retention chạy theo lịch.

### Giám sát

Không có metric `product.metrics` riêng; nguồn quan sát là `AiInvocation`,
`AiUsageDaily` và `GET /api/ai/admin/overview/` (quyền `site_setting.view`):
số lượt, thành công/thất bại, retry, quota rejection, token, chi phí ước tính,
p95 latency. Theo dõi thêm tuổi queue `ai-generation` và số stale recovery.
Dừng rollout khi có PII outbound, trường cấm bị điền, taxonomy ID không tồn
tại, truy cập chéo tenant, generation không terminal trong 90 giây, hoặc chi
phí/latency vượt mục tiêu đã duyệt.
