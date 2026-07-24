# Giai đoạn 1 — Technical-debt register

> Trạng thái ngày 2026-07-24. `Proposal required` nghĩa là chưa được phép triển
> khai trong kế hoạch tổng nếu chưa dừng và duyệt phương án high-risk.

## Quy ước

- Severity: Critical / High / Medium / Low.
- Estimate: S (≤1 phiên nhỏ), M (2–4 phiên), L (nhiều module/migration/rollout).
- Risk là rủi ro của **thay đổi**, không phải severity của hiện trạng.

Không phát hiện issue Critical.

## High

| ID | Vị trí / hiện trạng / nguyên nhân | Ảnh hưởng | Hướng xử lý | Risk | Est. | Dependency | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | `accounts/services/email_verification.py`, `api/views/verification.py`: token chỉ bind `user_id`; change-email không revoke token cũ | Token email A có thể xác thực email B | Bind `{user,email,generation}`, revoke/consume atomic, regression đổi email | High | M | Redis contract, auth UX | Proposal required |
| SEC-002 | OAuth completion bypass MFA; `AuthSession` chưa lưu assurance; candidate PII/legal endpoints chỉ kiểm employer role; stock Django Admin ngoài policy API | Provider/admin/session compromise vượt step-up và đọc dữ liệu nhạy cảm | Thiết kế assurance model + endpoint matrix + admin SSO/MFA/network boundary | High | L | Auth/session migration, frontend challenge, infra | Proposal required |
| SEC-003 | `base.py` cho env hạ SSL/secure cookies/HSTS/proxy; `production.py` không reject hầu hết override/HTTP origin; `.env.example` dùng giá trị dev | Production có thể khởi động ở cấu hình transport/cookie không an toàn | Fail-fast secure flags/HTTPS origins, deploy tests và escape hatch audit | Medium | S–M | Deployment/TLS topology | Proposal required |
| SEC-004 | CV import gửi extracted PII tới AI provider nhưng request không có consent theo import | Rủi ro privacy/DPA và xử lý dữ liệu ngoài hệ thống không minh bạch | Consent/transparency, provider policy/audit, local-only option | High | M–L | Legal/product/provider config | Proposal required |
| API-001 | OpenAPI validate: 52 error, 441 warning; custom auth không security scheme; 13 endpoint unique thiếu serializer | Docs/codegen coi protected API như public hoặc thiếu request/response | Auth extension, annotate endpoints/types/enums, schema CI gate | Low | M | drf-spectacular, contract tests | Open/confirmed |
| ARCH-001 | Import-linter chỉ gác nội app; deep cross-app service/API imports và vòng `cvs ↔ cv_templates` còn tồn tại | Coupling private contract, refactor một app dễ phá app khác | Public facades + gate cross-app; tháo cycle incremental | Med–High | L | ADR/tests, CV contract | Open/confirmed |
| CONC-001 | Phone OTP cooldown/attempt/verify read-modify-write không atomic, view thiếu explicit scopes | Concurrent send/verify, lost attempts, unique-phone conflict thành 500 | Row/cache lock, invalidate previous OTP, scoped throttle, transaction tests | Medium | M | PostgreSQL/Redis policy | Open/confirmed |
| CONC-002 | Job moderation/posting và application status dùng stale instance, không row lock | Concurrent transition sinh state/history mâu thuẫn | Service nhận ID, `select_for_update`, transition/history atomic | Medium | M | Transaction tests/state machine | Partially resolved in Phase 4 |
| FE-001 | 27 `/tuyendung/app` literals trong 8 employer files, trong khi subdomain dùng `/app` | Production navigation vào NotFound | Dùng `employerAppPath()` + test subdomain | Low | M | Portal config/E2E | Open/confirmed |
| FE-002 | Application/job/CV adapters bỏ pagination metadata; backend page size 20 | List/metrics/`hasApplied` sai sau 20 record | Canonical envelope, page-aware UI/status endpoint, migrate từng domain | Med–High | L | Backend contract + many consumers | Open/confirmed |
| FE-003 | Refresh failure chỉ clear token, không clear `SessionProvider.user`; single-flight global | Protected shell giữ phiên giả, lặp 401; portal có thể ảnh hưởng nhau | Auth-expired coordinator per portal; phân biệt terminal auth và transient errors | High | M | Session/guard/query cache | Proposal required |
| CV-001 | Explicit Save/Publish/Switch/Sample không drain edit queue như `saveDraft`; save-version không idempotent | Commit draft cũ, sample ghi đè edit, double click tạo version trùng | Autosave operation barrier/mutex + backend idempotency/CAS | High | M–L | Editor state machine/API contract | Proposal required |
| CV-002 | Application Admin sửa được `cv/submitted_cv_version`; immutable guard chỉ ở `CvVersion.save`; hard delete mất source parent | Snapshot provenance có thể bị viết lại hoặc không audit được nguồn | Read-only admin + model/service/DB invariant + provenance retention | High | M–L | Migration/data/legal retention | Proposal required |

## Medium

| ID | Vị trí / hiện trạng / nguyên nhân | Ảnh hưởng | Hướng xử lý | Risk | Est. | Dependency | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH-002 | Employer/template/sitecontent views và job serializers còn business mutation | Transaction boundary phân tán, khó reuse/test | Extract command services theo workflow, giữ payload/status | Medium | L | Characterization tests | Open |
| ARCH-003 | `candidates/selectors/profiles.py` dùng `get_or_create` | GET có write side effect, khó cache/read replica | Tạo shell ở registration/service + backfill | Medium | S–M | Data compatibility | Open/confirmed |
| TASK-001 | CV/template tasks trực tiếp ORM/storage/state; một số catch-all rồi return success | Retry/observability không tin cậy | Thin task → idempotent service + durable failure/attempt | Medium | L | Celery state/metrics | Open |
| PERF-001 | N+1 ở blog home, service category count và dynamic link groups | Query tăng theo record/group | Sliced prefetch/window, annotate Count, batch resolver + budgets | Low | M | Query-budget tests | Resolved in Phase 4 |
| API-002 | Admin template list unbounded và nhúng versions/localizations/schema JSON | Payload/memory tăng theo catalogue history | List/detail serializers + pagination, migrate admin UI | Medium | M | Frontend admin consumer | Open |
| API-003 | Error/filter/list shapes chưa thống nhất | Frontend mapper phức tạp, codegen/filter docs yếu | Compatibility error envelope + typed query serializers | High | L | Frontend migration/contracts | Open |
| CONC-003 | Template version `Max+1` và first recruitment need check-then-create chưa lock | Race thành duplicate/IntegrityError 500 | Lock parent/recruiter, move into service, concurrency tests | Medium | S–M | PostgreSQL tests | Partially resolved in Phase 4 |
| CACHE-001 | Service/sitecontent signals delete cache trước commit | Request khác refill stale cache tới 1 giờ | `transaction.on_commit(cache.delete)` | Low | S | Cache tests | Resolved in Phase 4 |
| DB-001 | CompanyDocument/range/owner-kind/soft-delete invariants chỉ ở serializer/clean | ORM/admin/bulk path bypass invariant | Data audit → backfill → staged CheckConstraint | Med–High | M | Migration rollout | Open |
| TEST-001 | Query budgets hẹp; thiếu concurrency/schema/low-app tests | Gate xanh nhưng race/schema regression lọt CI | Test theo debt trước refactor; OpenAPI gate | Low | M | Test fixtures/CI | Open |
| SIZE-001 | CV V2 view 939, 2FA view 702, Job serializer 697 và các core file >500 dòng | Review/ownership khó, sửa dễ lan | Tách theo resource/workflow trong cùng slice, giữ public API | Medium | L | Focused regression | Open |
| FE-004 | Protected list collapse error thành `[]`; một số mutation lỗi im lặng | 401/500 bị hiểu là “chưa có dữ liệu” | Explicit error/retry + mutation feedback tests | Low | S–M | Per-page tests | Open |
| FE-005 | Login qua onboarding làm mất safe `returnUrl` | Deep link không resume sau gate | Carry validated returnUrl xuyên gate, consume một lần | Medium | M | Auth navigation tests | Proposal required |
| FE-006 | Company documents dùng hai query-key namespace | Duplicate GET và stale verification cache | Public entity key factory + invalidation canonical | Low | S | Employer-profile entity | Open |
| FE-007 | CampaignList/JobForm/ApplicationList/admin CRUD page trộn workflow và UI | Page lớn, mutation/cache policy rải rác | Extract controller hooks/features incremental | Medium | L | Existing FSD/tests | Open |
| FE-008 | ConsultationLeads request thủ công không cancel/request-id | Response filter cũ ghi đè filter mới | TanStack Query keyed `{status,page}` với signal | Low | S | Pagination migration | Open |
| CV-003 | Có archive fields/restore window nhưng DELETE V2 hard-delete; không restore version | Người dùng không dùng được retention contract, thao tác xóa khó phục hồi | Product policy; archive/restore; restore version tạo draft mới | High | L | Data retention/API/UI | Proposal required |
| CV-004 | Snapshot content còn nhưng hard delete xóa source version, `parent_version=SET_NULL` | Mất exact provenance version gốc | Lưu immutable source IDs/hash hoặc giữ source version theo retention | High | M–L | CV-002/policy/migration | Proposal required |
| SEC-005 | DOCX/PDF/image/legal upload thiếu ZIP expansion/pixel/malware sandbox đầy đủ | ZIP/pixel bomb, malicious document làm worker/resource quá tải | Parser budgets, quarantine/AV, resource limits/throttle | Med–High | M–L | Worker/storage/scanner | Open/partially mitigated |
| SEC-006 | MFA counter/challenge consume không atomic; TOTP thiếu per-challenge attempt/replay | Parallel verify/lost attempt, TOTP reuse trong window | Redis atomic script/transaction + last timestep + tests | Medium | M | Redis/auth proposal | Proposal required |
| SEC-007 | Bearer/private CV response chưa explicit `private, no-store`; token trong URL path | Browser/proxy cache/history/log giữ dữ liệu/token | Cache headers, log redaction, review token exchange | Medium | S–M | Proxy/frontend share flow | Open |
| SEC-008 | TOTP encryption key không production fail-fast | Deploy xanh nhưng TOTP lỗi runtime | Validate Fernet key + rotation plan | Medium | S–M | Secret operations | Proposal required |

## Low

| ID | Vị trí / hiện trạng / nguyên nhân | Ảnh hưởng | Hướng xử lý | Risk | Est. | Dependency | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DB-002 | Explicit FK/single-field indexes có vẻ trùng implicit index | Storage/write amplification | Xác nhận catalog/EXPLAIN rồi mới drop concurrently | Medium | S | Production DB evidence | Needs verification |
| FE-009 | Dependency-cruiser thiếu no-cycle/portal isolation/cross-entity rule dù code sạch | Vi phạm tương lai có thể lọt gate | Bổ sung rule + fixture regression | Low | S | Architecture config | Open |
| FE-010 | Initial JS 89%, CSS 95,7% budget; checker không đo lazy chunks | Ít headroom và không thấy lazy regression | Thêm per-chunk/route report trước optimization | Low | S–M | Build script | Open |
| FE-011 | Wrong role redirect về login | UX vòng/confusion, không phải backend security gap | Chốt product UX forbidden/handoff rồi test | Low | S–M | Product decision | Deferred |
| QA-001 | Backend có 146 warning; local venv lệch pin; frontend JSDOM/canvas/no-color warnings | Log nhiễu, future Django 6 upgrade khó hơn | Đồng bộ env và xử lý warning theo nhóm, không suppress rộng | Low | S–M | Dependency upgrade | Partially resolved in Phase 3 |

## Đề xuất xóa nhưng cần xác minh thêm

- `interviews` hiện là placeholder app không có use case/API thực. Chưa xóa vì
  vẫn có migration/app registration và roadmap AI interview; cần quyết định sản
  phẩm và kiểm tra deployment/data trước.
- Không phát hiện component/asset/CSS/backend helper nào đủ bằng chứng để xóa
  ngay trong Giai đoạn 1.

## Cập nhật triển khai Giai đoạn 3–4

- `QA-001`: backend giảm từ 146 xuống 2 warning. Hai warning còn lại nằm trong
  migration lịch sử `cvs/0004_cv_exports.py`; không sửa migration đã áp dụng.
- `CACHE-001`: cả cache báo giá dịch vụ và site settings chỉ invalidated bằng
  `transaction.on_commit`; test khóa save/delete/rollback.
- `PERF-001`: blog home còn đúng 3 query, admin service category 1 query và link
  groups tối đa 4 query; các budget không tăng theo số category/group.
- `CONC-002`: moderation, publish/close/reopen/extend, application status và
  auto-mark-viewed đã re-read row bằng `select_for_update`, với stale/race tests.
  Employer PATCH nested content và draft delete vẫn cần command boundary riêng.
- `CONC-003`: initial recruitment need đã khóa parent `RecruiterProfile` và
  re-check trong transaction. Template version `Max+1` và general multi-need
  policy chưa thay đổi.
