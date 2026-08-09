# Kế hoạch rà soát và khắc phục toàn bộ luồng Nhà tuyển dụng

> **Trạng thái:** ER-0, ER-1 và ER-2 đã Verified — đang triển khai các phase phụ thuộc
> **Ngày lập:** 2026-08-10
> **Ngày phê duyệt:** 2026-08-10
> **Phiên bản kế hoạch:** 1.0
> **Phạm vi:** Employer portal, company workflow, verification, upload, job moderation, DPA, notification và security
> **Nhánh tích hợp đề xuất:** `dev`
> **Quy tắc:** Không tạo nhánh triển khai trước khi gate tương ứng được phê duyệt.

## 1. Vai trò và cách sử dụng tài liệu

Đây là tài liệu canonical cho epic rà soát và hardening luồng Nhà tuyển dụng.
Tài liệu mô tả:

- hiện trạng và rủi ro đã tìm thấy;
- quyết định sản phẩm đã xác nhận;
- quyết định còn chờ xác nhận;
- state machine, permission matrix và contract mục tiêu;
- giai đoạn, nhánh, dependency, migration, test và rollout;
- tài liệu phải cập nhật cùng từng thay đổi;
- cơ chế theo dõi tiến độ và ghi changelog.

Các tài liệu cũ vẫn có giá trị lịch sử, nhưng khi có mâu thuẫn với tài liệu này
thì phải được đồng bộ hoặc đánh dấu `Superseded` sau khi kế hoạch được phê duyệt.
Không được dùng kế hoạch cũ làm bằng chứng rằng một quyết định mới đã được chốt.

### 1.1 Quy ước trạng thái quyết định

| Trạng thái | Ý nghĩa |
| --- | --- |
| `CONFIRMED` | Người phụ trách sản phẩm đã xác nhận; được phép dùng làm input triển khai |
| `PROPOSED` | Phương án kỹ thuật/sản phẩm được đề xuất; chưa được triển khai |
| `OPEN` | Cần hỏi và nhận câu trả lời trước khi tạo nhánh liên quan |
| `SUPERSEDED` | Quyết định cũ đã bị thay thế và không còn hiệu lực |

### 1.2 Quy tắc phê duyệt

Trước mỗi giai đoạn, người triển khai phải trình bày tối thiểu:

1. Luồng và trạng thái thay đổi.
2. Quyền của từng actor.
3. API, schema và migration bị ảnh hưởng.
4. UI state và nội dung hiển thị.
5. Acceptance criteria và test evidence dự kiến.
6. Rollout, metric và rollback.
7. Câu hỏi rõ ràng: **“Luồng này hợp lý chưa?”**

Chỉ tạo nhánh sau khi có câu trả lời xác nhận. Quyết định phải được ghi vào
decision log, không chỉ tồn tại trong hội thoại.

## 2. Mục tiêu và tiêu chí thành công

Epic phải đạt các kết quả sau:

1. Thành viên mới chọn công ty nhưng chưa gửi yêu cầu không còn thấy ngày yêu
   cầu giả hoặc ngày của người khác trong thẻ “Yêu cầu của tôi”.
2. Lỗi tải dữ liệu không bị hiểu nhầm thành empty state và không mở thao tác
   ghi khi trạng thái server chưa rõ.
3. Không còn IDOR khi list, xem hoặc tải tài liệu của yêu cầu/hồ sơ khác.
4. Quyền vào workspace, tạo/gửi tin, duyệt tin và xem dữ liệu ứng viên được
   tách thành các contract độc lập; backend là nguồn quyết định cuối.
5. Toàn bộ file từ employer portal đi qua upload session, quarantine và malware
   scan trước khi được submit vào nghiệp vụ.
6. Duyệt từng tài liệu không tự động đồng nghĩa với duyệt toàn hồ sơ; admin có
   một quyết định cuối tường minh.
7. Nhiều thành viên cùng công ty có thể gửi yêu cầu chỉnh sửa song song mà
   không silent overwrite dữ liệu đã được duyệt từ yêu cầu khác.
8. Mọi thay đổi có migration/backfill idempotent, audit, metric, rollout và
   rollback tương xứng với rủi ro.
9. Tài liệu API, database, frontend architecture, tiến độ, runbook và changelog
   được cập nhật cùng PR tạo ra hành vi, không dồn về cuối epic.

## 3. Phạm vi

### 3.1 Trong phạm vi

- Đăng ký, onboarding và xác minh số điện thoại của Nhà tuyển dụng.
- Chọn/tạo công ty và xử lý trường hợp chọn nhầm công ty.
- Thẻ “Yêu cầu của tôi” và lịch sử yêu cầu chỉnh sửa của công ty.
- Tạo, resubmit, withdraw, cancel, review và quyết định yêu cầu chỉnh sửa.
- Quyền xem metadata, nội dung thay đổi và file nhạy cảm.
- Hồ sơ xác minh doanh nghiệp, DPA và quyết định cuối của admin.
- File upload từ employer portal: giấy phép, giấy tờ hỗ trợ, logo, cover,
  gallery và file đính kèm yêu cầu.
- Rà soát quyền xem/tải/export CV và dữ liệu ứng viên từ employer portal.
- Điều kiện vào jobs/campaigns/applications và điều kiện admin duyệt tin.
- Compliance hold khi verification/DPA mất hiệu lực.
- Website notification center, activity history và email quyết định quan trọng.
- Migration, retention, observability, rollout, rollback, docs và changelog.

### 3.2 Ngoài phạm vi hoặc cần duyệt riêng

- Thiết kế lại toàn bộ visual design của employer portal.
- Thay đổi mô hình tenant recruiter-owned: jobs, campaigns và applications vẫn
  thuộc recruiter tạo ra; thành viên cùng công ty không tự động nhìn thấy nhau.
- Tích hợp nhà cung cấp tra cứu MST làm nguồn quyết định pháp lý. Kết quả tra
  cứu chỉ mang tính hỗ trợ; override cần lý do.
- Chọn nhà cung cấp SMS production cụ thể. Epic chỉ xây provider-neutral adapter
  và fake provider cho dev/test trước.
- Refactor pipeline upload phía ứng viên nếu pipeline đó không dùng chung. Epic
  vẫn audit quyền truy cập CV; thay đổi lớn phía candidate cần gate riêng.
- Bắt buộc MFA cho toàn bộ Nhà tuyển dụng. MFA tiếp tục tùy chọn; step-up áp dụng
  cho thao tác bảo mật nhạy cảm theo quyết định hiện hành.
- Thu hẹp company search hoặc payload công ty trả cho member. Đây là accepted
  risk hiện tại và phải được ghi trong security audit.

## 4. Hiện trạng và phát hiện kiểm toán

### 4.1 Lỗi “Ngày yêu cầu chỉnh sửa”

Lỗi có nhiều nguyên nhân đồng thời:

- Frontend luôn render “Ngày gửi gần nhất” và dùng placeholder
  `--:-- --/--/--` khi `requests=[]`.
- Query lỗi bị ép thành `data || []`, nên UI coi lỗi như danh sách rỗng và vẫn
  cho tạo/chỉnh sửa.
- UI dùng phần tử đầu tiên của danh sách company-wide làm yêu cầu gần nhất.
- API hiện lọc theo company, nên thành viên mới có thể nhận lịch sử do người
  khác gửi.
- Ngày đang lấy `updated_at || created_at`, trong khi nghiệp vụ mục tiêu là
  thời điểm submit `submitted_at`.

### 4.2 Company update request

- Một request `pending` đang được dùng chung cho cả công ty.
- POST tiếp theo có thể ghi đè `changes`, tài liệu và cả `requested_by`.
- Chưa có snapshot/revision bất biến đủ mạnh để review đúng phiên bản.
- Nhiều tài liệu cũ mô tả “một pending/company”, mâu thuẫn quyết định mới cho
  nhiều thành viên gửi song song.

### 4.3 Truy cập tài liệu

- Company member có thể nhìn thấy hoặc tải tài liệu gắn với update request của
  member khác rộng hơn phạm vi mong muốn.
- Metadata nghiệp vụ, nội dung thay đổi và binary file chưa được tách quyền rõ.
- Cần kiểm thử cả list, detail, preview, download và storage URL; chỉ sửa list
  queryset là chưa đủ để đóng IDOR.

### 4.4 Upload và storage

- Upload hiện chủ yếu kiểm signature/MIME/dung lượng rồi ghi thẳng private
  storage.
- Chưa có quarantine, malware scan, scan retry, TTL hoặc fail-closed state.
- Company update có thể tạo request trước rồi mới upload file; upload lỗi một
  phần vẫn có thể báo đã lưu và để lại request/file dở dang.

### 4.5 Verification và admin review

- Duyệt document hoặc reconcile prerequisite có thể tự động approve hồ sơ và
  đánh dấu company verified.
- Frontend admin chưa sử dụng đầy đủ API decision impact/final decision đã có.
- Admin chưa luôn thấy rõ quyết định recruiter có ảnh hưởng cấp company.
- Tax lookup và override chưa được trình bày nhất quán như bằng chứng hỗ trợ.

### 4.6 Job, campaign và candidate data

- Jobs, campaigns và applications đang dùng chung một guard
  `verification_completed`.
- Chưa tách readiness, approval và candidate-data access.
- Job moderation chưa có blocker verification/DPA canonical ở mọi đường duyệt.
- Candidate access có chỗ chỉ dựa feature flag, chưa đủ policy source.

### 4.7 Phone, DPA, notification và activity

- OTP “điện thoại” hiện được gửi qua email.
- DPA cũ chỉ lưu timestamp, thiếu version, content hash, actor, IP và session.
- Chuông topbar chưa có handler/badge; notification history và workspace
  activity vẫn là “Sắp mở”.
- Business/security activity chưa có retention và redaction contract chung.

## 5. Quyết định đã xác nhận

| ID | Trạng thái | Quyết định |
| --- | --- | --- |
| ER-D01 | `CONFIRMED` | Thẻ chính là “Yêu cầu của tôi”; chưa có request thì chỉ hiện nút tạo, không ngày/trạng thái giả |
| ER-D02 | `CONFIRMED` | Query lỗi hiện alert + retry và khóa thao tác ghi cho tới khi tải lại thành công |
| ER-D03 | `CONFIRMED` | Ngày nghiệp vụ là `submitted_at` |
| ER-D04 | `CONFIRMED` | Tất cả member được xem trạng thái và nội dung lịch sử yêu cầu của công ty, có hiển thị requester |
| ER-D05 | `CONFIRMED` | Nếu member khác đang có request active, member mới vẫn được tạo request riêng |
| ER-D06 | `CONFIRMED` | Creator là người duy nhất sửa/resubmit request; requester không bị thay đổi sau khi tạo |
| ER-D07 | `CONFIRMED` | Binary file nhạy cảm chỉ uploader, company owner và admin được ủy quyền xem/tải |
| ER-D08 | `CONFIRMED` | Không có business draft lâu dài; chỉ có upload session tạm, cancel/exit/TTL phải dọn dữ liệu |
| ER-D09 | `CONFIRMED` | Creator được withdraw và owner được cancel trước review, bắt buộc ghi audit/lý do phù hợp |
| ER-D10 | `CONFIRMED` | `in_review` bị khóa; `changes_requested` cho phép resubmit revision; `rejected` đóng lần xử lý hiện tại |
| ER-D11 | `CONFIRMED` | Upload mới phải quarantine, ClamAV scan, fail closed và explicit submit |
| ER-D12 | `CONFIRMED` | File hợp lệ giữ 24 tháng; file độc hại xóa sớm sau khi lưu hash/kết quả scan; legal hold là ngoại lệ |
| ER-D13 | `CONFIRMED` | File hiện có được coi là `legacy_trusted`, không background scan và không giả là `clean` |
| ER-D14 | `CONFIRMED` | Duyệt từng document không tự approve hồ sơ; admin có quyết định cuối riêng |
| ER-D15 | `CONFIRMED` | Tax lookup chỉ advisory; override bắt buộc lý do |
| ER-D16 | `CONFIRMED` | Hoàn tất bước cơ bản, phone, company, tài liệu sạch và submit DPA thì được vào job workspace trước admin approval |
| ER-D17 | `CONFIRMED` | Được tạo/gửi tin trước verification approval; admin không được approve tin cho tới khi đủ blocker |
| ER-D18 | `CONFIRMED` | Applications/CV/candidate data có access gate riêng, không dùng chung workspace guard |
| ER-D19 | `CONFIRMED` | Jobs/campaigns/applications vẫn recruiter-owned; member cùng company không xem dữ liệu tuyển dụng của nhau |
| ER-D20 | `CONFIRMED` | Verification/DPA bị mất hiệu lực tạo hold có reason riêng; reapprove chỉ gỡ đúng hold do nguồn đó tạo |
| ER-D21 | `CONFIRMED` | Duyệt recruiter đồng thời xác minh company; admin UI phải cảnh báo ảnh hưởng cấp company |
| ER-D22 | `CONFIRMED` | Phone cũ giữ nguyên, không gắn `legacy_email_confirmed`, không deadline và không hold |
| ER-D23 | `CONFIRMED` | Tài khoản mới dùng SMS; tài khoản cũ dùng SMS khi đổi số hoặc xác minh lại về sau |
| ER-D24 | `CONFIRMED` | DPA mới lưu version/hash/actor/time/IP/session theo append-only evidence |
| ER-D25 | `CONFIRMED` | Website notification có bell, history, deep link, read status; email quyết định quan trọng luôn bật |
| ER-D26 | `CONFIRMED` | Business/security activity hiển thị 24 tháng |
| ER-D27 | `CONFIRMED` | Chọn nhầm company xử lý qua yêu cầu admin unlink khi tài khoản còn sạch |
| ER-D28 | `CONFIRMED` | Rollout hold cho dữ liệu hiện hữu phải dry-run, ops review rồi mới apply và notify |
| ER-D29 | `CONFIRMED` | Khi candidate-data bị khóa, vẫn hiển thị số tổng hợp không định danh; mọi PII, CV, link và activity nhạy cảm bị ẩn |
| ER-D30 | `CONFIRMED` | Cutover storage bằng copy + checksum không phá hủy; legacy giữ ngoài serving path để rollback, private/quarantine không phát direct URL |
| ER-D31 | `CONFIRMED` | Đổi phone giữ proof/readiness cũ tới khi SMS số mới thành công; reverify tự nguyện và không vô hiệu proof khi pending/thất bại |
| ER-D32 | `CONFIRMED` | Employer phone mới chỉ nhận số di động Việt Nam canonical `+84`; bỏ availability oracle, compatibility endpoint chỉ trả kết quả generic |
| ER-D33 | `CONFIRMED` | Challenge phone chứa PII/ciphertext xóa sau 30 ngày; audit redacted giữ 24 tháng; admin không sửa trực tiếp phone đã xác minh |
| ER-D34 | `CONFIRMED` | SMS production giữ flag tắt tới khi chọn gateway/template/sender; provider lỗi phải fail closed, không fallback email |
| ER-D35 | `CONFIRMED` | Recruiter verification bị revoke/expired không tự downgrade company; pháp nhân chỉ đổi bằng quyết định company riêng |
| ER-D36 | `CONFIRMED` | Hồ sơ auto-approved lịch sử được grandfather với nguồn `legacy_auto/legacy_unknown` và đưa vào báo cáo ops; không reset/hold tự động |
| ER-D37 | `CONFIRMED` | Revoke/expire khóa candidate-data và job approval, ẩn active job khỏi public ngay; vẫn cho workspace, tạo/sửa/gửi tin |
| ER-D38 | `CONFIRMED` | Tax `pending` phải chờ; mismatch/not_found/unavailable/invalid/missing chỉ approve với quyền override và reason |
| ER-D39 | `CONFIRMED` | Tách `review`, `revoke`, `tax_override`; revoke/override mặc định chỉ Super Admin hoặc Compliance Lead được gán rõ |
| ER-D40 | `CONFIRMED` | Rejected dùng cùng case với `revision++`; revoked/expired xử lý lại về pending, recruiter resubmit rồi admin start review |
| ER-D41 | `CONFIRMED` | Phase ER-5 chỉ hỗ trợ expired manual; chưa tự đặt TTL/scheduler trước chính sách thời hạn pháp lý riêng |

## 6. Quyết định đã chốt tại gate ER-0

| ID | Trạng thái | Đề xuất | Ảnh hưởng nếu chưa chốt |
| --- | --- | --- | --- |
| ER-O01 | `CONFIRMED` | Cho nhiều requester active song song nhưng giới hạn một active request/requester/company | Khóa unique, POST semantics và test concurrency của ER-4 |
| ER-O02 | `CONFIRMED` | Nếu request xung đột với company version mới, không partial apply; trả toàn bộ request về `changes_requested` | Transaction apply và UI conflict của ER-4 |
| ER-O03 | `CONFIRMED` | DPA cũ được nhận diện `legacy_unversioned`; chặn candidate data/admin approval khi rollout, cho 30 ngày trước DPA hold | Migration/backfill và rollout ER-6 |
| ER-O04 | `CONFIRMED` | Dùng `dev` làm integration branch và `dev → main` làm release PR | Branch/release flow của toàn epic |
| ER-O05 | `CONFIRMED` | Bật CI cho Pull Request vào `dev`, đồng thời vẫn chạy gate theo phạm vi trước khi bàn giao | Definition of Done cho từng PR |
| ER-O06 | `CONFIRMED` | Audit và sửa quyền xem/tải/export CV; chỉ mở rộng pipeline upload candidate nếu phát hiện dùng chung hạ tầng không an toàn | Giới hạn scope CV của ER-2/ER-3 |

Các quyết định trên và ER-D29 đến ER-D41 được người phụ trách sản phẩm xác nhận
ngày 2026-08-10.
Mọi thay đổi về sau phải được ghi vào decision log trước khi triển khai.

## 7. State machine mục tiêu

### 7.1 Upload session

```text
uploading
  → quarantined
  → scanning
      → clean
      → rejected
      → error → retry → scanning
      → expired
```

Quy tắc:

- `quarantined`, `scanning`, `rejected`, `error`, `expired` không được download
  bởi người dùng và không được attach vào request/case.
- Chỉ file `clean` được explicit submit.
- Tắt feature rollout không được biến file chưa sạch thành file tải được.
- Session cancel/expired phải có cleanup idempotent.

### 7.2 Company update request

```text
temporary upload session
  → submitted
      → resubmitted                 (trước khi admin bắt đầu review)
      → withdrawn                   (creator, trước review)
      → cancelled                   (company owner, trước review)
      → in_review
          → approved
          → changes_requested
              → resubmitted
          → rejected
```

Mỗi submit/resubmit tạo immutable revision. `requested_by` thuộc request và
không đổi. `in_review` khóa revision đang được admin đánh giá.

### 7.3 Employer verification

```text
collecting
  → submitted
  → in_review
      → changes_requested → submitted
      → rejected
      → approved
          → revoked/expired
          → approved (sau khi xử lý lại)
```

Document decision và case decision là hai lớp khác nhau. Không có đường tự động
từ “tất cả document approved” sang “case approved”.

### 7.4 Job/campaign/candidate access

| Capability | Điều kiện tối thiểu |
| --- | --- |
| Vào job/campaign workspace | `job_workspace_ready=true` |
| Tạo/lưu/gửi tin | Workspace ready và account không bị policy/account hold tương ứng |
| Admin approve/publish tin | Verification approved, DPA current và không có blocker khác |
| Xem applications/CV/export | `candidate_data_access=true` và resource thuộc recruiter |
| Khôi phục sau revoke | Chỉ gỡ hold có đúng source/reason sau khi điều kiện tương ứng hợp lệ lại |

### 7.5 DPA

```text
current
  → outdated/material_change
      → candidate data blocked immediately
      → admin job approval blocked immediately
      → grace period
          → re-consented → current
          → expired grace → DPA hold
```

Luồng đối với DPA cũ phụ thuộc ER-O03.

## 8. Permission matrix mục tiêu

| Hành động | Requester | Member khác | Company owner | Admin được ủy quyền | Ngoài company |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tạo request riêng | Có | Có | Có | Không | Không |
| Xem trạng thái/nội dung request company | Có | Có | Có | Có | Không |
| Sửa/resubmit request | Có | Không | Chỉ request của mình | Không | Không |
| Withdraw trước review | Có | Không | Nếu là requester | Không | Không |
| Cancel trước review | Không | Không | Có, kèm lý do | Có nếu policy cho phép | Không |
| Xem metadata file đã redacted | Có | Có | Có | Có | Không |
| Preview/download binary file | Nếu là uploader | Không | Có | Có | Không |
| Review document/request/case | Không | Không | Không | Có | Không |
| Xem job/campaign/application của recruiter khác | Không | Không | Không | Theo RBAC admin | Không |

Endpoint ngoài phạm vi nên trả `404` thay vì `403` khi cần tránh resource
enumeration. Response member không được chứa storage key, signed URL, scan
engine detail hoặc hash file.

## 9. Contract API và dữ liệu mục tiêu

### 9.1 Actor-scoped và company-scoped request

Giữ endpoint list hiện có tương thích và thêm scope tường minh:

```text
GET /api/employer/company/update-requests/?scope=mine
GET /api/employer/company/update-requests/?scope=company
```

- `scope=mine` cấp dữ liệu cho thẻ “Yêu cầu của tôi”.
- `scope=company` cấp lịch sử công ty và luôn ghi requester summary.
- Default cũ phải được giữ trong compatibility window hoặc được version hóa;
  không đổi âm thầm semantics của client đang tồn tại.

Response cần có:

- `submitted_at`, không dùng `updated_at` làm ngày submit;
- `requested_by_summary` đã giới hạn PII;
- `status`, `current_revision`, `lock_version`, `base_company_version`;
- `allowed_actions[]` do backend tính;
- file metadata đã redacted và không có download URL nếu actor không đủ quyền.

### 9.2 Canonical readiness

Employer onboarding/profile response cần trả:

```text
job_workspace_ready
verification_approved
candidate_data_access
dpa_status
blockers[]
```

Frontend không tự suy từ bốn/các field rời rạc. Field cũ
`verification_completed` được dual-read trong compatibility window và chỉ xóa
sau khi repository search xác nhận không còn consumer.

### 9.3 Canonical error codes

Tối thiểu phải chuẩn hóa:

```text
REQUEST_IN_REVIEW
STALE_REVISION
COMPANY_VERSION_CONFLICT
UPLOAD_NOT_CLEAN
UPLOAD_SCAN_FAILED
VERIFICATION_REQUIRED
DPA_OUTDATED
CANDIDATE_DATA_BLOCKED
JOB_APPROVAL_BLOCKED
RESOURCE_NOT_FOUND
```

Error response phải có code máy đọc được, message an toàn và action/retry hint
khi phù hợp. Không parse message tiếng Việt để điều khiển UI.

## 10. Kế hoạch giai đoạn, nhánh và dependency

Không dùng tiền tố `codex/`. Tên nhánh chuẩn:

- tính năng: `feature/...`;
- sửa lỗi/bảo mật: `fix/...`;
- tài liệu: `docs/...`;
- vận hành/CI: `chore/...`;
- dọn compatibility: `refactor/...`.

### ER-0 — Audit baseline và phê duyệt contract

**Nhánh:** `docs/employer-audit-spec`
**Trạng thái:** `Verified`
**Phụ thuộc:** Không

Deliverables:

- Tài liệu kế hoạch này.
- Decision log có ID, ngày, context, quyết định và tài liệu bị supersede.
- Security/flow audit report có evidence, severity, owner, trạng thái và residual
  risk.
- State/permission matrix, API error contract và acceptance matrix.
- Test tái hiện lỗi ngày yêu cầu và các chuỗi IDOR trước khi vá.

Không ghi hành vi dự kiến vào `CHANGELOG.md` trong PR docs-only.

**Gate ER-0:** ER-O01 đến ER-O06 và toàn bộ scope đã được xác nhận ngày
2026-08-10; Markdown link/whitespace gate đạt.

### ER-1 — Vá lỗi và lỗ hổng P0

**Trạng thái:** `Verified` (2026-08-10; ER-1A, ER-1B và ER-1C đều đạt gate)

Các nhánh sau có thể chạy song song sau ER-0:

#### ER-1A — Empty/error/personal request state

**Nhánh:** `fix/employer-request-empty-state`
**Trạng thái:** `Verified` (2026-08-10)

- Tách loading, error, empty và has-data state.
- Empty chỉ hiện nút tạo; không placeholder ngày/status.
- Error hiện retry và khóa create/edit.
- Thẻ chính dùng `scope=mine`; history dùng `scope=company`.
- Hiển thị ngày `submitted_at`.
- Unit/regression/E2E cho member mới vừa chọn company.

Evidence: commit `828a8d0e`; 24/24 unit/API/query-key regression đạt; 9/9 E2E
cho ba workflow company settings trên desktop/tablet/mobile đạt; Oxlint không có
lỗi, architecture và production build đều xanh. `scope=mine` và
`scope=company` có query key độc lập nhưng cùng root để invalidate; lỗi lần đầu
hoặc background refresh khóa toàn bộ write/upload/delete/submit cho tới khi cả
hai query thành công. Markdown link và whitespace gate đạt sau cập nhật tài
liệu.

#### ER-1B — Document object access

**Nhánh:** `fix/employer-document-access-control`
**Trạng thái:** `Verified` (2026-08-10)

- Khóa list/detail/preview/download theo permission matrix.
- `requested_by` bất biến; POST không upsert vào request của actor khác.
- Signed URL chỉ phát sau object-level authorization.
- Test IDOR với public ID/storage reference của user khác.

Evidence: commit `609b3e47`; migration `employers.0030` backfill
`submitted_at` và đổi unique pending sang `(company, requested_by)`; 108 test
employer trước đồng bộ và 127 test employer + moderation sau merge `dev` đạt,
list budget 4 query và các gate Ruff/format/import-linter/Django/migration drift
đều xanh. Residual lifecycle request thuộc ER-4; upload trust boundary thuộc
ER-3.

#### ER-1C — Admin job approval recheck

**Nhánh:** `fix/admin-job-approval-guard`
**Trạng thái:** `Verified` (2026-08-10)

- Backend recompute blocker trong transaction.
- Không tin blocker do frontend gửi lên.
- Test race approve với revoke/account/DPA transition.

Evidence: commit `7e04f6a3`; canonical và compatibility path dùng chung
authoritative guard, recompute verification/DPA/campaign dưới transaction lock;
20 moderation/query-budget test, một DPA/duplicate regression và bốn frontend
blocker test đạt; Ruff/format/import-linter/migration drift đều xanh. Residual
hold sau revoke thuộc ER-5.

**Release:** ER-1 là safety fix, không đặt sau feature flag có thể bypass.

### ER-2 — Readiness và permission contract

**Backend:** `feature/employer-readiness-contract`
**Frontend:** `feature/employer-readiness-ui`
**Phụ thuộc:** ER-1

Backend:

- Thêm canonical readiness fields và blockers.
- Tách selector quyền workspace/candidate-data khỏi presenter/API.
- Giữ query budget phẳng và test list endpoint.
- Dual-read/write contract cũ trong compatibility window.

Frontend:

- Tách job/campaign guard khỏi application/candidate-data guard.
- Cập nhật login destination, onboarding panel, checklist và direct routes.
- Thêm compliance strip giải thích blocker và action.
- Không deep-import; giữ đúng ownership theo `frontend/ARCHITECTURE.md`.

**Gate ER-2:** demo ma trận account mới, submitted, approved, DPA outdated,
revoked và account hold trước khi merge frontend.

**Kết quả kỹ thuật ER-2 — Verified 2026-08-10:**

- Backend commits `b5a50c45`, `49f11065`, `f1408e43` và `916d2bfb`, sau
  merge-sync `8e01389e`, trả đúng
  năm field readiness ở `/api/employer/me/` và
  `employer_job_workspace_ready` ở `/api/auth/me/`. Workspace guard bao phủ
  campaign mutations và toàn bộ employer job mutations; candidate policy không
  còn feature-flag bypass trên application list/export/status/history/snapshot,
  dashboard recent applications, job/campaign preview, activity metadata và
  recruiter CV asset content.
- Frontend commits `cc4e3085`, `59307148`, `7c97cc7c`, `44da5635`,
  `ab1c003e` và `d84760ba` thêm public readiness
  model/hook, `JobWorkspaceGuard`, `CandidateDataGuard`, machine-action mapping,
  compliance UI và fail-closed consumer gating. Direct URL bị từ chối giữ
  nguyên; query nhạy cảm không mount/chạy và PII đã cache biến mất ngay khi
  readiness chuyển `true → false`. Theo ER-D29, aggregate không định danh được
  giữ lại; tên/email/avatar/CV/link/activity ứng viên bị khóa.
- Ma trận unit đủ sáu trạng thái new/submitted/approved/DPA outdated/
  verification revoked/account hold; canonical partial, malformed hoặc
  `true + blocker cùng capability` đều fail closed. Full coverage gate đạt 253
  test file/953 test; readiness E2E đạt 9/9 trên desktop/tablet/mobile. Oxlint
  không lỗi, architecture 1.142 module/2.293 dependency và production build
  đều đạt.
- Backend đạt 206 integration test và direct/read/query matrix 31/31; Ruff,
  import-linter/layering, migration drift, query budget và race regression đều
  đạt. Campaign list giữ 4 query phẳng; auth session giữ budget tối đa 12 query.
- Residual được giữ đúng phase: ER-5 xử lý post-approval revoke/hold
  reconciliation; ER-6 bổ sung DPA version/hash/IP/session và các trạng thái
  `legacy_unversioned|outdated|grace|hold`. ER-2 đã khóa shape để các phase này
  không phải đổi consumer contract.

### ER-3 — Upload quarantine foundation

**Storage foundation:** `fix/media-storage-boundaries` — In progress
**Backend:** `feature/employer-upload-quarantine`
**Frontend:** `feature/employer-upload-session-ui`
**Phụ thuộc:** ER-2

Backend:

- Storage foundation tách root/bucket public, private, quarantine; old shared
  root chỉ là unserved migration source. DEBUG/nginx chỉ serve public;
  private/quarantine `.url()` fail-closed.
- Backfill byte dùng command dry-run/apply copy+verify idempotent,
  batch/cursor; không chạy storage I/O trong schema migration. Raw multipart
  DOC/DOCX preview bị khóa bằng `UPLOAD_SCAN_REQUIRED` cho tới clean-session.
- Additive upload-session và scan-metadata schema.
- Temporary/quarantine/clean storage boundary.
- ClamAV adapter, worker task, timeout, retry và idempotency.
- Retention/legal-hold cleanup command.
- Existing file classification `legacy_trusted`.
- Metrics không log raw filename/phone/document content.

Frontend:

- UI cho uploading/quarantine/scanning/clean/rejected/error/expired.
- Disable submit khi có file chưa `clean`.
- Retry/cancel rõ ràng; không báo thành công nếu partial upload lỗi.
- Không tạo business request trước khi file session đủ điều kiện submit.

**Gate ER-3:** clean, malware, timeout, scanner unavailable, retry, cancel,
expiry và legacy download scenarios đều có evidence.

### ER-4 — Company update request V2

**Backend:** `feature/employer-company-request-lifecycle`
**Frontend:** `feature/employer-company-request-ui`
**Phụ thuộc:** ER-3 và ER-O01/ER-O02

Schema mục tiêu:

- `CompanyUpdateRequest`: immutable requester, status, submitted time,
  base-company version và lock version.
- `CompanyUpdateRevision`: immutable snapshot và clean attachment references.
- `CompanyUpdateEvent`: append-only audit event.

Workflow:

- Nhiều member gửi song song.
- Creator sửa/resubmit trước review; in-review read-only.
- Creator withdraw; owner cancel trước review kèm reason/audit.
- Member xem company history nhưng binary permission vẫn giới hạn.
- Admin luôn review revision cụ thể.
- Apply request trong transaction sau company-version conflict check.

Migration dữ liệu cũ:

- `pending → submitted`;
- `submitted_at = created_at`;
- giữ requester hiện hữu;
- tạo revision 1 từ snapshot hiện tại;
- ghi migrated marker/event;
- không gọi storage/provider/Celery từ schema migration.

**Gate ER-4:** concurrent create, concurrent review, stale revision, overlapping
fields, non-overlapping fields, resubmit, withdraw và cancel.

**Safety slice đã merge (2026-08-10):** `ddb8a47f` chuẩn hóa lock order hiện
hành `Company → CompanyUpdateRequest → CompanyDocument`; admin mở và review
đúng request `public_id`, không lấy `results[0]`; metadata nhạy cảm được che nếu
thiếu `account.sensitive.view`, còn binary bắt buộc cả view và sensitive. Backend
108/108 và frontend 10/10 regression đạt cùng scoped quality gates. Đây là
evidence trung gian, không thay cho schema revision/base-version và toàn bộ gate
lifecycle ở trên.

### ER-5 — Verification, final decision và compliance holds

**Backend:** `feature/employer-verification-state-machine`
**Admin UI:** `feature/admin-employer-final-decision`
**Policy holds:** `feature/employer-compliance-holds`
**Job UI:** `feature/admin-job-compliance-ui`
**Phụ thuộc:** ER-2 và ER-3; tích hợp company update sau ER-4

- Review document và final case decision tách riêng.
- Frontend consume decision-impact trước khi confirm quyết định cuối.
- Company-level effect được cảnh báo rõ.
- Tax override bắt buộc reason/audit.
- Admin job UI render canonical blocker code và link xử lý nếu có quyền.
- Hold có source/reason riêng; reconcile không gỡ business/moderation hold khác.
- Existing active job/campaign dùng dry-run report, ops approval và batch apply.

**Quyết định gate ER-5 đã khóa (ER-D35–ER-D41):**

- Company verification độc lập với revoke/expire của một recruiter; không suy
  diễn company downgrade.
- Legacy auto-approved được grandfather và report ops, không tự reset/hold.
- Revoke/expire ẩn active public jobs và khóa candidate-data/job approval,
  nhưng không khóa workspace hoặc job draft/submit.
- Tax pending phải chờ; trạng thái advisory còn lại cần permission override và
  lý do audit. Review, revoke và tax override là ba quyền riêng.
- Rejected dùng revision mới trên cùng case; revoked/expired quay về pending để
  resubmit. Expired chỉ manual trong phase này, chưa có TTL/scheduler.

**Gate ER-5:** review/revoke/reapprove, race với job approval, hold
apply/release/reconcile và company-level impact đều có test.

### ER-6 — SMS và DPA evidence

#### ER-6A — SMS adapter

**Nhánh:** `feature/employer-sms-verification`
**Phụ thuộc:** ER-2

- Provider-neutral interface.
- Fake dev/test provider; production fail startup/readiness nếu flag bật mà
  thiếu endpoint/credential/template.
- TTL, throttle, attempt budget, replay protection và secret redaction.
- Account cũ giữ nguyên; account mới, đổi phone hoặc reverify dùng SMS.

#### ER-6B — DPA evidence

**Nhánh:** `feature/employer-dpa-evidence`
**Phụ thuộc:** ER-2, ER-5 và ER-O03

- Append-only version/hash/actor/time/IP/session evidence.
- Material change policy: candidate-data block và admin-approval block ngay;
  grace trước DPA hold.
- Re-consent và release đúng hold source.
- Legacy row không được bịa hash/IP/session.

**Gate ER-6:** SMS outage/rate-limit/replay và DPA
current/outdated/grace/expired/re-consent/legacy scenarios.

### ER-7 — Unlink, notification và activity

**Company recovery:** `feature/employer-company-unlink-request`
**Notification API:** `feature/employer-notification-api`
**Notification UI:** `feature/employer-notification-center`
**Activity:** `feature/employer-activity-log`
**Phụ thuộc:** stable events từ ER-4, ER-5 và ER-6

- Unlink chỉ qua admin khi account/company relation còn clean; impact preview
  và reason bắt buộc.
- Transactional outbox, dedupe key, retry và unread index.
- Website bell, history page, read status, pagination và deep link.
- Email quyết định quan trọng luôn bật; event trung gian configurable.
- Activity business/security giữ 24 tháng, redacted và không chứa secret/hash/
  storage key.

**Gate ER-7:** duplicate event, outbox retry, unread consistency, inaccessible
deep link, retention và permission scenarios.

### ER-8 — Rollout, monitoring và compatibility cleanup

**Rollout:** `chore/employer-workflow-rollout`
**Cleanup sau soak:** `refactor/employer-workflow-compat-cleanup`
**Phụ thuộc:** ER-1 đến ER-7

Feature flags đề xuất:

```text
EMPLOYER_UPLOAD_SCAN_REQUIRED
EMPLOYER_COMPANY_UPDATE_V2_ENABLED
EMPLOYER_VERIFICATION_V2_ENABLED
EMPLOYER_SMS_OTP_ENABLED
EMPLOYER_NOTIFICATION_CENTER_ENABLED
```

IDOR permission, quarantine download denial và admin approval guard luôn
fail-closed; không có flag cho phép bypass.

Rollout:

1. Expand schema.
2. Deploy compatibility code và dual-read/write.
3. Chạy backfill command idempotent theo batch/cursor.
4. Đối soát trước/sau và lưu dry-run report.
5. Bật nội bộ rồi staging.
6. Chạy full regression và rollback rehearsal.
7. Bật production theo cohort/phần trăm phù hợp.
8. Quan sát soak period.
9. Contract compatibility và cleanup bằng PR riêng sau phê duyệt.

Rollback ưu tiên tắt flag về compatibility path. Không reverse migration, xóa
revision/file hoặc gỡ hold không đúng source.

## 11. Sơ đồ dependency nhánh

```text
docs/employer-audit-spec
├── fix/employer-request-empty-state
├── fix/employer-document-access-control
└── fix/admin-job-approval-guard
    └── feature/employer-readiness-contract
        ├── feature/employer-readiness-ui
        ├── feature/employer-upload-quarantine
        │   └── feature/employer-upload-session-ui
        │       └── feature/employer-company-request-lifecycle
        │           └── feature/employer-company-request-ui
        └── feature/employer-verification-state-machine
            ├── feature/admin-employer-final-decision
            ├── feature/employer-compliance-holds
            └── feature/admin-job-compliance-ui
                ├── feature/employer-sms-verification
                └── feature/employer-dpa-evidence
                    ├── feature/employer-company-unlink-request
                    ├── feature/employer-notification-api
                    │   └── feature/employer-notification-center
                    └── feature/employer-activity-log
                        └── chore/employer-workflow-rollout
                            └── refactor/employer-workflow-compat-cleanup
```

Các nhánh frontend chỉ bắt đầu sau khi backend contract tương ứng được merge
hoặc có contract fixture đã phê duyệt. Nhánh notification chỉ bắt đầu khi event
catalog của các phase trước ổn định.

## 12. Migration và backfill

### 12.1 Nguyên tắc

- Schema thay đổi theo expand → migrate/backfill → contract.
- Migration schema không gọi provider, storage, email hoặc Celery.
- Backfill lớn dùng management command idempotent, batch/cursor, dry-run và số
  đếm đối soát trước/sau.
- Không bịa bằng chứng lịch sử như scan result, DPA hash, IP hoặc session.
- Không tăng query budget nếu không có giải thích và test chứng minh.
- Không reverse-delete dữ liệu nghiệp vụ khi rollback release.

### 12.2 Nhóm migration dự kiến

| Nhóm | Thay đổi additive | Backfill |
| --- | --- | --- |
| Company request V2 | `submitted_at`, base/lock version, revision, event, migrated marker | `pending → submitted`, revision 1, giữ requester |
| Upload security | upload session, scan status/result metadata, quarantine/retention fields | file cũ → `legacy_trusted` |
| DPA evidence | append-only acceptance/evidence table | phụ thuộc ER-O03; không tạo hash/IP giả |
| Compliance holds | hold source/reason và resource linkage | dry-run rồi batch apply sau ops approval |
| Notification/activity | outbox, notification, unread index, activity metadata | chỉ backfill nếu có yêu cầu sản phẩm được duyệt |

## 13. Kiểm thử và quality gates

### 13.1 Backend gate

Chạy tại `backend/`:

```bash
ruff check .
ruff format --check .
lint-imports
python manage.py makemigrations --check --dry-run
pytest --cov --cov-fail-under=84
```

Mọi Django app phải giữ dependency theo ADR-0010:

```text
api → services/selectors → models
tasks → services
```

### 13.2 Frontend gate

Chạy tại `frontend/`:

```bash
npm run lint
npm run check:architecture
npm run test:coverage
npm run build
npm run test:e2e:smoke
```

Nếu repository có gate bundle budget trong `scripts/check_all.sh`, phải chạy
gate đó trước khi bàn giao epic.

### 13.3 Full repository gate

```bash
./scripts/check_all.sh
```

### 13.4 Ma trận test bắt buộc

| Nhóm | Kịch bản tối thiểu |
| --- | --- |
| Request card | loading, fetch error, no own request, own request, other-member history, retry |
| Permission | owner/member/requester/admin/outsider trên list/detail/preview/download |
| Concurrency | hai member submit, cùng member submit đồng thời, stale revision, company-version conflict |
| Upload | clean, infected, polyglot, timeout, scanner down, retry, cancel, expired, legacy |
| Verification | document approved nhưng case pending, final decision, changes requested, reject, revoke |
| Job moderation | verification blocker, DPA blocker, account hold, stale review token, approve-vs-revoke race |
| Candidate access | list, detail, CV snapshot/download/export/history và deep link |
| SMS | TTL, attempt limit, replay, throttle, provider outage, phone uniqueness |
| DPA | current, material update, grace, expired grace, re-consent, legacy data |
| Notifications | outbox retry, dedupe, unread count, deep link denied/expired, pagination |
| Migration | dry-run, idempotent rerun, counts, rollback compatibility, query budget |
| Responsive | desktop/tablet/mobile, direct route và không overflow |

## 14. Definition of Done theo PR

Một PR chỉ được coi là hoàn tất khi:

- quyết định/gate liên quan đã được ghi nhận;
- phạm vi PR rõ và không trộn refactor ngoài yêu cầu;
- migration có forward/compatibility/backfill/rollback note;
- unit/regression/E2E theo rủi ro đã đạt;
- API/schema/docs bị ảnh hưởng được cập nhật cùng PR;
- `docs/TIEN-DO-DU-AN.md` được cập nhật evidence sau khi test xanh;
- `CHANGELOG.md` chỉ ghi hành vi thực sự đã merge;
- PR mô tả risk, screenshots UI liên quan, test evidence và rollback;
- không tăng architecture/query/coverage exceptions để né gate.

PR nên dưới 30 file. PR từ 30–60 file phải giải thích; trên 60 file phải tách
backend/frontend/migration/docs hoặc có lý do đặc biệt được phê duyệt.

## 15. Tài liệu phải cập nhật

### 15.1 Tài liệu mới

| File | Thời điểm | Nội dung |
| --- | --- | --- |
| `docs/03-database/ke-hoach-ra-soat-va-khac-phuc-employer.md` | ER-0 | Kế hoạch canonical này |
| `docs/02-tong-quan/employer-remediation-decision-log.md` | ER-0 | Quyết định có ID, ngày, context, người xác nhận |
| `docs/07-algorithms/employer-flow-security-audit-2026-08.md` | ER-0 và từng phase | Evidence, severity, fix status, retest, residual risk |
| `docs/06-deployment/employer-hardening-rollout-runbook.md` | ER-3 đến ER-8 | Scanner/SMS/DPA/holds rollout và rollback |

### 15.2 Tài liệu hiện có cần đồng bộ

| File | Cập nhật khi |
| --- | --- |
| `docs/05-huong-dan/luong-xac-thuc-nha-tuyen-dung.md` | ER-2, ER-5, ER-6 |
| `docs/03-database/ke-hoach-thiet-ke-lai-cong-ty-nha-tuyen-dung.md` | ER-4; đánh dấu phần cũ bị supersede |
| `docs/03-database/ke-hoach-trang-cong-ty.md` | ER-1 và ER-4; sửa owner/member semantics |
| `docs/03-database/ke-hoach-chien-dich-va-vong-doi-tin.md` | ER-2 và ER-5; readiness/approval/hold |
| `docs/03-database/thiet-ke-database.md` | Mỗi PR có schema/migration |
| `docs/04-api/openapi.yaml` | Mỗi PR thay đổi contract API |
| `docs/04-api/tai-lieu-api.md` | ER-1 đến ER-7 theo endpoint |
| `docs/04-api/frontend-response-contracts.md` | ER-1, ER-2, ER-4, ER-5, ER-7 |
| `docs/08-frontend/admin-job-management-plan.md` | ER-5 |
| `frontend/ARCHITECTURE.md` | Chỉ khi ER-2/ER-7 thêm guard/entity/widget/route ownership mới |
| `docs/README.md` | ER-0/ER-8; thêm index tới canonical docs/runbook |
| `.env.example` và deployment docs liên quan | ER-3/ER-6 khi thêm ClamAV/SMS config |

Không sửa `docs/04-api/openapi-baseline-2026-07.yaml`; đây là baseline lịch sử.

## 16. Tiến độ dự án

Trong `docs/TIEN-DO-DU-AN.md`, thêm một epic ngắn gọn; chi tiết vẫn nằm trong
tài liệu này. Mỗi phase dùng schema:

```text
ID | Trạng thái | Branch/PR | Migration | Test evidence | Rollout | Ghi chú
```

Trạng thái:

```text
Planned
→ Awaiting approval
→ In progress
→ Code complete
→ Verified
→ Released
→ Closed
```

Quy tắc:

- `Code complete` không đồng nghĩa `Verified`.
- Chỉ chuyển `Verified` khi quality gate đạt và có evidence.
- Chỉ chuyển `Released` sau deploy + smoke test.
- `Closed` yêu cầu audit retest và residual risk được ghi nhận.
- Cập nhật tiến độ ngay trong PR hoàn tất phase, không dồn cuối epic.
- Dòng “Cập nhật lần cuối” phải đổi cùng commit cập nhật tiến độ.

Trạng thái thực hiện hiện tại:

| ID | Trạng thái | Ghi chú |
| --- | --- | --- |
| ER-0 | Verified | Đã khóa quyết định; Markdown link và whitespace gate đạt |
| ER-1 | Verified | ER-1A, ER-1B và ER-1C đã đạt quality gate |
| ER-2 | Verified | Canonical readiness, backend capability enforcement, frontend guards/redaction và 3-viewport E2E đều đạt |
| ER-3 | In progress | Storage boundary/cutover foundation đạt scoped gate; upload session, scanner và retention còn mở |
| ER-4 | In progress | Safety slice exact-object/lock/redaction đạt; lifecycle V2 còn mở |
| ER-5 | In progress | ER-D35–ER-D41 đã khóa; implementation bắt đầu sau ER-4 safety |
| ER-6 | In progress | SMS adapter đang triển khai; DPA evidence vẫn mở |
| ER-7 | Planned | Phụ thuộc event catalog ổn định |
| ER-8 | Planned | Chỉ bắt đầu khi các phase chức năng verified |

## 17. Changelog

`CHANGELOG.md` dùng `[Unreleased]`, nhóm theo ngày merge và Keep a Changelog.
Không ghi trước các chức năng chưa merge.

| Loại | Ví dụ thay đổi |
| --- | --- |
| `Fixed` | Bỏ ngày giả, tách query error khỏi empty, sửa stale UX |
| `Security` | Đóng IDOR, quarantine, fail-closed download, admin transaction recheck, DPA evidence |
| `Added` | Upload session, SMS adapter, notification center, activity log |
| `Changed` | Request lifecycle, readiness contract, explicit final decision, compliance holds |

PR docs-only ER-0 không tuyên bố product behavior đã hoàn tất. Mỗi PR triển khai
cập nhật changelog đúng phần thay đổi thực tế của chính PR đó.

## 18. Observability và alert

### 18.1 Metrics

- Company request count theo status, age, requester count và conflict count.
- Request create/resubmit/withdraw/cancel/review latency.
- IDOR-denied list/detail/download, không log object secret.
- Upload scan latency, queue depth, infected/error/timeout/expired count.
- Quarantine age và orphan temporary file count.
- Verification case age, document-vs-case state mismatch.
- Admin job approval blocked count theo blocker code.
- Hold apply/release/reconcile count theo source/reason.
- Candidate-data denied count theo policy code.
- SMS send/delivery/verify/throttle/error; không log raw phone/OTP.
- DPA current/outdated/grace/expired/re-consent count.
- Outbox retry/dead-letter, notification dedupe và unread drift.
- Query count/budget cho endpoint list.

### 18.2 Alert tối thiểu

- Scanner unavailable hoặc queue age vượt ngưỡng.
- File chưa clean nhưng phát sinh download/attachment attempt.
- Verification approved không đồng nhất với company state.
- Job approved trong khi có blocker canonical.
- Hold reconcile mismatch.
- SMS failure rate hoặc throttle spike bất thường.
- Outbox dead-letter tăng liên tục.
- DPA grace expiration batch lớn hơn dry-run expectation.

## 19. Rollback và dữ liệu an toàn

- Tắt feature flag để trở về compatibility read path; không xóa schema mới.
- Không reverse migration đã tạo revision/evidence/event.
- Không chuyển file infected/error thành trusted khi rollback.
- Không gỡ toàn bộ hold; chỉ release hold có đúng source/reason và rollout ID.
- Trước batch apply phải lưu export ID/count để đối soát.
- Backfill và reconcile command phải có `--dry-run`, batch size và resume cursor.
- SMS flag production tắt nếu provider chưa readiness; luồng văn bản khác không
  được giả vờ gửi SMS thành công.
- Khi frontend V2 tắt, backend vẫn enforce permission và approval blocker.

## 20. Risk register

| Rủi ro | Mức | Biện pháp | Phase |
| --- | --- | --- | --- |
| Member mới thấy request/ngày của người khác như request của mình | Cao | actor-scoped card, company history riêng, regression test | ER-1 |
| IDOR tài liệu nhạy cảm | Nghiêm trọng | object-level auth ở mọi path, 404, signed URL sau auth | ER-1 |
| Hai request song song silent overwrite company | Cao | base version, immutable revision, transaction conflict check | ER-4 |
| Upload lỗi một phần tạo request dở dang | Cao | upload session trước business submit | ER-3 |
| Scanner outage mở đường bypass | Nghiêm trọng | fail closed, queue/alert, không có bypass flag | ER-3 |
| Duyệt document tự approve case/company | Cao | explicit final decision và state invariant | ER-5 |
| Approve job đua với revoke | Nghiêm trọng | transactional recompute/lock và concurrency test | ER-1/ER-5 |
| Gỡ nhầm hold khác khi reapprove | Cao | source/reason riêng, reconcile scoped | ER-5 |
| DPA legacy rollout gây khóa hàng loạt | Cao | ER-O03, dry-run, grace, cohort rollout | ER-6/ER-8 |
| SMS provider outage | Trung bình | provider adapter, readiness, retry/throttle, flag | ER-6 |
| Notification lộ secret/PII | Cao | event schema tối thiểu, redaction test, no raw file/hash | ER-7 |
| Docs và code tiếp tục mâu thuẫn | Cao | canonical doc, same-PR update, progress/decision evidence | Tất cả |

## 21. Runbook phải có trước production

Tạo `docs/06-deployment/employer-hardening-rollout-runbook.md` với:

1. Preconditions và owner trực vận hành.
2. Feature flags và config matrix theo environment.
3. ClamAV health/readiness, queue và storage paths.
4. SMS provider readiness và secret rotation.
5. Schema migration, backfill, dry-run, apply, resume và reconcile.
6. Company request V2 compatibility/cutover.
7. Verification/DPA/job hold dry-run và approval checklist.
8. Metrics dashboard, alerts và expected baseline.
9. Staging rehearsal và smoke scenarios.
10. Cohort rollout, pause criteria và abort criteria.
11. Rollback commands không phá dữ liệu.
12. Post-rollout audit và residual-risk sign-off.

## 22. Checklist phê duyệt kế hoạch

- [x] Giới hạn một active request/requester/company; các requester được song song.
- [x] Conflict xử lý nguyên tử, không partial apply.
- [x] DPA legacy, thời điểm block và grace 30 ngày trước hold.
- [x] `dev` là integration branch và `dev → main` là release flow.
- [x] Bật CI cho Pull Request vào `dev` và vẫn chạy gate theo phạm vi.
- [x] Audit/sửa quyền CV; chỉ mở rộng candidate upload khi dùng chung hạ tầng không an toàn.
- [x] Xác nhận ER-0 và cho phép tạo các nhánh ER-1.

Sau khi checklist được duyệt, cập nhật decision log trước, sau đó mới tạo nhánh
theo thứ tự và dependency trong tài liệu này.
