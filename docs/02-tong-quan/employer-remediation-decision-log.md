# Biên bản quyết định — Rà soát và hardening Nhà tuyển dụng

> **Tài liệu sống:** cập nhật trước khi triển khai một thay đổi mới về luồng,
> quyền, dữ liệu hoặc rollout.  
> **Đặc tả canonical:**
> [Kế hoạch rà soát và khắc phục Employer](../03-database/ke-hoach-ra-soat-va-khac-phuc-employer.md)  
> **Ngày khóa gate ER-0:** 2026-08-10

## Nguyên tắc

1. Quyết định trong file này ưu tiên hơn mô tả cũ được liệt kê là superseded.
2. Không thay đổi flow/permission/schema dựa trên suy đoán; phải có decision ID.
3. Mỗi thay đổi quyết định ghi context, lựa chọn, hệ quả và tài liệu/code bị ảnh
   hưởng.
4. Quyết định kỹ thuật chi tiết được phép tối ưu trong phạm vi đã duyệt, nhưng
   không được làm thay đổi quyền hoặc kết quả nghiệp vụ.

## Session 2026-08-10 — Gate ER-0

### Bối cảnh

- Thành viên mới chọn company thấy “Ngày gửi gần nhất” dù chưa từng tạo yêu cầu.
- Frontend đang trộn request của actor với lịch sử company; query lỗi bị coi là
  empty state.
- Backend đang upsert một request `pending` dùng chung theo company và có thể
  thay `requested_by`.
- File, verification, job moderation, phone OTP và DPA còn thiếu các boundary
  bảo mật/lifecycle cần thiết.
- Chủ dự án yêu cầu triển khai toàn bộ remediation theo từng phase, dùng nhánh
  chuẩn và hỏi duyệt trước khi thay đổi flow.

### Quyết định sản phẩm và quyền

| ID | Quyết định đã xác nhận | Hệ quả triển khai chính |
| --- | --- | --- |
| ER-D01 | Thẻ chính là “Yêu cầu của tôi”; empty không có ngày/status giả | Actor-scoped query và bốn UI state |
| ER-D02 | Fetch lỗi hiện retry và khóa write | Không dùng `data || []` để che lỗi |
| ER-D03 | Ngày nghiệp vụ là `submitted_at` | Additive API/schema field và backfill |
| ER-D04 | Member xem trạng thái/nội dung company history, có requester | Company-scoped response phải redacted |
| ER-D05 | Member vẫn tạo request riêng khi member khác có active request | Bỏ unique active/company; giữ unique active/requester/company |
| ER-D06 | Chỉ creator sửa/resubmit; requester bất biến | Object permission + immutable ownership |
| ER-D07 | Binary file chỉ uploader, company owner và authorized admin | Tách metadata permission khỏi download permission |
| ER-D08 | Không có persistent business draft | Upload session tạm, cancel/TTL cleanup |
| ER-D09 | Creator withdraw; owner cancel trước review, có reason/audit | Action endpoints và append-only events |
| ER-D10 | `in_review` khóa; `changes_requested` resubmit; `rejected` đóng lần xử lý | State machine V2 và revision |
| ER-D14 | Document decision không tự approve case | Explicit final admin decision |
| ER-D15 | Tax lookup chỉ advisory; override có reason | Audit + admin confirmation |
| ER-D16 | Workspace mở sau basic/phone/company/clean docs/DPA submit | `job_workspace_ready` độc lập approval |
| ER-D17 | Được tạo/gửi job trước admin approval; admin approve bị chặn | Backend authoritative blockers |
| ER-D18 | Candidate data có access gate riêng | Applications/CV/export không dùng workspace guard |
| ER-D19 | Recruiting data tiếp tục recruiter-owned | Company member không thấy jobs/campaigns/applications của nhau |
| ER-D20 | Verification/DPA tạo hold theo source; chỉ gỡ đúng hold | Không dùng một boolean hold dùng chung |
| ER-D21 | Approve recruiter đồng thời verify company | Admin UI hiển thị company-level impact |
| ER-D27 | Chọn nhầm company xử lý qua admin unlink nếu account sạch | Impact preview + audited action |

### Quyết định upload, dữ liệu và retention

| ID | Quyết định đã xác nhận | Hệ quả triển khai chính |
| --- | --- | --- |
| ER-D11 | Upload mới quarantine, ClamAV, fail closed, explicit submit | Upload session + scan worker |
| ER-D12 | File hợp lệ giữ 24 tháng; malicious xóa sớm sau evidence; legal hold ngoại lệ | Retention command và legal-hold guard |
| ER-D13 | File hiện có là `legacy_trusted`, không background scan | Không bịa scan evidence |
| ER-D22 | Phone cũ giữ nguyên, không legacy label/deadline/hold | Không phone backfill |
| ER-D23 | Account mới và lần đổi/reverify dùng SMS thật | Provider-neutral adapter |
| ER-D24 | DPA mới lưu version/hash/actor/time/IP/session append-only | Evidence table, không chỉ timestamp |
| ER-D25 | Website bell/history/deep-link/read status; decision email luôn bật | Outbox + notification center |
| ER-D26 | Business/security activity hiển thị 24 tháng | Retention + redaction contract |
| ER-D28 | Existing holds rollout phải dry-run, ops review rồi apply/notify | Batch command + reconciliation evidence |

### Các lựa chọn mở đã được khóa

| ID | Quyết định đã xác nhận | Lý do |
| --- | --- | --- |
| ER-O01 | Tối đa một active request/requester/company; nhiều requester được active song song | Ngăn spam/race của cùng actor nhưng không khóa member khác |
| ER-O02 | Conflict xử lý nguyên tử; không partial apply | Tránh company ở trạng thái nửa snapshot và review khó audit |
| ER-O03 | DPA cũ là `legacy_unversioned`; block candidate data/admin approval khi rollout, grace 30 ngày trước hold | Không bịa evidence và vẫn có thời gian remediation vận hành |
| ER-O04 | `dev` là integration branch; release bằng `dev → main` | Khớp flow repository hiện hành |
| ER-O05 | CI chạy cho Pull Request vào `dev`; vẫn chạy gate theo phạm vi trước bàn giao | Không để nhánh tích hợp thiếu quality gate |
| ER-O06 | Audit/sửa quyền xem, tải và export CV; chỉ mở rộng candidate upload khi dùng chung hạ tầng không an toàn | Giữ phạm vi nhưng không bỏ sót shared upload risk |

### Accepted risks đã được ghi nhận

| ID | Rủi ro được chấp nhận trong epic | Chốt chặn còn giữ |
| --- | --- | --- |
| ER-AR01 | Company search tiếp tục hỗ trợ kết quả đầy đủ, kể cả MST/địa chỉ theo contract hiện tại | Authentication, audit và rate limit hiện hữu |
| ER-AR02 | Company payload cho member không bị thu hẹp ngoài file/storage secret | Serializer redaction và object permission |
| ER-AR03 | MFA không bắt buộc toàn bộ recruiter | Step-up cho thao tác bảo mật nhạy cảm |

## Session 2026-08-10 — Gate ER-2/ER-3/ER-6

### Bối cảnh

- Readiness contract cần quyết định liệu aggregate không định danh có thuộc
  candidate-data gate hay không.
- Audit storage phát hiện public và private cùng nằm trong root được Django,
  Vite và nginx phục vụ; cutover có thể làm hỏng consumer cũ gọi direct URL.
- Audit phone OTP phát hiện resend/replay race, phone-enumeration oracle, đổi
  phone không qua SMS và chưa có retention/recovery contract.

### Quyết định đã xác nhận

| ID | Quyết định | Hệ quả triển khai |
| --- | --- | --- |
| ER-D29 | Khi candidate-data bị khóa vẫn cho xem aggregate không định danh; ẩn tên, email, avatar, CV, deep-link và activity có PII | Backend redact trước response; frontend không mount/query surface nhạy cảm nhưng vẫn render count |
| ER-D30 | Copy + SHA-256 verify dữ liệu sang public/private/quarantine trước traffic; giữ legacy ngoài serving path để rollback; private/default R2 `.url()` cố ý fail closed | Consumer direct URL chưa được phát hiện có thể ngừng hoạt động an toàn thay vì làm lộ file |
| ER-D31 | Đổi số giữ phone/proof/readiness cũ tới khi challenge số mới thành công; reverify trước mắt là self-triggered và giữ proof khi pending/thất bại | Atomic claim sau OTP; admin-forced revoke là policy riêng, không được suy diễn |
| ER-D32 | Phone employer mới chuẩn hóa số di động Việt Nam `+84[35789]xxxxxxxx`; bỏ availability precheck | Compatibility route chỉ validate format và trả generic trong cửa sổ chuyển đổi |
| ER-D33 | Challenge có phone/ciphertext purge sau 30 ngày; event redacted giữ 24 tháng; admin không sửa trực tiếp verified phone | Recovery riêng cần reason, step-up và append-only audit |
| ER-D34 | Production SMS flag tắt cho tới khi Ops/Product chọn gateway, sender và template | Outage/misconfiguration fail closed, không fallback email hoặc giả delivery |

Người phụ trách sản phẩm xác nhận toàn bộ các quyết định trên ngày 2026-08-10.

## Session 2026-08-10 — Gate ER-5

### Bối cảnh

- Document/prerequisite cuối hiện có thể tự approve case/company, trái ER-D14.
- Final-decision UI chưa consume impact/decision API; revoke/expire chưa có
  compliance hold đa nguồn và có race với job approval.
- Tax advisory, legacy auto-approved và company effect sau recruiter revoke cần
  contract sản phẩm rõ trước migration/backfill.

### Quyết định đã xác nhận

| ID | Quyết định | Hệ quả triển khai |
| --- | --- | --- |
| ER-D35 | Recruiter revoked/expired không tự downgrade company verified | Company legal status chỉ đổi qua workflow company riêng; impact UI vẫn cảnh báo company scope |
| ER-D36 | Grandfather case/company auto-approved lịch sử thành `legacy_auto/legacy_unknown`, report ops | Không bịa admin decision, không reset cohort hoặc apply hold tự động |
| ER-D37 | Revoke/expire khóa candidate-data và job approval, ẩn active public jobs; workspace/create/edit/submit vẫn mở | Hold gắn source/reason riêng, không đổi business status của job/campaign |
| ER-D38 | Tax `pending` bắt buộc chờ; mismatch/not_found/unavailable/invalid/missing cần `tax_override` + reason | Impact/confirm recompute evidence và audit override; không coi lookup là quyết định pháp lý |
| ER-D39 | Tách permission review/revoke/tax_override; revoke/override chỉ Super Admin hoặc Compliance Lead được gán rõ | Không trao high-risk permission mặc định cho reviewer thường |
| ER-D40 | Rejected dùng cùng case với `revision++`; revoked/expired xử lý lại về pending trước resubmit/start-review | Không tạo attempt model mới trong phase; transition guard tường minh |
| ER-D41 | Expired chỉ có manual action trong ER-5, chưa có TTL/scheduler | Chính sách validity duration phải qua gate riêng trước automation |

Người phụ trách sản phẩm xác nhận toàn bộ ER-D35 đến ER-D41 ngày 2026-08-10.

## Session 2026-08-10 — Corrective UX gate

### Bối cảnh

- Route recruiter bị chặn đang thay nội dung trang bằng một alert
  “Workspace tuyển dụng chưa sẵn sàng”, dù đã có trang checklist xác thực.
- Trang checklist lặp thêm readiness banner và case-status banner, làm loãng
  luồng thao tác chính.
- Trang công ty cần thể hiện lịch sử rõ ràng hơn; dữ liệu tên thương mại legacy
  có thể bị kéo vào request dù người dùng chỉ sửa trường khác.

### Quyết định đã xác nhận

| ID | Quyết định | Hệ quả triển khai |
| --- | --- | --- |
| ER-D42 | Known-denied job/campaign/application route điều hướng tới `employer-verify`; readiness fetch error vẫn retry fail-closed | Không render blocker page tùy tiện ở URL nghiệp vụ; backend permission vẫn authoritative |
| ER-D43 | `employer-verify` chỉ hiển thị checklist/progress, không lặp readiness và case-status banner | Trạng thái chi tiết tiếp tục nằm tại bước/workflow sở hữu, không chèn badge tổng hợp |
| ER-D44 | Company settings luôn có history section `scope=company`, count và requester an toàn | Personal card vẫn dùng `scope=mine`; raw value/file/PII không xuất hiện trong history |
| ER-D45 | Untouched legacy trade name không được validate/submit như thay đổi mới | Diff giữ minimal; chỉ đồng bộ tên thương mại khi người dùng đổi tên/cờ liên quan |

Người phụ trách sản phẩm xác nhận trực tiếp ER-D42 đến ER-D45 ngày 2026-08-10.

## Tài liệu/mô tả bị thay thế

| Tài liệu/mô tả cũ | Phần bị thay thế |
| --- | --- |
| `ke-hoach-thiet-ke-lai-cong-ty-nha-tuyen-dung.md` | `updated_at` làm ngày gửi; một pending/company; POST upsert cùng record; phone OTP qua email cho account mới |
| `ke-hoach-trang-cong-ty.md` | Owner-only create request; member không được tạo request riêng |
| `TIEN-DO-DU-AN.md` các ghi chú publish tức thì | Tin được tạo/gửi trước approval nhưng chỉ admin approval/publish khi blockers sạch |
| Guard `verification_completed` tổng | Tách workspace readiness, verification approval, candidate-data access và DPA status; known denial điều hướng về checklist theo ER-D42 |

Các phần lịch sử khác của tài liệu cũ vẫn được giữ cho tới khi phase tương ứng
cập nhật chúng; không xóa dấu vết quyết định cũ.

## Quy trình thay đổi quyết định

1. Ghi vấn đề và lựa chọn trong Pull Request hoặc cuộc trao đổi phê duyệt.
2. Hỏi chủ dự án “Luồng này hợp lý chưa?”.
3. Sau khi xác nhận, thêm một session mới vào file này.
4. Cập nhật đặc tả canonical và tài liệu bị ảnh hưởng trong cùng commit.
5. Chỉ sau đó mới thay đổi code/schema/feature flag.
