# Audit luồng và bảo mật Nhà tuyển dụng — ER-0 (2026-08)

> **Trạng thái:** Baseline trước remediation; các finding chưa được coi là đã
> đóng cho tới khi có test đỏ → vá → retest và evidence trong phase tương ứng.  
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
| ER-F01 | Cao | Thẻ cá nhân dùng company-wide request, hiện ngày giả và che fetch error | Open | ER-1A |
| ER-F02 | Cao | Shared pending request có thể bị member khác upsert/đổi requester | Open | ER-1B/ER-4 |
| ER-F03 | Nghiêm trọng | Document queryset/content permission cho member rộng hơn binary-file policy | Open | ER-1B |
| ER-F04 | Cao | Upload đi thẳng storage, thiếu quarantine/malware scan/fail-closed submit | Open | ER-3 |
| ER-F05 | Cao | Partial upload có thể để request/file dở dang nhưng UI báo thành công | Open | ER-3 |
| ER-F06 | Cao | Document/prerequisite reconciliation có thể tự approve verification/company | Open | ER-5 |
| ER-F07 | Nghiêm trọng | Job approval chưa có đầy đủ authoritative verification/DPA blocker ở mọi đường | Open | ER-1C/ER-5 |
| ER-F08 | Nghiêm trọng | Candidate data access chưa tách nhất quán khỏi workspace/feature flag | Open | ER-2/ER-5 |
| ER-F09 | Cao | Phone OTP nghiệp vụ được gửi qua email, không phải possession proof của phone | Open | ER-6A |
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

- `mine=[]`, `company=[other requester]`: thẻ cá nhân chỉ có Create; history vẫn
  hiện requester.
- 500 → alert/retry; không có create/edit cho tới khi retry thành công.
- Không render fallback `updated_at`, `created_at` hoặc ngày giả.

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

### ER-F09 — Phone OTP transport

**Evidence**

- `PhoneOtp` và hash/TTL tồn tại nhưng transport hiện đi qua email task.

**Impact**

- Trạng thái “verified phone” không chứng minh actor kiểm soát số điện thoại.

**Retest**

- Account mới/change/reverify gọi SMS provider adapter.
- TTL/attempt/rate-limit/replay/provider outage/phone uniqueness đều fail safe.
- Account cũ không bị backfill, deadline hoặc hold.

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
