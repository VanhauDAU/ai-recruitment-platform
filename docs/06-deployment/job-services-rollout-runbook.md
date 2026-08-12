# Runbook rollout — Job lifecycle và Employer Services

**Trạng thái:** Giai đoạn 0; dùng cho các release Giai đoạn 1–8  
**ADR:** [ADR-0012](../02-tong-quan/adr-0012-job-services-architecture.md)

## 1. Baseline legacy

### 1.1. Phát hiện tĩnh ngày 12/08/2026

| Hạng mục | Hiện trạng |
| --- | --- |
| Hạn tin | Default 30, cho chọn đến 90; `deadline` đồng thời chặn public |
| Public lifetime | Chỉ chặn ở endpoint extend dựa trên `published_at` hiện tại |
| Reset anchor | Duyệt lại set lại `published_at`; close/reopen có thể bypass cap |
| Tin hết hạn | Vẫn status ACTIVE nhưng candidate selector loại theo deadline |
| Legacy promotion | `tier`, HOT, GẤP, flash là cờ không expiry/source |
| Urgent ordering | `ordering=urgent` đang sort `has_flash_badge` |
| Catalogue | Marketing JSON/text, mutable, chưa có version/entitlement |
| View history | Chỉ aggregate/dedupe, không có candidate-job history |
| Banner | Editorial placement, chưa có booking/inventory/company owner |

Runtime count chưa được ghi vào tài liệu vì PostgreSQL local `127.0.0.1:5433`
không chạy tại thời điểm audit. Không được điền số giả. Trước migration trên mỗi
môi trường phải xuất report read-only có timestamp và lưu làm deployment artifact.

### 1.2. Truy vấn baseline bắt buộc

Chạy bằng Django management command chuyên dụng ở Giai đoạn 1. Trước khi command
tồn tại, có thể đối chiếu read-only các nhóm sau:

- tổng job theo status và số ACTIVE đã quá deadline;
- tier standard/featured/top, HOT, GẤP, flash và các tổ hợp overlap;
- ACTIVE có `published_at` null;
- ACTIVE có `published_at` quá 90 ngày;
- deadline trước published date;
- job đóng/mở hoặc duyệt nhiều lần qua status/moderation history;
- package active/inactive, slug trùng nghĩa và benefit JSON không hợp lệ;
- company có brand-page legacy và banner active theo placement.

Report phải có `generated_at`, environment, app revision, row counts, anomaly
IDs dưới dạng public ID, checksum và tuyệt đối không chứa PII.

## 2. Migration strategy

### Expand

- Thêm cột/bảng nullable hoặc có default an toàn.
- Index lớn dùng chiến lược không khóa phù hợp PostgreSQL; migration state phải
  khớp database state.
- Không đổi tên/xóa `deadline`, cờ tier hoặc catalogue legacy.
- Deploy code đọc legacy, ghi dữ liệu mới khi flag cho phép.

### Backfill

- Command idempotent, chunked, có `--dry-run`, resume cursor và summary checksum.
- Không reset `published_at` hoặc tạo audit giả.
- Dữ liệu không đủ bằng chứng được đánh dấu anomaly, không tự suy diễn quyền trả phí.
- Rerun không tạo public cycle, version hoặc unit trùng.

### Shadow

- `JOB_LIFECYCLE_V2_MODE=shadow`: response vẫn theo legacy, đồng thời tính V2 và
  ghi aggregate mismatch metric không PII.
- Phân loại mismatch theo availability, visibility end và max extension.
- Không sang enforce khi còn mismatch chưa giải thích.

### Enforce

- Bật nội bộ, pilot, 10%, 50%, 100%.
- Mỗi nấc có soak window và dashboard riêng.
- Contract cleanup chỉ ở release sau khi consumer telemetry bằng 0.

## 3. Thứ tự deploy

1. Migration expand và read-compatible backend.
2. Backfill dry-run, review artifact, rồi backfill thật.
3. Shadow compare lifecycle.
4. Employer UI đọc contract mới nhưng flag tắt mutation mới.
5. Enforce lifecycle.
6. Deploy catalogue/ledger với activation tắt.
7. Admin grant UAT.
8. Employer activation pilot.
9. Candidate presentation projection.
10. Sponsored distribution canary.
11. Remarketing saved sau consent/frequency-cap verification.

Không bật hai bước có thay đổi hành vi lớn trong cùng cửa sổ deploy.

## 4. Readiness gate mỗi release

- `./scripts/check_all.sh` xanh.
- Migration clean DB, upgrade DB và rerun idempotency pass.
- Query budget list/detail/inventory không phụ thuộc row count.
- OpenAPI validation và exact contract tests pass.
- Feature flag tồn tại trong `.env.example`, production validation và runbook.
- Dashboard/alert đã deploy trước khi bật flag.
- Reconciliation count unit/activation/audit khớp.
- Rollback rehearsal trên staging đạt.
- PR dưới 30 file khi có thể; trên 60 file phải chia.

## 5. Observability

### Lifecycle

- shadow mismatch theo reason;
- public item quá hạn;
- reopen/approval attempted reset;
- extension rejected theo blocker;
- candidate 404 cho job vừa hết hạn.

### Commercial ledger

- grant, available, consumed, expired, revoked;
- duplicate idempotency request và payload conflict;
- unit consumed nhưng thiếu activation hoặc ngược lại;
- activation effect mismatch với presentation;
- compensation theo reason.

### Distribution

- sponsored share, empty slot, company concentration;
- impression/view/save/apply theo activation/surface;
- P50/P95 latency, query count và pagination anomaly.

Metric labels không chứa email, phone, CV text, raw search query hoặc job title.

## 6. Kill switch và rollback

Thứ tự tắt khi có sự cố:

1. `SAVED_JOB_REMARKETING_ENABLED=false`;
2. alert/refresh kill switch;
3. `SPONSORED_JOB_DISTRIBUTION_ENABLED=false`;
4. `SERVICE_ACTIVATION_ENABLED=false`;
5. `JOB_PRESENTATION_V2_ENABLED=false` nếu projection lỗi;
6. lifecycle từ `enforce` về `shadow`, rồi `legacy` nếu cần.

Không reverse-delete ledger/schema. Sau rollback:

- chụp reconciliation artifact;
- xác định activation bị ảnh hưởng;
- cấp compensating unit qua workflow có audit;
- chỉ bật lại sau regression test và staging rehearsal.

## 7. Incident thresholds

Dừng rollout ngay khi:

- có double consumption;
- tin hết hạn/held vẫn có sponsored impression;
- activation thành công nhưng extension thất bại hoặc ngược lại;
- reconciliation không bằng 0;
- error rate vượt baseline đã duyệt;
- P95 endpoint chính tăng trên 20%;
- sponsored share vượt 20%;
- cùng một effective state có presentation khác nhau giữa surface.

## 8. Legacy retirement

- Admin review từng tier/GẤP legacy; không tự coi cờ là purchase.
- Mapping hợp lệ tạo manual activation có source và expiry rõ ràng.
- HOT/flash không chuyển thành quyền bán.
- Giữ dual-read cho tới khi telemetry consumer cũ bằng 0.
- Xóa field/API cũ trong contract release riêng, có migration và rollback riêng.
- Seed marketing không phải source of truth và không được overwrite version đã
  publish hoặc purchase snapshot.
