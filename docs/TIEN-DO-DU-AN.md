# Tiến độ dự án

## Epic rà soát và hardening cổng Nhà tuyển dụng (ER, 2026-08-10)

Đặc tả canonical:
[`ke-hoach-ra-soat-va-khac-phuc-employer.md`](03-database/ke-hoach-ra-soat-va-khac-phuc-employer.md).
Decision log:
[`employer-remediation-decision-log.md`](02-tong-quan/employer-remediation-decision-log.md).

> Cập nhật lần cuối: 2026-08-10 — ER-2 và ER-5 verified; corrective UX, luồng
> resubmit/review lại và policy ba final rejection đã đạt gate; ER-3 đã hoàn tất employer
> domain/frontend upload-session; candidate import/assets đã code-complete,
> PostgreSQL Docker và real ClamAV local gate đạt; còn Chrome branch QA và
> production-like staging/strict rollout;
> ER-4 đã hoàn tất lifecycle V2, revision/event bất biến,
> exact-object final review và conflict handling; ER-6B evidence/grace/hold đã
> Verified; ER-6A live SMS đã code-complete và đạt targeted gate, activation
> gateway production thuộc ER-8.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| ER-0 | Audit baseline, permission/state matrix và khóa quyết định | ✅ Hoàn tất |
| ER-1 | Empty/error state, document IDOR và job approval guard | ✅ Hoàn tất |
| ER-2 | Readiness/permission contract và frontend guards | ✅ Hoàn tất |
| ER-3 | Upload session, quarantine, malware scan và retention | 🟨 Đang làm — Docker/ClamAV local đạt; còn Chrome + staging/strict rollout |
| ER-4 | Company update request V2, revision và conflict handling | ✅ Hoàn tất |
| ER-5 | Verification final decision, blockers và compliance holds | ✅ Hoàn tất |
| ER-6 | SMS provider adapter và DPA evidence/version/grace | ✅ Hoàn tất code — production SMS activation thuộc ER-8 |
| ER-7 | Company unlink, notification center và activity | ✅ Hoàn tất code |
| ER-8 | Rollout, reconciliation, compatibility cleanup và audit closure | ⬜ Chưa làm |

### Corrective UX 2026-08-10

- GPKD/DPA dùng document scope cá nhân và summary chỉ phản ánh file current đang
  hiển thị; Google employer login giữ contrast an toàn dưới stale dark theme.
- Known-denied job/campaign/application route điều hướng về trang
  `employer-verify`; lỗi readiness vẫn retry fail-closed.
- Trang verify bỏ hai banner readiness/case status trùng checklist.
- Company settings không tải/render history `scope=company`, chỉ hiển thị yêu
  cầu của actor. Form không gửi/toast thành công khi diff rỗng, có nút quay lại,
  và không kéo tên thương mại legacy chưa sửa vào update request.
- Evidence: 25/25 targeted unit/component; 6/6 smoke trên desktop/tablet/mobile;
  full coverage 253/253 file và 958/958 test; edge regression cuối chạy lại
  17/17. Oxlint không lỗi, architecture, production build, bundle budget và
  Markdown link gate đều đạt.
- Corrective ER-D46: 19/19 unit/component, 6/6 smoke desktop/tablet/mobile và
  full coverage 253/253 file, 961/961 test. Oxlint không lỗi; architecture
  1142 module/2293 dependency, production build và bundle budget
  JS 299,9/320 KiB, CSS 34,4/35 KiB đều đạt.

<details>
<summary>Ghi chú ER-0</summary>

- Chủ dự án đã xác nhận ngày 2026-08-10: một active request/requester/company;
  nhiều requester được gửi song song; conflict không partial apply; DPA cũ là
  `legacy_unversioned` với block/grace đã mô tả trong đặc tả.
- Xác nhận `dev` là integration branch, `dev → main` là release flow và CI cần
  chạy cho Pull Request vào `dev`.
- Account phone cũ giữ nguyên; account mới/change/reverify chuyển sang SMS.
- Baseline audit ghi finding trước remediation; chưa có finding nào được đánh
  dấu đóng và chưa tuyên bố test code đã đạt trong ER-0.
- Gate ER-0: Markdown link check kiểm 189 internal destination trên 64 file và
  `git diff --check` đều đạt.

</details>

<details>
<summary>Ghi chú ER-7</summary>

- Company recovery chỉ mở cho permission
  `employer_verification.unlink_company`, không grant mặc định.
- Impact preview/confirm ký số và fail stale; chỉ member chưa phát sinh dữ liệu
  nghiệp vụ được unlink. Company/proof/history không bị xóa hoặc chuyển sang
  company mới; action có link event append-only và admin audit.
- Company recovery đạt 4/4 backend trên PostgreSQL Docker và frontend 8/8.
  Notification/activity có event idempotent + metadata allowlist, list/unread/
  read-one/read-all, deep-link, bell/popover, hai trang responsive, email outbox
  sweep và retention 730 ngày. Regression tích hợp backend 40/40, frontend
  targeted 16/16, smoke desktop/tablet/mobile 3/3 và full coverage 1009/1009;
  migration drift sạch.

</details>

<details>
<summary>Ghi chú ER-4</summary>

- Safety slice `fix/employer-company-request-review-safety` đã chuẩn hóa lock
  order `Company → CompanyUpdateRequest → CompanyDocument` cho các mutation
  hiện hành và khóa Django admin thành read-only cho ba model này.
- Admin queue truyền exact `request.public_id`; detail gọi
  `GET /api/admin/company-update-requests/{public_id}/` và fail-closed nếu
  requester/company/status không khớp, không còn duyệt mù `results[0]`.
- User chỉ có `company_update.view` nhận metadata tài liệu đã che; binary vẫn
  cần thêm `account.sensitive.view`. Deep-link dùng query
  `company_update=cur_*`, không suy request từ company.
- Evidence: backend 108/108, frontend 10/10; scoped Ruff/format,
  import-linter, layering, Django check, migration drift, lint và architecture
  đạt. Merge `ddb8a47f` giữ nguyên thay đổi local của người dùng.
- Lifecycle V2 bổ sung revision snapshot bất biến, event append-only, base field
  snapshot, exact current revision và state
  `submitted/in_review/changes_requested/approved/rejected/withdrawn/cancelled`.
- Admin phải nhận review trước khi duyệt tài liệu/quyết định cuối; recruiter
  sửa/gửi lại/rút trước review, owner hủy trước review. Apply chỉ conflict các
  field thay đổi đồng thời và không ghi partial.
- Employer page chỉ tải `scope=mine`, không hiển thị lịch sử công ty; diff rỗng
  không được gửi, tên thương mại legacy không bị thêm ngoài ý muốn và form luôn
  có nút quay lại.
- Migrations `employers.0037` (schema) và `0038` (backfill) chạy riêng; backfill
  giữ requester, tạo revision 1/event migrated và không gọi storage/provider/
  Celery. Gate chạy trên PostgreSQL Docker `127.0.0.1:5433`.
- Evidence cuối: backend employer 237/237; Ruff/format, import-linter 863 file/
  1622 dependency, layering, Django/migration drift đạt. Frontend 256/256 file,
  985/985 test; lint/architecture 1148 module/2308 dependency/build/bundle
  budget đạt; company/admin smoke 15/15 trên ba viewport. OpenAPI contract,
  198 Markdown links và Chrome visual QA tab Xác thực admin đều đạt.

</details>

<details>
<summary>Ghi chú ER-5</summary>

- Backend đã tách document review khỏi final decision; prerequisite mutation
  không tự approve case/company. Decision/revoke/expire bắt buộc preview rồi
  confirm bằng signed impact token và recompute dưới lock.
- Thêm `revoked`/`expired`, reapprove event, tax advisory override có quyền/lý
  do riêng, verification compliance hold theo source và public-job fail closed.
  Company không bị downgrade; workspace/tạo/sửa/gửi tin vẫn mở.
- Migration `accounts.0023` chỉ seed permission, không grant mặc định;
  `employers.0034` thêm state/hold schema. Legacy classifier dry-run mặc định,
  không bịa actor/decision và không tự reset/hold cohort cũ.
- Docker PostgreSQL `127.0.0.1:5433`: 235 test unaffected đạt, expectation auto
  approve legacy được đảo và regression mới đạt 1/1. Query budget 4/5/7,
  Ruff/format, import-linter, layering, Django/migration/OpenAPI, permission
  registry, frontend lint/architecture và Markdown gate đều đạt.
- Frontend admin đã consume impact trước confirm cho final decision và
  revoke/expire, hiện company/resource/capability impact, bắt reason cho tax
  override/lifecycle và reload fail-closed khi impact stale.
- Job moderation giữ approve disabled theo blocker canonical; deep-link exact
  recruiter verification chỉ hiện khi actor có quyền màn đích, không parse
  message backend.
- Evidence frontend sau sync dev: 17/17 targeted; full coverage 255/255 file,
  971/971 test; smoke 6/6 desktop/tablet/mobile; Oxlint, architecture 1.146
  module/2.301 dependency, build và bundle budget JS 299,9/320 KiB, CSS
  34,4/35 KiB đều đạt. ER-5 được đánh dấu `Verified`.
- Corrective resubmit giữ cùng case: recruiter thay đủ bộ current document cần
  sửa thì case về `pending`, `revision++`; admin có **Nhận xử lý lại**, document
  review và final decision mới. Chỉ final `rejected` tăng count; lần thứ ba
  khóa nộp lại, không tự ban tài khoản. Unlock là permission riêng, cần reason
  + lock version và không xóa lịch sử.
- Evidence corrective: PostgreSQL Docker `127.0.0.1:5433` đạt 138/138 backend
  state/API regression; migration drift sạch và plan đúng
  `accounts.0024`/`employers.0036`. Frontend full coverage 256/256 file,
  983/983 test; smoke tab Xác thực 3/3 desktop/tablet/mobile; lint,
  architecture 1.148 module/2.306 dependency và production build đạt. OpenAPI
  parse 1.544 local schema reference/0 unresolved; Markdown 196 internal link.

</details>

<details>
<summary>Ghi chú ER-3</summary>

- Slice `fix/media-storage-boundaries` tách public/private/quarantine cho local
  và R2, khóa direct URL/private media serving, thêm công cụ copy legacy
  idempotent batch/cursor và vô hiệu raw Office preview trước scan.
- Shared core merge `99b34781` thêm upload-session state machine, owner-scoped
  API, purpose/role capability, owner-row transactional quota, ClamAV INSTREAM
  adapter và queue `upload-scan`, clean-only expected-purpose claim, explicit
  release, retention/legal hold, privacy scrub và bounded DOCX ZIP validation.
- Evidence chạy trên PostgreSQL Docker 16.14 của repo tại
  `127.0.0.1:5433 → container:5432`: 83/83 targeted test đạt, gồm ba concurrency
  regression và regression Compose worker giữ cả `auth-sms` lẫn `upload-scan`.
  Ruff/format, import-linter 2/2, Django check, migration drift, static OpenAPI
  1.492 reference/0 unresolved và production Compose render đều đạt trong phạm
  vi slice. Generated OpenAPI vẫn có baseline 416 warning/122 error ngoài ER-3.
- Commit `ec1ac428` đã nối core vào verification, company update, DPA và
  logo/cover/gallery. Frontend pre-scan cả tập file trước business submit, poll
  state/retry bounded, attach tuần tự và không còn báo thành công khi upload một
  phần lỗi. Backend recheck owner/purpose/clean/claim, liên kết business object
  với `UploadAsset`, parse strict PDF và verify ảnh sau scan; file clean nhưng
  hỏng cấu trúc bị reject trong transaction.
- Gate slice employer trên PostgreSQL Docker 16 tại `127.0.0.1:5433`: backend
  283/283; frontend targeted 48/48, full coverage 256 file/974 test, upload smoke
  3/3 desktop/tablet/mobile. Ruff/format, import-linter 2/2, Django check,
  migration drift, Oxlint, architecture, build và bundle budget đều xanh.
- Slice `feature/candidate-upload-quarantine` đã nối import PDF/DOCX có/không
  template và avatar vào purpose `candidate_cv`. Parser/Pillow chỉ chạy sau
  clean claim; delete/expiry release claim nhưng giữ evidence 730 ngày; frontend
  library/template/application/avatar chờ scan và chỉ fallback raw khi pipeline
  tắt bằng exact machine code.
- Candidate frontend/static gate: targeted 23/23, full coverage 256 file/988
  test, lint, architecture 1.148 module/2.312 dependency, build, bundle budget,
  Ruff/format, compile, Django check, migration drift và import-linter đều đạt.
- PostgreSQL Docker 16 tại `127.0.0.1:5433` đạt 68 shared/candidate upload
  regression (2 real-scanner test skip mặc định); migration drift sạch. Real
  ClamAV profile đạt readiness, clean,
  EICAR, outage và 2/2 integration pipeline. Phase còn mở Chrome branch QA vì
  Vite local chưa có reCAPTCHA site key; không bypass captcha.

</details>

<details>
<summary>Ghi chú ER-6</summary>

- ER-6A foundation đã merge provider-neutral adapter, challenge purpose/state,
  queue `auth-sms`, bounded retry/recovery, retention, redacted event/metric và
  production readiness validation. Runbook:
  [`employer-sms-provider-adapter.md`](06-deployment/employer-sms-provider-adapter.md).
- Production vẫn giữ `EMPLOYER_SMS_OTP_ENABLED=False` và fail closed cho tới khi
  chọn provider/sender/template. Live endpoint, frontend và OpenAPI đã chuyển
  sang exact SMS challenge; không còn email fallback hoặc availability oracle.
- Migration giữ nguyên phone proof hiện hữu: không marker, deadline, hold hay
  backfill proof cho account cũ. ER-6B vẫn phải nhận diện DPA cũ mà không bịa
  version/hash/IP/session.
- Evidence code: `d58ad837`, `78f12be2`, `72468831`, `201e2829`; merge
  `03ac8640`. Trên nhánh triển khai, 181 employer tests đạt, gồm 22 SMS tests và
  3 migration tests; sau merge, ma trận SMS + migration đạt 25/25. Full Ruff,
  format, import-linter, layering, Django check, migration drift, docs và
  rendered Compose đều đạt.
- ER-6B đã hoàn tất evidence append-only, grace đúng 30 ngày, expired DPA hold,
  campaign/job linkage và exact-source release khi re-consent. Command rollout
  dry-run mặc định, có batch/cursor và không tự apply dữ liệu thật.
- Evidence ER-6B cuối: PostgreSQL Docker `127.0.0.1:5433` đạt 248/248 employer;
  frontend 257/257 file và 994/994 test; Ruff/format, import-linter, layering,
  Django check, migration drift, architecture, build và bundle budget đạt.
- Live workflow account mới/change/reverify đã hoàn tất: challenge actor-bound,
  poll redacted, cooldown, TTL, năm lần sai, replay protection và employer
  profile PATCH bypass đều có regression. PostgreSQL Docker đạt 85/85 targeted
  backend; frontend 21/21 targeted; static gate đạt.
- Residual vận hành chỉ còn chọn provider/sender/template, sandbox smoke và bật
  flag production có giám sát; được theo dõi tại ER-8.

</details>

<details>
<summary>Ghi chú ER-1</summary>

- **ER-1A verified:** thẻ cá nhân chỉ đọc `scope=mine`; corrective ER-D46 bỏ
  consumer `scope=company` khỏi employer page. Không còn ngày/status giả hoặc
  request member khác trong thẻ “Yêu cầu của tôi”. Lỗi initial/background query
  actor scope hiện retry và khóa create/edit/upload/delete/submit.
- **ER-1C verified:** backend chặn duyệt tin nếu verification case chưa
  `approved` đúng company hoặc DPA chưa hợp lệ; canonical và compatibility API
  cùng dùng một guard và recompute dưới transaction lock.
- **ER-1B verified:** metadata và private binary giấy tờ dùng hai permission
  scope riêng; member khác nhận metadata redacted và content `404`, còn
  uploader/requester và company owner được mở file. Request công ty giới hạn
  một pending/requester/company, giữ `requested_by` bất biến, có `submitted_at`
  và hỗ trợ `scope=mine|company`.
- Evidence ER-1B: commit `609b3e47`; 108 employer test trước đồng bộ và 127
  employer + job-moderation test sau merge `dev`; list budget 4 query;
  Ruff/format/import-linter/Django check/migration drift đạt.
- Evidence ER-1C: 20 moderation/query-budget tests + 1 regression DPA/duplicate
  blocker + 4 frontend tests; Ruff/format/import-linter/migration drift đạt.
- Evidence ER-1A: commit `828a8d0e`; 24/24 unit/API/query-key regression, 9/9
  E2E của ba workflow company settings trên desktop/tablet/mobile; Oxlint không
  lỗi, architecture, production build, Markdown links và whitespace gate đạt.
- ER-1 hoàn tất ở mức `Verified`; release/deploy smoke và audit production vẫn
  thuộc rollout ER-8.

</details>

<details>
<summary>Ghi chú ER-2</summary>

- `/api/employer/me/` trả năm field canonical; `/api/auth/me/` trả
  `employer_job_workspace_ready`. Canonical present thắng legacy; partial,
  malformed và contract tự mâu thuẫn đều fail closed.
- Backend dùng cùng capability policy cho job/campaign mutations và mọi đường
  candidate list/export/status/history/snapshot/asset; recruiter CV asset token
  được audience-bound và luôn live reauthorize.
- Frontend tách `JobWorkspaceGuard` và `CandidateDataGuard`, giữ direct URL khi
  denied, render blocker/retry qua action allowlist, tắt query nhạy cảm và không
  render PII đã cache khi checking/error/denied. Aggregate không chứa danh tính
  vẫn hiển thị.
- Evidence backend: commits `b5a50c45`, `49f11065`, `f1408e43`, `916d2bfb`,
  merge-sync `8e01389e`; 206 integration test và direct/read/query matrix 31/31;
  Ruff/import-linter/layering/migration/query-budget/race gates đạt.
- Evidence frontend: commits `cc4e3085`, `59307148`, `7c97cc7c`, `44da5635`,
  `ab1c003e`, `d84760ba`; coverage gate đạt 253 test file/953 test; readiness
  model có ma trận sáu trạng thái; 9/9 E2E readiness desktop/tablet/mobile;
  Oxlint, architecture 1.142 module/2.293 dependency và build đạt.
- Residual: ER-5 sở hữu post-approval revoke/hold reconciliation; ER-6 sở hữu
  DPA version/hash/IP/session và trạng thái legacy/outdated/grace/hold thật.

</details>

## Cập nhật 2026-08-07 — Tối ưu TTS production Giai đoạn 0–2

- **Giai đoạn 0 hoàn thành về công cụ:** benchmark chính thức đo cache
  miss/hit, ba artifact đồng thời, singleflight mười listener, TTFA/RTF/queue,
  CPU/RAM/cache/rejection và ảnh hưởng Web API. Benchmark thật chưa chạy vì máy
  hiện tại không có model/runtime production; đây vẫn là rollout gate, không
  được coi số minh hoạ trong README là kết quả.
- **Giai đoạn 1 hoàn thành:** hard switch production default off; admission tối
  đa ba generation; status nội bộ có token; policy theo Site Setting, voice/
  style cố định theo surface, quota ngày user/IP fail-closed cho cache miss;
  aggregate `SpeechUsageDaily`; admin overview degraded-safe được compose vào
  tab AI hiện có. Seed idempotent không ghi đè giá trị admin.
- **Giai đoạn 2 hoàn thành:** blog click-to-play với durable R2; chatbot bỏ
  auto-speak/global toggle và điều khiển từng message; onboarding mặc định off;
  interview không có code chờ. Text workflow luôn hoạt động khi TTS disabled,
  hết quota hoặc unavailable. Cache local PCM 24h, WAV/MP3/meta 72h, tối đa
  5 GB; prune ngoài inference path. Artifact lỗi/revision cũ dọn sau 30 ngày.
- Baseline deploy: host 4 vCPU/8 GB, một TTS worker, 2.5 CPU, 2 GB RAM, hai ONNX
  threads, model snapshot + revision pin SHA. Production vẫn **chưa bật**.
- Verify hoàn tất: TTS 17/17; backend 796/796 với coverage 86,21%,
  import-linter, DRF layer, migration drift, Django check và query/regression
  đều đạt; frontend 892/892, lint, architecture, production build và bundle
  budget đều đạt. Smoke TTS cô lập 15/15 trên desktop/tablet/mobile (blog,
  chatbot, onboarding); OpenAPI YAML và link Markdown hợp lệ.
- Full `./scripts/check_all.sh` dừng ở nợ Ruff ngoài phạm vi TTS: import
  `BytesIO` chưa dùng trong `sitecontent/services/announcement_media.py` và hai
  ca `pytest.raises(Exception)` trong
  `sitecontent/tests/test_announcement_visual_theme.py`; format check còn báo
  năm file `sitecontent/blog` có sẵn. Full E2E không được chứng nhận vì Vite/
  Node dev server abort khi tải chunk Ant Design trong lượt chạy song song;
  trước thời điểm abort còn hai smoke admin cũ timeout. Không sửa lan các lỗi
  này trong nhánh TTS.
- Tiếp theo có điều kiện: **Giai đoạn 3** prepared audio onboarding (không có
  placeholder trong nhánh này); **Giai đoạn 4** chạy benchmark trên production,
  quan sát chi phí rồi mới bật hard switch/surface.

## Cập nhật 2026-08-05 — Onboarding gộp thành một cuộc trò chuyện (1.24i)

Phản hồi: onboarding cũ bắt thao tác quá nhiều (trang chào → 5 bước bấm "Tiếp
tục" → màn cá nhân hoá → màn sẵn sàng, 4 màn/8 cú bấm). Nay **toàn bộ nằm trên
một trang duy nhất dưới dạng chat** giữa robot và ứng viên. Backend vẫn không
đổi một dòng: payload `PUT`, cờ `job_preferences_configured`, URL đích giữ nguyên.

- **Bỏ hẳn "Tiếp tục / Quay lại".** Đáp án một lựa chọn (kinh nghiệm, mức lương
  gợi ý) bấm phát gửi luôn; đáp án nhiều lựa chọn gửi bằng nút gửi của ô soạn —
  đó là thao tác vốn có của chat, không phải nút điều hướng. Thay cho "Quay
  lại": bấm **"Sửa"** ngay trên bong bóng đáp án cũ để sửa tại chỗ, không tua
  ngược hội thoại; huỷ thì trả lại giá trị trước đó.
- **Transcript suy ra từ state** (`chat-transcript.js`) chứ không lưu riêng, nên
  sửa một đáp án là bong bóng tương ứng đổi theo và **không tin nhắn nào biến
  mất giữa chừng**. `id` tin nhắn cố định vì đó cũng là khoá `speakOnce` — cuộn
  lại lịch sử không đốt hạn mức TTS.
- **Lỗi cũng là một lượt nói.** Trả lời thiếu thì robot nhắc bằng tin nhắn và
  câu nhắc **ở lại trong lịch sử** (đúng như chat thật); backend từ chối field
  nào thì robot xin lỗi trong hội thoại rồi mở lại đúng ô đó với nút "Gửi lại".
- **Lưu và chốt cũng nằm trong luồng chat:** bong bóng "đang lọc việc làm" kèm
  thanh tiến trình, rồi câu chốt cá nhân hoá + nút đi tới việc làm. Không còn
  chuyển màn. `/onboard-user-setting` redirect về `/onboard-user` để link cũ
  không chết; xoá `OnboardUserSetting`, `PersonalizingScreen`, `ReadyScreen`,
  `OnboardingInterview`, `InterviewMascot`, `use-interview-flow`.
- **Chỉ tin nhắn mới nhất mới đọc và chạy chữ**, tin cũ hiện nguyên văn ngay.
  Giữ nhịp "robot đang gõ" 420ms trước mỗi lượt nói; ô soạn hiện ngay khi bong
  bóng xuất hiện chứ không chờ đọc xong, để không bao giờ có ngõ cụt.
- **Sửa lỗi tự gây:** `aliveRef` chỉ gán ở cleanup nên StrictMode (mount →
  cleanup → mount) tắt cờ vĩnh viễn, câu chốt không bao giờ hiện ở dev. E2E chạy
  trên dev server bắt được, unit test (không bọc StrictMode) thì không.
- **Layout khung chat:** `min-h-0` xuống tận `main` để transcript tự cuộn bên
  trong thay vì đẩy ô soạn xuống dưới mép màn hình; `mt-auto` neo tin nhắn sát
  đáy khi hội thoại còn ngắn; header thu gọn và dải mức lương cuộn ngang ở mobile.

Verify: `npm run lint`, `check:architecture`, 227 file/865 test unit, `build`,
`test:e2e:smoke` 185 pass (desktop + tablet + mobile). Đã soát lại bằng ảnh chụp
thật ở 1280 và 393 cho cả 5 lượt hỏi, màn lưu và màn chốt. `check:bundle-budget`
vẫn đỏ ở Initial CSS như trước thay đổi (35.2 → 35.0 KiB, ngưỡng 35.0) — nợ cũ.

## Cập nhật 2026-08-05 — Robot phỏng vấn onboarding ứng viên (1.24f)

Onboarding ứng viên đổi từ một form 8 trường sang **cuộc phỏng vấn 5 câu do
mascot ProCV dẫn bằng giọng nói**. Tận dụng đúng hai thứ đã có sẵn trong repo mà
onboarding chưa dùng: rig mascot (`shared/ui/mascot`) và TTS tiếng Việt
(`features/speak-text`). **Backend không đổi một dòng** — payload
`PUT /api/candidate/job-preferences/`, cờ `job_preferences_configured` và route
giữ nguyên.

- **`widgets/onboarding-interview` (mới).** Phải là widget vì ghép hai feature
  (`speak-text` + `configure-job-preferences`) mà depcruise cấm feature import
  feature. Gồm kịch bản tĩnh, state machine 5 bước, bản đồ trạng thái mascot và
  provider giọng đọc.
- **Provider giọng đọc mount ở `OnboardingLayout`, không ở page.** AudioContext
  chỉ mở được trong cử chỉ người dùng (nút "Bắt đầu" ở `/onboard-user`), mà page
  unmount là `useSpeak` destroy player — đặt trong page thì sang bước phỏng vấn
  robot sẽ câm. Robot đọc ngay, không có nút "bật tiếng"; trường hợp vào thẳng
  URL thì listener một lần resume audio ở thao tác đầu tiên bất kỳ.
- **Pose `checklist` (mới)** nối bộ tay `arms/hold` + `props/robot-prop-checklist`
  đang bỏ trống. `ProcvMascot` nay đỡ được **hai** bàn tay trước (`front` dạng
  mảng); pose `microphone` một tay chạy y cũ.
- **Sửa lỗi rig có sẵn:** khi `talking`, lớp miệng theo emotion không bị ẩn nên
  hai khẩu hình chồng nhau (rõ nhất ở `success`). Nay dùng cặp animation nghịch
  đảo như mắt chớp, kèm nhịp nói chia không đều cho tự nhiên hơn.
- **Không cắt lời robot:** `PersonalizingScreen` và `ReadyScreen` chỉ chuyển
  tiếp sau khi mascot báo đã nói dứt câu (có chốt chặn 9s/14s phòng audio treo).
- **Tách model dùng chung khỏi `JobPreferencesForm`** (`job-preferences-fields`,
  `use-job-preference-catalog`, `save-job-preferences`) để phỏng vấn và form
  settings dùng chung một bộ validate/submit/map lỗi field; xoá nhánh
  `variant="onboarding"` đã chết. Chuyển `use-progressive-reply` lên
  `shared/hooks` cho cả trợ lý lẫn onboarding dùng.
- **Sửa lỗi tự gây:** effect đồng bộ `preference` trong `useInterviewFlow` gây
  vòng lặp render vô tận khi prop là object dựng mới mỗi render — bỏ hẳn effect
  vì page đã chờ tải xong mới mount widget.

Verify: `npm run lint`, `check:architecture`, 224 file/847 test unit, `build`,
E2E smoke onboarding desktop + mobile xanh; đã xem lại bằng ảnh chụp thật cả
desktop 1280 và mobile 393 cho toàn bộ 5 bước, màn lỗi và màn kết.

## Cập nhật 2026-07-30 — Kiểm toán luồng xác thực nhà tuyển dụng

Rà soát toàn bộ luồng auth NTD theo từng lớp; mỗi lỗi được chứng minh bằng test
đỏ trước khi vá. Test kiểm toán:
`backend/apps/accounts/tests/test_employer_auth_audit.py`,
`frontend/src/shared/api/client.test.js`.

- ✅ **Nghiêm trọng — throttle auth bị vô hiệu từ xa.** `NUM_PROXIES` không được
  cấu hình nên DRF lấy nguyên chuỗi `X-Forwarded-For` làm khoá throttle, còn
  nginx thì nối giá trị client gửi. Đổi header mỗi request là có bucket mới ⇒
  mất sạch giới hạn của login/register/2FA/password-reset. Vá bằng
  `common/client_ip.py` + `common/throttling.ClientIPScopedRateThrottle`, lấy IP
  theo `TRUSTED_PROXY_HOPS` phần tử ngoài cùng bên phải.
- ✅ **Nghiêm trọng — brute-force TOTP/mã dự phòng.** Chỉ OTP email có
  `MAX_VERIFY_ATTEMPTS`; TOTP và backup code không đếm lần sai và challenge
  không chết. Nay ngân sách tính theo challenge, áp cho mọi phương thức.
- ✅ **Chống dò mật khẩu phân tán** (`services/login_guard.py`): backoff mũ theo
  `(email, cổng)`, không khoá cứng để không mở đường DoS khoá tài khoản NTD.
- ✅ **Dùng lại refresh token đã xoay vòng ⇒ thu hồi phiên**, kèm ân hạn
  `AUTH_REFRESH_REUSE_GRACE_SECONDS` cho đua giữa hai tab và bắt buộc chữ ký hợp
  lệ để không ai bịa `sid` thu hồi phiên người khác.
- ✅ **Dò email NTD:** captcha chuyển lên trước `serializer.is_valid()` ở
  `employer/register`, `auth/register`, `password-reset`; đăng nhập luôn băm mật
  khẩu một lần kể cả khi email không tồn tại (timing oracle).
- ✅ **Sửa nhận diện IP của phiên đăng nhập:** trước đây lấy phần tử ĐẦU của
  `X-Forwarded-For` — chính là phần client tự khai — nên IP trong danh sách
  thiết bị giả mạo được.
- ✅ Đăng ký NTD trùng email do đua request trả 400 thay vì 500; thêm throttle
  cho `verify/confirm`, `change-email`, `password-reset/validate`.
- ✅ Frontend: refresh hỏng nay phát `notifySessionExpired` để `SessionProvider`
  dọn state và đưa về login — trước đó guard vẫn giữ người dùng trong workspace
  còn mọi request 401 âm thầm. Interceptor không còn ném `TypeError` với lỗi
  không có `config` (request bị huỷ). `client.js` lần đầu có test.
- ✅ `TRUSTED_PROXY_IPS` thành bắt buộc ở production: thiếu nó thì `REMOTE_ADDR`
  luôn là IP nginx và cả hệ thống dùng chung một bucket throttle.
- ✅ Gate đầy đủ: 666 backend test (coverage 86.32%), 711 frontend test,
  lint/architecture/build/bundle budget và 159 E2E smoke đều xanh.
- ⬜ Còn nợ: hành động bảo mật NTD tự thực hiện (đổi mật khẩu, bật/tắt MFA, thu
  hồi phiên, sinh lại backup code) không để lại audit row vì
  `record_admin_self_action` no-op với user không phải admin. Cần bảng audit
  riêng cho sự kiện bảo mật tài khoản mọi role — quyết định thiết kế + migration,
  tách khỏi lượt vá này.

## Cập nhật 2026-07-29 — Account status enforcement

- ✅ Schema + backfill fail-closed: transition evidence, policy hold campaign/
  job và hai permission mới không grant mặc định.
- ✅ State machine tạm khóa/cấm/khôi phục nhiều bước; không cho
  `BANNED → ACTIVE`, không ghi đè business status.
- ✅ Revoke credential/session, transactional outbox, audit action riêng và
  preview bind role-aware resource snapshot.
- ✅ Canonical public selector (kể cả danh sách việc làm đã lưu) + write guard
  transaction cho job/campaign/application; recruiter khác cùng công ty không
  bị ảnh hưởng.
- ✅ Candidate restriction giữ CV/application snapshot và chỉ cho employer
  chuyển hồ sơ sang từ chối.
- ✅ UI action rõ nghĩa, modal 820px, đối chiếu user, required mark, impact theo
  vai trò, stale re-preview không auto-confirm.
- ✅ Docs thiết kế, rollout/rollback runbook, changelog, permission catalog và
  command `reconcile_account_status_holds`.
- ✅ Full gate `./scripts/check_all.sh`: 633 backend test (coverage 86.25%),
  699 frontend test, lint/architecture/build/bundle budget và 159 E2E smoke
  desktop/tablet/mobile đều xanh.
- ✅ Đối soát DB local sau migrate: 6/6 nhóm mismatch bằng 0; hai permission
  nhạy cảm chưa được grant cho role nào.
- 🟡 Còn bước vận hành ngoài code: rehearsal trên staging từ production
  snapshot, kiểm tra email worker/metrics và phê duyệt rollout theo runbook.

## Cập nhật 2026-07-29 — Xác thực lại OAuth khi đặt mật khẩu lần đầu

- ✅ Backend: `GET /api/auth/password/` trả điều kiện của phiên hiện tại; tách
  `current_session` + `requires_oauth_reauthentication` thành service dùng chung
  để GET và POST không thể lệch luật.
- ✅ Frontend: banner cảnh báo ngay khi mở trang kèm nút xác thực lại với đúng
  provider, quay về đúng trang đang đứng thay vì xoá phiên và đá về `/login`.
- ✅ Áp dụng cho cả cổng ứng viên và nhà tuyển dụng (dùng chung
  `features/change-password`, page truyền `onReauth`).
- ✅ Bổ sung regression backend (5 case) + frontend (4 case) và cập nhật tài
  liệu API, hướng dẫn social login, ARCHITECTURE, CHANGELOG.
- ⬜ Còn lại: `POST /api/auth/change-email/` vẫn dùng thông báo re-auth kiểu cũ,
  chưa có nút xác thực lại tại chỗ.

## Cập nhật 2026-07-29 — UX xác thực nhà tuyển dụng quản trị

- ✅ Đồng nhất badge hàng chờ với danh sách “Cần xử lý”, bao gồm hồ sơ đang
  duyệt và giấy tờ nộp lại; không còn trạng thái badge `1` nhưng bảng rỗng.
- ✅ Sửa warning cell render của Ant Design khi ngày trống.
- ✅ Trang chi tiết mặc định thu gọn hành trình 9 bước, nhóm giấy tờ theo nghiệp
  vụ và giải thích đúng phạm vi đối chiếu MST cho cả owner/member.
- ✅ Bổ sung regression frontend/backend và cập nhật tài liệu luồng.

## Cập nhật 2026-07-26 — Vá reset mật khẩu Admin

- Luồng “Gửi đặt lại mật khẩu” từ Quản lý tài khoản nhận diện đúng `role=admin`:
  email dùng nhãn **Quản trị**, URL `/admin/app/reset-password` và binding
  `portal=admin`; không còn rơi vào template/link Ứng viên.
- API validate/confirm chỉ chấp nhận reset Admin khi token có binding `portal=admin`
  và tài khoản còn `active`. Tài khoản `inactive`/`banned` bị từ chối ở lúc gửi
  lẫn lúc dùng link, tránh mở lại tài khoản bị khóa qua email cũ.
- Frontend có màn reset Admin riêng, hiển thị ngữ cảnh quản trị và quay về trang
  đăng nhập Admin khi link hết hiệu lực. Nút gửi reset ở chi tiết tài khoản bị
  vô hiệu hóa kèm giải thích khi tài khoản không hoạt động.

> Quy ước: mỗi khi hoàn thành một công việc (xong code + test), đổi icon trạng thái ngay trong lần commit đó — không để dồn việc cập nhật lại sau. Tiêu đề trong bảng giữ **ngắn gọn 1 dòng**; ghi chú kỹ thuật chi tiết đặt trong khối `<details>` ở mục "Ghi chú chi tiết" cuối mỗi giai đoạn. Cập nhật dòng "Cập nhật lần cuối" ở cuối file.

Thứ tự giai đoạn theo tài liệu database v1.4 (mục 7), đã đối chiếu với PRD mục 11.

**Trạng thái:** ✅ Done · 🟡 Một phần · ⬜ Chưa làm

## Tổng quan

| Giai đoạn | Tiến độ | Trạng thái |
| --- | --- | --- |
| 0 — Khởi tạo dự án | 5/5 | ✅ Hoàn thành |
| 1 — MVP lõi | 44/46 | 🟡 Còn 1.14 (một phần), 1.15 |
| 2 — AI cơ bản | 0/8 | ⬜ |
| 3 — Tối ưu tìm kiếm / matching | 0/2 | ⬜ |
| 4 — CV nâng cao | 0/2 | ⬜ |
| 5 — Tuyển dụng nâng cao | 1/3 | 🟡 |
| 6 — Thương mại & quản trị | 14/16 | 🟡 |
| 7 — Phỏng vấn AI | 0/4 | ⬜ |
| 8 — Deployment | 0/2 | ⬜ |
| **Tổng** | **64/88 + 1 phần** | |

## Epic FAQ và hướng dẫn sử dụng (KB, 2026-08-05)

Đặc tả canonical:
[FAQ và hướng dẫn sử dụng](./03-database/ke-hoach-faq-huong-dan.md). Triển khai
trên nhánh `codex/feat-faq-help-center`, giữ revision đã publish độc lập với bản
sửa và rollout public qua capability switch.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| KB-P0 | Chốt route, taxonomy, lifecycle, media, RBAC, SEO và rollout | ✅ |
| KB-P1 | Backend foundation: common sanitizer, model/migration, 7 category và permission | ✅ |
| KB-P2 | Workflow, media, admin API, audit và OpenAPI | ✅ |
| KB-P3 | Workspace quản trị, editor, preview, diff và media library | ✅ |
| KB-P4 | Help center public, search, detail và SEO noindex | ✅ |
| KB-P5 | Nội dung đã xác minh và nối các entry point | ✅ |
| KB-P6 | Hardening, observability, sitemap, runbook và rollback rehearsal | ✅ |

## Epic thông báo chạy đa cổng (AN, 2026-07-29)

Thiết kế canonical:
[hệ thống thông báo chạy đa cổng](./03-database/ke-hoach-he-thong-thong-bao-chay.md).
Mỗi phase dùng một nhánh `feature/announcement-*` tuần tự từ `dev`; phase sau
chỉ bắt đầu sau khi phase trước merge và quality gate đạt.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| AN-P0 | Chốt PRD, ERD, lifecycle, priority, API/DTO, ownership, failure mode và rollout | ✅ |
| AN-P1 | Backend foundation: model/revision, permission, selector/service, public/admin API và OpenAPI | ✅ |
| AN-P2 | Runtime strip đa portal, system reminder, animation, accessibility và fail-safe | ✅ |
| AN-P3 | Admin workspace, editor, preview, priority simulator, revision và audit | ✅ |
| AN-P4 | Dismiss/snooze, consent-aware analytics, Redis dedupe và metrics | ✅ |
| AN-P5 | Hardening, kill switch, staging rollout, changelog và runbook | 🟡 Rehearsal cô lập đạt; chờ merge fix + staging thật/soak |
| AN-P6 | Xóa compatibility legacy sau tối thiểu một release ổn định | ⬜ |

## Epic nâng cấp visual thông báo đa cổng (AN-V, 2026-08-06)

Thiết kế:
[ke-hoach-nang-cap-thong-bao-visual-theme.md](./03-database/ke-hoach-nang-cap-thong-bao-visual-theme.md).
Nhánh: `feat/announcement-visual-theme`. Bổ sung **theme màu (kind/preset/custom)**
và **ảnh nền strip** (vd. 980×31) kèm overlay; **responsive** và **preview admin**
là bắt buộc ở phase frontend. Không đổi namespace API, priority tier hay lifecycle.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| AN-V0 | Đặc tả visual, chốt hybrid màu + ảnh/overlay + responsive/preview | ✅ |
| AN-V1 | Backend: migration revision theme/background, validate, DTO public/admin, tests | ✅ |
| AN-V2 | Upload background + form admin + **live preview** desktop/tablet/mobile | ✅ |
| AN-V3 | Runtime strip apply theme/bg, FE contract, responsive touch targets | ✅ |
| AN-V4 | Runbook, seed ví dụ, đồng bộ doc runtime | ⬜ |

## Epic hoàn thiện CV Builder (2026-07-15)

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| CVB-P0 | Canonical composition, regression contract, ADR | ✅ |
| CVB-P1 | Sample/blank live preview | ✅ |
| CVB-P2 | Previous + latest recoverable draft | ✅ |
| CVB-P3 | Locale + canonical blueprint | ✅ |
| CVB-P4 | Admin catalogue + snapshot | ✅ |
| CVB-P5 | AI import PDF/DOCX | ✅ |
| CVB-P6 | Cleanup, rollout, observability | ✅ |
| CVB-8 | WYSIWYG A4 editor, rich text, DnD, asset, PDF parity, fallback flag | ✅ Code + bật mặc định / 🟡 Theo dõi rollout |

Chi tiết: [kế hoạch CV Builder theo giai đoạn](./03-database/ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md).

## Epic dọn dẹp & nâng cấp frontend (2026-07-15, nhánh `refactor/*` stacked trên `feature/cv-builder`)

Audit FSD không có vi phạm layer; ngân sách dồn vào enforcement, quy ước, tách file lớn và server-state. Baseline: 22 E2E smoke, coverage 84.65/67.36/85.33/89.52, bundle 255.7 KiB gzip.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| FE-P1 | Siết enforcement: widget public API (3 `index.js` + sửa deep-import MainLayout), depcruise đọc slice động (vá 7 feature + 2 widget không được bảo vệ) + rule `no-deep-import-widgets`, oxlint thêm exhaustive-deps/no-unused-vars/import-first/no-duplicates/no-cycle (sửa 36 vi phạm) | ✅ |
| FE-P2 | Đồng nhất quy ước: rename 6 hook camelCase → kebab-case, xóa wrapper `session.storage.js`, tài liệu hóa quy ước import trong slice | ✅ |
| FE-P3 | Tách `MyCvs.jsx` 643 dòng → model hook + 3 UI component, mở đầu coverage ratchet | ✅ |
| FE-P4 | Tách `FeaturedIndustriesEmployers` (449) + `MarketStats` (442) | ✅ |
| FE-P5 | TanStack Query: infra → pilot saved-jobs → jobs pages → thu gọn request-deduplication | ✅ |
| FE-P6 | Perf: precompress, WebP logo (favicon + manualChunks đã xong từ trước) | ✅ |

## Epic Audit & Refactor toàn dự án (2026-07-21, nhánh `refactor/phase*`)

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| AR-P0 | Triage nhánh (32→4), đo baseline (coverage FE thật 34%, 170 endpoint, BE 280 test/46s), snapshot OpenAPI, fix `manage.py test` dùng settings test | ✅ |
| AR-P1 | Env fail-fast (client.js prod throw, production.py gom lỗi), check_env_sync + 7 biến bổ sung, ruff 206→0 vi phạm (2 bug F821 thật), Docker Compose dev+prod + nginx, pre-commit, CI thêm ruff/env-sync | ✅ (build image chờ verify khi mở Docker) |
| AR-P2 | 16/16 app layout ADR-0010 (hết views/serializers phẳng), import-linter 2 contract KEPT + layering gate DRF, pytest + coverage BE 85% (gate CI 84%), gỡ 3 vi phạm layer có sẵn | ✅ (tách test lớn + factory-boy dời sang đợt sau) |
| AR-P3 | Xóa 9 endpoint v1 (cvs/cv-templates/applications), port 2 endpoint employer sang /api/v2/recruiter/, xóa api_deprecation + biến LEGACY_*, ma trận migration, e2e smoke 63/63 xanh | ✅ (52 lỗi schema spectacular + squash migrations dời sau) |
| AR-P4 | Audit 3 luồng (doc + sequence diagram): idempotency/transaction/PDF-in-Celery đều đạt; khóa query budget bằng test (job list 5q, application list 5q); ghi nhận 2 nợ email đồng bộ | ✅ |
| AR-P5 | Coverage FE đo toàn src/ (threshold ratchet 33/29/28/35 thay allowlist 11 file), oxlint max-lines 300 (warn, 10 file tồn), tách ApplyForJobModal 609→4 file <300; e2e smoke đã có sẵn trong CI | ✅ (còn 9 file >300 dòng — tách dần theo rule warn) |
| AR-P8 | Nợ cuối: OTP điện thoại ra khỏi request cycle (Celery + on_commit), tách guard chống mất dữ liệu khỏi use-cv-draft-editor, helper make_published_template thay boilerplate 4 app; sửa tài liệu audit ghi sai về email đồng bộ | ✅ |
| AR-P7 | Dọn nợ sau đại tu: Docker chạy thật (bắt 2 bug worker), schema OpenAPI 52 lỗi → 0, tách test accounts 1.611 dòng → 4 module, rút model hook khỏi CvSourcePanel (451→219) | ✅ |
| AR-P6 | README (Docker quickstart + quality gate mới), AGENTS.md thêm phần backend ADR-0010, PR template gates mới, results-2026-07.md (bảng trước/sau + 4 bug + nợ ghi nhận), archive doc refactor cũ | ✅ |

## Epic thiết kế trang chủ (2026-07-16, nhánh `feature/design-home`)

| Mục | Nội dung | Trạng thái |
| --- | --- | --- |
| HOME-CV | Section "Tạo CV ấn tượng" trên trang chủ (giữa FlashBadge và Top ngành nghề): showcase 3 mẫu CV thật từ catalogue xòe quạt desktop / trượt ngang snap mobile, swatch đổi màu preview tại chỗ, badge PREMIUM, link chi tiết `/mau-cv/chi-tiet/:slug`; 4 thẻ tính năng (mẫu đa dạng, autosave, AI import, xuất PDF) + CTA `/mau-cv`. Fetch React Query (stale 5′) + skeleton, ẩn section khi catalogue rỗng; export `CvTemplatePreview` qua public API entity `cv-template`. Data: seed thêm template "Chuyên nghiệp 2 cột" (`classic_two_column_v1`, publish qua service chính thức) — catalogue dev có 3 mẫu | ✅ |

## Epic cổng marketing nhà tuyển dụng (2026-07-18, nhánh `feature/employers-home`)

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| EMP-P1 | Backend `apps.services`: models/API/throttle/cache/seed + migration sửa link footer | ✅ |
| EMP-P2 | i18n VI/EN, layout/header/drawer/footer, form tư vấn, About + Contact | ✅ |
| EMP-P3 | Landing 10 section, Services 5 nhóm, Pricing đọc DB + trạng thái loading/error/empty | ✅ |
| EMP-P4 | Admin CRUD dịch vụ + danh sách/xử lý lead, docs/changelog và smoke desktop/mobile; polish navigation active state và card giá có affordance click/focus | ✅ |
| EMP-P5 | Auth employer riêng: register email/Google, consent, recovery, onboarding + guard dashboard, legal routes, backend/frontend/E2E/docs; khảo sát nhu cầu tư vấn chỉ chọn một mục (API vẫn tương thích mảng một phần tử); giao diện đăng ký theo wizard 01 → 02, responsive desktop/mobile | ✅ |
| EMP-P6 | Employer verify + workspace dashboard: shell `100dvh` theo mẫu quản trị với compliance bar/topbar/sidebar trắng/header route/content cuộn; sidebar có cấp xác thực 0/3–3/3 + popover 3 mốc và desktop icon rail 216px→64px (hover mở tạm, icon lớn/căn giữa; mobile ẩn); dashboard có banner, hành trình xác thực ngang, discovery và CV đề xuất; checklist bỏ email, có OTP + password gate cho OAuth, chọn/tạo công ty rõ ràng, ĐKDN, hai bước DLCN độc lập và khóa tin đầu tiên; route account settings nội bộ, read-model KPI/activity/pipeline/recent data, khóa consulting đã hoàn tất và regression desktop/mobile | ✅ |
| EMP-P7 | Email chào mừng NTD theo nguồn đăng ký: email/password gửi sau verify, Google mới gửi ngay; template riêng + CTA checklist + transactional outbox chống trùng ở DB; login chỉ vào `/employer-verify` khi năm điều kiện xác thực chưa đủ, đã đủ thì vào dashboard/deep-link | ✅ |
| EMP-P8 | Hoàn thiện UX trang GPKD: hai luồng giấy tờ giữ thứ tự radio dọc, minh họa asset local, link hướng dẫn/mẫu mới và Lưu khóa rõ ràng khi workflow persistence chưa bật; regression desktop/mobile | ✅ |
| EMP-P9 | Hoàn thiện trang DLCN: mẫu DOCX local tải được/chỉnh sửa được, một file DOC/DOCX/PDF thay thế được, Lưu + xác nhận inline không phụ thuộc company; sau khi nộp hiển thị toast tiếp nhận, nhãn “Hệ thống đang xử lý”, link xem DOC/DOCX qua Google Docs Viewer và chỉ mở thay tệp bằng Chỉnh sửa/Hủy; thời điểm xác nhận hiển thị đến giây giờ Việt Nam; liên kết/hành động ép màu emerald, checkbox xác nhận nằm thành khối riêng dưới liên kết thay màu mặc định; toast toàn app chuyển sang Sonner (màu/biểu tượng riêng theo trạng thái, render cấp `document.body`, không bị workspace cắt); nộp/thay giấy tờ chỉ cần phiên employer hợp lệ, không bắt MFA/xác thực lại và vẫn luôn chờ admin duyệt; migration `employers.0012` tách quyền sở hữu tài liệu DLCN theo recruiter nhưng đọc tương thích tài liệu company cũ; regression backend/frontend/E2E | ✅ |
| EMP-P10 | Quản lý nhiều nhu cầu tuyển dụng, nguồn ngân sách dùng chung Công ty/Cá nhân, CRUD và responsive desktop/tablet/mobile; migration `employers.0013` | ✅ |
| EMP-P11 | Trang Thông tin công ty đầy đủ: catalogue recent/search 6 mục/trang, option cards, form Doanh nghiệp/Hộ kinh doanh, catalogue server-driven, TipTap rich text sanitize, logo + gallery 10 ảnh, owner/member và update request pháp lý có hồ sơ; catalogue tìm kiếm gọn với nhãn Lưu ý, dòng địa chỉ–quy mô, lĩnh vực một dòng hover và CTA Chọn nhỏ (liên kết có hiệu lực ngay, không modal/hồ sơ/admin duyệt); mọi employer đã có liên kết, gồm record cũ `pending`, có thể tạo yêu cầu cập nhật chờ quản trị viên duyệt; trạng thái đã liên kết bám hierarchy TopCV với dải tạo yêu cầu/cập nhật gần nhất và hồ sơ nhãn–giá trị; form liền mạch, spacing gọn, logo căn giữa, Lĩnh vực chính khóa tới khi chọn lĩnh vực hoạt động và chứng minh Tên thương mại chỉ cho chọn File/Website khi tên thương mại khác tên đăng ký; migration seed lĩnh vực `employers.0014`; regression backend/unit/E2E ba viewport | ✅ |
| EMP-P12 | Workspace tuyển dụng: chiến dịch recruiter-owned, tin nháp/xuất bản tức thì/đóng-mở lại-gia hạn-sao chép, quota 3 lần xuất bản miễn phí trọn đời, public expiry, pipeline 7 trạng thái + snapshot CV/audit lịch sử; chỉ người tạo tin có quyền dữ liệu, ứng viên chỉ thấy timeline đã lọc; migrations `employers.0016`, `jobs.0020`, `applications.0010`, API/frontend/docs/regression | ✅ |

## Epic tái cấu trúc (song song, nhánh `feature/restructuring`)

Theo *Kế hoạch tái cấu trúc ProCV sau merge main (2026-07-12)* — 11 giai đoạn, tăng dần, giữ tương thích.

| GĐ | Nội dung | Trạng thái |
| --- | --- | --- |
| R0 | Khóa baseline: tag `baseline-refactor-start`, quality suite xanh (74 BE + 31 FE test), bundle report, script inventory hotspot | ✅ |
| R1 | CI (frontend/backend workflow + Postgres/Redis), `scripts/check_all.sh` 1 lệnh, 5 ADR, PR template | ✅ |
| R2 | Tách hạ tầng API frontend (`shared/api`): client/tokenStore/errorMapper/pagination/dedup + re-export tương thích + boundary check axios | ✅ |
| R3 | Tái cấu trúc Auth/Account/2FA thành `features/*` | ✅ `features/auth`, `features/account`, `features/two-factor` hoàn chỉnh; giữ re-export tương thích tới R10. Unit 34/34, Accounts 37/37, E2E 12/12, lint/build xanh |
| R4 | App providers, router, guard đơn trách nhiệm | ✅ `AppProviders`, `AppRouter`, Auth/Role/Onboarding guard, loading shell và returnUrl an toàn; OnboardingGuard chờ R9 tích hợp status/route |
| R5 | Pilot Jobs theo lát cắt dọc | 🟡 Tách candidate feature + backend boundary; còn UI CRUD employer |
| R6 | Applications/Saved jobs + server state | 🟡 Feature state/API và transition backend; còn UI nghiệp vụ |
| R7 | Tách Django settings theo môi trường | ✅ base/development/test/production, CI test settings và production validation giữ nguyên |
| R8 | Dọn backend theo hotspot | 🟡 Candidate/CV/CV template có selector/service; Dashboard đã có read-model employer, AI chưa có use case, Sitecontent để lát cắt riêng |
| R9 | Onboarding theo kiến trúc mới | ✅ Form preference dùng chung onboarding/settings, API preference có transaction + consent, responsive modal chọn vị trí, regression desktop/mobile |
| R10 | Cleanup, bundle, tài liệu | ✅ Xóa compatibility layer, CI feature boundary, bundle review và tài liệu |

> Lưu ý: nhánh dựa trên `#23`, cần hòa hợp `origin/main` (`#24`) trước khi merge refactor về `main`.

## Giai đoạn 0 — Khởi tạo dự án

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 0.1 | Chốt công nghệ (ReactJS+Vite, Django+DRF, PostgreSQL, JWT) | ✅ |
| 0.2 | Scaffold Django project + apps skeleton | ✅ |
| 0.3 | Scaffold React + Vite + Tailwind + Ant Design | ✅ |
| 0.4 | Cấu trúc `docs/` theo chủ đề | ✅ |
| 0.5 | README, CHANGELOG, hướng dẫn cài đặt local | ✅ |

## Giai đoạn 1 — MVP lõi

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 1.1 | Bảng `users` (custom User, role, JWT auth) | ✅ |
| 1.2 | Bảng `skills` (nguồn kỹ năng chuẩn, seed data) | ✅ |
| 1.3 | Bảng `candidate_profiles` + API | ✅ |
| 1.4 | Bảng `employer_profiles` + API | ✅ |
| 1.5 | Frontend: trang đăng ký/đăng nhập, dashboard shell theo role | ✅ |
| 1.5b | Xác thực email qua link + Redis (auto-login sau đăng ký, cooldown gửi lại, SMTP provider-agnostic) | ✅ |
| 1.6 | Bảng `job_categories` + API | ✅ |
| 1.6b | Seed taxonomy danh mục 3 cấp (8 nhóm + 24 nghề + 61 vị trí); filter nhận nhiều `?category=` tự mở rộng cấp con | ✅ |
| 1.7 | Bảng `locations` (2 cấp tỉnh/xã, seed 34 tỉnh + 3321 xã/phường) + API tra cứu | ✅ |
| 1.8 | Bảng `cv_templates` + API list/detail | ✅ |
| 1.9 | Bảng `user_cvs` (builder + upload) + API CRUD/upload | ✅ |
| 1.10 | Bảng `cv_skills` (nested trong API user_cvs) | ✅ |
| 1.11 | Bảng `jobs` + API public list/detail + employer CRUD | ✅ |
| 1.12 | Bảng `job_skills` (nested trong API jobs) | ✅ |
| 1.13 | Bảng `applications` + API ứng tuyển/xem/đổi trạng thái | ✅ |
| 1.14 | Frontend cổng ứng viên: xong trang chủ + danh sách/chi tiết job; **còn thiếu CV builder, kho template, luồng ứng tuyển** | 🟡 |
| 1.14b | Redesign trang danh sách việc làm (search xanh, sidebar lọc nâng cao, JobCard mới, sort lương) | ✅ |
| 1.14c | Bộ lọc đầy đủ: kinh nghiệm theo năm, cấp bậc, nghỉ thứ 7, lĩnh vực công ty | ✅ |
| 1.14d | Header tự ẩn khi cuộn, thanh tìm kiếm sticky, chip lọc, URL bộ lọc rút gọn | ✅ |
| 1.14e | Tách `Industry` thành model riêng + M2M (1 công ty nhiều lĩnh vực) | ✅ |
| 1.14f | Skeleton loading toàn diện cho trang việc làm | ✅ |
| 1.14g | Dải "khám phá nhanh" dưới thanh tìm kiếm (thẻ lối tắt + pill) | ✅ |
| 1.14h | Banner thông báo địa danh hành chính mới (sáp nhập 1/7/2025) + filter `?education_level=` | ✅ |
| 1.14i | Dữ liệu sáp nhập tỉnh 2025 (63→34) vào `Location.merged_from` + seed command | ✅ |
| 1.14j | Sửa cuộn ngang dải "khám phá nhanh": bỏ drag tự chế, dùng scroll gốc + nút mũi tên | ✅ |
| 1.14k | Panel "Xem nhanh" job 2 cột (`JobQuickView`, danh sách compact bên trái) | ✅ |
| 1.14l | Header ứng viên sau đăng nhập: chuông + avatar dropdown hover, accordion section | ✅ |
| 1.14m | Responsive mobile toàn site chính (Drawer nav, Drawer lọc, bottom-sheet xem nhanh) | ✅ |
| 1.14n | Tìm kiếm tiếng Việt không dấu/đảo từ (Postgres `unaccent`) + empty-state kiểu TopCV | ✅ |
| 1.14o | Việc làm đã lưu (trang riêng, API `SavedJob`, đồng bộ đa thiết bị) + cụm nút nổi Góp ý/Hỗ trợ | ✅ |
| 1.14p | Phân hạng tin (tier standard/featured/top) + nhãn HOT/GẤP/⚡/✓ xác thực | ✅ |
| 1.14q | Chuẩn hóa schema tin tuyển dụng: danh mục theo vai trò, địa điểm phường/xã, lịch làm việc, quyền lợi, ngoại ngữ, liên hệ nhận hồ sơ | ✅ |
| 1.14r | Trang chi tiết việc làm bản mới: view-model API nhóm sẵn + tag tóm tắt, ngoại ngữ, địa điểm nhóm tỉnh, lịch JSX, sticky anchor động | ✅ |
| 1.15 | Workspace chiến dịch/tin/CV: campaign owner-only, tạo nhanh và chọn hoạt động; tin `nháp → chờ duyệt → đang tuyển|từ chối`, admin bắt buộc nêu lý do, revision quay lại chờ duyệt, quota lifetime và public expiry | ✅ |
| 1.16 | Bảo vệ login/register: rate limit theo IP + Google reCAPTCHA v3 invisible | ✅ |
| 1.17 | Social login Google/Facebook/LinkedIn (OAuth Authorization Code Flow qua backend) | ✅ |
| 1.18 | Ghi nhận `last_login` ở cả 3 luồng phát token (login, đăng ký, social) | ✅ |
| 1.19 | Đặt lại mật khẩu (quên mật khẩu) qua link email + Redis, token một lần | ✅ |
| 1.19b | Email không phân biệt hoa/thường (normalize + `iexact` + unique constraint `Lower(email)`) | ✅ |
| 1.20 | Trang thương hiệu (brand page): URL `/brand/<company>/tuyen-dung/<job>` + header thương hiệu | ✅ |
| 1.21 | Tách công ty khỏi nhà tuyển dụng ([kế hoạch](./03-database/ke-hoach-thiet-ke-lai-cong-ty-nha-tuyen-dung.md)): **Giai đoạn A + B xong** — (A) models `companies`/`company_industries`/`company_images`/`company_documents`/`company_update_requests`/`recruiter_profiles`/`phone_otps` + migration đổ 9 `employer_profiles` sang (gộp theo tax_code, size chuẩn hóa bucket); (B) `jobs` chuyển FK `employer_profile`→`company`, `employer`→`posted_by` (backfill migration 0014–0016), bộ API mới `/api/employer/*` (onboarding 5 bước, OTP SĐT qua email, tạo/tìm/join công ty kèm giấy tờ, update request chờ duyệt). Từ EMP-P12, `posted_by` là tenant nghiệp vụ: tin/hồ sơ không được chia sẻ theo company, và tin hợp lệ xuất bản ngay không qua admin. (C) xóa model + bảng `employer_profiles` (migration `employers.0008`, phụ thuộc `jobs.0016`). | ✅ |
| 1.22 | Khung layout 3 cột trang tài khoản ứng viên `/tai-khoan/*` (sidebar accordion + cột phải hồ sơ + 11 route placeholder) | ✅ |
| 1.23 | Trang "Cài đặt thông tin cá nhân": PATCH `/auth/me/` sửa họ tên + SĐT (nhiều lần), email read-only | ✅ |
| 1.24 | Onboarding và cài đặt gợi ý việc làm: form preference dùng chung, giới tính tại settings, modal chọn vị trí responsive, feedback validation/toast và sidebar hồ sơ sticky | ✅ |
| 1.24b | Kết thúc onboarding kiểu TopCV: màn "đang cá nhân hoá" (progress) → màn "đã sẵn sàng" (đếm ngược + nút đi ngay; từ 1.24f đồng hồ chỉ chạy sau khi robot nói dứt câu) → redirect `/viec-lam` với bộ lọc dựng từ preference (`cat` + `search` + `locations` + path `/tai/<slug>`) | ✅ |
| 1.24f | Robot phỏng vấn onboarding: tách form 8 trường thành 5 câu hỏi do mascot dẫn bằng giọng nói tiếng Việt (VieNeu-TTS), phụ đề chạy theo audio, mascot đổi emotion/pose theo ngữ cảnh (`microphone` khi nói, `checklist` mới khi chờ trả lời, `error`/`success`/`thinking`), câu chốt cá nhân hoá từ nhu cầu vừa lưu; payload `PUT` và cờ `job_preferences_configured` giữ nguyên | ✅ |
| 1.24c | Empty state trang việc làm kiểu TopCV: dưới "Rất tiếc..." hiện banner admin cấu hình (placement `job_empty`) + khối "Việc làm có thể bạn sẽ quan tâm" gợi ý theo preference đã lưu, nới lỏng 3 tầng | ✅ |
| 1.24d | Bổ sung trang việc làm theo khảo sát TopCV: banner chèn giữa danh sách (placement `job_list_inline`), card "Ứng viên cũng tìm kiếm", chip "Danh mục Nghề liên quan", box CTA nhận thông báo, khảo sát hài lòng 1 chạm (Feedback.satisfaction), SEO text theo nhánh nghề, sort "Cần tuyển gấp" | ✅ |
| 1.24e | Tối ưu menu tài khoản desktop: click, single accordion, tự mở route active, cuộn trong viewport và giữ logout hiển thị | ✅ |
| 1.24f | Cài đặt 12 loại thông báo email candidate, mặc định bật, PATCH tự lưu và UI ba nhóm phẳng | ✅ |
| 1.24g | Trang đổi mật khẩu candidate dùng workflow chung, email read-only, token/session rotation và validation khớp backend | ✅ |
| 1.24h | Trang việc làm phù hợp preference-first: consent, CV bổ sung/fallback không CV, score/reasons, pagination và lưu việc | ✅ |
| 1.24i | Onboarding gộp về một trang dạng chat: bỏ trang chào + wizard "Tiếp tục/Quay lại" + hai màn kết, tất cả thành tin nhắn trong cùng transcript; đáp án một lựa chọn bấm phát gửi, sửa đáp án cũ tại chỗ bằng "Sửa", robot nhắc lỗi và báo lỗi backend ngay trong hội thoại; `/onboard-user-setting` redirect về `/onboard-user` | ✅ |
| 1.25 | Cookie consent + job view tracking: signed cookie, UI tùy chỉnh, policy, optional-storage gate và deduplicated tracking | ✅ |
| 1.26 | API response DTO theo màn hình: list/detail/write riêng, query tối thiểu và contract test chống field dư/nhạy cảm | ✅ |

### Ghi chú chi tiết — Giai đoạn 1

<details>
<summary><b>1.5b</b> — Xác thực email qua link + Redis</summary>

Đăng ký bằng email xong **đăng nhập luôn** (RegisterView trả về JWT access/refresh) rồi backend gửi mail xác thực; token ngẫu nhiên lưu trong Redis (`django-redis`, cache mặc định) tự hết hạn theo TTL 24h + khoá cooldown chặn spam gửi lại (60s) — không cần bảng/migration. Endpoints mới: `POST /auth/verify/send/` (gửi lại, 429 kèm `retry_after` khi còn cooldown), `POST /auth/verify/confirm/` (token→`email_verified=True`, AllowAny vì token là bằng chứng), `POST /auth/change-email/` (đổi email→reset xác thực + gửi lại); `UserSerializer` expose thêm `email_verified`/`provider`. Frontend: banner nhắc "Tài khoản chưa xác thực… tại đây" ở `MainLayout` (chỉ hiện với provider `local` chưa xác thực), trang `/tai-khoan/xac-thuc-email` (2 chế độ: có `?token=` → tự xác nhận báo thành công/thất bại; không token → nút gửi/gửi lại kèm đồng hồ đếm ngược cooldown, popup "đổi email khác", khung "Khắc phục lỗi thường gặp" lấy hotline/email CSKH từ site settings). Email gửi qua SMTP provider-agnostic (Gmail/SendGrid/SES/Mailgun): chưa điền credential → in ra console cho dev, điền `EMAIL_HOST_USER/PASSWORD` vào `.env` là **tự chuyển gửi thật** (không đổi code); dùng `EmailMultiAlternatives` (text + HTML), `Reply-To` = `support_email`, `From` name lấy từ site setting `email_from_name`, `EMAIL_TIMEOUT=10` chặn request treo; `.env`/`.env.example` (backend + frontend) đã cập nhật đầy đủ. Đăng nhập Google/FB/LinkedIn (không cần xác thực email) làm sau.

</details>

<details>
<summary><b>1.14</b> — Frontend cổng ứng viên (một phần)</summary>

Đã xong — trang chủ: header mega-menu (Việc làm/Tạo CV/Công cụ/Cẩm nang nghề nghiệp, icon, vách ngăn cột, mũi tên hiệu ứng khi hover), hero search + `LocationFilter`, **banner carousel** (tự trượt, prev/next, dot, dừng khi hover), mega-menu danh mục 3 cấp (nhóm nghề→nghề→vị trí chuyên môn khi hover, next/prev phân trang nhóm); danh sách job (bộ lọc, phân trang), chi tiết job (nhiều địa điểm, số lượng tuyển, học vấn); **CategoryPicker modal 3 cấp (multi-select, rút gọn id khi apply, drill-down mobile)**; **LocationFilter dùng chung Home+Jobs (chọn nhiều tỉnh+phường/xã, click tên là chọn, giữ checkbox khi mở lại, label "Tỉnh (Tất cả)"/"(n phường/xã)", drill-down mobile, áp dụng địa điểm ở trang chủ tìm ngay không cần bấm thêm)**; Skeleton + lazy-load + theme AntD xanh. Còn thiếu CV builder, kho template, luồng ứng tuyển.

</details>

<details>
<summary><b>1.14b</b> — Redesign trang danh sách việc làm</summary>

Thanh tìm kiếm nền xanh (danh mục + từ khóa + địa điểm), heading đếm job + breadcrumb + gợi ý "N việc làm tại Hà Nội", sidebar Lọc nâng cao (danh mục nghề có số lượng & mở rộng cấp con, mức lương bucket + khoảng tự nhập + thoả thuận, cấp bậc, hình thức/loại hình làm việc, Xóa lọc), tabs tìm-theo + sắp xếp (Mới nhất/Lương cao nhất — thêm `?ordering=salary_desc` backend), JobCard mới (logo công ty, chips, kỹ năng, "Đăng N ngày trước", lưu tim localStorage); serializer thêm `company_logo_url` + `published_at`.

</details>

<details>
<summary><b>1.14c</b> — Bộ lọc đầy đủ</summary>

Thêm 3 field vào `jobs` (`experience_years` — kinh nghiệm theo năm chọn nhiều, `position_level` — 8 cấp bậc, `weekend_policy` — nghỉ/làm thứ 7, backfill dữ liệu demo từ experience_level qua migration 0007); filter API tương ứng + `?industry=` (lĩnh vực công ty, endpoint distinct `/api/employer/industries/`); sidebar mới: Nghỉ thứ 7 (badge AI), Kinh nghiệm checkbox 2 cột, Lĩnh vực công ty select, Cấp bậc 8 bậc, thanh dính đáy "Xóa lọc + Lưu bộ lọc" (localStorage); breadcrumb chuỗi danh mục cha→con click được; JobCard viền xanh nhạt.

</details>

<details>
<summary><b>1.14d</b> — Header tự ẩn, search sticky, URL bộ lọc rút gọn</summary>

Header tự ẩn khi cuộn xuống (hook `useHideOnScroll` dùng chung toàn site), thanh tìm kiếm xanh sticky né header (offset động theo header), sidebar lọc dính ngay dưới thanh tìm kiếm (CSS var `--sb-top`), gắn `SearchDropdown` (gợi ý từ khóa + lịch sử + "việc làm quan tâm" + tabs tìm-theo) như trang chủ; các bộ lọc lựa chọn chuyển sang chip bo tròn (`SingleChips`/`MultiChips`) tự xuống hàng gọn thay grid 2 cột bị vỡ; "Lưu bộ lọc" bắt đăng nhập bằng Modal tái dùng đúng component `Login` (Google/Facebook/LinkedIn + email; `Login` thêm prop `onSuccess` để nhúng không điều hướng), đăng nhập xong tự lưu và ở lại trang; URL bộ lọc rút gọn: key ngắn (`cat/wt/et/level/weekend/nganh/sort`), gộp nhiều giá trị bằng dấu phẩy (`cat=84,85`, `exp=1,2`), lương 1 param `salary=10-15|nego` (triệu) — lớp `toApiParams` khai triển lại thành param backend gốc nên API không đổi.

</details>

<details>
<summary><b>1.14e</b> — Tách model <code>Industry</code> + M2M</summary>

`EmployerProfile.industry` (CharField đơn) → model `Industry` riêng + `industries` M2M (1 công ty nhiều lĩnh vực), vì dữ liệu thật đã lộ nhu cầu này qua giá trị lách "Đa ngành"; migration 3 bước tách rõ ràng (tạo bảng + field mới → backfill dữ liệu cũ → xoá field cũ) để không mất dữ liệu; `IndustryListView` trả object `{id,name,slug}` (chỉ lĩnh vực đang có công ty); `EmployerProfileSerializer` nhận/trả `industries`/`industries_detail` theo khuôn `locations`/`locations_detail`; filter job `?industry=<id>` giữ **single-select** trên UI nhưng match theo M2M (`employer_profile__industries__id=`) nên job của công ty đa ngành vẫn lên đúng khi lọc theo bất kỳ ngành nào của công ty đó; `JobStatsView.featured_employers` dùng `StringAgg` gộp tên các lĩnh vực; Django admin `Industry` + `filter_horizontal` cho `EmployerProfile`.

</details>

<details>
<summary><b>1.14f</b> — Skeleton loading toàn diện</summary>

Sidebar (danh mục nghề, lĩnh vực công ty) có `sidebarLoading` riêng (`Promise.allSettled` cho 4 API song song) hiện `FilterSkeleton`/`Skeleton.Input` thay vì pop-in trống, heading đếm số việc làm dùng `Skeleton.Input` thay chữ "…"; danh sách job giữ `JobCardSkeleton` đã có (chạy cả lúc tải đầu và mỗi lần đổi filter) — quy ước áp dụng cho mọi danh sách sau này, đã ghi vào memory.

</details>

<details>
<summary><b>1.14g</b> — Dải "khám phá nhanh"</summary>

Hàng thẻ `ShortcutCard` cuộn ngang gồm lối tắt đặc biệt (Không cần kinh nghiệm→`exp=none`, Thực tập sinh→`level=intern`, Part-time→`et=part_time`) + tất cả nhóm ngành nghề (dùng `logo_url`, click set `cat`) + "Xem tất cả" (cuộn tới bộ lọc danh mục ở sidebar, `#cat-filter`); hàng pill lối tắt (Ưu tiên lương cao→`sort=salary_desc`, Làm từ xa→`wt=remote`, Nghỉ thứ 7→`weekend=off_saturday`) — đều toggle & sáng khi đang áp dụng, có skeleton khi đang tải; sửa điều hướng danh mục từ trang chủ (`CategoryMenu`, `FeaturedIndustriesEmployers`) dùng `?cat=` thay `?category=` cho khớp URL gọn mới.

</details>

<details>
<summary><b>1.14h</b> — Banner địa danh hành chính mới</summary>

Banner thông báo địa danh hành chính mới (sau sáp nhập 1/7/2025) trên trang việc làm: chỉ hiện khi lọc **đúng 1 tỉnh/thành** (`selectedLocationGroups.length===1`), đặt ngay trên lưới sidebar + "Tìm kiếm theo"; nền hổ phách, icon info, nội dung theo tên tỉnh đang chọn, nút Xem thêm/Thu gọn (`line-clamp-1`) và nút × đóng theo từng tỉnh (`dismissedNotice`); backend thêm filter `?education_level=` (field đã có sẵn trên `Job`) để phục vụ lối tắt "không yêu cầu bằng cấp" (education=none) sau này.

</details>

<details>
<summary><b>1.14i</b> — Dữ liệu sáp nhập tỉnh 2025</summary>

Dữ liệu sáp nhập tỉnh 2025 (63→34) vào `Location.merged_from` (JSONField, list tên tỉnh cũ hợp thành; rỗng = giữ nguyên); seed qua management command `seed_province_merges` (mapping đã đối chiếu nguồn chính phủ/thuvienphapluat, 23/23 tỉnh sáp nhập khớp), admin sửa được; `LocationSerializer` expose `merged_from`; banner ở trang việc làm dùng dữ liệu này: nếu có `merged_from` hiển thị đúng câu "…sau sáp nhập bao gồm phạm vi các tỉnh Bình Phước, Đồng Nai cũ…" (tên tỉnh viết thường giữa câu), nếu rỗng dùng câu fallback quận/huyện→phường/xã.

</details>

<details>
<summary><b>1.14j</b> — Sửa cuộn ngang dải "khám phá nhanh"</summary>

Bỏ hẳn cơ chế kéo chuột tự chế bằng `setPointerCapture` (nghi ngờ là nguyên nhân đôi khi nuốt mất click, khiến chọn được nhiều thẻ khó/không nhất quán) — thay bằng `overflow-x-auto` gốc của trình duyệt (đã hỗ trợ sẵn kéo cảm ứng/trackpad) + 2 nút mũi tên `ArrowButton` (tái dùng từ `CategoryMenu`) nổi 2 bên, tự ẩn khi đã cuộn hết; theo dõi vị trí cuộn qua state `canScrollShortcutsLeft/Right` cập nhật theo sự kiện `scroll`/`resize`. Việc chọn nhiều thẻ ngành nghề vốn đã đúng ở tầng dữ liệu (`cat=a,b`), lỗi chỉ nằm ở tầng tương tác chuột — nay loại bỏ.

</details>

<details>
<summary><b>1.14k</b> — Panel "Xem nhanh" job</summary>

Click card (ngoài tiêu đề) hoặc nút "Xem nhanh" → ẩn sidebar lọc, danh sách job chuyển sang cột trái (JobCard `compact` + `active` highlight card đang xem, pagination `simple`), cột phải hiện `JobQuickView` (component mới): header dính (tiêu đề, chip lương/địa điểm/kinh nghiệm, link Xem chi tiết, nút Ứng tuyển ngay + tim), bảng thông tin chung, các section Mô tả/Trách nhiệm/Yêu cầu/Ưu tiên/Quyền lợi/Địa điểm, thẻ công ty; fetch đầy đủ qua `getJobDetail` kèm **Skeleton**, hiệu ứng slide-in, panel sticky cuộn riêng như sidebar; nút × quay lại layout có bộ lọc; JobCard đổi root Link→div (tiêu đề vẫn là Link sang trang chi tiết), tách hook `useSavedJob` dùng chung lưu tim.

</details>

<details>
<summary><b>1.14l</b> — Header ứng viên sau đăng nhập</summary>

Khi `isAuthenticated && role==='candidate'` thay 2 nút cũ bằng `CandidateUserMenu` (chuông thông báo + icon chat, avatar; chuông/avatar mở bằng click) + cụm "Bạn là nhà tuyển dụng? Đăng tuyển ngay »" sang `EMPLOYER_PORTAL_URL`. Dropdown: khối profile (avatar, tên, trạng thái xác thực — chưa xác thực thì link `/tai-khoan/xac-thuc-email`, ID `public_id` + email), 5 section thu/mở với animation `grid-rows`; toàn bộ section dùng single-open accordion và tự mở nhóm chứa route hiện tại. Panel giới hạn theo viewport, chỉ vùng menu cuộn để profile/nút đăng xuất luôn nhìn thấy; màu lấy từ CSS var brand (`--brand-primary/-soft`), item chưa có trang → `message.info('Tính năng sẽ sớm ra mắt.')`. Role employer/admin vẫn giữ nút "Trang quản lý".

</details>

<details>
<summary><b>1.14m</b> — Responsive mobile toàn site chính</summary>

Header thêm nút hamburger `md:hidden` mở AntD `Drawer` chứa nav (accordion animation grid-rows) + hành động đăng nhập/đăng ký/đăng tuyển; logo co nhỏ theo `sm:`. JobList: sidebar lọc `hidden lg:block` trên desktop, mobile chuyển thành `Drawer` mở bằng nút "Lọc nâng cao" (kèm số bộ lọc), tách `filterSidebar` dùng chung 2 nơi; **xem nhanh** chỉ tách 2 cột trên desktop (`inlineQuickView = quickViewJob && isDesktop` qua `matchMedia(min-width:1024px)`) — mobile mở `JobQuickView` trong Drawer bottom-sheet toàn màn hình (danh sách giữ nguyên đầy đủ, không thu gọn/xếp chồng). JobDetail: padding/tiêu đề co theo `sm:`, thêm thanh "Ứng tuyển ngay" `fixed bottom md:hidden`. AuthLayout: bỏ padding cố định `3rem`, dùng padding responsive (`px-5 py-8 sm:px-10`). Các trang Home/BestJobs/FeaturedIndustries/Hotline/form auth vốn đã có grid responsive. Nguyên tắc từ nay: **mọi UI mới bắt buộc responsive**.

</details>

<details>
<summary><b>1.14n</b> — Tìm kiếm tiếng Việt không dấu</summary>

Bật extension Postgres `unaccent` (migration `0008_unaccent_extension` + `django.contrib.postgres` vào INSTALLED_APPS), helper `search_q(field, text)` tách từ khóa thành token AND từng từ với `__unaccent__icontains` (unaccent cả 2 phía) — nhập **không dấu** ("cham soc khach hang") hoặc **đảo thứ tự từ** ("khach hang cham soc") đều khớp "Chăm sóc khách hàng"; áp cho cả `JobListView` (title/company/both) lẫn `JobSuggestView` (autocomplete gợi ý được từ không dấu, dedupe + ưu tiên startswith so sánh bằng `fold_accents` phía Python — xử lý riêng đ→d vì NFD không tách được); từ khóa rác ("abcdsad") trả 0 kết quả → frontend `JobResults` empty-state mới kiểu TopCV: thông báo "Rất tiếc… thử thay đổi từ khóa hoặc bộ lọc" + nút "Xóa bộ lọc & từ khóa" (`clearAllCriteria` reset cả FILTER_KEYS lẫn search, chỉ hiện khi đang có tiêu chí). Đã test shell + API end-to-end 4 case.

</details>

<details>
<summary><b>1.14o</b> — Việc làm đã lưu + cụm nút nổi Góp ý/Hỗ trợ</summary>

**Việc làm đã lưu** giờ là **trang riêng** `/viec-lam-da-luu` (không phải Drawer): heading "Danh sách N việc làm đã lưu", danh sách `JobCard` đầy đủ, mục "Việc làm tương tự việc bạn đã lưu" (lấy job cùng danh mục hay gặp nhất trong các tin đã lưu, loại tin đã lưu, tối đa 6; fallback tin mới nhất khi tin lưu không có danh mục), cột phải banner quảng bá tạo CV; guard chỉ ứng viên (`Navigate` về `/login` nếu chưa đăng nhập/không phải candidate, chờ `authLoading` xong mới quyết định); vào từ menu **"Việc làm đã lưu"** trên header (bỏ placeholder "sắp ra mắt"). Backend saved job: model `SavedJob` (`candidate`+`job`, `UniqueConstraint` chống trùng, index `(candidate,-created_at)`); `SavedJobSerializer` ghi bằng `job` public_id (`SlugRelatedField`), đọc trả `job_detail` = **`JobSerializer` đầy đủ** (để `JobCard` render giống hệt trang danh sách + có `category` cho gợi ý tương tự), `validators=[]` vì `candidate` đến từ `perform_create` (tránh `UniqueTogetherValidator` tự sinh văng lỗi thiếu field — trùng do `get_or_create` lo, lưu 2 lần là no-op); endpoints `GET/POST /api/jobs/saved/` (`IsCandidate`, `pagination_class=None` để frontend có trọn bộ id tô tim mọi card + đếm badge; queryset prefetch `job__job_skills__skill`) và `DELETE /api/jobs/saved/<job_public_id>/`. **`useSavedJob` chuyển localStorage→API**: `SavedJobsProvider` + context dùng chung (optimistic: bỏ lưu xoá ngay rồi rollback nếu lỗi; lưu dùng `pending` Set để tim sáng tức thì), tim trên `JobCard`/`JobQuickView`, badge và trang đã lưu luôn khớp và **đồng bộ đa thiết bị** (hook cũ `pages/main/jobs/hooks/useSavedJob.js` xoá, chuyển lên `hooks/useSavedJobs.js`). **Cụm nút nổi = 3 nút** (`FloatingActions` trong `MainLayout`): **Việc làm đã lưu** (icon trái tim + `Badge` đếm số tin đã lưu → điều hướng `/viec-lam-da-luu`), **Góp ý** (mở **Modal giữa màn hình** "Bạn muốn?" — 2 thẻ lớn _Góp ý sản phẩm_ → form và _Chat Zalo_ → `contact_zalo_url`, kèm dải xanh "…Nhà tuyển dụng sẽ không đọc được góp ý này"), **Hỗ trợ** (panel "Trung tâm hỗ trợ ứng viên" neo cạnh nút: header gradient + "{sitename} thường phản hồi trong vòng 24h"; mục Hướng dẫn tìm việc an toàn \*, Các câu hỏi thường gặp, Hỗ trợ qua Zalo, Liên hệ {sitename}→`tel:hotline`). **Form góp ý** (UI chip, không dropdown): Chủ đề cần góp ý = 6 **chip chọn trực tiếp** (bắt buộc, validate thủ công vì ngoài AntD Form), Mô tả (TextArea, **bắt buộc**, ≥10 ký tự), "Bạn có hài lòng về {sitename} không?" (5 mức emoji chọn 1, không bắt buộc), **khi chưa đăng nhập** thêm SĐT + Email (đều không bắt buộc) + label "{sitename} sẽ phản hồi tới số điện thoại hoặc email bạn nhập trong vòng 24h (không kể Thứ 7, CN, ngày lễ)". Backend feedback: model `Feedback` mở rộng — `category` đổi thành 6 chủ đề sản phẩm, thêm `satisfaction` (5 mức) + `phone`, `user` nullable; `POST /api/site/feedback/` (`AllowAny`, throttle `feedback:5/min`, mô tả ≥10 ký tự, user đăng nhập bỏ trống email thì lấy email tài khoản); Django admin đọc-only + sửa `status`, chặn add. Kênh Zalo/hotline **đọc từ site settings** (nhóm "Liên hệ / hỗ trợ"), rỗng thì báo "chưa cấu hình". Verify: round-trip HTTP thật (POST 201 → idempotent 201 count=1 → GET 200 `job_detail` đầy đủ 34 field gồm `category`+`job_skills` → DELETE 204 → 404 → anon 401), feedback anon 201 với `satisfaction`+`phone`, mô tả ngắn 400; lint + `vite build` pass. **Chưa verify bằng mắt** (2 cổng dev do người dùng chạy, không chiếm cổng mở preview được).

**Nâng cấp 24/07/2026:** Trang hiển thị thời điểm lưu, empty/error/retry rõ ràng, CTA tạo CV đúng đích và feed gợi ý luôn hiện cả khi danh sách lưu rỗng. `GET /api/jobs/recommendations/by-saved/` so pairwise tối đa 20 tin lưu gần nhất theo category chính, token tiêu đề, kỹ năng, tỉnh, kinh nghiệm và hình thức làm việc; lấy cặp mạnh nhất để không trộn sai sở thích, loại tin đã lưu/đã ứng tuyển/không còn public và fallback tin active mới nhất khi chưa có tín hiệu. UI phân biệt “Việc làm tương tự” với fallback “Việc làm bạn có thể quan tâm”; frontend không tự tính category/score. Route standalone chuyển sang `AuthGuard → RoleGuard(candidate)`; lưu/bỏ lưu thành công invalidate feed. Sau review đã chặn lưu tin không public, tách nhóm taxonomy để không lẫn chuyên môn, loại token chức danh chung và giữ snapshot đầy đủ khi optimistic save. Verify: backend coverage 85,50%, 374 frontend test, lint/architecture/build, 81 smoke E2E desktop/tablet/mobile và 15 regression cuối cho saved-job. Tài liệu thuật toán: `docs/07-algorithms/saved-job-recommendations.md`.

</details>

<details>
<summary><b>1.14p</b> — Phân hạng tin + nhãn dịch vụ</summary>

Thiết kế 3 tầng, chốt với user qua mockup. **Tầng 1 — hạng tin** `Job.tier` (TextChoices `standard`/`featured`/`top`, single-choice, quyết định nền card): tin thường nền trắng viền xám, nổi bật/TOP nền `emerald-50` viền xanh (sửa lỗi cũ: JobCard tô nền xanh cho _mọi_ tin), TOP thêm nhãn đỏ trước tiêu đề. **Tầng 2 — nhãn dịch vụ** (gắn kèm nhiều cái): `is_hot` (HOT đỏ), `is_urgent` (GẤP cam), `has_flash_badge` (huy hiệu Sấm Chớp ⚡ góc logo — nối vào section FlashBadge trang chủ có sẵn, giờ fetch `?flash_badge=1` thật, fallback tin mới nhất khi chưa gán); nhãn ✓ xác thực **không lưu trên Job** — serializer expose `company_verified` suy từ `employer_profile.verified_at` có sẵn, hiện cạnh tiêu đề JobCard + JobQuickView. **Tầng 3 — trạng thái theo ngữ cảnh** (Mới/sắp hết hạn/đã xem/đã ứng tuyển) _tính toán không lưu_ — để dành các mục sau. Admin gán tier+nhãn qua Django admin (`list_editable` ngay trên danh sách; employer không ghi được qua API — 4 field nằm trong `read_only_fields`, sau này Giai đoạn 6 chuyển sang gán tự động theo gói dịch vụ). Sắp xếp danh sách mặc định: `annotate(tier_weight=Case(...))` TOP→nổi bật→thường rồi mới tới ngày đăng; riêng `?ordering=salary_desc` giữ thuần theo lương (lựa chọn chủ động của user, không chen tier). Chip trên card nhận prop `elevated` (card xanh dùng chip trắng, card trắng dùng chip xám cho tách nền). Seed `seed_demo_jobs` gán tỉ lệ 65/25/10 + hot/gấp 18% + flash 30% + `deadline`; **sửa luôn bug seed crash**: vẫn truyền `industry=` CharField đã bị 1.14e thay bằng M2M `industries` → chuyển sang `Industry.get_or_create` + `profile.industries.set`. Migration `0011`. Verify qua API thật: trang 1 xếp top→featured đúng, `?flash_badge=1` trả 9/9 tin có huy hiệu, `salary_desc` không chen tier, `company_verified` có mặt; lint + build + 4/4 test pass.

</details>

<details>
<summary><b>1.14q</b> — Chuẩn hóa schema tin tuyển dụng</summary>

Mở rộng model `jobs` theo thiết kế database mới (migration `0012`–`0013`), thay dữ liệu phẳng bằng các bảng quan hệ có cấu trúc: `JobCategoryAssignment` (danh mục theo vai trò — 1 vị trí chuyên môn chính `primary_specialization` unique/job + nhiều `domain_knowledge`, thay FK `category` đơn), `JobLocation` (địa điểm làm việc theo **phường/xã** + `address_detail`, ghi mới bắt buộc ward có tỉnh cha, dữ liệu tỉnh cũ giữ tương thích), `JobWorkSchedule` (khung giờ có cấu trúc weekday_from/to + start/end + `is_overnight` + note, kèm `Job.work_schedule_note` cho lịch tự do), `Benefit`/`JobBenefit` (quyền lợi chuẩn hóa có icon + note), `Language`/`JobLanguageRequirement` (ngoại ngữ: trình độ 5 mức, chứng chỉ, bắt buộc/ưu tiên), `JobApplicationContact`+`JobApplicationEmail` (người nhận hồ sơ 1-5 email — **nội bộ, không expose qua API public**, có test chống lộ). `Job` thêm `gender_requirement`, `age_min/age_max`, `number_of_vacancies`, `salary_type` 5 loại (thỏa thuận/khoảng/cố định/từ/đến) với CheckConstraint + validate serializer chéo theo loại. `JobSerializer` nhận nested writes cho cả 6 quan hệ (thay thế trọn gói mỗi lần update, validate trùng lặp); các field cũ frontend đang dùng (`category`, `locations_detail`, `short_description`, `is_salary_visible`) chuyển thành computed read-only — không còn cột trùng lặp. Filter `?category=` đổi sang match `category_assignments` (giữ mở rộng cấp con). Seed `seed_demo_jobs` viết lại theo schema mới.

</details>

<details>
<summary><b>1.14r</b> — Trang chi tiết việc làm bản mới</summary>

Làm lại theo bố cục 2 cột chốt với user (trái: breadcrumb → hero → chi tiết → việc làm liên quan; phải: công ty → thông tin chung → danh mục liên quan → lưu ý an toàn/promo). **API view-model** (không thêm cột DB): `JobDetailSerializer` trả thêm `primary_specialization`/`domain_knowledge` (`{id,name,slug}`), `workplace_groups` (địa điểm nhóm theo tỉnh/thành → dòng địa chỉ phường/xã có `display` ghép sẵn), `requirement_tags` (kinh nghiệm/tuổi/học vấn "Từ X trở lên"/giới tính/kỹ năng required — label sinh từ `get_FOO_display`), `benefit_tags`, `proficiency_label` trên `language_requirements` — frontend không phải tự suy luận từ dữ liệu thô nữa (xoá `buildJobTagGroups`); dữ liệu nested thô giữ nguyên cho form employer. **Content** theo thứ tự đọc: tag tóm tắt (Yêu cầu/Quyền lợi/Chuyên môn — chuyên môn chính tô emerald) → mô tả → yêu cầu → quyền lợi → **ngoại ngữ** ("Tiếng Hàn — Giao tiếp — TOPIK 2" + nhãn Ưu tiên khi không bắt buộc) → **địa điểm nhóm tỉnh** → **lịch làm việc render JSX** (component `WorkScheduleList` thay chuỗi HTML tự ghép — an toàn, hỗ trợ nhiều ca "Ca sáng/Ca chiều" + ghi chú) → cách thức ứng tuyển (câu cố định sản phẩm) → CTA cuối. Các khối tách vào `JobDetailBlocks.jsx` (`RequirementTags`/`BenefitTags`/`SpecialtyTags`/`LanguageRequirementList`/`WorkplaceGroups`/`WorkScheduleList`). **Sidebar**: "Thông tin chung" còn đúng 5 mục (bỏ Kinh nghiệm vì đã có ở Hero + tag); "Danh mục nghề liên quan" link theo **từng** `category_assignments.category` (`?cat=<id>` riêng) thay vì mọi tag về chung `job.category`. **Sticky bar**: 4 anchor (Chi tiết/Mô tả/Địa điểm/Việc làm liên quan), anchor Địa điểm + Việc làm liên quan **tự ẩn khi tin không có dữ liệu** (tin remote không văn phòng, tin không có việc liên quan). **Mobile**: tag Yêu cầu thu gọn tối đa ~3 dòng + nút Xem thêm/Thu gọn (đo `scrollHeight`, chỉ hiện khi tràn, `sm:` bỏ giới hạn); sidebar xếp sau nội dung; giữ thanh đáy Lưu/Ứng tuyển. Seed demo làm giàu: ~20% tin lương thỏa thuận, ~30% có tuổi, ~35% có 1-2 ngoại ngữ (chứng chỉ theo mã ngôn ngữ), 40% làm 2 ca, benefits 3-5 mục, skills 2-4, tin remote 0-1 địa điểm, domain knowledge gắn từ parent của chuyên môn. Verify: 7/7 test `apps.jobs` (2 test mới: view-model nhóm đúng 2 tỉnh + tag đúng thứ tự đọc, tin tối giản trả rỗng an toàn), 17/17 vitest, lint + build pass; browser thật 4 loại tin (nhiều địa điểm 2 tỉnh, remote không địa điểm, lương thỏa thuận, 2 ngoại ngữ + 2 ca) + mobile 375px (Xem thêm/Thu gọn hoạt động, đo container 96→120px).

</details>

<details>
<summary><b>1.16</b> — Rate limit + reCAPTCHA v3</summary>

Rate limit theo IP (DRF `ScopedRateThrottle`, 5 lần/phút mỗi endpoint) + Google reCAPTCHA v3 invisible (verify server-side qua `apps/accounts/captcha.py` — check `success` + `action` khớp (`login`/`register`) + `score >= RECAPTCHA_SCORE_THRESHOLD`, bỏ qua 2 field khi thiếu để tương thích test key; field `captcha_token` trên cả 2 serializer); frontend dùng `react-google-recaptcha-v3` (`GoogleReCaptchaProvider` bọc App, `useGoogleReCaptcha().executeRecaptcha(action)` lấy token ẩn lúc submit trên `Login`/`Register`), thông báo riêng khi bị 429.

</details>

<details>
<summary><b>1.17</b> — Social login OAuth</summary>

OAuth Authorization Code Flow qua backend callback: ứng viên Google/Facebook/LinkedIn, NTD chỉ Google, admin không có. Backend: model `SocialAccount` (unique `(provider, provider_user_id)`, migration 0002), `User.Provider` thêm facebook/linkedin; service `apps/accounts/oauth.py` (build auth URL, `state` Redis TTL 10ph chống CSRF + one-shot, exchange code, fetch + normalize profile OIDC/Graph, `one_time_code` Redis TTL 60s); endpoints `GET /auth/oauth/<provider>/start/?portal&next` (redirect provider; lỗi → redirect frontend `?error=<code>`), `GET .../callback/` (verify state → tạo/liên kết user → redirect frontend kèm code), `POST /auth/oauth/complete/` (đổi code lấy `{user, access, refresh}`, throttle 10/min). Luật liên kết: có SocialAccount → đăng nhập luôn; email trùng cùng role → tự liên kết (+set `email_verified=True`, giữ password cũ); khác role → chặn `wrong_portal`; user mới → role theo cổng, `email_verified=True`, password unusable; `next` chỉ nhận path nội bộ (chặn absolute/`//`). Env: `OAUTH_*_CLIENT_ID/SECRET` (trống → báo "chưa cấu hình", không crash), `OAUTH_MAIN/EMPLOYER_CALLBACK_URL`. Frontend: component chung `SocialLoginButtons` (gộp icon trùng lặp ở Login/Register, full-page redirect sang start URL, `next` = trang hiện tại trừ trang auth — giữ UX login modal ở trang việc làm), trang `OAuthCallback` dùng chung 2 cổng (`/oauth/callback` + `/tuyendung/app/oauth/callback`, guard StrictMode double-effect vì code chỉ dùng 1 lần), lưu token đúng portal key, lỗi → về trang login của cổng kèm `?oauth_error=` hiện trong Alert của `LoginForm` (map mã→tiếng Việt ở `errorMessage.js`); employer Login/Register thêm nút Google + divider. Test: 13 test OAuth backend (portal rules, tạo/liên kết/chặn role, state one-shot, code one-shot, chặn next absolute) — 18/18 pass; lint+build pass; verify browser: đủ 3 nút cổng main, 1 nút Google cổng NTD, click Google (chưa credential) → quay về form báo "chưa được cấu hình" đúng luồng.

OAuth hoàn tất qua provider bỏ qua email 2FA; email/mật khẩu vẫn yêu cầu mã khi người dùng đã bật 2FA.

</details>

<details>
<summary><b>1.18</b> — Ghi nhận <code>last_login</code></summary>

`User.last_login` (có sẵn từ `AbstractUser` nhưng JWT không tự set vì không đi qua `django.contrib.auth.login()`) nay được cập nhật ở cả 3 luồng phát token — đăng nhập email/mật khẩu (`RoleTokenObtainPairSerializer.validate`, chỉ set sau khi qua kiểm tra `portal`), đăng ký auto-login, social login (qua `_issue_tokens()`); expose field `last_login` trong `UserSerializer`. Test: 5 test (3 luồng + 2 case âm sai mật khẩu/sai cổng không set) — phát hiện & sửa 2 lỗi cô lập test: Django test runner luôn ép `DEBUG=False` (cần override tường minh để bypass captcha), `ScopedRateThrottle` dùng chung cache Redis thật nên override `CACHES` sang LocMemCache tránh cộng dồn 429 giữa các lần chạy.

</details>

<details>
<summary><b>1.19</b> — Đặt lại mật khẩu qua email + Redis</summary>

Cùng mô hình với 1.5b nhưng siết chặt hơn vì đây là luồng chiếm được tài khoản. Backend: module `apps/accounts/password_reset.py` (token `secrets.token_urlsafe(32)` trong Redis, TTL **30 phút**, cooldown 60s/user; khoá `latest:<user_id>` giữ token mới nhất → **xin link mới là link cũ chết ngay**; tiêu token một lần bằng `atomic_pop`), tách helper mail dùng chung `apps/accounts/mailing.py` (`site_setting`/`from_email`/`frontend_link`/`send_html_email`) và refactor `email_verification.py` dùng lại. Endpoints: `POST /auth/password-reset/` (captcha, **luôn trả cùng một `detail`** dù email tồn tại hay không → chống dò email; cooldown im lặng; đẩy mail qua outbox `AuthEmailJob` kind `password_reset`), `GET /auth/password-reset/validate/?token=` (kiểm tra link **không tiêu token** → hiện ngay màn hết hạn), `POST /auth/password-reset/confirm/` (validate mật khẩu **trước** khi tiêu token để mật khẩu yếu không đốt link; đổi xong `email_verified=True` vì nhận được mail = chứng minh sở hữu hòm thư, và blacklist toàn bộ refresh token cũ qua `token_blacklist` → đăng xuất mọi thiết bị). Rule mật khẩu tách thành `password_field()` dùng chung với `RegisterSerializer`. Frontend: `/forgot-password` + `/reset-password?token=` (lazy route, dùng lại `PasswordRequirements` realtime + rule "nhập lại không khớp"), confirm trả `role` để đưa về đúng cổng đăng nhập; `MAIN_FORGOT_PASSWORD_URL` trong `portals.js` (cổng NTD/admin ở subdomain riêng phải link tuyệt đối về host chính, `LoginForm` render `<a>` thay `<Link>` khi link absolute). Env mới: `PASSWORD_RESET_TTL=1800`, `PASSWORD_RESET_RESEND_COOLDOWN=60`. **Bug tự gây ra rồi sửa**: ban đầu gán chung `throttle_scope='password_reset'` cho cả 3 endpoint → gõ sai mật khẩu vài lần là hết quota, không confirm được nữa dù link còn hạn; tách bucket riêng `password_reset_confirm` (10/phút). Verify: 15 assertion qua HTTP client thật (chống dò email, cooldown im lặng, link cũ chết, token một lần, mật khẩu yếu không đốt token, refresh token bị blacklist) + kiểm chứng UI trên browser (submit thật, màn hết hạn, mobile 375px không tràn ngang).

Chính sách mật khẩu dùng chung cho đăng ký và đặt lại mật khẩu: 8–25 ký tự,
chặn mật khẩu phổ biến/thuần số/tương tự dữ liệu tài khoản bằng Django validator;
bắt buộc có chữ hoa, chữ thường và chữ số.

Email candidate được tách thành hai bước: địa chỉ email tự nhập chỉ nhận link
xác thực trước, và email chào mừng chỉ gửi một lần sau khi xác thực thành công.
Candidate tạo lần đầu qua OAuth nhận email chào mừng ngay vì email đã được
provider xác thực.

Form đăng ký candidate pre-check email sau **500ms** không gõ thêm, chỉ khi
đúng định dạng; request cũ được hủy và phản hồi cũ không thể ghi đè email mới.
API `POST /auth/register/email-availability/` chuẩn hóa email, so sánh không
phân biệt hoa/thường và giới hạn **12 lần/phút**. Đây chỉ là phản hồi UX;
`RegisterSerializer` vẫn kiểm tra trùng lặp ở lúc tạo tài khoản để chống race
condition.

</details>

<details>
<summary><b>1.19b</b> — Email không phân biệt hoa/thường</summary>

Sửa bất đối xứng phát hiện ở 1.19: `password-reset` tra user bằng `email__iexact` còn login đi qua `authenticate()` → `get_by_natural_key()` so sánh **chính xác** (Postgres phân biệt hoa/thường), và `normalize_email()` của Django chỉ hạ chữ phần domain → user đăng ký `Hau@gmail.com` đặt lại mật khẩu được nhưng login bằng `hau@gmail.com` thì 401. Sửa: `UserManager.normalize_email()` hạ chữ **toàn bộ** địa chỉ; `UserManager.get_by_natural_key()` dùng `iexact`; ràng buộc DB `UniqueConstraint(Lower('email'), name='uniq_users_email_lower')` (migration `0004`) bảo đảm `iexact` không bao giờ khớp >1 bản ghi — nếu không có nó, `authenticate()` sẽ ném `MultipleObjectsReturned` → 500 thay vì 401; `RegisterSerializer.validate_email()` chặn trùng theo `iexact` để trả 400 tử tế thay vì vỡ ở index DB (`UniqueValidator` mặc định của ModelSerializer phân biệt hoa/thường). Migration có bước `RunPython` hạ chữ dữ liệu cũ, **dừng kèm danh sách cụ thể** nếu môi trường nào đã lỡ có 2 tài khoản chỉ khác hoa/thường (gộp/xoá là quyết định của con người). Verify: rollback → tạo xung đột thật → migrate lại thấy đúng `RuntimeError`; qua HTTP: đăng ký `Hau.Test@Example.com` lưu thành `hau.test@example.com`, login được với cả 3 kiểu viết hoa/thường, đăng ký trùng khác case → 400, reset bằng email chữ hoa rồi login chữ thường → 200; 25/25 test `apps.accounts` pass.

</details>

<details>
<summary><b>1.20</b> — Trang thương hiệu (brand page)</summary>

`EmployerProfile.has_brand_page` (BooleanField, admin gán qua Django admin/`list_editable`, tương tự `Job.tier`; sau này gán theo gói dịch vụ ở Giai đoạn 6) — bật thì tin tuyển dụng của công ty mở dưới URL riêng `/brand/<company-slug>/tuyen-dung/<job-slug>` kèm header thương hiệu (banner cover + logo + tên công ty) thay vì `/viec-lam/<job-slug>` thường. `JobSerializer` thêm `brand_slug` (suy từ `employer_profile.has_brand_page`, null nếu tắt) + `company_cover_url`; frontend gom logic dựng URL job vào **một nơi duy nhất** `config/jobPaths.js` (`jobDetailPath(job)`, có test `jobPaths.test.js` — 4 case) và migrate toàn bộ điểm gọi cũ (`SearchDropdown`, `BestJobsResults`, `FlashBadge`, `MarketStats`, `JobCard`, `JobQuickView`) sang dùng hàm này thay vì tự ghép chuỗi `/viec-lam/${slug}`; `MainRoutes` thêm route `/brand/:companySlug/tuyen-dung/:slug` (cùng `JobDetailPage`), `JobDetail.jsx` tự redirect (`replace`) về đúng URL chuẩn nếu vào sai dạng, và render `BrandHeader` khi `job.brand_slug` có giá trị. Seed `seed_demo_jobs` bật brand page cho 3 công ty demo (FPT, VNG, Shopee), migration `0005_employerprofile_has_brand_page`. Verify: `manage.py test apps.jobs apps.employers` pass, `vitest run` 4/4 pass, `vite build` pass, kiểm chứng trên browser thật cả 2 luồng (tin công ty có brand → redirect đúng `/brand/...` + hiện header; tin công ty thường → giữ nguyên `/viec-lam/...`, không có header thừa).

</details>

<details>
<summary><b>1.22</b> — Khung layout 3 cột trang tài khoản ứng viên</summary>

Dựng khung + cấu trúc code cho cụm trang cài đặt candidate. **Một nguồn dữ
liệu duy nhất** `entities/account/config/candidate-menu.jsx`: 5 nhóm menu với
quy ước item `path`, `blank`, `todo`; dropdown avatar, sidebar và route con cùng
đọc config này. `CandidateAccountLayout` dùng lưới 3/6/3: trái là accordion tự
mở nhóm chứa route hiện tại, giữa là `<Outlet/>`, phải là `ProfileSidebar`.
Dropdown desktop hiện dùng click + single-open accordion, menu cuộn trong
viewport và giữ profile/logout cố định. Hàng gợi ý bên phải điều hướng tới
settings thật thay cho toast thành công giả; toggle tìm việc và số lượt xem còn
lại vẫn được đánh dấu TODO. Route con bọc `AuthGuard →
RoleGuard(candidate)`; mobile đưa sidebar vào Drawer và dồn cột phải xuống dưới.

</details>

<details>
<summary><b>1.23</b> — Trang "Cài đặt thông tin cá nhân"</summary>

Trang thật đầu tiên trong khung 1.22 (thay `AccountPlaceholder`). **Backend:** `MeView` nâng từ `RetrieveAPIView` → `RetrieveUpdateAPIView` (`http_method_names=['get','patch']`), thêm `ProfileUpdateSerializer` chỉ nhận `full_name` + `phone` (email KHÔNG đổi ở đây — đổi email đi qua luồng `ChangeEmailSerializer` có xác thực), validate SĐT VN `^(0|\+84)\d{9,10}$` + họ tên ≥2 ký tự; PATCH trả về `UserSerializer` đầy đủ để frontend cập nhật thẳng auth context. Sửa được **nhiều lần**. **Frontend:** `pages/main/candidate/pages/PersonalInfo.jsx` (AntD Form, validation client khớp backend, ô Email `disabled` + ghi chú, nút Lưu; lỗi 400 theo field gắn vào đúng ô qua `form.setFields`); `authService.updateProfile()` PATCH `/auth/me/`; sau lưu gọi `setAuthenticatedUser(updated)` → cột phải (ProfileSidebar) đổi tên **live**. Route map theo `item.key` (`ACCOUNT_PAGE_BY_KEY` trong MainRoutes) — key nào chưa có trang thật thì vẫn dùng placeholder. Verify: 6/6 test `ProfileUpdateTests` (sửa tên/SĐT, nhiều lần, email read-only, SĐT sai → 400, tên rỗng → 400, cần đăng nhập); build + lint pass; browser: đăng nhập candidate demo → sửa tên + SĐT hợp lệ lưu thành công (DB đổi, email giữ nguyên), SĐT sai hiện lỗi đỏ, cột phải cập nhật live, responsive mobile 375px, console sạch.

</details>

<details>
<summary><b>1.24</b> — Onboarding và cài đặt gợi ý việc làm</summary>

Hoàn tất R9 theo cấu trúc `app → pages → features → entities → shared`. Backend
giữ domain trong `apps/candidates`: preference và consent được thay thế trong
một transaction qua `PUT /api/candidate/job-preferences/`; lương kỳ vọng được
đồng bộ thành field bắt buộc ở serializer và có regression test cho payload
thiếu lương. Frontend dùng entity `candidate-preferences` cho preference và
entity `candidate-profile` cho giới tính; form workflow thuộc feature
`configure-job-preferences`, còn onboarding/account page chỉ compose và điều
phối điều hướng. Bộ chọn vị trí chuyển sang modal responsive có tìm kiếm, tab
nhóm nghề, giới hạn 1–5 lựa chọn và xác nhận rõ ràng. Trang settings có giới
tính, gửi lỗi field bằng tiếng Việt, toast chỉ hiện một thông báo hiện hành, và
cột hồ sơ bên phải sticky trên desktop. Đăng ký hoặc OAuth thành công của ứng
viên chưa cấu hình preference luôn chuyển vào `/onboard-user`, ưu tiên hơn URL
quay lại. Verify: backend candidate tests, frontend
lint/architecture/unit/build và E2E router desktop/mobile.

</details>

<details>
<summary><b>1.24b</b> — Kết thúc onboarding kiểu TopCV (cá nhân hoá → việc làm)</summary>

Sau khi ứng viên bấm "Hoàn thành" ở `/onboard-user-setting`, thay vì về trang
chủ, luồng mới chạy 3 bước như TopCV: (1) màn "Chờ chút nhé, ProCV AI đang cá
nhân hoá trải nghiệm dành cho bạn" với 3 chip lợi ích + thanh tiến trình
gradient ~3s (`PersonalizingScreen`, hiệu ứng thuần UI không gọi API); (2) màn
"Mọi thứ đã sẵn sàng!" với đếm ngược 9 giây tự chuyển + nút "Đi tới Danh sách
việc làm (dành riêng cho bạn)" đi ngay + mascot (`ReadyScreen`); (3) redirect
sang trang việc làm với bộ lọc dựng sẵn từ preference vừa lưu qua
`buildPersonalizedJobsUrl` (page-local model, có unit test): id vị trí chuyên
môn → `cat`, vị trí tự nhập → `search`, tỉnh/thành đầu tiên → `locations` +
path đẹp `/viec-lam/tai/<slug>` (slugify bỏ dấu, bỏ tiền tố Thành phố/Tỉnh).
Cả hai màn là UI cục bộ của page onboarding (`pages/main/onboarding/ui`),
điều phối bằng state `phase` trong `OnboardUserSetting`; nút "Tôi sẽ hoàn
thiện sau" vẫn về trang chủ như cũ. Verify: lint + architecture + 178 unit
test + build pass; chạy tay full flow trên browser desktop + mobile với tài
khoản dev (`candidate-dev@demo.local`): chọn 3 vị trí IT, nhập "nhân viên máy
tính", Đà Nẵng + Hà Nội → redirect đúng
`/viec-lam/tai/da-nang?cat=…&search=nhân+viên+máy+tính&locations=…`, thanh
tìm kiếm hiện đủ 3 bộ lọc, sidebar CNTT indeterminate 3/7.

</details>

<details>
<summary><b>1.24c</b> — Empty state trang việc làm kiểu TopCV (banner + gợi ý)</summary>

Khi `/viec-lam` không có kết quả, dưới thông báo "Rất tiếc..." hiện thêm 2 khối
(có kết quả thì danh sách hiển thị bình thường, không đổi):
(1) **Banner quảng cáo** do admin cấu hình — thêm placement `job_empty` vào
`sitecontent.Banner` (migration 0013) + seed banner "Tạo CV chuẩn ATS miễn phí"
CTA `/mau-cv`; frontend đọc qua `getBanners('job_empty')` (API
`/site/banners/?placement=` có sẵn), render card gradient theme responsive.
(2) **"Việc làm có thể bạn sẽ quan tâm"** — khảo sát trực tiếp TopCV cho thấy
họ gợi ý theo HỒ SƠ ứng viên (card badge "2 năm kinh nghiệm chuyên môn"...)
chứ không theo từ khóa vừa fail. Làm tương tự: `use-interested-jobs` (page
model) đọc preference đã lưu của ứng viên (`getCandidateJobPreferences`; khách
dùng bộ lọc URL) rồi gọi `/api/jobs/` theo 3 tầng nới lỏng dựng bởi
`buildInterestedJobTiers` (lib thuần, có unit test): chuyên môn + tỉnh/thành →
chỉ chuyên môn → mới nhất; khử trùng lặp public_id, gom đủ 6, tầng trùng nhau
tự loại. Lỗi mạng → khối tự ẩn. UI `JobEmptyExtras` tái dùng
JobCard/JobCardSkeleton, gắn vào `JobResults` qua prop `emptyExtra` nên chỉ
mount (và chỉ gọi API) khi thật sự rỗng. Verify: lint + architecture + 181
unit test + build + backend sitecontent tests pass; browser thật với tài khoản
dev: URL onboarding 0 kết quả hiện đúng thứ tự empty→banner→6 gợi ý, network
3 tầng đúng params từ preference (cat 75,76,77 + loc 3351,1 → cat → newest);
`/viec-lam` có kết quả hiển thị 20 card bình thường, không mount khối gợi ý.

</details>

<details>
<summary><b>1.24d</b> — Bổ sung trang việc làm theo khảo sát TopCV</summary>

Khảo sát trực tiếp trang kết quả TopCV (public, 1.135 việc Nhân sự) và bổ sung
các khối còn thiếu vào `/viec-lam`. **Chèn giữa danh sách** qua prop
`insertAfter` (map index→node) của `JobResults`, né vị trí card gợi ý
phường/xã: (1) banner admin cấu hình placement mới `job_list_inline`
(migration sitecontent 0014 + seed "Việc làm tuyển gấp..." CTA
`/viec-lam?sort=urgent`) sau tin thứ 5 — refactor `PlacementBanner` dùng chung
cho cả `job_empty`; (2) card "Ứng viên ProCV cũng tìm kiếm" sau tin thứ 10 —
từ khóa lấy từ nhánh danh mục đang lọc (con của danh mục, hoặc anh em nếu là
lá) qua `relatedSearchTerms` (lib thuần + test), bấm chạy tìm kiếm ngay.
**Cuối danh sách** (`JobListFooter`, hiện cả trang rỗng lẫn có kết quả như
TopCV): chip "Danh mục Nghề liên quan" = tổ tiên + con + anh em qua
`relatedCategoryChips` (test đủ 3 nhánh); box "Bạn vẫn chưa tìm được công việc
ưng ý?" CTA Nhận thông báo (Sắp ra mắt, đồng bộ nút header); khảo sát hài lòng
1 chạm 5 mức emoji gửi qua API góp ý sẵn có (`Feedback.satisfaction` khớp đủ 5
choices, content tự sinh ≥10 ký tự, kèm page_url) với trạng thái cảm ơn sau
gửi; đoạn SEO text theo nhánh nghề (chỉ hiện khi lọc sâu ≥2 cấp: "X là chuyên
môn... trong danh mục nghề Y thuộc nhóm nghề Z"). **Sort mới "Cần tuyển gấp"**
(`ordering=urgent` xếp `-has_flash_badge` trước, thêm nhánh `_order_jobs` +
option Select). Bỏ qua có chủ đích: lọc "Nghỉ thứ 7" (cần field model Job mới
+ UI đăng tin NTD), "Search by AI" (cần ranking AI), lọc Pro Company (chưa có
khái niệm tier công ty). Verify: backend jobs + sitecontent tests OK, frontend
lint/architecture/189 test/build pass; browser thật: cat=1 hiện đủ 6 khối,
cat=75 (lá, 0 kết quả) hiện SEO text đúng chuỗi "Frontend Developer → Lập
trình Web → Công nghệ thông tin" + chip liên quan đúng tổ tiên/anh em, khảo
sát lưu đúng `satisfied` vào DB, API `ordering=urgent` trả tin flash badge
trước.

</details>

<details>
<summary><b>1.24e–h</b> — Hoàn thiện cá nhân hóa tài khoản ứng viên</summary>

Menu avatar desktop bỏ hover/badge giả, chuyển sang click + single-open accordion,
tự mở nhóm chứa route hiện tại; panel giới hạn theo `100dvh`, menu cuộn độc lập
và nút đăng xuất luôn nhìn thấy. Ba placeholder được thay bằng trang thật:
`/tai-khoan/cai-dat-nhan-email`, `/tai-khoan/doi-mat-khau` và
`/tai-khoan/viec-lam-phu-hop`.

Email dùng model one-to-one `CandidateEmailNotificationSettings` (migrations
`candidates.0004–0005`), 12 preference mặc định bật, GET không ghi row và PATCH
partial create-on-first-write. Frontend chia đúng 3 nhóm phẳng 4/5/3, optimistic
auto-save/rollback. Email xác thực/reset mật khẩu/2FA là email giao dịch, vẫn
ngoài preference và không chiếm một switch riêng. Đây là policy store; chưa có
producer gửi email sản phẩm mới.

Đổi mật khẩu tái dùng `/api/auth/password/`; feature không còn hardcode redirect
employer, hiển thị email candidate read-only, giữ token/session rotation và tùy
chọn đăng xuất thiết bị khác. Rule UI đồng bộ backend: 8–25 ký tự, hoa, thường,
số.

Feed mới `/api/jobs/recommendations/for-me/` ưu tiên preference, dùng CV mặc
định/CV gần nhất để bổ sung position/headline/skills và vẫn hoạt động khi không
có CV. Consent được kiểm trước khi đọc CV; job active/chưa hết hạn, loại job đã
ứng tuyển, salary chỉ so VND, relocate được tính riêng. Response có trạng thái
setup/consent, nguồn dữ liệu, phân trang và `match_details`; search activity
được khai báo `false` vì backend chưa có lịch sử tìm kiếm theo candidate.
Endpoint by-CV cũng được bổ sung consent gate. Verify tập trung: 23 backend test,
31 frontend test đều xanh. Verify cuối toàn repo: Ruff và format check, 2 import
contracts, migration check, 338 backend test với coverage 85,36%; lint và
architecture check frontend, 105 file/369 Vitest, production build và 81/81
Playwright smoke trên desktop/tablet/mobile đều đạt.

</details>

<details>
<summary><b>1.25</b> — Cookie consent và job view tracking</summary>

Hoàn tất theo hai lát cắt độc lập. `apps/privacy` là nguồn sự thật cho consent:
`GET/POST /api/privacy/consent/` dùng cookie ký số `HttpOnly`, policy version 1,
TTL 180 ngày, bắt buộc `necessary=true` và xóa viewer cookie khi rút Analytics.
Consent được throttle `20/hour` ở production; development tắt throttle để QA có
thể thay đổi lựa chọn liên tục mà không bị khóa modal.
Frontend đặt `ConsentProvider` ở app root, `CookieConsentLayer` ở cạnh router để
phủ mọi layout; banner/modal responsive theo mẫu, footer mở lại cài đặt và route
`/chinh-sach-cookie` công khai inventory. `color-scheme` và `search_history`
chỉ persist/đọc khi Preferences được đồng ý.

Job detail GET đã bỏ side effect. `POST /api/jobs/{slug}/views/` kiểm tra signed
consent ở backend, chỉ phát `procv_viewer_id` ngẫu nhiên/ký số khi Analytics
đúng, Redis Lua atomically dedupe key viewer/user trong 24 giờ rồi mới `F()` tăng
PostgreSQL. Redis lỗi fail closed. Tracking luôn hoạt động khi Analytics consent
hợp lệ; CORS vẫn allowlist origin và bật credential cho hai request cookie.
Verify: 16 backend tests (privacy + jobs), `check`,
`makemigrations --check`, 85 frontend tests, lint, architecture và production
build đều pass.

</details>

## Giai đoạn 2 — AI cơ bản

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 2.1 | Bảng `cv_analysis` | ⬜ |
| 2.2 | Bảng `match_results` | ⬜ |
| 2.3 | Bảng `ai_suggestions` | ⬜ |
| 2.4 | Bảng `ai_usage_logs` | ⬜ |
| 2.5 | `ai_core/cv_parser.py` — đọc CV PDF (PyMuPDF) | ⬜ |
| 2.6 | `ai_core/skill_extractor.py` — trích xuất kỹ năng | ⬜ |
| 2.7 | Dataset + train model phân loại nhóm kỹ năng (`skill_classifier.py`) | ⬜ |
| 2.8 | `ai_core/job_matcher.py` — công thức match_score thống nhất | ⬜ |

## Giai đoạn 3 — Tối ưu tìm kiếm / matching

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 3.1 | Bảng `embeddings` (pgvector) | ⬜ |
| 3.2 | Semantic matching CV-JD (Sentence Transformer) | ⬜ |

## Giai đoạn 4 — CV nâng cao

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 4.1 | `cv_versions` + draft/history/owner/share lifecycle | ✅ |
| 4.2 | `cv_exports` + immutable PDF export | ✅ |
| 4.3 | Template taxonomy/color many-to-many + preview asset theo màu | ✅ |
| 4.4 | Candidate “My CV” hoàn chỉnh (duplicate/hard-delete/default) | ✅ — V2 workflow, snapshot ứng tuyển retained detached, smoke desktop/mobile và CTA tới immutable PDF export hoàn tất |
| 4.4a | Candidate apply chọn CV/version bất biến | ✅ — V2 application contract, application snapshot, unit/regression và smoke desktop/mobile |
| 4.5 | Import PDF/DOCX/LinkedIn và AI-assisted authoring | 🟡 — PDF/DOCX đã parse AI thành canonical editable draft; còn LinkedIn, AI writer và review workflow nâng cao |
| 4.6 | CVB-8 WYSIWYG editor kiểu TopCV | ✅ Code + bật mặc định / 🟡 Theo dõi rollout — shell đúng DOCX gồm header website, action bar, rail 176 px tự co chiều cao, panel 352 px, canvas A4 80% và zoom nổi; toolbar rich text nổi theo selection, hiển thị format hiện tại và không thay đổi kích thước trang; design panel có màu luôn mở, slider theo nấc, locale reset tiêu đề/placeholder chuẩn và font fallback stack; inline/rich text, pagination DOM theo item, row/header, DnD touch/keyboard với overlay/vùng thả, avatar/background, template/sample CAS, PDF parity; editor cũ chỉ còn làm fallback; canvas chrome đối chiếu TopCV: toolbar section gọn trong hàng tiêu đề + toolbar item ở cạnh dưới-phải (không che nội dung), mỗi lúc chỉ một tầng chrome và ẩn khi đang gõ (`:has`, hover chủ động vẫn hiện lại), nút Xóa có nhãn màu ngữ nghĩa, avatar mặc định lên đầu cột phụ khi template không có header, thêm mục tự cuộn + focus ô đầu, summary bỏ ô "Tên" thừa, placeholder ngày dạng ví dụ, nhãn vùng Cột chính/Cột phụ, sửa nút "+ Thêm nội dung" bị antd đè `position` làm lệch layout A4; đợt 2 theo TopCV: nút "+ Thêm" chèn item ngay sau item đang hover, editor mức độ kỹ năng 5 nấc khớp preview, kéo mục mới từ panel Thêm mục thả thẳng vào canvas (DndContext dùng chung cấp editor), panel Bố cục thành sơ đồ mini kéo-thả giữa các cột + click đi tới mục, vùng Mô tả luôn hiển thị với placeholder theo loại mục (trước đây item mới không thể nhập mô tả), toolbar định dạng neo góc phải phía trên item nên không đè lên dòng kế bên |

### Kế hoạch hoàn thiện CV Builder theo giai đoạn ([kế hoạch](./03-database/ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md))

<details>
<summary><b>CVB-0</b> — Stabilization (runtime + migration + tạo CV)</summary>

**Migration snapshot application (expand → backfill → contract):** tách `applications.0004` gộp thành `0004_application_snapshot_expand` (thêm cột nullable) + `0005_application_snapshot_backfill` (chỉ dữ liệu, `atomic=False`, **idempotent** — reuse `cvv-application-{pk}` thay vì tạo trùng) + `0006_application_snapshot_contract` (guard hết NULL rồi mới NOT NULL + index). Lỗi thật đã tái hiện trên PostgreSQL 16: bản gộp cũ crash `duplicate key cvv-application-1` khi reverse→re-apply (đúng kiểu "merge nhiều lần vẫn lỗi"); bản tách xử lý đúng. Thêm `apps/applications/tests_migrations.py` — test nâng cấp qua `MigrationExecutor` seed application legacy ở `0003` rồi migrate lên mới nhất, chạy trên Postgres thật (vào CI qua `manage.py test`). **Khóa Python 3.11:** `.python-version` (root + backend), CI 3.13→3.11, `scripts/bootstrap-backend.sh`, `docs/setup-development.md`. **Error mapping tạo CV:** `createCvErrorMessage` map cụ thể backend-down / template chưa publish / sample sai / email chưa xác thực / 401·403·404·409·5xx (trước đây lỗi field 400 của DRF rơi vào message chung), có unit test, nối vào `UseTemplateModal`. Verify: backend `check` + `makemigrations --check` + 141 test pass; frontend lint + architecture + 125 unit test + build pass; **không `--fake`, không reset DB**.

</details>

<details>
<summary><b>CVB-0.2</b> — 🟡 CV API V1→V2 cutover</summary>

V2 bổ sung `PATCH|DELETE /api/v2/cvs/{id}/` cho metadata/hard-delete, `POST /api/v2/cvs/imports/` cho PDF/DOCX và `POST …/duplicate/` cho builder CV. Hard-delete xóa library aggregate/artifacts; snapshot application bất biến được giữ detached để recruiter đọc đúng hồ sơ đã nộp. Trang “CV của tôi” gọi entity API V2, upload nhận phản hồi backend thật và không còn gọi V1. V1 vẫn chạy để client cũ không gãy, nhưng trả `Deprecation`, `Sunset`, successor `Link` và event telemetry tối thiểu không chứa PII. Không tạo `/api/v1/`, không redirect request ghi; chỉ chuyển sang `410` trong release riêng sau khi telemetry cho thấy usage V1 bằng 0.

</details>

<details>
<summary><b>CVB-4</b> — ✅ Candidate application chọn version</summary>

Job detail compose feature `apply-for-job`; feature đọc CV owner, buộc candidate
chọn một `CvVersion` bất biến và gửi `POST /api/v2/applications/`. Backend xác
thực job active, CV owner/active, version thuộc đúng CV và loại trừ internal
`application_snapshot`; transaction tạo snapshot từ đúng version được chọn mà
không làm đổi draft/latest/published pointer. V1 applications không bị đổi hoặc
redirect trong lát cắt này. Verify: 46 backend application/CV tests, 131
frontend unit tests và 22 smoke desktop/mobile.

</details>

<details>
<summary><b>CVB-0.1</b> — Hardening stabilization (idempotent migration + preflight + repair)</summary>

**bootstrap-backend.sh:** phát hiện `backend/venv` cũ sai phiên bản (đọc `venv/bin/python`) và **từ chối cài dependencies** vào venv đó (kèm hướng dẫn), thêm cờ `--recreate` để xóa+tạo lại, và chốt chặn cuối kiểm tra interpreter active đúng 3.11 trước khi `pip install`. **Migration idempotent (khôi phục DB partial-failure):** `0004` bọc trong `SeparateDatabaseAndState` — state vẫn là 4 `AddField` (nên `makemigrations --check` sạch + DB mới không đổi) nhưng DB-side là DDL có guard `IF NOT EXISTS`/kiểm tra cột nên chạy lại trên DB đã có sẵn cột (do migration cũ chạy dở, chưa ghi) là no-op thay vì crash "column already exists"; `0006` index tạo bằng `CREATE INDEX IF NOT EXISTS` + `SET NOT NULL` vốn idempotent; `0005` backfill khi **tái sử dụng** snapshot nay kiểm tra đúng `cv_id` và `version_kind='application_snapshot'`, sai thì raise loud thay vì mislink nhầm CV cho recruiter. **Preflight command** `manage.py cv_snapshot_preflight` (chỉ đọc): báo cáo migration state, cột/index tồn tại, số application thiếu snapshot, và inconsistency (snapshot sai cv_id/kind, orphan `cvv-application-{pk}`); exit 1 khi có vấn đề để CI/deploy chặn; cờ `--repair` chạy backfill idempotent có guard (không drop/reset/`--fake`). **Tests:** `tests_migrations.py` phủ 6 ca — clean / legacy / **partial migration** (cột tồn tại nhưng chưa ghi) / **snapshot đã tồn tại** (reuse không nhân đôi) / **repair hai lần** (idempotent) / **mismatch bị từ chối**; `tests_v2.py` thêm 2 test khẳng định tạo CV trắng + từ sample trả `201` và dựng đủ `UserCv` + `CvVersion` initial + `CvDraft`. Verify đầy đủ: `check` + `makemigrations --check` + `migrate` + **148 backend test**; frontend lint + architecture + **125 test (coverage 84.65%)** + build + **18 e2e smoke**; `git diff --check` sạch. DB local: healthy trước và sau (preflight OK, 0 thiếu snapshot, 0 inconsistency).

</details>

<details>
<summary><b>CVB-1</b> — ✅ Redesign trang mẫu CV + create flow</summary>

**Trang `/mau-cv`:** breadcrumb/tiêu đề theo locale, grid 3 cột, infinite scroll, filter category/tag từ API, card màu và related templates. `UseTemplateModal` cùng trang detail compose `CvSourcePanel`; preview dùng renderer thật, blank/sample map vào `POST /api/v2/cvs/`. Các nguồn previous CV/upload/restore vẫn được ghi rõ là chưa có backend và không được coi là hoàn tất. Verify hiện tại: lint + architecture, 127 unit tests, build và 18 smoke E2E desktop/mobile pass.

</details>

<details>
<summary><b>CVB-1.1</b> — ✅ URL theo ngôn ngữ + nội dung mẫu theo vị trí</summary>

**URL kho mẫu theo ngôn ngữ:** `/mau-cv`, `/mau-cv-tieng-anh|nhat|trung` cùng route detail/category; locale-paths là một nguồn ánh xạ. Position picker đọc 61 `JobCategory` specialization, chỉ hiển thị `name_vi` có tìm kiếm và giữ opaque `public_id`. Baseline localization có đủ 4 locale. Preview resolver dùng curated sample nếu có, nếu không dùng blueprint admin-configurable; một canonical document render trên mọi template, không nhân sample theo template.

</details>

<details>
<summary><b>CVB-1.2</b> — ✅ Category/color từ database và lưu màu vào CV</summary>

`CvTemplate` liên kết nhiều-nhiều với `CvCategory` và `CvColor` qua hai bảng link. Link màu giữ `thumbnail_url`, `preview_url`, `sort_order`, `is_default`; public API trả `colors[]`, card hover/focus đổi đúng asset URL. `POST /api/v2/cvs/` nhận `theme_color`, validate màu active thuộc template rồi ghi vào initial version/draft. Migration `cv_templates.0004` backfill JSON cũ, seed chuyển category legacy và tạo palette; admin quản lý registry + inline link. `theme_color`/`color_variants` vẫn được giữ tương thích trong giai đoạn dual-read, không còn là nguồn chuẩn của frontend mới. Chi tiết và backlog: [kế hoạch CV Builder](./03-database/ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md).

</details>

## Giai đoạn 5 — Tuyển dụng nâng cao

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 5.1 | Bảng `saved_jobs` — xem chi tiết ở mục 1.14o (làm cùng đợt "Việc làm đã lưu") | ✅ |
| 5.2 | Bảng `application_status_history` | ⬜ |
| 5.3 | Bảng `notifications` | ⬜ |

## Giai đoạn 6 — Thương mại & quản trị

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 6.1 | Bảng `subscription_plans` | ⬜ |
| 6.2 | Bảng `user_subscriptions` (quota AI) | ⬜ |
| 6.3 | RBAC admin theo phòng ban + audit log phân quyền | ✅ |
| 6.4 | App `sitecontent`: `SiteSetting` + `LinkGroup`/`LinkItem` + admin + API public `/api/site/` | ✅ |
| 6.5 | `sitecontent.Banner` (carousel trang chủ cấu hình từ admin) + API `/api/site/banners/` | ✅ |
| 6.6 | `SiteSetting` schema-driven: 11 value_type, 15 nhóm, seed 96 keys, cache 1h | ✅ |
| 6.7 | API admin cấu hình: `GET/PATCH /api/site/admin/settings/` + upload ảnh + permission `IsAdmin` | ✅ |
| 6.8 | Trang React `/admin/settings`: tabs 15 nhóm, form tự sinh từ metadata | ✅ |
| 6.9 | Chuẩn hóa frontend 3 cổng (`pages/main/`) + migrate màu brand sang CSS var | ✅ |
| 6.10 | Tách `BestJobs.jsx` (643→478 dòng): `JobPreviewPanel` ra file riêng, dùng label chuẩn | ✅ |
| 6.11 | Tối ưu performance đợt 1: favicon 957KB→1.9KB, chặn upload favicon nặng, tách vendor chunk react | ✅ |
| 6.12 | Cẩm nang nghề nghiệp (blog): app `blog` + API public + trang `/blog` + phân quyền biên tập | ✅ |
| 6.13 | Redesign giao diện blog kiểu TopCV: magazine /blog, danh mục load-more, chi tiết nền xám card trắng | ✅ |
| 6.14 | Cổng marketing nhà tuyển dụng: 5 trang VI/EN, gói dịch vụ + lead, admin CRUD/xử lý lead | ✅ |
| 6.15 | Luồng đăng ký/đăng nhập NTD: profile + consent, email verify → consulting need → dashboard, Google completion, recovery và guard | ✅ |
| 6.16 | Employer verify + dashboard quản trị: checklist bảo mật, KPI/activity/pipeline, recent job/application và shell responsive | ✅ |

### Ghi chú chi tiết — Giai đoạn 6

<details>
<summary><b>6.3</b> — RBAC admin G1–G2 và audit log phân quyền</summary>

Thêm registry permission code-owned và năm bảng `AdminPermission`,
`Department`, `AdminRole`, `AdminMembership`, `AdminAccessAuditLog`; quyền hiệu
dụng là hợp các membership còn hiệu lực, superuser bypass. Audit luôn ghi cùng
transaction và chỉ dùng public ID. `/auth/me` trả snapshot phòng ban/chức danh;
frontend dùng một config route để lọc sidebar, guard và điều hướng. Backend G1C
siết site settings (superuser-only), dịch vụ/lead, catalogue CV (gồm lifecycle
field guard) và job moderation. G2 thêm `is_system_managed`, seed không ghi đè
bản ghi tuỳ chỉnh, API `/api/admin/` và trang `/admin/app/access-control` ba tab.
Mọi ghi/impact/dữ liệu nhân sự là superuser-only; action nguy hiểm dùng token
ký ràng buộc revision/operation/resource/payload, row locking, audit và cache
invalidation. Delegation có scope, audit viewer, dashboard/blog và luồng mời
admin thuộc G3, không nằm trong 6.3 core.

</details>

<details>
<summary><b>6.4</b> — App <code>sitecontent</code></summary>

`SiteSetting` (config key-value JSON) + `LinkGroup`/`LinkItem` (cụm link có thứ tự, source manual/auto từ locations·categories) + Django admin + API public `/api/site/`; frontend `PopularSearches` (cụm link SEO trên footer) đọc từ API.

</details>

<details>
<summary><b>6.5</b> — Banner carousel trang chủ</summary>

`sitecontent.Banner` (slide carousel trang chủ: eyebrow/title/subtitle/theme gradient hoặc image_url/CTA, order, is_active) + admin + API `/api/site/banners/`; `Home.jsx` render banner IT/CV từ API thay vì hardcode (slide thống kê vẫn code cứng vì cần số liệu jobCount/categories realtime).

</details>

<details>
<summary><b>6.6</b> — <code>SiteSetting</code> schema-driven</summary>

Thêm `value_type` (text/textarea/number/boolean/select/color/image/email/url/json/env) + `options` + `order`, 15 nhóm cài đặt (chung, trang chủ, SEO, ứng viên, NTD, việc làm, CV, email, thanh toán, bảo mật, upload, footer, liên hệ, phân quyền, AI), seed 96 keys idempotent (không ghi đè value); cache public API 1h + signal invalidation. Secrets giữ trong `.env` (type `env` chỉ báo đã cấu hình hay chưa). Chi tiết: `docs/05-huong-dan/cau-hinh-site-settings.md`.

</details>

<details>
<summary><b>6.7</b> — API admin cấu hình</summary>

`GET/PATCH /api/site/admin/settings/` (trả theo nhóm + bulk update có validate theo value_type) + `POST /api/site/admin/settings/upload/` (upload ảnh) + permission `IsAdmin` mới trong `accounts/permissions.py`.

</details>

<details>
<summary><b>6.8</b> — Trang React <code>/admin/settings</code></summary>

Tabs 15 nhóm, form tự sinh từ metadata (`SettingField` map value_type → control AntD), dirty-tracking + lưu theo nhóm, upload ảnh, tag Public/env; fix nav DashboardLayout (bỏ menu chết users/skills, highlight theo route).

</details>

<details>
<summary><b>6.9</b> — Chuẩn hóa frontend 3 cổng</summary>

Gom cổng main vào `pages/main/` (Home, auth, jobs, candidate) cho đối xứng với `pages/employer` & `pages/admin`; đổi `PublicRoutes`→`MainRoutes` (`mainRoutes()`) cho khớp tên `EmployerRoutes`/`AdminRoutes`; migrate màu brand hardcode (`#00b14f/#008a3e/#f0fbf5` ở ~30 file) sang `var(--brand-primary/-hover/-soft)` để đổi màu qua site settings áp dụng toàn site; gỡ `settingText` trùng lặp trong `SiteSettingsProvider`; fix bug có sẵn nested `<a>` (Link bọc BrandLogo vốn đã tự render Link) ở `EmployerMarketingLayout`. Verify: lint + build pass, preview 3 cổng không lỗi.

</details>

<details>
<summary><b>6.10</b> — Tách <code>BestJobs.jsx</code></summary>

Đưa `JobPreviewPanel` + `PreviewSection` + helper `textLines` ra file riêng `JobPreviewPanel.jsx`, chuyển helper `formatDeadline` về `constants/jobOptions.js` (cùng nhà với `formatSalary/formatLocations`), và dùng `EXPERIENCE_LEVEL_LABELS` chuẩn thay `experienceLabel` cục bộ (bỏ mapping lạ `senior→"3 năm"`, đồng bộ với JobDetail/JobCard). BestJobs còn 478 dòng. Verify: lint + build pass.

</details>

<details>
<summary><b>6.11</b> — Tối ưu performance (đợt 1)</summary>

(1) favicon **957KB** (PNG 2000×2000, `logo_proCV_2000_2000.png`) tải mọi trang — sửa 2 lớp: **data** (`SiteSetting.brand_favicon_url` trong DB, ghi đè `<link rel="icon">` runtime qua `SiteSettingsProvider`, override cả static tag trong `index.html`) VÀ **code** (`seed_sitecontent.py` idempotent sẽ ép giá trị này về `PROCV_MARK_URL` cũ nếu để nguyên `/favicon.svg` — SVG đó lại là icon tím `#863bff` của brand cũ "aicareer", sai màu thương hiệu). Fix thật: dựng `favicon-32.png` (1.9KB) + `apple-touch-icon.png` (18.8KB) từ đúng logo ProCV bằng Pillow resize, set làm default mới ở seed script + `DEFAULT_SITE_SETTINGS` (`siteSettingsContext.js`) + `index.html`; (2) chặn tận gốc admin upload favicon nặng trong tương lai: `AdminSettingUploadView` nhận thêm `key`, `UPLOAD_MAX_DIMENSIONS = {'brand_favicon_url': (256,256)}` tự resize qua `save_image_upload(..., max_dimensions=...)` (`apps/common/media_storage.py`, dùng Pillow — thêm dependency `Pillow==11.3.0`), test thực nghiệm 957KB→30KB tự động; (3) tách vendor `react` (react/react-dom/react-router-dom/scheduler) thành chunk riêng qua `manualChunks` (dạng **function** vì Vite 8 dùng rolldown) để cache độc lập qua các lần deploy — **cố ý KHÔNG gom antd vào 1 chunk** vì sẽ kéo antd trang admin vào initial load (thử nghiệm cho chunk antd monolithic 344KB gz, đã bỏ); antd để Vite tự tách theo route (vd `Settings` 48KB gz chỉ tải ở route admin). Verify: backend test (`sitecontent`+`accounts`) pass, `manage.py check` pass, build+lint frontend pass, favicon-32.png/apple-touch-icon.png trả 200 đúng dung lượng nhỏ, API public settings trả `brand_favicon_url=/favicon-32.png`. Backlog còn lại (react-query cache API, brotli precompress, WebP/AVIF cho ảnh khác, bundle analyzer, cache-control CDN) ghi trong memory.

</details>

<details>
<summary><b>6.12</b> — Cẩm nang nghề nghiệp (blog)</summary>

App Django mới `apps/blog` (4 model: `PostCategory` taxonomy phẳng 1 cấp, `Post` với `public_id`/slug SEO/`content` HTML rich-text/`related_job_category` FK sang `jobs.JobCategory`/vòng đời `draft→pending→published→archived`, `Tag` M2M, `PinnedPost` ghim theo `placement` cho khối "Tài liệu hỗ trợ tìm việc"). Mở rộng `sitecontent.Banner` thêm placement `blog_sidebar` + cặp `cta_secondary_*` (banner 2 nút Tạo CV/Tìm việc) và group setting `blog` (`blog_page_title`/`blog_meta_description`/`blog_support_docs_title`). **API public read-only** `/api/blog/` (list lọc `category`/`tag`/`q` không dấu, chi tiết theo slug tăng view, `categories`, `pinned`) + endpoint upload ảnh nội dung cho editor (`/api/blog/admin/uploads/`, permission `CanEditBlog`). **Phân quyền** dùng Django Groups: `blog_editor` (soạn/sửa bài của mình, gửi duyệt) + `blog_manager` (duyệt/publish + quản lý danh mục/thẻ/ghim), custom permission `can_publish_post`; PostAdmin lọc queryset theo author và giới hạn choices status cho người không có quyền publish. **Frontend** `/blog`, `/blog/danh-muc/:slug`, `/blog/:slug` (breadcrumb, thanh danh mục ngang cuộn + next/prev, share rail dính copy/FB/in/Twitter + nút mở mục lục drawer, mục lục sinh từ heading h2/h3 với scroll-to + thu gọn, `BlogContent` sanitize HTML + gắn id heading, khối việc làm liên quan theo `related_job_category` + nút xem tất cả, thẻ, cột phải: widget tìm việc nhanh + tài liệu hỗ trợ ghim + banner) + nối menu header "Cẩm nang nghề nghiệp" vào route thật. Seed `seed_blog` (6 danh mục, setting, 2 group quyền) idempotent. Kế hoạch chi tiết: `docs/03-database/ke-hoach-database-cam-nang-nghe-nghiep-blog.md`. Verify: `manage.py check` + smoke test 7 endpoint API 200, preview browser list/filter/detail desktop+mobile không lỗi console.

</details>

<details>
<summary><b>6.13</b> — Redesign giao diện blog kiểu TopCV</summary>

**Backend:** `Banner` thêm placement `blog_inline` (banner "ảnh giả button" — cả khối là 1 link, chèn giữa các section); endpoint `GET /api/blog/home/` trả featured 4 bài + section theo danh mục (4 bài/danh mục) trong 1 request; seed thêm `blog_benefits` (JSON: 3 lợi ích + CTA cho khối "Lợi ích khi sử dụng &lt;site&gt;"). **Trang `/blog` kiểu magazine** (`BlogHome.jsx`): khối "Bài viết nổi bật" 2 cột 5/5 (1 bài lớn + 3 bài dọc), mỗi danh mục một section 4 bài với 3 biến thể bố cục xoay vòng + nút "Xem tất cả", dải nền full-bleed xen kẽ trắng/`--brand-primary-soft`, banner inline chèn sau mỗi 2 section. **Trang danh mục** (`BlogCategory.jsx`): featured 4 bài của danh mục + 2 banner cạnh nhau + "Danh sách bài viết" với skeleton loader và nút "Xem thêm" nạp nối tiếp (append, không paginate) + banner cuối trang. **Trang chi tiết**: nền `#f7f9fc` — mọi khối bọc card trắng; section đầu "Lợi ích khi sử dụng &lt;site&gt;" (3 item + CTA, đọc từ setting); share rail gom 2 nhóm khung bo tròn (chia sẻ / mục lục); mục lục đánh số `1.`/`1.1` + thu gọn mượt bằng `grid-template-rows` transition; input tìm việc có gợi ý (debounce 250ms qua `/jobs/suggest/`) + option "Tất cả tỉnh/thành phố" tường minh; nút banner sidebar kiểu solid/outline có icon. **Chung**: bỏ chip "Tất cả" (/blog là tất cả), thanh danh mục sticky `top-16` dưới header trên mọi trang blog + lăn chuột để lướt ngang + nền trắng, mọi item bài viết/banner mở `_blank`, hover = zoom ảnh (`scale-110`) + nổi khối (translate + shadow) + đổi màu tiêu đề, màu đều từ CSS var thương hiệu. Verify: 6/6 test backend pass, build + lint pass, preview desktop + mobile 3 trang không lỗi console, bấm "Xem thêm" nạp đúng trang kế (8→14 bài, nút tự ẩn khi hết).

</details>

## Giai đoạn 7 — Phỏng vấn AI

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 7.1 | Bảng `interview_question_bank` | ⬜ |
| 7.2 | Bảng `interview_sessions` | ⬜ |
| 7.3 | Bảng `interview_questions` | ⬜ |
| 7.4 | Bảng `interview_answers` + chấm điểm rule-based | ⬜ |

## Giai đoạn 8 — Deployment

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 8.1 | Dockerfile backend + docker-compose (backend + PostgreSQL) | ⬜ |
| 8.2 | Deploy (Vercel + Render/Railway hoặc Docker tự host) | ⬜ |

---

Cập nhật 2026-07-19e (Phase 4 — Quản lý phiên & thiết bị): bảng **`AuthSession`** (migration `accounts/0010`, PK uuid, `user`, `portal`, `refresh_jti` indexed, `device_label`, `ip_address`, `user_agent`, `last_seen_at`, `expires_at`, `revoked_at`). Nhận diện thiết bị hiện tại bằng cách **nhúng claim `sid`** (= AuthSession.id) vào JWT: `services/auth_sessions.py::start_session` tạo phiên rồi set `refresh['sid']` TRƯỚC khi serialize access/refresh (claim custom nên **sống xuyên rotation** — chỉ jti/exp/iat đổi). `issue_tokens(user, request)` giờ nhận request (bắt device/IP) và gọi ở mọi luồng phát token (login/register/2FA/OAuth/đổi mật khẩu). `AccountTokenRefreshView` gọi `rotate_session(old_jti, new_refresh)` để chuyển jti + bump `last_seen`, đồng thời `_ensure_outstanding` ghi OutstandingToken cho jti xoay vòng (simplejwt không tự ghi) để thu-hồi-theo-jti luôn hiệu lực. Thu hồi: `LogoutView` đánh dấu phiên theo jti; `revoke_refresh_tokens` (logout-all/reset/đổi mật khẩu) `mark_all_revoked`. Endpoint mới: `GET /auth/sessions/` (gắn cờ `current` theo `request.auth['sid']`), `DELETE /auth/sessions/<uuid>/` (guard theo user — không đụng tài khoản cùng email cổng khác), `POST /auth/sessions/revoke-others/`. FE: feature `session-management` (`SessionManager` — list thiết bị, nhãn parse từ UA, badge "Thiết bị này", thu hồi từng phiên + "Đăng xuất thiết bị khác", Popconfirm, Skeleton, responsive) gắn vào **ứng viên** `/tai-khoan/cai-dat-bao-mat` (key `security`) và **NTD** `settings/password-login`. Verify: accounts 67 test (+5 gồm sid-preserved-qua-rotation, scope theo user, revoke-others giữ phiên hiện tại), FE 243 + lint/architecture/build xanh; kiểm live trên 1 tài khoản 2 phiên: list hiện đúng "Thiết bị này" vs thiết bị khác, DELETE phiên → 204, list còn 1, refresh token phiên bị thu hồi → 401.

Cập nhật 2026-07-19d (Vá 3 lỗ hổng auth phát hiện khi rà soát toàn luồng): **#1 Đổi email cần re-auth** — `ChangeEmailView` trước đây không kiểm mật khẩu, không chặn tài khoản đã xác thực, không báo địa chỉ cũ → kẻ chiếm access token 15ph có thể đổi email rồi "quên mật khẩu" để cướp tài khoản. Nay: `ChangeEmailSerializer` yêu cầu `current_password` (khi có mật khẩu), view chặn nếu `email_verified=True` (đúng mục đích thiết kế: chỉ cho tài khoản chưa xác thực), và gửi mail cảnh báo đồng bộ về địa chỉ CŨ (`send_email_changed_notice`); FE modal đổi email thêm ô mật khẩu (hiện khi `has_usable_password`). **#2 Giới hạn thử sai mã 2FA** — `verify_code` trước chỉ throttle theo IP; nay đếm số lần sai trong Redis theo `(user, purpose)`, quá `MAX_VERIFY_ATTEMPTS=5` thì hủy mã (buộc gửi lại), `issue_code` reset bộ đếm. **#3 Single-flight refresh (FE)** — nhiều request 401 đồng thời trước đây cùng gọi `/auth/refresh` với một refresh token → rotation+blacklist khiến request thứ hai 401 → văng phiên oan; nay dùng một promise refresh dùng chung. Verify: accounts 62 test (+4), FE 243 test + lint/architecture/build xanh; kiểm live: `change-email` không/sai mật khẩu → 400, đúng → 200; app boot sạch sau refactor interceptor. Các mục 🟡 còn lại (access token cũ ≤15ph, dò email qua register-availability) là tradeoff chấp nhận; quản lý phiên/thiết bị là Phase 4.

Cập nhật 2026-07-19c (Chuẩn hóa logout/phiên theo cổng — Phase 1–3): sửa mâu thuẫn "token tách theo cổng nhưng logout chủ động xóa cả 3 cổng". **FE `token-store.js`**: marker logout **tách theo portal** (`procv_auth_logout_{main,employer,admin}` + `auth_logout_marker_{portal}`) thay cho marker dùng chung; thêm `clearCurrentPortalSession()` (chỉ xóa + phát marker của cổng hiện tại), `clearAllPortalSessions()` (đăng xuất mọi cổng — hành động toàn cục, chủ động) và `getStoredRefreshTokens()`; `subscribeToSessionLogout` chỉ phản ứng với marker của **đúng cổng hiện tại** (subdomain NTD không còn bị đăng xuất khi ứng viên logout). `SessionProvider.logout` mặc định = đăng xuất **cổng hiện tại** + gọi backend blacklist refresh; thêm `logoutAllDevices` (mọi thiết bị của tài khoản) và `logoutEverywhere` (mọi cổng trên thiết bị). **BE**: endpoint mới `POST /auth/logout/` (AllowAny, blacklist đúng refresh token, idempotent) và `POST /auth/logout-all/` (IsAuthenticated, thu hồi mọi refresh token của **đúng row user** — không đụng user cùng email cổng khác). **Đổi mật khẩu**: `PasswordChangeView` luôn **rotate** refresh token phiên hiện tại và trả `tokens` mới (OWASP — thay session identifier sau thao tác nhạy cảm) nên thiết bị hiện tại không bị văng giữa onboarding; checkbox đổi nghĩa thành **"Đăng xuất khỏi các thiết bị khác"** (blacklist các phiên còn lại). Email reset **nêu rõ cổng** ("tài khoản Nhà tuyển dụng/Ứng viên") trong subject + body. Verify: accounts 58 test xanh (thêm 6 test logout/rotation), FE 243 test + lint + `check:architecture` + `test:coverage` + build xanh. *Chưa chạy E2E smoke (cần dựng full-stack 2 cổng) và chưa verify bằng mắt trên preview.* Phase 4 (bảng `AuthSession` + UI quản lý thiết bị) để sau theo thống nhất với user.

Cập nhật 2026-07-19b (CHỐT: Tài khoản tách theo cổng giống TopCV — thay cho mô hình đa-vai bên dưới): user muốn **mật khẩu riêng mỗi cổng**, nên chuyển sang mô hình hai tài khoản độc lập cùng email. Định danh = **(email, role)**: bỏ `unique` toàn cục trên `User.email`, thêm ràng buộc `uniq_users_email_role_lower` (`Lower(email)`, `role`) — một email có tối đa 1 tài khoản ứng viên + 1 NTD (+1 admin), mỗi bên mật khẩu/hồ sơ riêng. `USERNAME_FIELD='email'` cố ý không unique → `SILENCED_SYSTEM_CHECKS=['auth.E003','auth.W004']`, `get_by_natural_key` ưu tiên row staff (Django admin). Đăng nhập resolve theo `(email, role của cổng)` + `check_password` (không dùng `authenticate()`); đăng ký & email-availability & quên mật khẩu đều scope theo cổng/role; Google `resolve_user` tạo/gắn tài khoản riêng mỗi cổng, cùng google-id gắn được cả hai (SocialAccount unique `(provider, provider_user_id, user)`). Đã **hoàn lại** máy móc đa-vai (active-role JWT, capability, provisioning): `token['role']=user.role`, permissions role-based. FE: bỏ hai shortcut chéo cổng trong menu; JWT vẫn namespace theo portal để chuyển URL không ghi đè phiên, còn logout chủ động xóa mọi namespace và phát marker cookie không chứa bí mật để các tab/subdomain cùng đăng xuất; `requestPasswordReset`/`checkRegistrationEmail` truyền portal/role. Migration `accounts/0009`. Verify: accounts 52 test xanh, employers/candidates/cvs/jobs 115 xanh, FE 240 test + lint + build + architecture + 38 smoke E2E xanh; còn 5 lỗi độc lập `apps.applications.tests_migrations` (InvalidCursorName trong `cv_snapshot_preflight`) ngoài phạm vi.

Cập nhật 2026-07-19 (Đa vai — một tài khoản dùng cả cổng ứng viên lẫn NTD) — **ĐÃ THAY bằng bản 2026-07-19b ở trên**: bỏ mô hình `User.role` đơn trị làm cổng authorization. Năng lực suy từ hồ sơ (không thêm cột, không migration): `has_employer_capability`=`is_employer or có recruiter_profile`, `has_candidate_capability`=`is_candidate or có candidate_profile`, `available_roles` suy từ đó. Vai đang hoạt động = role trong JWT của từng cổng (token lưu tách cổng); `get_token/issue_tokens` nhận `active_role`, one-time-code OAuth và challenge 2FA mang `portal`; `/auth/me/` trả active role theo `request.auth['role']` nên guard/redirect FE chạy đúng mà không decode JWT. OAuth `resolve_user` bỏ chặn `wrong_portal` → `_ensure_portal_capability` tự cấp `recruiter_profile` (cổng NTD) / `candidate_profile` (cổng ứng viên) rồi vào onboarding sẵn có. Permissions capability-based (`IsEmployer`/`IsCandidate`); password-login KHÔNG tự cấp năng lực (chỉ Google/đăng ký), đối xứng hai chiều; admin vẫn cấp tay, không tự phục vụ. FE: nút "Chuyển sang Nhà tuyển dụng" trong menu tài khoản ứng viên khi đã có năng lực NTD. Verify: `apps.accounts` 53/53 test xanh, toàn bộ test permission ở candidates/cvs/jobs/applications/employers xanh, lint + architecture pass. Còn lại là lỗi độc lập ngoài phạm vi: 5 lỗi `apps.applications.tests_migrations` (InvalidCursorName trong `cv_snapshot_preflight`) và 2 lỗi `contact_phone` của feature "cho trùng SĐT" đang làm dở song song (migration 0011 chưa commit, model còn `unique=True`).

Cập nhật lần cuối: 2026-08-06c (AN-V3 — runtime strip áp theme/ảnh nền:
`normalizeAnnouncement` nhận `theme`/`background`; `buildAnnouncementStripVisual`
set CSS vars + layers ảnh/overlay; class `announcement-strip--has-bg` tắt sheen;
mobile nút điều khiển 44×44. System banner vẫn theo kind. Unit contract/strip
visual pass. AN-V4 runbook còn lại.)

Cập nhật 2026-08-06b (AN-V2 — upload ảnh nền + form/preview admin:
`POST /api/site/admin/announcements/backgrounds/` (JPEG/PNG/WebP, 640–2400×24–120,
≤1MB); editor bước “Loại & CTA” có theme kind/preset/custom, ColorPicker, upload
nền, fit/overlay; preview Desktop/Tablet/Mobile áp token màu shared
`resolveAnnouncementThemeTokens`, line-clamp 2 trên mobile, height theo content.
AN-V3 còn: wire runtime strip. Nhánh `feat/announcement-visual-theme`.)

Cập nhật 2026-08-06 (AN-V0/AN-V1 — nâng cấp visual thông báo đa cổng:
chốt hybrid theme kind/preset/custom hex + một ảnh nền strip (ví dụ 980×31)
kèm overlay contrast; height strip luôn theo content (cấm khóa 31px). AN-V1
backend: migration `sitecontent.0017`, validate storage key/hex, public DTO
`theme`/`background`, admin revision fields, tests visual + regression
announcement xanh. Bắt buộc AN-V2 live preview admin (desktop/tablet/mobile)
và AN-V3 runtime responsive. Nhánh `feat/announcement-visual-theme`. Doc:
`03-database/ke-hoach-nang-cap-thong-bao-visual-theme.md`. AN-P5/AN-P6 không đổi.)

Cập nhật 2026-07-29m (AN-P2/AN-P3 equal-tier UX follow-up — Docker
selector xác nhận hai thông báo info cùng hạng 6/priority 300 đều được trả cho
candidate authenticated tại `/viec-lam`; runtime chủ đích chỉ hiển thị một item
mỗi lần và luân phiên theo 5/6 giây. Sửa dismissal chuẩn hóa queue index và
announce item kế tiếp trước render nên focus-pause không còn để nội dung opacity
0 trên nền rail. Editor đổi nhãn thành “Thứ tự trong cùng hạng”, giải thích số
lớn chạy trước nhưng không loại item thấp hơn, đồng thời nhắc mọi target/lịch
phải cùng khớp request. Regression mục tiêu 13/13 và smoke runtime 15/15 trên
desktop/tablet/mobile pass. Không đổi API, migration, permission hoặc trạng
thái AN-P5/AN-P6.)

Cập nhật 2026-07-29l (AN-P2/AN-P3 animation follow-up — sửa `slide`
và `fade` chỉ chạy 280–320 ms lúc mount khiến một thông báo trông như đứng
yên. Runtime nay lặp animation nhẹ theo `display_seconds` khi queue có một
item; queue nhiều item vẫn luân phiên như cũ. Hover/focus/tab ẩn pause chuyển
động; `static` và reduced motion không animate. Preview quản trị chạy đúng
animation và thời lượng bản nháp. Verify: 683 frontend test; lint,
architecture, build và bundle budget 293,6 KiB JS / 34,2 KiB CSS pass; smoke
runtime 12/12 trên desktop/tablet/mobile xác nhận animation name, 6 giây và
infinite iteration. Không đổi API, migration, permission hoặc trạng thái
AN-P5/AN-P6.)

Cập nhật 2026-07-29k (AN-P3/AN-P5 UX hardening — editor thay URL CTA
nội bộ và textarea prefix bằng danh mục route có tìm kiếm. CTA được chọn độc
lập với surface hiển thị, nhóm theo bốn portal, tự sinh URL local/subdomain và
gắn nhãn Công khai/Cần đăng nhập; guest nhận cảnh báo nếu CTA đi vào route có
AuthGuard. Include/exclude lọc theo surface, hỗ trợ tags/custom prefix và
validation cùng contract backend. Preview bước 5 đọc toàn bộ form store nên
hiển thị đúng nội dung đã soạn ở bước 1. Regression gồm route catalog, form
binding, guest/auth warning và luồng editor năm bước; kiểm tra trực tiếp local
xác nhận CTA Ứng viên → Marketing NTD công khai, cảnh báo workspace cần đăng
nhập và preview đúng bản nháp. Verify: 683 frontend test; lint, architecture,
build, bundle budget 293,6 KiB JS / 34,2 KiB CSS và smoke quản trị thông báo
6/6 trên desktop/tablet/mobile đều pass. Không đổi API, migration, permission
hoặc trạng thái AN-P5/AN-P6.)

Cập nhật 2026-07-29j (AN-P5 — staging rehearsal: dựng Compose project
cô lập và mở tuần tự Admin → NTD marketing → workspace NTD → ứng viên. Preflight
đủ bốn surface trả `status=ok`, không warning/error; smoke desktop/tablet/mobile
không overlap hoặc tràn ngang trên các route kiểm tra. Priority thực tế xác
nhận critical vượt DPA, xác thực email vượt nhắc nhu cầu công việc và nhắc nhu
cầu vượt remote info. Kill switch candidate trả false/empty nhưng system label
vẫn hiển thị. Failure injection Redis phát hiện throttle trả 500 trước service;
nhánh `fix/announcement-redis-resilience` chuyển riêng telemetry throttle sang
fail-open có metric PII-free, chạy lại khi Redis dừng đạt 202. Verify bản vá:
55 sitecontent test, 13 analytics test, ruff/format/import-linter/Django check
và migration check sạch. Full repository gate sau commit đạt 617 backend test,
coverage 86,13%, 666 frontend test, bundle budget và 153 smoke E2E. Evidence:
`06-deployment/announcement-staging-evidence-2026-07-29.md`. AN-P5 giữ 🟡 cho
tới khi merge fix, deploy staging hạ tầng thật và soak tối thiểu 30 phút mỗi
surface; AN-P6 vẫn bị khóa cho tới một release ổn định.)

Cập nhật 2026-07-29i (AN-P5 — rollout hardening: backend có kill
switch fail-closed theo từng surface; response active feed công khai
`remote_enabled`, surface tắt trả danh sách rỗng và không query database.
Frontend chỉ nhận remote item khi cờ này là `true`, retry có giới hạn, báo
telemetry PII-free và dùng error boundary trả banner legacy nếu render lỗi;
system label xác thực/bảo mật/tuân thủ không phụ thuộc remote feed. Thêm runtime
event throttle 60/giờ, metric feed latency/status và command read-only
`announcement_rollout_preflight` kiểm integrity, critical end time, live surface
và rotation group. Runbook chốt rollout Admin → NTD marketing → workspace NTD →
ứng viên, failure injection, ngưỡng dừng và rollback không reverse schema.
Không có migration hoặc permission mới. Verify toàn repo: backend 615/615 pass,
coverage 86,12%; frontend 187 file/666 test pass, coverage 44,03% statements /
41,32% branches / 39,51% functions / 46,37% lines; architecture 909 module /
1.830 dependency sạch; OpenAPI validate; bundle 293,6 KiB JS / 34,2 KiB CSS;
smoke 153/153 trên desktop/tablet/mobile. AN-P5 giữ 🟡 cho tới khi có preflight,
kill-switch rehearsal, monitoring và smoke evidence từ staging thật; AN-P6
chưa được mở trước một release ổn định.)

Cập nhật 2026-07-29h (AN-P4 — dismiss/snooze và analytics:
authenticated state dùng `PUT` idempotent, row lock, revision +
dismissal-version stale trả `409`; feed loại state dismiss/snooze bằng
`Exists` trong cùng một query. Guest state chuyển sang `localStorage` và giữ
fallback P2 `sessionStorage`. Event impression/click/dismiss được gom batch,
throttle 240/giờ, chỉ ghi khi signed Analytics consent hợp lệ và Redis claim
viewer–revision–surface–event–ngày thành công; Redis lỗi/duplicate/invalid event
fail-closed và phát operational metric PII-free, CTA không chờ tracking.
Admin list trả aggregate thật và sort server-side; tab Hiệu quả đọc summary +
daily metrics toàn bộ revision trong 7/30/90 ngày, kèm cảnh báo phạm vi consent.
Không có migration hoặc permission mới; OpenAPI thêm state/event/metrics.
Verify: backend 609/609 pass, coverage 86,09%, concurrency/query budget/throttle/
Redis failure pass; frontend 185 file/661 test pass, coverage 43,95% statements /
41,25% branches / 39,42% functions / 46,28% lines; architecture 904 module /
1.822 dependency sạch; build + bundle budget 293,6 KiB JS / 34,2 KiB CSS pass;
full smoke 150/150 và focused admin metrics 6/6 pass trên
desktop/tablet/mobile. Rollback code không xóa user state/daily aggregate và
không làm mất system security label.)

Cập nhật 2026-07-29g (AN-P3 CI follow-up — GitHub E2E sau merge
phát hiện mobile CV delete bị flaky do hai Ant Design portal còn chuyển động,
khiến sticky header chặn pointer hoặc confirmation button bị thay node trong lúc
Playwright chờ vị trí ổn định. Smoke chuyển hai action menu/modal sang keyboard
activation theo đúng role accessible, không dùng `force` hoặc tăng timeout để
che lỗi. Verify: tái hiện 5/5 fail trước sửa; sau sửa mobile concurrent 5/5 pass
và desktop/tablet/mobile lặp ba lần 9/9 pass. AN-P4 bị giữ lại cho tới khi fix
branch merge và CI xanh.)

Cập nhật 2026-07-29f (AN-P3 — workspace quản trị thông báo:
thêm route `/admin/app/announcements` theo `announcement.view`, danh sách
server-side có URL filter/sort/pagination, editor 5 bước, preview desktop/mobile
và Việt/Anh, priority simulator, lifecycle publish/schedule/pause/resume/archive,
duplicate/rename, immutable revision và audit history. Mutation được khóa chống
submit lặp; revision token stale trả `409` và buộc tải lại, không tự ghi đè.
Detail read-model bổ sung audit bằng một query phẳng; query budget detail tăng
có chủ đích từ 2 lên 3. Không có migration hoặc permission mới; OpenAPI thêm
`AnnouncementAuditEvent`. Verify: toàn backend 595 test pass, coverage 86,02%;
Ruff/format, 2 import contract, Django check, migration drift và OpenAPI validate
pass. Toàn frontend 182 file/654 test pass; coverage 43,83% statements /
41,09% branches / 39,33% functions / 46,15% lines; architecture 897 module /
1.808 dependency không vi phạm; build + bundle budget 293,6 KiB JS /
34,2 KiB CSS pass; full smoke 150/150 pass trên desktop/tablet/mobile, trong đó
6/6 scenario AN-P3 cover create, publish, stale conflict và view-only.
AN-P3 không thay đổi schema; rollback application code/OpenAPI không làm mất
announcement, revision, permission hoặc audit.)

Cập nhật 2026-07-29e (AN-P2 — runtime strip đa cổng: thêm
`entities/announcement` sở hữu active-feed contract/query key theo session,
normalize DTO/URL/enum fail-closed; `widgets/announcement-strip` hợp nhất remote
feed với xác thực email, DPA và nhu cầu công việc bằng pure priority resolver
tier 1–6. Strip sticky tự đo chiều cao, slide/fade/static, pause khi
hover/focus/tab ẩn, reduced-motion static, desktop một dòng/mobile hai dòng,
CTA internal/HTTPS an toàn, manual live-region và compatibility banner theo
`VITE_ANNOUNCEMENT_ROLLOUT_SURFACES`. Bốn surface candidate, employer marketing,
employer workspace và admin workspace đã gắn; rollout mặc định tắt và rollback
về legacy không cần đổi schema. Verify: 30 test phạm vi pass; toàn frontend
177 file/644 test pass, coverage 44,30% statements / 41,48% branches /
39,83% functions / 46,71% lines; architecture 873 module/1.759 dependency
không vi phạm; build + bundle budget 293,3 KiB JS / 34,2 KiB CSS pass; full
smoke 144/144 pass trên desktop/tablet/mobile, không pageerror hoặc horizontal
overflow. Không có migration, permission hay OpenAPI diff ở AN-P2.)

Cập nhật 2026-07-29d (AN-P1 — backend foundation dải thông báo:
thêm schema additive announcement/revision/user-state/daily-metric; ba permission
`announcement.view/manage/publish`; active feed target theo surface/session/path,
priority deterministic và locale fallback; admin API tạo revision bất biến,
publish/pause/resume/archive/duplicate với row lock, revision token `409` và
audit. Migration forward/reverse test pass; public/list/detail query budget lần
lượt 1/2/2; toàn backend 595 test pass, coverage 86,01%; accounts + sitecontent
213 test pass; frontend permission contract 2 test, lint, architecture, build
và bundle budget pass. OpenAPI đã sinh/validate; runtime UI chưa được gắn và
thuộc AN-P2.)

Cập nhật 2026-07-29b (AUTH-OAUTH-REAUTH — `GET /api/auth/password/`
trả điều kiện phiên; banner xác thực lại tại chỗ với `next` quay về đúng trang,
thay cho việc xoá phiên và đá về `/login`.)

Cập nhật 2026-07-29 (ADMIN-EMPLOYER-VERIFY — đồng nhất badge/hàng chờ,
thu gọn hành trình 9 bước, nhóm giấy tờ và làm rõ phạm vi đối chiếu MST.)

Cập nhật 2026-07-26a (ADMIN-RBAC-G2 — migration `accounts.0014` backfill
`is_system_managed`; ma trận seed chuyển vào constants và giữ độc lập ownership
department/role; API `/api/admin/` có impact preview + token ký 10 phút, kiểm
revision sau `select_for_update`, audit/cache trong transaction; UI
`/admin/app/access-control` ba tab với picker runtime/deprecated, badge MFA và
409 buộc xem lại; command `create_admin_user`; backend concurrency/regression,
frontend unit/architecture/build được bổ sung.)

Cập nhật 2026-07-26b (ACCOUNT-MANAGEMENT-G3 — migration `accounts.0016` thêm
provisioning scope/lời mời Admin và seed permission `account.*`, `accounts.0017`
thêm index truy vấn thiết bị/phiên; backend có
whitelist fail-closed, token mời versioned 72 giờ, accept transaction + row
locking, MFA email/mã dự phòng, impact token cho trạng thái/scope/phiên,
audit/cache và query budget. Frontend mở `/admin/app/accounts` năm tab với bộ
lọc nâng cao, drawer + chi tiết hồ sơ/bảo mật/audit, form mời chỉ dùng
`available-roles`, luồng accept public và tab Cấp tài khoản superuser. Có seed
Docker demo, backend concurrency/API test, frontend unit/architecture/build và
E2E smoke responsive.)

Cập nhật 2026-07-29b (ACCOUNT-IDENTITY-RECOVERY-P0 — migration
`accounts.0020` thêm `auth_revision` cho User/AuthSession, outbox cancelled +
notice và hai permission không grant mặc định. JWT/refresh/password reset/MFA
challenge/OAuth one-time code đều bind revision; worker fail-closed với identity
snapshot stale. Admin có hai luồng preview/confirm độc lập: đổi email buộc
password unusable, revoke session/OAuth và gửi cảnh báo; reset MFA xóa email
OTP/TOTP/backup code nhưng giữ password/OAuth/email/status. Frontend thêm feature
`recover-account-identity`, gate từng quyền, 409 tự re-preview không tự confirm.
Production cấm tuyệt đối `/admin/` bằng `DJANGO_ADMIN_ENABLED=False`; break-glass
qua `createsuperuser` + `bootstrap_admin_mfa` có quyền máy chủ. P0 superuser-only,
PENDING/soft-deleted fail-closed; runbook yêu cầu email → MFA → password reset.)

Xác minh bàn giao G3: backend **443/443** test với coverage **84,85%** trên
PostgreSQL Docker; frontend **441/441** unit test, dependency-cruiser **0**
violation, production bundle **286,8/320 KiB JS** và **33,8/35 KiB CSS** gzip;
Playwright smoke **87/87** trên desktop/tablet/mobile. Migration drift, Ruff,
format và import-linter đều sạch.

Xác minh bàn giao G2: `./scripts/check_all.sh` xanh toàn bộ; backend **417/417**
test với coverage **85,54%**, frontend **416/416** test với coverage
statements/branches/functions/lines lần lượt **40,45% / 36,48% / 36,06% /
42,97%**, import-linter **0** contract vỡ, dependency-cruiser **0** violation,
production bundle **290,0/320 KiB JS** và **33,5/35 KiB CSS** gzip, Playwright
smoke **81/81** trên desktop/tablet/mobile.

Cập nhật 2026-07-22f (CAMP-SIMPLIFY — chốt "chiến dịch chỉ cần tên": form chỉnh sửa (`CampaignForm.jsx`) rút còn đúng ô Tên (bỏ mô tả/vị trí/cấp bậc/headcount/ngân sách/ngày/tuyển liên tục), modal thu gọn 760→480; trang chi tiết bỏ thẻ "Thông tin chiến dịch" (các field kế hoạch trống), bỏ query danh mục không dùng; giữ phần phân tích (KPI, phễu, biểu đồ 7 ngày, gauge tiến độ, nguồn CV, tính năng sắp ra mắt). PATCH campaign chỉ gửi { name }. Verify: oxlint sạch, 3 test campaign pass (cập nhật matcher getAllByText cho KPI trùng), vite build xanh.)

Cập nhật 2026-07-22e (CAMP-DETAIL UI — nâng cấp trang chi tiết chiến dịch hiện đại/đầy đủ: header có chip trạng thái + badge tuyển liên tục + dải 4 chỉ số nhanh; tab Tổng quan thêm thẻ "Thông tin chiến dịch" (vị trí, cấp bậc, mục tiêu, ngân sách, thời gian), phễu xử lý hồ sơ dạng thanh theo 7 trạng thái pipeline, thẻ "Nguồn ứng viên" (ứng tuyển trực tiếp = thật, CV đề xuất/tìm kiếm/mời lại = Sắp ra mắt), khu "Tính năng sắp ra mắt" hiển thị đầy đủ layout nhưng vô hiệu hóa: AI Campaign Copilot, Matching CV–JD minh bạch, Kho ứng viên; panel Tin/CV thêm toolbar + CTA + empty state. Chỉ dùng dữ liệu report/serializer có sẵn, không đổi backend. Verify: oxlint + vite build xanh; chưa kiểm mắt vì trang sau đăng nhập employer + cần full-stack.)

Cập nhật 2026-07-22d (JOB-FORM UX — nút Quay lại thông minh ở header workspace cạnh tiêu đề "Không gian nhà tuyển dụng": chỉ hiện trên trang đăng/chỉnh sửa tin (`/jobs/new`, `/jobs/:id/edit`); ưu tiên lùi theo lịch sử phiên (từ tin về tin, từ chiến dịch về chiến dịch), khi mở trực tiếp (location.key === 'default') fallback về chi tiết tin (edit) hoặc danh sách tin (new). Sửa `EmployerWorkspaceLayout.jsx`. Verify: oxlint + vite build xanh; chưa kiểm mắt vì trang nằm sau đăng nhập employer.)

Cập nhật 2026-07-22c (CAMP-LIST UX — hành động inline hiện khi hover ở danh sách chiến dịch: hover dòng hiện dưới tên chiến dịch ba nút text không khung Sửa chiến dịch/Xem báo cáo/Xem CV ứng tuyển (Sửa mở modal đổi tên tại chỗ); hover cột Tin tuyển dụng hiện Chỉnh sửa + (nếu bị từ chối) Xem lý do bị từ chối mở modal viền đỏ, chưa có tin thì hiện Đăng tin; cột Thao tác thu gọn còn Dừng/Mở lại; mobile card hiển thị cùng nhóm nút không cần hover. Backend thêm `rejected_reason` vào `campaign_job` (selector annotate + serializer). Verify: employer campaign tests 6/6, makemigrations --check sạch, oxlint + vite build FE xanh; chưa kiểm mắt trên preview vì cần phiên employer + dữ liệu tin bị từ chối.)

Cập nhật 2026-07-22b (CAMP-PLAN — chốt kế hoạch mở rộng chiến dịch tuyển dụng: giữ mô hình 1 chiến dịch – 1 tin + timeline các vòng đăng suy từ `job_status_history`; ba điểm khác biệt AI Campaign Copilot / matching minh bạch hai chiều / talent pool theo chiến dịch; liệt kê dịch vụ trả phí tương lai chờ billing-entitlement; roadmap CAMP-M1…M5 tại `03-database/ke-hoach-chien-dich-tuyen-dung-mo-rong.md`. Chỉ tài liệu, chưa sửa code.)

Cập nhật 2026-07-22 (EMP-JOBS — campaign/tin/CV workspace: sửa dashboard tự phục hồi recruiter profile cũ; campaign tạo nhanh theo tên rồi chọn hoạt động, không yêu cầu company/xác thực; job pages kiểm tra lại đủ 5 bước employer-verify; admin moderation bắt buộc cho mọi tin và có lý do từ chối hiển thị cho chủ tin; sidebar Quản lý CV có hai mục Nhãn CV/Yêu cầu kết nối CV ở trạng thái sắp mở. Chi tiết lifecycle ở `03-database/ke-hoach-chien-dich-va-vong-doi-tin.md`.)

Cập nhật 2026-07-19f (DLCN — hoàn thiện trạng thái đã nộp): khi văn bản thỏa thuận ứng viên–nhà tuyển dụng ở trạng thái **Hệ thống đang xử lý**, phần **Văn bản mẫu** và nút tải DOCX vẫn xuất hiện cạnh tệp đã nộp; bỏ nhãn trạng thái lặp lại ở dòng tệp để tiêu đề là nguồn trạng thái duy nhất. Chế độ **Chỉnh sửa** vẫn có liên kết xem tệp cũ, còn tên tệp mới hiển thị bên trong ô upload. Backend chuẩn hóa tên hiển thị sau lưu là **Thỏa thuận xử lý DLCN**. API ưu tiên bản DLCN recruiter mới nhất trước bản lịch sử company nên không mở nhầm tệp cũ; DOC/DOCX URL HTTPS/S3 mở bằng Google Viewer, PDF và localhost mở trực tiếp. Hover đổi theo màu thương hiệu setting. Test component/API xác nhận các hành vi này.

Cập nhật 2026-07-19g (EMP-P10 — Nhu cầu tuyển dụng): mở route settings `/account/settings/recruitment-demand`, sidebar active, danh sách responsive không cuộn ngang, thêm/sửa/xóa/bật-tắt nhu cầu. Thiết lập nguồn ngân sách theo mẫu TopCV mở popover radio và có Lưu/Hủy: đây là giá trị chung Công ty/Cá nhân, không lọc danh sách, được lưu cho các nhu cầu hiện có và mặc định cho nhu cầu mới; form modal có hierarchy/spacing dễ quét hơn. Migration `employers.0013` chuyển dữ liệu onboarding `RecruitmentNeed` từ one-to-one sang danh sách theo recruiter mà không mất bản ghi cũ; API CRUD mới và dashboard/onboarding tiếp tục dùng nhu cầu đầu tiên làm mốc hoàn tất. Verify: migration check, 125 regression backend (employers/dashboard/accounts), frontend lint/architecture/build xanh.

Cập nhật 2026-07-19h (EMP-RESP — responsive cổng nhà tuyển dụng): rà soát lại marketing, auth/onboarding và toàn bộ workspace/settings employer theo mobile, tablet, desktop. Sidebar mobile/tablet chuyển thành drawer phủ có mask; menu settings dùng dropdown thay thanh tab ngang; dashboard journey dùng grid; màn xác minh không kích hoạt hai cột quá sớm; các form GPKD, DLCN, công ty, tài khoản, bảo mật, đổi mật khẩu và nhu cầu tuyển dụng có spacing, text wrapping, modal/popover và cụm nút thích ứng viewport. Hero/CTA/card marketing được giảm typography và xếp dọc hợp lý trên mobile. Playwright thêm project tablet `834x1112` và assertion chống horizontal overflow xuyên các route employer. Baseline mobile-first đã được ghi vào `frontend/ARCHITECTURE.md`. Verify: lint, architecture, build, 10 unit regression và 27/27 smoke employer desktop/tablet/mobile xanh.

Cập nhật 2026-07-19i (EMP-REGISTER — tối ưu trang đăng ký): bỏ thanh **Các bước tạo tài khoản** ở phần đầu nhưng giữ nguyên luồng Tiếp tục/Quay lại hai phần. Thay bằng khối **Quy định đăng ký tài khoản** mặc định mở, có thể thu gọn/mở lại, dùng tên hệ thống và hotline động từ site settings; nội dung cảnh báo tài khoản trùng lặp và quy định hiển thị tin được trình bày rõ trước form. Header và form được làm phẳng, bỏ khung viền/đổ bóng bao quanh; consent chỉ dùng đường phân cách nhẹ. Verify: ESLint targeted, architecture, build và 3/3 Playwright regression desktop/tablet/mobile xanh, gồm trạng thái `aria-expanded`, luồng Tiếp tục và chống tràn ngang.

Cập nhật 2026-07-19j (EMP-REGISTER — kiểm tra mật khẩu): phần mật khẩu đăng ký employer nay xác minh trực tiếp theo bốn điều kiện: tối thiểu 8 ký tự, có chữ hoa/thường, có số và có ký tự đặc biệt. Hướng dẫn hiển thị mức **Yếu / Trung bình / Mạnh**, thanh bốn nấc và trạng thái từng điều kiện, đồng thời validator của form chặn Tiếp tục đến khi toàn bộ điều kiện đạt. Phạm vi chỉ áp dụng cho luồng đăng ký employer, không thay đổi policy đăng ký ứng viên. Verify: 4 unit test password validation và regression E2E đăng ký employer.

Cập nhật 2026-07-19k (EMP-REGISTER — UX hướng dẫn mật khẩu): khối xác minh mật khẩu employer chỉ mở khi input Mật khẩu nhận focus và tự đóng ngay khi blur (ví dụ chuyển sang Nhập lại mật khẩu), giúp form gọn và không che nội dung kế tiếp. Regression E2E xác nhận cả trạng thái hiển thị khi nhập lẫn trạng thái đóng khi rời input.

Cập nhật 2026-07-19l (EMP-REGISTER — lưu ý email doanh nghiệp): thêm note cảnh báo ngay dưới ô Email đăng nhập rằng email không thuộc tên miền công ty có thể bị hạn chế quyền mua hoặc sử dụng một số dịch vụ. Note dùng màu cảnh báo nhẹ, icon thông tin và tự ngắt dòng trên mobile; regression E2E xác nhận hiển thị trên form đăng ký.

Cập nhật 2026-07-19m (EMP-VERIFY — kết thúc đúng năm điều kiện): chỉnh frontend dùng cùng định nghĩa với backend `verification_completed`: năm mục xác thực trên checklist là số liệu duy nhất của progress. **Đăng tin tuyển dụng đầu tiên** được tách khỏi xác thực, không còn hiển thị trong checklist/progress dashboard. Direct navigation tới `/employer-verify` sau khi đủ năm mục sẽ tải profile canonical rồi redirect về dashboard, kể cả khi `first_job_posted=false`. Thêm E2E regression cho redirect này.

Cập nhật 2026-07-19n (EMP-DASHBOARD — hành trình xác thực): đối chiếu dashboard TopCV đã đăng nhập và thiết kế lại khối xác thực theo mô hình journey: header có vòng phần trăm, lời chào và mô tả lợi ích; năm bước xác thực hiển thị trạng thái hoàn tất/bước tiếp theo/chưa hoàn tất. Desktop dùng dải năm mục trực quan; tablet/mobile hạ thành grid/danh sách dễ quét, không tràn viewport. Đăng tin đầu tiên tiếp tục bị loại khỏi tiến độ xác thực.

Cập nhật 2026-07-19o (EMP-DASHBOARD — sticky hành động đăng tin): đưa journey về bố cục dải cuộn theo dashboard TopCV; tiêu đề của năm bước là liên kết mở tab mới đến tác vụ tương ứng. **Đăng tin tuyển dụng đầu tiên** tách thành item ghim ở mép phải, hiển thị khóa đến khi workflow đăng tin được triển khai; không tính vào xác thực, không có Top Points/điểm thưởng. Nút điều hướng dải bước hỗ trợ cuộn ngang có chủ đích, còn mobile giữ item ghim ở mép phải mà không phát sinh tràn viewport.

Cập nhật 2026-07-20a (EMP-DASHBOARD — brand background): tải SVG `v-brand` từ tài nguyên tham khảo TopCV về `frontend/public/images/employer/topcv-v-brand.svg` và self-host làm nền trang trí ở cạnh phải của section hành trình xác thực. Asset là decor nên `alt` rỗng và `aria-hidden`, không thêm nội dung lặp cho trình đọc màn hình.

Cập nhật 2026-07-20b (EMP-DASHBOARD — brand background position): đồng bộ đúng CSS định vị của mẫu cho asset `v-brand`: `top: -250px`, `bottom: 0`, `right: 5%`; không ép kích thước hoặc opacity làm thay đổi tỷ lệ SVG gốc.

Cập nhật 2026-07-20c (EMP-P11 — Thông tin công ty): hoàn thiện catalogue nội bộ recent/search 6 mục/trang và loại placeholder legacy; thêm catalogue lựa chọn server-driven cùng migration seed lĩnh vực `employers.0014`. Trang account company dùng option cards, form Doanh nghiệp/Hộ kinh doanh đầy đủ, checkbox phụ thuộc, TipTap allowlist 10.000 ký tự, logo và gallery tối đa 10 ảnh. Sau liên kết hiển thị đúng owner/member/pending; owner gửi diff qua update request và thay đổi MST/tên phải có hồ sơ gắn request trước khi admin duyệt. Verify: Django check + migration check, 46/46 backend employer regression, 9/9 frontend unit/API, lint/architecture/build và 3/3 Playwright smoke desktop/tablet/mobile xanh; không tràn ngang.

Cập nhật 2026-07-20d (EMP-P11 — khóa liên kết công ty): bỏ dependency giữa xác thực SĐT và thao tác tạo/join công ty; recruiter chưa xác thực điện thoại vẫn lưu được hồ sơ hoặc gửi giấy tờ liên kết. Sau lần tạo/chọn đầu tiên, backend từ chối mọi yêu cầu tạo/join công ty khác và dùng `select_for_update` trong transaction để chống request đồng thời; frontend bỏ cảnh báo/disable theo SĐT, đồng thời ẩn hoàn toàn hai luồng lựa chọn khi đã liên kết và hiển thị ghi chú liên kết cố định. Verify: 48/48 regression backend employer, 6/6 unit frontend company, lint/architecture/build xanh.

Cập nhật 2026-07-20e (CI — frontend green): khắc phục ba job PR bị đỏ và một job bị skip. `static-quality` sạch sau khi bỏ icon không dùng; test cài đặt 2FA dùng `data-testid` contract thay selector class layout để layout grid không gây lỗi coverage; CSS initial gzip 31,5 KiB được kiểm soát bởi budget thực tế 35 KiB (JS 279/320 KiB). Đồng bộ smoke employer với UX dashboard mới: tài khoản đã đủ năm xác thực phải rời checklist, còn CTA **Đăng tin tuyển dụng đầu tiên** vẫn được ghim ngoài hành trình xác thực. Verify đầy đủ: API/feature boundary, oxlint, dependency-cruiser, 76/76 Vitest files (270 test) với coverage, build production, `check:bundle-budget` và 63/63 Playwright smoke desktop/tablet/mobile xanh.

Cập nhật 2026-07-22a (Chi tiết việc làm — kỹ năng & quyền lợi bổ sung): tách kỹ năng khỏi hàng tag tóm tắt và render thành khối riêng đúng ngữ cảnh đọc. `JobDetailSerializer` thêm `required_skills`, `preferred_skills`, `benefit_groups` (gom theo `Benefit.Category`, thứ tự Phụ cấp → Hỗ trợ thiết bị → Phúc lợi → Khác); `get_requirement_tags` không còn nối tên kỹ năng required nên hàng "Yêu cầu:" chỉ còn kinh nghiệm/tuổi/học vấn/giới tính. Không thêm cột DB, `active_job_detail_queryset()` đã prefetch sẵn `job_skills__skill` + `job_benefits__benefit` nên không phát sinh N+1. Frontend: `JobDetailBlocks` thêm `JobSkills` (2 cột `sm:grid-cols-2`, gộp 1 cột ở mobile) render dưới rich text "Yêu cầu ứng viên", `AdditionalBenefits` render dưới "Quyền lợi"; xoá `BenefitTags` (hàng "Quyền lợi:" trùng dữ liệu với khối mới). `JobText` nhận thêm `children` để lồng khối phụ trong đúng section. Verify: 307 test backend + coverage 84.22%, ruff/lint-imports/makemigrations sạch, 317 vitest + build; browser thật trên tin có đủ 3 loại dữ liệu — khối kỹ năng đo được `grid-template-columns: 340px 340px` ở desktop và 1 cột ở 375px, không tràn ngang. Còn nợ: `benefit_tags` thành field không consumer và `openapi.yaml` đang lệch ~1200 dòng so với code (tách commit riêng).

Cập nhật 2026-07-31a (CV Builder — dữ liệu mẫu template + lọc danh mục): DB dev trước đó có 36 nội dung CV mẫu và 5 màu nhưng **0 `CvTemplate`**, nên `/mau-cv` rỗng và ứng viên không tạo được CV — `seed_cv_catalog` chỉ trang trí template đã tồn tại chứ không tạo template. Thêm command `seed_cv_templates` (idempotent) dựng 10 mẫu trên đủ 3 renderer đã deploy (`classic_single_column_v1`, `classic_two_column_v1`, `header_two_column_v1`): template + version publish qua service chính thức, mapping 13–15 section vào region, localization 4 ngôn ngữ, 19 danh mục 4 loại (style/audience/position/feature), 8 màu và 80 color link; dữ liệu khai báo tách sang `_cv_template_catalog.py`. Cờ `--snapshots` xếp hàng render ảnh preview thật. Sửa hai lỗi lộ ra khi dựng dữ liệu: (1) `compose_cv_document` nay tự tạo marker `nameplate`/`contact` khi template map chúng — layout header không có header block dựng sẵn nên trước đó CV tạo từ mẫu này **không hiển thị tên và liên hệ** ở cả preview lẫn PDF; (2) `snapshot_fingerprint` chọn locale theo `default_locale_code()` thay vì localization đầu bảng chữ cái, tránh thumbnail tiếng Anh trên catalogue tiếng Việt. Frontend: `CatalogFilterBar` bỏ wrap 3 hàng, chuyển thành một hàng cuộn ngang có nút mũi tên (ẩn khi hết nội dung), mask mờ ở mép, chip **Tất cả** ghim ngoài vùng cuộn, chip cùng `category_type` nhóm cạnh nhau và ngăn bằng vạch mờ, tự cuộn chip đang chọn vào tầm nhìn khi vào bằng URL danh mục. Verify: ruff/ruff format/lint-imports/makemigrations sạch, 685 test backend + coverage 86.44%; oxlint/dependency-cruiser/build, 722 vitest (200 file, thêm 4 test `CatalogFilterBar`), 162/162 Playwright smoke; browser thật xác nhận 10 thẻ có preview tiếng Việt, `dinh-cao` (header layout) render `nameplate_1` trong region header, và thanh lọc không tràn ngang ở 375px lẫn 1440px.

Cập nhật 2026-07-31b (Thông báo đa cổng — hiện lại cho người đã đóng): báo cáo "tạo thông báo nhưng không hiển thị" hóa ra không phải lỗi target/rollout — backend trả đúng 1 item cho cả bốn surface với guest/candidate/employer/admin, và `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES` + `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES` đều đủ bốn cổng. Nguyên nhân: người dùng đã bấm ✕ đóng thông báo đó; dismissal được khóa theo `(announcement, dismissal_version)` ở `AnnouncementUserState` và theo key local storage `announcement-strip:{id}:v{version}` ở trình duyệt khách, nhưng **`dismissal_version` chưa từng được tăng ở bất kỳ đâu trong repo** — `publish_announcement` chỉ tăng `revision_token`. Hệ quả: ai đã đóng một thông báo thì vĩnh viễn không thấy lại, dù admin sửa và publish bao nhiêu revision. Trường này vốn có sẵn check constraint, nằm trong unique constraint và được serialize xuống client làm khóa cache — tức năng lực "hiện lại" đã thiết kế sẵn nhưng chưa nối dây ở server. Bổ sung service `reset_announcement_dismissals` (khóa hàng, kiểm `revision_token`, chỉ cho phép khi `published`, giữ lại state row cũ làm lịch sử), endpoint `POST /api/site/admin/announcements/{public_id}/reset-dismissals/` dưới `announcement.publish`, audit action `announcement_reset_dismissals`, nút **Hiện lại cho người đã đóng** kèm hộp thoại xác nhận trong drawer chi tiết, và hiển thị **Phiên bản hiển thị lại** để chẩn đoán. Chọn action riêng thay vì tự tăng mỗi lần publish: sửa lỗi chính tả không nên làm phiền lại toàn bộ người đọc. Verify: ruff/ruff format/lint-imports sạch, 59/59 test sitecontent (thêm 2 test: revision mới không đủ để hiện lại, và chặn stale token/draft), 728 vitest (201 file, thêm test API cho cả 5 lifecycle action), oxlint/dependency-cruiser xanh; kiểm chứng trực tiếp trên DB docker: đóng → feed rỗng, POST reset → `dismissal_version` 1→2 và feed hiện lại, token cũ trả 409, thông báo archived trả 400.

Cập nhật 2026-08-03a (UI — linh vật ProCV thay spinner chờ): thay spinner CSS hình tròn ở `PageLoading` và dot mặc định của antd `Spin` bằng ảnh động linh vật ProCV. Asset gốc là GIF 500×500, 172 frame, **6,66 MB** — quá nặng cho một chỉ báo chờ hiển thị ở mọi lần chuyển route lazy, nên tối ưu qua ffmpeg + `gif2webp`: cắt 1 giây đầu (đoạn zoom cận cảnh, lặp lại mỗi 5,7s trông rất lạ và là phần nén tốn bit nhất), hạ còn 192px/17fps/180 màu, xuất animated WebP `public/images/loading/procv-loader.webp` **260 KB** (giảm 96%, 80 frame, loop vô hạn, nền trong suốt giữ nguyên) kèm poster tĩnh `procv-loader-static.webp` 7,6 KB cho `prefers-reduced-motion`. Thêm `shared/ui/BrandLoader.jsx`: `size` dạng số thì set inline, bỏ trống thì để CSS quyết định — cần thiết vì `ConfigProvider spin={{indicator}}` chỉ nhận một node duy nhất, không biết `size` của từng `<Spin>`. Component phải nuốt prop `percent` do antd tiêm vào lúc `cloneElement`, nếu không sẽ rơi xuống thẻ `img` thành attribute lạ. `PageLoading` chuyển sang `BrandLoader size={128}`, phủ luôn `Suspense fallback` của `AppRouter`, `AuthGuard`/`GuestGuard`/`PermissionGuard`, `OAuthCallback`, `JobPreferenceSettings`, `OnboardUserSetting`. Kích thước indicator bám theo `size` của antd qua `.procv-spin-dot` (28/40/60px cho small/default/large) trong `index.css`; phải dùng `!important` vì antd chèn `.ant-spin .ant-spin-dot { width: 1em }` bằng CSS-in-JS lúc runtime, không đảm bảo thứ tự so với stylesheet. Đo trên browser thật phát hiện thêm một lỗi: Preflight đặt `img { max-width: 100% }` mà `.ant-spin` lại rộng 0 nên ảnh co về **0×40px** — thêm `max-width: none !important` mới ra đúng 28/40/60 vuông. Giữ nguyên 70 file dùng `Skeleton` (giữ được layout, đổi sang ảnh động sẽ gây nhảy layout). Verify: oxlint sạch, dependency-cruiser 1000 module không vi phạm, 784 test/211 file vitest (thêm 4 test `BrandLoader`), build production, 168/168 Playwright smoke; đo trực tiếp trong DOM xác nhận ba cỡ indicator đúng số. Lưu ý còn lại: WebP thừa hưởng alpha 1-bit của GIF gốc nên viền có thể hơi gắt trên nền tối, và asset 260 KB chưa được preload nên lần tải nguội đầu tiên chỉ hiện dòng chữ trước khi ảnh về.

Cập nhật 2026-08-04a (TTS — mở giọng đọc cho mọi bề mặt, không riêng blog): hạ tầng đọc đã có sẵn và tốt (tts-service nhận text thô, single-flight theo `artifact_key`, cache, `PcmStreamPlayer` Web Audio), nhưng contract public bị khoá cứng vào bài viết: `SpeechSessionRequestSerializer` chỉ nhận `source_type='blog_post'`, view bắt buộc `published_blog_post_for_speech()`, normalizer nhận **model `Post`** và parse HTML, còn engine phát audio thì nằm trong `features/listen-to-blog-post/model/` nên slice khác không được import (feature không import feature). Mở thêm `source_type='text'` trên chính endpoint cũ: normalizer generic `plain_text_speech_script` (`plain-speech-v1`, mỗi dòng là một block để giữ nhịp ngắt, vẫn chạy HTML parser để không đọc to thẻ và không announce "đoạn mã được lược bỏ" như luồng bài viết), service `create_text_speech_session` **không** đăng ký `BlogSpeechAsset` và không bắn Celery finalizer — câu nói quá ngắn và quá nhiều để trả giá 1 row DB + 1 MP3 mỗi lượt, nên chỉ chạy live stream. `source_revision` ghim hằng `text:v1` để cùng một câu từ bất kỳ bề mặt nào rơi vào **một** artifact identity (đo thực tế: lần đọc thứ hai trả `cached: true`, trùng `artifact_key`). Rào chắn cho input đến từ client: `SPEECH_MAX_ADHOC_TEXT_CHARS=600` và scope throttle riêng `speech_adhoc` 90/hour (`get_throttles()` chọn scope theo `source_type`) để robot nói nhiều không ăn hết hạn ngạch 60/hour của người đang nghe blog — engine chỉ có `TTS_MAX_CONCURRENT_STREAMS=1` worker. Frontend: nâng `PcmStreamPlayer`/`NativeAudioPlayer`/`pcm-stream-format` + chính sách chờ 429/503 lên `shared/lib/speech/`, gom vòng retry mở luồng thành `playSpeechStream` dùng chung (blog và ad-hoc không còn copy nhau), thêm `createTextSpeechSession` vào `entities/speech` và feature mới `features/speak-text` với `useSpeak()` — `speak(text)` là đủ. Ràng buộc không bỏ được: AudioContext chỉ mở trong cử chỉ người dùng nên lần phát đầu phải nằm trong handler click/tap; bề mặt tự nói (trợ lý) gọi `unlock()` ở lần bấm đầu tiên rồi `speak()` tự do. Verify: ruff/ruff format/lint-imports/makemigrations sạch, 30/30 test app speech (thêm test cho throttle scope tách biệt, chặn text rỗng/quá dài, markup không được đọc to, không sinh artifact), 720 pass backend + coverage 86,31%; oxlint/dependency-cruiser (1026 module, 0 vi phạm)/build, 803 vitest (217 file, thêm 9 test `useSpeak`), 173/174 Playwright smoke. Đo trên stack docker thật: POST text → 201 + 230 KB WAV 48 kHz mono trong 0,83 s, lặp lại → `cached: true`, text rỗng và 700 ký tự đều 400. Nợ đã biết: 8 test `apps/jobs/test_posting_workflows.py` đang đỏ sẵn từ trước (deadline windows, không liên quan) và `blog-admin-permissions.spec.js` flaky (chạy lại xanh).

Cập nhật 2026-08-04b (Trợ lý ứng viên — robot đọc câu trả lời): nối `useSpeak()` vào `widgets/candidate-assistant` qua hook `useAssistantVoice(messages)`. Chỉ đọc câu trả lời cho tin nhắn người dùng vừa gửi: mốc `spokenIdRef` khởi tạo bằng ID tin nhắn cuối lúc mount nên **lời chào không bao giờ được đọc** — panel là lazy chunk, lúc nó mount thì cử chỉ mở đã kết thúc và trình duyệt chặn autoplay, mà tự phát tiếng khi người dùng chưa hỏi gì cũng là hành vi gây khó chịu. `voice.prepare()` gọi `unlock()` ngay trong handler submit — cử chỉ hợp lệ duy nhất trước khi câu trả lời về sau ~1,1s. Giọng cố định `north-female-news` (Mai Anh). Nút loa trong header panel bật/tắt, lưu `procv_assistant_voice_v1` ở localStorage, tắt thì `stop()` ngay và không đọc các câu sau; bật lại cũng là cử chỉ hợp lệ để mở Web Audio. Bật tiếng giữa chừng không đọc lại câu cũ. Mascot dùng `talking={typing || voice.speaking}` và dòng trạng thái thêm "Đang đọc câu trả lời…". Verify: oxlint sạch, dependency-cruiser 1030 module 0 vi phạm, 820 test/219 file vitest (thêm 9 test `useAssistantVoice` + 2 test tích hợp trong `CandidateAssistant`), build, 174/174 Playwright smoke. Kiểm chứng trên browser thật với stack docker: gửi câu hỏi → POST `/api/speech/sessions/` 201 → stream `/tts/v1/streams/...` phát hết bài rồi tự về trạng thái nghỉ, patch `AbortController` xác nhận **0 lần abort** từ phía client (dòng `ERR_ABORTED` trong network panel chỉ là cách devtools ghi nhận response streaming dài); bấm tắt tiếng → `aria-pressed=false`, localStorage `off`, câu sau không phát.

Cập nhật 2026-08-05a (FAQ/Help Center KB-P1): hoàn tất app skeleton,
common HTML sanitizer, model/migration, seed bảy category và bốn permission với
role mapping `content-cv`. Targeted test, Ruff, migration drift,
import-linter/layering đều xanh; KB-P2 là bước tiếp theo.

Cập nhật 2026-08-05b (FAQ/Help Center KB-P2): hoàn tất service state
machine draft → review → approve/reject → publish/rollback, archive/restore,
optimistic concurrency, media JPEG/PNG/WebP, admin API/RBAC, audit và OpenAPI.
22 targeted/regression test, query budget 3, Ruff/import-linter/layering đều xanh;
KB-P3 là bước tiếp theo.

Cập nhật 2026-08-05c (FAQ/Help Center KB-P3): hoàn tất entity API +
renderer, bốn feature biên tập/category/review/publish, widget danh sách và
workspace editor, ba page lazy admin cùng navigation/RBAC. Danh sách giữ filter,
sort và page trong URL; editor không autosave server, có dirty guard, local
recovery, preview, media JPEG/PNG/WebP, diff, history và optimistic token 409.
Lint phần thay đổi sạch, architecture/build xanh, 13 targeted test pass và smoke
workflow lưu → gửi duyệt → duyệt → xuất bản pass trên desktop/tablet/mobile.
KB-P4 public help center là bước tiếp theo.

Cập nhật 2026-08-05d (FAQ/Help Center KB-P4): hoàn tất public selector
không lộ draft/rejected/archived/inactive, ba API browse/search/detail có
throttle/cache/ETag/kill switch và SEO shell canonical + Article/BreadcrumbList
giữ `noindex`. Frontend có ba route `/tro-giup`, search/type/page lấy URL làm
nguồn chuẩn, trạng thái loading/empty/error/404, layout sidebar + question list
responsive và renderer ảnh lỗi an toàn. 28/28 test knowledgebase backend, 9
frontend regression, lint/architecture/build và E2E public ở ba viewport đều
pass. KB-P5 nội dung đã xác minh và entry point là bước tiếp theo.

Cập nhật 2026-08-05e (FAQ/Help Center KB-P5): thêm bảy bài ProCV
approved/published, mỗi category active có một bài; nội dung được đối chiếu với
route, component và hành vi đăng ký/khôi phục, bảo mật, tìm việc, ứng tuyển, CV,
báo cáo rủi ro và hỗ trợ. Data migration additive có ID ổn định, không ghi đè
bài đã có và không xóa dữ liệu khi reverse. Public site-settings expose
`knowledgebase_public_enabled` từ backend kill switch; hai mục trong floating
actions và mục hướng dẫn CV trên header chỉ hiện khi capability bật, điều hướng
tới route canonical thay cho toast sắp ra mắt. 26 backend test và 4 frontend
regression test pass; Ruff, oxlint và architecture gate sạch. KB-P6 hardening,
observability, sitemap/index và runbook là bước tiếp theo.

Cập nhật lần cuối: 2026-08-05f (FAQ/Help Center KB-P6): thêm index switch riêng
mặc định tắt, đồng bộ SEO shell/client metadata, search page noindex và sitemap
knowledgebase chỉ xuất hiện khi public + index + global SEO cùng bật. Bổ sung
command readiness JSON kiểm 7 category, bài public, source/SEO, review, hạn,
link canonical, media/alt; structured metric request/latency public/admin,
zero-result và content state không chứa raw query/PII. Runbook khóa trình tự mở
public rồi index, tiêu chí quan sát và rollback không reverse migration. Test
diễn tập bật → đọc ID → tắt → 404 → bật lại xác nhận cùng dữ liệu. 48 backend
và 14 frontend regression test mục tiêu đều xanh. Full gate đạt 769 backend test
(coverage 86,36%), 886 frontend test, 191 E2E smoke pass và 4 ca theo viewport
không áp dụng được skip; Ruff/format/import-linter/migration drift,
oxlint/architecture/build đều xanh. Toàn bộ KB-P0 đến KB-P6 hoàn tất.

Cập nhật 2026-08-05g (FAQ — tinh giản UX ứng viên): bỏ search server-side trên
UI, type filter, topic cards và counter trên `/tro-giup`; giao diện chỉ còn
sidebar chuyên mục cố định và danh sách câu hỏi gọn với một input lọc cục bộ
không ghi URL/gọi search API. Mặc định item chỉ có title; khi nhập, bộ lọc khớp
title/excerpt không phân biệt dấu, highlight phần trùng và hiện excerpt đầu nội
dung trên một dòng có ellipsis. Bỏ item “Tất cả chủ đề”; API `q`/`type` vẫn giữ
để không phá contract. Bỏ ràng buộc ảnh phải upload vào media ProCV: revision nhận URL
HTTPS hoặc đường dẫn nội bộ an toàn, vẫn sanitize và bắt buộc alt; readiness chỉ
kiểm tra file tồn tại với ảnh thuộc media storage nội bộ. Editor FAQ có tab
**Từ URL** để chèn trực tiếp ảnh HTTPS mà không qua upload. Workspace biên tập
đưa “Bước tiếp theo” cùng nút gửi duyệt/duyệt/yêu cầu sửa lên đầu, đồng thời giữ
Lưu/Xem trước trên thanh sticky; topbar admin, thanh hành động và toolbar
rich-text có offset/z-index riêng nên không chồng hoặc cắt nội dung khi cuộn.
Detail FAQ hiển thị ảnh, giờ cập nhật và nhãn “Câu hỏi tiếp”. Verify: 48 backend
regression, 889 frontend coverage, 6 targeted
unit cho thay đổi tìm kiếm và 6 E2E public/admin trên desktop/tablet/mobile;
Ruff/format/import-linter/migration drift, lint/architecture/build đều xanh.

Cập nhật 2026-08-05h (FAQ — tìm kiếm toàn bộ chuyên mục): thay bộ lọc cục bộ của
bản 08-05g bằng một truy vấn global tối giản: input debounce 250 ms, gửi `q` tới
API nhưng không gửi category và không ghi từ khóa lên URL. Khi có từ khóa, UI
hiển thị `Tìm thấy N kết quả cho “…”`; mỗi item đặt nhãn chuyên mục phía trên
title, tiếp theo là excerpt một dòng, đồng thời highlight phần khớp không phân
biệt dấu trong title/excerpt. Eyebrow “Chuyên mục” dùng `--brand-primary` được
provider sinh từ site setting `brand_primary_color`, không tạo accessor setting
song song. Unit 6/6 và smoke public 3/3 trên desktop/tablet/mobile đều pass.

Cập nhật 2026-08-05i (FAQ — revision UX và danh sách tách thẻ): bỏ nền/viền của
khung danh sách câu hỏi, giữ từng item nền trắng với gap và hover độc lập. Sửa
luồng tạo revision bài đã publish bị kẹt do `change_summary` bắt buộc nhưng form
đang chỉ đọc: modal tạo revision nhận tóm tắt trước, API clone draft rồi editor
mở lại để tiếp tục chỉnh. Scope lại CSS workflow, nút gửi duyệt/duyệt/yêu cầu
sửa còn cao 30 px và không full-width trên mobile. Targeted unit 5/5, smoke
admin 3/3 và public 3/3 trên desktop/tablet/mobile đều pass; lint sạch.

Cập nhật 2026-08-05j (FAQ — giữ vị trí item sidebar): đổi eyebrow “Trong chuyên
mục này” thành “Tên chuyên mục”. Public compact article bổ sung `order`; sidebar
chi tiết ghép bài hiện tại với related articles rồi sắp xếp theo cùng contract
của danh sách. Vì vậy click bài chỉ đổi active state, không còn đẩy item lên đầu
và làm người đọc lạc vị trí. Public API 9/9 và frontend unit 2/2 pass.
Smoke public 3/3 trên desktop/tablet/mobile pass.

Cập nhật 2026-08-06 (JOB-REVIEW — duyệt tin biết rõ thay đổi và không mất nút
Duyệt): thêm `Job.approved_snapshot`/`approved_snapshot_at` (migration
`jobs.0034`) — mỗi lần duyệt lưu lại bản nội dung được công khai, nên khi nhà
tuyển dụng sửa tin đang tuyển và tin quay về `pending`, trang duyệt hiển thị mục
**Thay đổi cần duyệt** đối chiếu từng trường trước/sau (tiêu đề, mô tả rich text,
thu nhập, hạn, kỹ năng, địa điểm, liên hệ…), badge “Bản cập nhật · N thay đổi” và
chip điều hướng có số đếm; thay đổi thuộc thông tin liên hệ chỉ hiện với quyền
`job_moderation.view_sensitive_contact`, người thiếu quyền thấy số lượng bị ẩn.
Tin chưa có bản gốc nói rõ “Chưa có bản đã duyệt để so sánh” thay vì báo không có
thay đổi; command `backfill_job_snapshots` gieo baseline cho tin đang tuyển.
`deadline_expired` không còn ẩn nút Duyệt: nó thành `approve_requirements`, admin
duyệt kèm chọn hạn nhận hồ sơ mới (ghi vào lịch sử kiểm duyệt), còn các điều kiện
chặn thật (policy/moderation hold, tài khoản bị hạn chế, chiến dịch dừng) trả về
`approve_blockers` khiến nút hiện dạng disabled kèm tooltip lý do thay vì biến
mất. Gọn lại layout: nút Quay lại thành text nhỏ căn trái, cảnh báo chặn công
khai còn một dòng, thu nhỏ quick-fact/disclosure header. Verify: backend
784/784 pytest (coverage 86,31%), import-linter + migration check sạch, frontend
lint/architecture/build xanh, unit 905/905 (thêm 3 test diff + 3 test hành động
duyệt), kiểm mắt desktop 1512px và mobile 420px trên preview.

Cập nhật 2026-08-06b (JOB-REVIEW UI — thanh "Đi nhanh đến" theo chuẩn hệ thống):
đổi từ dãy chip bo tròn nhiều màu (nền xanh brand khi active, badge số tròn đỏ)
sang một thanh segmented vuông vức: khung viền bo 8px, ô nhãn nền `#f8fafc` ngăn
bằng divider, mỗi mục cao 36px vuông góc cách nhau bằng đường 1px, active dùng
nền `#f1f5f9` + gạch chân `inset 0 -2px 0 #334155` thay vì đổi màu chữ sang brand,
badge đếm là chip xám bo 4px (`#e2e8f0`, active đảo thành `#334155`). Mobile ẩn ô
nhãn và giữ dải mục cuộn ngang trong khung. Chỉ CSS, không đổi markup/aria.
Verify: lint sạch, build xanh, unit widget 4/4 pass, kiểm mắt 1512px và 420px.

Cập nhật 2026-08-06c (JOB-REVIEW UI — chuyển trang duyệt sang mô hình tab):
thay chuỗi disclosure thả xuống bằng tab thật — mỗi tab render đúng một panel nội
dung (`AdminJobPanel` header tĩnh + body), không còn mở/đóng nhiều khối cùng lúc.
Tablist theo chuẩn ARIA (`role="tablist"/"tab"/"tabpanel"`, `aria-selected`,
roving `tabIndex`, phím ←/→/Home/End). Sidebar phải rút còn thẻ **Tóm tắt kiểm
tra** dính (sticky); ba mục Nhà tuyển dụng/Nhận hồ sơ/Báo cáo chuyển thành panel
chính (`AdminJobReviewPanels`). Tách `AdminJobDecisionDock` khỏi
`AdminJobOverview` để dock quyết định và thanh tab nằm chung một khối sticky
`admin-job-sticky-bar`, offset tính bằng `--admin-topbar-height +
--announcement-strip-height` nên không bị thanh thông báo che; mobile ≤639px trả
về tĩnh vì dock xếp dọc. Bỏ nút Mở tất cả/Thu gọn tất cả (vô nghĩa với tab). Tab
mặc định là **Thay đổi** khi có diff, ngược lại là **Nội dung**. Verify: lint +
architecture sạch, build xanh, unit 907/907 (thêm 2 test chuyển tab), kiểm mắt
desktop 1512px và mobile 420px.

Cập nhật 2026-08-06d (JOB-ADMIN — link trang công khai + rút gọn danh sách tin):
backend annotate `is_publicly_visible` cho `_admin_job_queryset` bằng chính
`publicly_available_job_filter()` (predicate dùng cho mọi bề mặt ứng viên) rồi
phơi ra ở serializer list/detail, nên link admin không bao giờ trỏ tới trang 404.
Frontend thêm `AdminJobPublicLink`: ở chi tiết là link chữ "Xem trang công khai"
nằm cùng hàng với nút Quay lại; ở bảng danh sách chỉ là icon `ExportOutlined`
cạnh tiêu đề (không thêm dòng), có Tooltip; tin chưa công khai hiện icon xám
không bấm được kèm lý do. Dải 5 thẻ thống kê màu (AdminStatCard) ở trang danh
sách đổi thành một thanh segmented xám trung tính: nhãn viết hoa nhỏ, số lớn,
dòng chi tiết mờ, mục đang chọn nền `slate-100` + gạch chân — vẫn là bộ lọc scope
như cũ. Không đụng `AdminStatCard` dùng chung (Dashboard vẫn giữ nguyên). Verify:
backend 785/785 pytest coverage 86,31% (thêm test `is_publicly_visible` bám sát
predicate công khai), ruff/format/import-linter sạch; frontend lint/architecture
xanh, unit 907/907, build xanh, kiểm mắt danh sách + chi tiết trên preview.
