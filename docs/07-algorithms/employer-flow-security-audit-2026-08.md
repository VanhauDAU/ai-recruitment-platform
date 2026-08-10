# Audit luồng và bảo mật Nhà tuyển dụng — ER-0 (2026-08)

> **Trạng thái:** Baseline kèm remediation evidence; chỉ finding có test đỏ →
> vá → retest và evidence trong phase tương ứng mới được đổi trạng thái.
> **Kế hoạch canonical:**
> [ke-hoach-ra-soat-va-khac-phuc-employer.md](../03-database/ke-hoach-ra-soat-va-khac-phuc-employer.md)  
> **Decision log:**
> [employer-remediation-decision-log.md](../02-tong-quan/employer-remediation-decision-log.md)

## 1. Phạm vi và phương pháp

Audit đọc code và test hiện hành trên các boundary:

- employer onboarding/profile/company/update request;
- document list/detail/content và company media;
- admin employer verification/final decision;
- job moderation, campaign/application/CV access;
- phone OTP, DPA evidence;
- notification/activity;
- frontend guards, cache/query state và direct-route behavior.

Mỗi finding có severity, evidence, exploit/impact, phase remediation và retest
criteria. Báo cáo này không thay thế penetration test production hoặc legal
review DPA.

### Severity

| Mức | Diễn giải |
| --- | --- |
| Nghiêm trọng | Có thể lộ file/candidate data hoặc bypass quyết định bảo mật quan trọng |
| Cao | Sai ownership/state có thể ghi đè dữ liệu, duyệt sai hoặc khóa/mở sai quyền |
| Trung bình | Sai UX/audit/availability làm người dùng thao tác trên state không đáng tin |
| Thấp | Documentation/observability debt chưa trực tiếp mở quyền |

## 2. Tóm tắt finding

| ID | Mức | Finding | Trạng thái | Phase |
| --- | --- | --- | --- | --- |
| ER-F01 | Cao | Thẻ cá nhân dùng company-wide request, hiện ngày giả và che fetch error | Closed ER-1A | ER-1A |
| ER-F02 | Cao | Shared pending request có thể bị member khác upsert/đổi requester; admin có thể mở sai request cùng company | Safety closed ER-4; lifecycle follow-up | ER-1B/ER-4 |
| ER-F03 | Nghiêm trọng | Document queryset/content permission cho member rộng hơn binary-file policy | Closed ER-1B | ER-1B |
| ER-F04 | Cao | Upload đi thẳng storage, thiếu quarantine/malware scan/fail-closed submit | In remediation — employer closed; candidate/staging open | ER-3 |
| ER-F05 | Cao | Partial upload có thể để request/file dở dang nhưng UI báo thành công | Closed ER-3 employer slice | ER-3 |
| ER-F06 | Cao | Document/prerequisite reconciliation có thể tự approve verification/company | Closed ER-5 | ER-5 |
| ER-F07 | Nghiêm trọng | Job approval chưa có đầy đủ authoritative verification/DPA blocker ở mọi đường | Closed ER-1C/ER-5 backend | ER-1C/ER-5 |
| ER-F08 | Nghiêm trọng | Candidate data access chưa tách nhất quán khỏi workspace/feature flag | Closed ER-2/ER-5 backend | ER-2/ER-5 |
| ER-F09 | Cao | Phone OTP nghiệp vụ được gửi qua email, không phải possession proof của phone | In remediation — adapter foundation merged; live workflow open | ER-6A |
| ER-F10 | Cao | DPA chỉ có timestamp, thiếu version/hash/actor/IP/session | Open | ER-6B |
| ER-F11 | Trung bình | Notification/activity workspace chưa có outbox/read/deep-link/audit contract | Open | ER-7 |
| ER-F12 | Trung bình | Tài liệu canonical cũ mâu thuẫn quyền, ngày gửi và publish blocker | In remediation | ER-0–ER-8 |

## 3. Evidence và retest criteria

### ER-F01 — Actor scope, empty state và fetch error

**Evidence**

- `frontend/src/features/manage-employer-company/ui/LinkedCompanyPanel.jsx`
  dùng `requestsQuery.data || []`, lấy `requests[0]` và render placeholder ngày.
- `frontend/src/entities/employer-profile/api/employer-profile.api.js` gọi list
  không có actor/company scope tường minh.
- Backend employer list hiện lọc theo company.

**Impact**

- Member mới hiểu request của người khác là request của mình.
- Fetch lỗi vẫn mở write action, tạo thao tác dựa trên state không xác định.

**Retest**

- `mine=[]`: thẻ cá nhân chỉ có Create; employer UI không gọi/render
  `scope=company` hoặc request của requester khác.
- 500 → alert/retry; không có create/edit cho tới khi retry thành công.
- Không render fallback `updated_at`, `created_at` hoặc ngày giả.

**ER-1A evidence (2026-08-10)**

- Fixed in local branch `fix/employer-request-empty-state`, code commit
  `828a8d0e`.
- Thẻ cá nhân chỉ dùng query actor `scope=mine`; contract company scope giữ cho
  admin/audit nhưng không còn consumer trong employer settings.
- Empty state không có ngày/status giả; ngày null hoặc không hợp lệ bị bỏ qua và
  chỉ `submitted_at` được phép hiển thị.
- Lỗi initial fetch hoặc background refresh của actor scope hiện retry và
  fail-closed toàn bộ form, upload, media delete và submit.
- Corrective ER-D46 bỏ hẳn company history khỏi employer UI; backend vẫn
  redaction/authorize scope này cho admin, audit và compatibility.
- Corrective regression đạt 19/19 unit/component, 6/6 smoke trên ba viewport và
  full coverage 961/961; employer page chỉ phát request `scope=mine`.
- Targeted evidence: 24/24 unit/API/query-key regression và 9/9 E2E cho ba
  workflow trên desktop/tablet/mobile; Oxlint không lỗi, architecture và build
  đều đạt.
- Residual lifecycle edit/resubmit/withdraw và conflict handling thuộc ER-4;
  backend actor/document authorization đã được đóng ở ER-1B.

### ER-F02 — Shared pending ownership overwrite

**Evidence**

- Employer create service tìm pending theo company và upsert snapshot.
- `requested_by` có thể bị cập nhật theo actor mới.
- Model/test hiện giả định một pending/company.

**Impact**

- Member B có thể thay đổi ownership/nội dung request của member A.
- Attachment và audit evidence không còn gắn đúng actor.

**Retest**

- Hai member cùng company tạo hai request active độc lập.
- Một member chỉ có tối đa một active request; concurrent POST không tạo trùng.
- `requested_by` bất biến qua update/resubmit/upload.

**ER-4 safety evidence (2026-08-10)**

- Merge `ddb8a47f` dùng canonical lock order
  `Company → CompanyUpdateRequest → CompanyDocument` trên create/upload/review/
  tax-refresh hiện hành; regression bao phủ concurrent ownership/status recheck.
- Admin queue/detail truyền exact request public ID và gọi retrieve-by-ID. Panel
  fail-closed nếu company, requester hoặc pending status không khớp; không còn
  chọn `results[0]` từ danh sách lọc theo company.
- Django admin cho Company, CompanyDocument và CompanyUpdateRequest là read-only
  để không có mutation path bỏ qua service lock/authorization.
- Backend 108/108, frontend 10/10; scoped Ruff/format, import-linter, layering,
  Django/migration checks, lint và architecture đạt.
- Finding sai-object/lock path được đóng ở safety slice. Revision immutable,
  resubmit/withdraw/cancel và base-company conflict vẫn là residual lifecycle
  ER-4, không được suy thành phase Verified.

### ER-F03 — Binary document IDOR

**Evidence**

- Employer document queryset lấy tài liệu theo company/update request rộng hơn
  uploader/owner policy.
- Cần kiểm tra đồng thời list, detail/content, signed URL và media endpoints.

**Impact**

- Member cùng company có thể xem/tải giấy phép, định danh hoặc bằng chứng do
  người khác tải lên.

**Retest**

- Requester/uploader, other member, owner, authorized admin và outsider được
  test trên list/detail/preview/download.
- Other member chỉ nhận redacted metadata; content path trả 404.
- Response không chứa storage key/signed URL/hash/scan-engine detail.

**ER-1B evidence (2026-08-10)**

- Fixed in commit `609b3e47` trên nhánh
  `fix/employer-document-access-control`; owner-metadata regression được bổ sung
  sau self-review trên cùng nhánh.
- Metadata queryset và binary-content queryset được tách. Uploader/requester và
  company owner mở được private content; member khác nhận metadata redacted và
  direct content trả `404` trước khi truy cập storage.
- Company history che storage-backed `logo_url`, `cover_image_url`,
  `gallery_additions`, `media_previews`, filename, MIME và kích thước với actor
  không có quyền. Requester summary chỉ có public ID và display name an toàn.
- Migration `employers.0030` backfill `submitted_at=created_at` và thay unique
  pending/company bằng unique pending `(company, requested_by)`. POST/resubmit,
  document attach và media mutation không thể đổi hoặc dùng request của actor
  khác.
- Targeted evidence: 108 employer API/admin/migration/query-budget tests trước
  đồng bộ; post-merge suite gồm các module trên và job moderation đạt 127 test.
  List update-request giữ budget 4 query; Ruff/format, import-linter, Django
  check và migration drift đều đạt.
- Residual risk: lifecycle revision/conflict/withdraw/cancel tiếp tục ở ER-4;
  quarantine, malware scan và retention của file tiếp tục ở ER-3.

**ER-4 admin metadata evidence (2026-08-10)**

- Admin list/retrieve chỉ cần `company_update.view` nhưng serializer che
  filename, MIME, size, SHA, uploader email và source URL nếu actor thiếu
  `account.sensitive.view`; tax code được mask theo cùng boundary.
- Binary endpoint tiếp tục bắt buộc cả `company_update.view` và
  `account.sensitive.view`, kiểm document thuộc exact request và stream private
  với `Cache-Control: private, no-store`.

### ER-F04/ER-F05 — Upload trust boundary

**Evidence**

- File được validate MIME/signature/size rồi lưu private storage.
- Company update tạo business request trước upload và dùng partial-settled
  behavior phía frontend.

**Impact**

- Malware/polyglot có thể đi vào storage/preview path.
- Request không hoàn chỉnh và orphan file khó reconcile.

**Retest**

- Clean/infected/polyglot/timeout/scanner-down/retry/expiry/cancel.
- Chỉ `clean` được attach và download; scan error fail closed.
- Không có business request khi một file bắt buộc chưa clean.

**ER-3 storage-foundation evidence (2026-08-10)**

- Local và R2 có alias/root/bucket tách public, private, quarantine; private và
  quarantine fail-closed khi gọi `.url()`. DEBUG/nginx chỉ được serve public.
- Rendered production Compose chỉ publish nginx 80/443, không kế thừa source
  bind hoặc port development; nginx chỉ nhận static và public-media volume.
- Root shared cũ trở thành `LEGACY_MEDIA_ROOT` không phục vụ. Lệnh
  `migrate_media_storage_layout` dry-run mặc định, batch/cursor, copy + hash
  verify idempotent và giữ source rollback; không di chuyển byte trong schema
  migration.
- Classifier allowlist public, unknown → private; bao phủ `gallerys/`,
  knowledgebase, frontend legacy và external-media migration.
- Raw multipart DOC/DOCX preview trả machine code `UPLOAD_SCAN_REQUIRED` và
  không gọi LibreOffice; authorized preview/download của document đã lưu vẫn
  đọc private storage theo storage key cũ.
- Storage foundation không tự đóng finding; evidence shared core và residual
  integration được ghi bên dưới.

**ER-3 shared-core evidence (2026-08-10)**

- Merge `99b34781` thêm state machine
  `uploading → quarantined → scanning → clean|rejected|error|expired`. Chỉ
  `clean` sinh private asset; API owner-scoped trả `404` cho owner khác, không
  có generic claim/download và không lộ storage/scanner evidence nhạy cảm.
- Session creation fail-closed theo purpose/role. Owner row được khóa trước khi
  kiểm session/byte quota; expired/rejected session có quarantine byte hoặc
  clean-unclaimed private byte vẫn chiếm quota cho tới cleanup thành công.
- ClamAV INSTREAM, bounded retry/lease, reconciliation, expiry, cleanup và
  evidence purge chạy trên `upload-scan`; khi bật pipeline, production config
  fail nếu scanner, purpose, retention hoặc DOCX limit không an toàn. Worker
  render giữ cả `auth-sms` và `upload-scan`.
- Domain claim yêu cầu authenticated owner và `expected_purpose`; sai purpose
  fail-closed. Claimed asset chỉ cleanup-eligible sau explicit release, hết
  minimum retention 730 ngày và không có legal hold. Deleted clean asset được
  privacy-scrub metadata khi byte/evidence/claim không còn phải giữ.
- DOCX validation có bounded ZIP metadata, required parts
  `[Content_Types].xml`/`word/document.xml`, encryption, traversal/symlink,
  duplicate entry, entry/uncompressed/ratio limits và không extract nội dung
  trước scan. PDF/image hiện chỉ có MIME/dung lượng/magic signature cộng malware
  scan; verdict `clean` không phải parser validity.
- Targeted suite đạt 83/83, gồm ba concurrency regression, trên PostgreSQL
  Docker 16.14 của repo: `127.0.0.1:5433 → container:5432`, với
  `DB_NAME=ai_recruitment_er3_docker_gate`. Ruff/format, import-linter, Django
  check, migration drift, static OpenAPI refs và production Compose render đều
  đạt trong phạm vi slice.

**ER-3 employer-domain evidence (2026-08-10)**

- Commit `ec1ac428` nối upload session vào giấy tờ verification/DPA/company
  update và logo/cover/gallery. API chỉ claim session cùng owner, đúng purpose,
  `clean`, chưa claim; `CompanyDocument` và `CompanyMediaUpload` giữ reference
  audit tới private original. Public image chỉ là derivative sau clean claim.
- Employer post-scan parser boundary dùng pypdf strict cho PDF, Pillow
  format+verify cho ảnh và bounded DOCX validator của core. Invalid content trả
  validation error, rollback claim và không tạo business record.
- Frontend pre-scan toàn bộ tập file trước company/update request, attach tuần
  tự và không còn `Promise.allSettled`/partial-success. Scanner rejection,
  timeout hoặc error không được fallback raw; compatibility raw chỉ dùng khi API
  trả exact `UPLOAD_PIPELINE_DISABLED` và bị khóa bởi strict rollout flag.
- Backend affected suite đạt 283/283 trên PostgreSQL Docker 16 tại
  `127.0.0.1:5433`; frontend targeted 48/48, full coverage 256 file/974 test và
  E2E upload 3/3 desktop/tablet/mobile. Các gate architecture/layering,
  migration drift, build và bundle budget đều đạt.

**Residual/status**

- ER-F04 chưa `Closed` toàn hệ thống: employer workflow đã đóng nhưng candidate
  import/assets chưa nối shared core. Audit ER-O06 xác nhận candidate CV dùng
  cùng unsafe default/private
  storage, nên integration candidate là residual bắt buộc trong slice riêng qua
  shared core, không tạo coupling `cvs → employers`. Real ClamAV
  staging/readiness/EICAR và rollout flag vẫn mở.
- ER-F05 đã `Closed` cho employer: business request không được tạo trước khi tập
  file clean, attach lỗi không có success toast. Candidate workflow sẽ có finding
  riêng trong slice ER-O06, không làm reopen closure theo domain này.
- Candidate parser-specific validation vẫn là residual; không suy diễn employer
  parser boundary cho app `cvs`.

### ER-F06 — Verification auto-finalization

**Evidence**

- Document review/reconcile có đường hoàn tất prerequisite rồi đánh dấu case và
  company approved.
- Admin frontend chưa luôn gọi decision-impact/final-decision flow.

**Impact**

- Duyệt một tập document có thể gây company-level effect ngoài ý định admin.

**Retest**

- Tất cả document approved nhưng case vẫn `awaiting_final_decision`.
- Final approve yêu cầu impact preview, review token/lock và explicit confirm.
- Company-level effect được hiển thị và audit.

### ER-F07 — Job approval policy/race

**Evidence**

- Moderation đã có `approve_blockers` và `review_token`, nhưng employer/DPA
  entitlement chưa là canonical source đầy đủ ở mọi đường approve.

**Impact**

- Admin có thể approve tin sau khi recruiter vừa bị revoke hoặc DPA không còn
  current.

**Retest**

- Backend recompute blocker trong transaction, không tin frontend payload.
- Race approve-vs-revoke/DPA transition phải fail closed.
- Mọi action approve/publish dùng cùng service invariant.

**ER-1C evidence (2026-08-10)**

- Fixed in local branch `fix/admin-job-approval-guard`.
- Canonical và compatibility endpoint đều bị chặn bởi
  `recruiter_job_approval_state`; response có `JOB_APPROVAL_BLOCKED`.
- Verification case, recruiter/DPA và campaign được đọc lại dưới transaction
  lock trước quyết định cuối.
- Targeted evidence: 20 moderation/query-budget tests, 1 duplicate/DPA
  regression và 4 frontend blocker tests; Ruff, format, import-linter và
  migration drift đều đạt.
- Residual risk trên đã được đóng ở ER-5 backend: revoke/expire khóa cùng prefix
  với job approval và tạo hold/link cho resource hiện hữu trong transaction.

**ER-5 backend evidence (2026-08-10)**

- `review_verification_document`, phone/DPA/recruitment-need reconciliation chỉ
  cập nhật prerequisite/document; không có đường tự approve case/company.
- Final decision và revoke/expire là workflow preview/confirm; impact token ký
  privacy-safe fingerprint của case, prerequisite, company, document/tax
  evidence, campaign/job và hold/link. Same-count replacement cũng làm stale.
- Global lock prefix là `User → Recruiter → VerificationCase → Company`, rồi
  campaign/job/document/evidence/hold theo PK. Race approve-vs-revoke được test
  cả hai thứ tự commit; phía commit sau luôn recheck trạng thái mới.
- Hold có source/reason riêng, unique active theo recruiter/source và release
  exact source. Public job filter fail closed khi recruiter relink sai company
  hoặc có verification hold; không đổi business/moderation status.
- Permission revoke/tax override tách khỏi review và không grant mặc định.
  Tax response hash, filename và internal integrity fingerprint bị redacted;
  `decision_snapshot` dùng allowlist.
- PostgreSQL Docker cổng 5433: 235 test hiện hữu/ER-5 đạt trước một expectation
  legacy sai; expectation được đảo sang “phone không auto approve” và đạt 1/1.
  Query budget admin list/detail/impact đạt trần 4/5/7. Full Ruff/format,
  import-linter, layering, Django/migration plan, OpenAPI refs, permission
  registry và Markdown gates đều đạt.
- Admin final-decision UI consume đúng preview/confirm và stale refresh; action
  theo permission riêng. Job blocker deep-link dùng code allowlist, exact
  recruiter ID và chỉ hiện khi actor có quyền màn đích.
- Frontend evidence: 17/17 targeted, full coverage 971/971 test và 6/6 admin
  smoke desktop/tablet/mobile; lint/architecture/build/bundle budget đều đạt.

### ER-F08 — Candidate-data access

**Evidence**

- Workspace guard tổng dùng `verification_completed`.
- Campaign/job/application endpoints có nhiều cách kiểm candidate access và có
  đường phụ thuộc feature flag.

**Impact**

- Có thể mở hoặc khóa applications/CV/export sai với verification/DPA policy.

**Retest**

- List/detail/CV snapshot/download/export/history/direct route dùng cùng
  `candidate_data_access` selector.
- Member cùng company không xem resource recruiter khác.

**ER-2 evidence (2026-08-10)**

- Fixed trên nhánh `feature/employer-readiness-contract` bằng các commit
  `b5a50c45` (policy/contract), `49f11065` (candidate, CV và mutation
  enforcement), `f1408e43` (authoritative job/campaign read guard) và
  `916d2bfb` (OpenAPI/security evidence); đồng bộ `dev` tại merge commit
  `8e01389e` trước retest cuối.
- Một policy canonical trả `job_workspace_ready`, `verification_approved`,
  `candidate_data_access`, `dpa_status` và danh sách blocker có thứ tự xác định.
  `candidate_data_access` là tập con nghiêm ngặt của workspace, verification
  approved đúng recruiter/company và DPA `current`; feature flag không còn là
  đường bypass. Adapter DB hiện tại chỉ phát `missing/current`, còn enum công
  khai giữ đủ `legacy_unversioned/outdated/grace/hold/unknown` cho ER-6.
- `/api/employer/me`, `/api/auth/me` và posting-context cùng dùng contract này.
  Direct API job/campaign list, detail, options, report, performance và activity
  yêu cầu capability workspace; posting-context vẫn đọc được để trả blocker.
  Verification pending/changes-requested với DPA current vẫn vào workspace,
  nhưng không đọc candidate data hoặc duyệt tin.
- Application list/export/status/history/snapshot, campaign activity metadata,
  dashboard và job/campaign preview đều recheck candidate capability ở backend.
  Signed recruiter CV asset được bind audience, actor, application và version,
  rồi kiểm lại authorization sống khi tải; flow asset của candidate được giữ
  tương thích. Theo ER-D29, aggregate không định danh vẫn có nhưng không kèm
  PII/deep-link/activity nhạy cảm.
- Endpoint errors đã triển khai là `EMPLOYER_WORKSPACE_BLOCKED`,
  `CANDIDATE_DATA_BLOCKED`, `JOB_APPROVAL_BLOCKED`; blocker bên trong giữ mã
  lowercase và capability ổn định. Không ghi nhận các target code phase sau như
  `VERIFICATION_REQUIRED` hoặc `DPA_OUTDATED` là endpoint error đã có.
- Mutation dùng lock order `User → Recruiter → Verification → Campaign → Job →
  Application`; regression bao phủ relink/wrong-company document, campaign đổi
  giữa snapshot và lock, job/campaign hold, duplicate và approve-vs-revoke.
- Frontend commits `cc4e3085`, `59307148`, `7c97cc7c`, `44da5635`,
  `ab1c003e`, `d84760ba`: jobs/campaigns dùng `JobWorkspaceGuard`, applications
  dùng `CandidateDataGuard`; denied direct route giữ URL và render blocker/
  retry. Job detail và campaign Apply CV/Activity không phát sensitive request
  khi denied/error; cached name/avatar/email/CV link biến mất ngay khi readiness
  chuyển `true → false`.
- Retest cuối: 206/206 test trong các module accounts profile, employer
  readiness/admin/campaign, jobs API/query budget/posting/moderation,
  applications v2/service và dashboard; matrix direct read/query budget riêng
  đạt 31/31. Ruff check/format, import-linter 2/2, DRF layering, diff check và
  `makemigrations --check --dry-run` đều đạt; không có migration ER-2.
- Frontend coverage gate đạt 253 test file/953 test, gồm ma trận sáu readiness
  state; readiness E2E đạt 9/9 trên desktop/tablet/mobile. Oxlint,
  architecture check và production build đều đạt.
- Residual: tạo/propagate hold ngay sau revoke hoặc DPA transition thuộc ER-5;
  DPA append-only evidence/version/hash/actor/IP/session thuộc ER-6. Bộ CV v2
  đầy đủ còn có fixture locale/blueprint hỏng sẵn ngoài phạm vi ER-2; regression
  signed-token chuyên biệt đã đạt.

### ER-F09 — Phone OTP transport

**Evidence**

- `PhoneOtp` và hash/TTL tồn tại nhưng transport hiện đi qua email task.

**Impact**

- Trạng thái “verified phone” không chứng minh actor kiểm soát số điện thoại.

**Retest**

- Account mới/change/reverify gọi SMS provider adapter.
- TTL/attempt/rate-limit/replay/provider outage/phone uniqueness đều fail safe.
- Account cũ không bị backfill, deadline hoặc hold.

**ER-6A infrastructure evidence (2026-08-10)**

- Provider-neutral HTTP/fake adapter, purpose-bound challenge/state, queue
  `auth-sms`, bounded retry/recovery, retention, redacted event/metrics và
  production readiness đã merge qua `03ac8640` (code commits `d58ad837`,
  `78f12be2`, `72468831`, `201e2829`).
- Production flag vẫn tắt và dispatch fail closed khi disabled, cấu hình sai
  hoặc provider lỗi; không fallback email, không giả delivery. OpenAPI và live
  OTP endpoint/frontend chưa đổi, provider production chưa được chọn.
- Migration không tạo marker/deadline/hold và không thay đổi phone proof cũ.
  Challenge PII/ciphertext được purge sau 30 ngày; event redacted giữ 730 ngày.
- Branch evidence: 181 employer tests, gồm 22 SMS và 3 migration tests; root
  post-merge retest SMS + migration đạt 25/25. Ruff, format, import-linter,
  layering, Django check, migration drift, docs và rendered Compose đều đạt.

Finding chưa đóng cho tới khi account mới/change/reverify thực sự dùng SMS và
toàn bộ retest criteria outage/rate-limit/replay/uniqueness đạt.

### ER-F10 — DPA evidence

**Evidence**

- `RecruiterProfile.dpa_accepted_at` là bằng chứng chính; thiếu content version,
  hash, actor, IP và session correlation.

**Impact**

- Không chứng minh actor đã chấp nhận đúng phiên bản nội dung.

**Retest**

- Acceptance mới append-only và chứa đủ evidence tối thiểu.
- Không backfill giả dữ liệu cũ; legacy policy theo ER-O03.
- Material update block candidate data/admin approval và áp hold đúng grace.

## 4. Accepted risks và residual-risk process

Trong epic này không tự ý thay đổi:

- company search/payload đầy đủ theo contract hiện hành;
- MFA tùy chọn ngoài các action cần step-up;
- recruiter-owned jobs/campaigns/applications.

Các accepted risk vẫn cần rate limit, serializer redaction, audit và monitoring.
Nếu retest tìm thấy exploit vượt boundary đã chấp nhận, finding mới phải được
thêm và hỏi duyệt trước khi mở rộng scope.

## 5. Evidence closure template

Khi đóng một finding, cập nhật dòng tóm tắt và thêm:

```text
Fixed in: <branch/commit/PR>
Tests: <exact test commands and cases>
Migration/backfill: <none or evidence/counts>
Rollout: <flag/cohort/date>
Retest result: <pass/fail>
Residual risk: <accepted/open>
```

Không dùng “tests pass” chung chung; phải ghi targeted evidence và full gate nếu
phase yêu cầu.
