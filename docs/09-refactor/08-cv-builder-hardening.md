# Giai đoạn 6 — CV Builder hardening

> Thực hiện ngày 2026-07-24. Phạm vi là các lát cắt có regression độc lập,
> không viết lại editor, không đổi schema/migration/API và không triển khai các
> debt cần proposal.

## 1. Guardrail và phạm vi

Đã thực hiện:

1. Cô lập state autosave khi route chuyển sang một CV khác.
2. Khôi phục đúng trạng thái draft sau retry không cần PUT.
3. Đồng bộ rich-text Summary giữa browser preview và PDF.
4. Đồng bộ lề trang nhỏ nhất giữa editor, preview và PDF.
5. Bổ sung regression cho ownership và `PROTECT` của application snapshot.

Không thực hiện:

- Operation barrier, mutex hoặc idempotency cho Save/Publish/Switch/Sample.
- Thay schema canonical hoặc template schema.
- Sửa/squash/xóa migration CV.
- Đổi version numbering, pointer hoặc hard-delete/restore contract.
- Thêm provenance column/constraint/trigger.
- Refactor renderer và persistence trong cùng lát cắt.

## 2. Data model và snapshot audit

Contract hiện tại:

```text
UserCv
├── một CvDraft mutable + lock_version CAS
├── latest_version / published_version
└── nhiều CvVersion immutable ở application path

Application
└── submitted_cv_version --PROTECT--> application_snapshot
```

Luồng API chuẩn đang bảo đảm:

- Candidate chỉ chọn CV của mình và version thuộc chính CV đó.
- Tạo snapshot chạy trong transaction, khóa aggregate và không dịch chuyển
  `latest_version`.
- Recruiter đọc `submitted_cv_version`, không đọc mutable draft/CV hiện tại.
- Hard-delete CV thư viện detach và giữ application snapshot.

Hai regression mới khóa:

- Không thể xóa snapshot khi Application còn tham chiếu (`PROTECT`).
- Không thể gửi `cv_public_id=A` với `version_public_id` thuộc CV B, kể cả A và
  B cùng owner.

Không nâng các bảo đảm này thành invariant mới ở admin/model/DB vì cần proposal:

- Django Admin còn có thể sửa pointer provenance.
- `QuerySet.update`/raw SQL bypass `CvVersion.save()`.
- `parent_version=SET_NULL` làm mất source version sau hard-delete.
- Archive/restore chưa có policy product/legal thống nhất.

## 3. Autosave

### Contract đã kiểm chứng

- Debounce 700 ms.
- Một PUT in-flight trong một editor instance.
- `If-Match: lock-version-N` và 409 conflict.
- Edit mới trong lúc PUT chạy được queue và lưu sau response trước.
- Failed/conflict/retry/reload và browser navigation guard có regression.

### Lát hardening đã triển khai

Route `/cvs/:publicId/edit` có thể tái sử dụng cùng page component khi param đổi.
Trước đây promise PUT của CV A có thể resolve/reject sau khi GET CV B hoàn tất,
rồi ghi lock/signature/assets/phase của A vào hook đang hiển thị B. Page hiện
key `CvDraftEditor` theo `publicId`, buộc mỗi aggregate có một hook instance và
cleanup riêng.

Nếu tạo version thất bại khi draft vốn đã current, “Thử lưu lại” không cần gửi
PUT. Retry hiện xác nhận signature rồi trả UI về `saved` thay vì mắc ở
`unsaved`.

### Deferred: `CV-001`

`commitVersion`, `switchTemplate` và `applySample` vẫn chỉ chờ promise PUT hiện
tại; edit mới queue trong lúc đó chưa được drain như `saveDraft()`. Save-version
cũng chưa idempotent. Proposal phải mô tả cùng lúc:

- Operation barrier/mutex phía editor.
- Request state/copy riêng cho autosave và explicit operation.
- Idempotency key hoặc CAS commit token phía backend.
- Double-click, retry, tab conflict và rollback semantics.
- Rollout/telemetry/rollback không làm mất draft hay tạo version trùng.

## 4. Renderer và compatibility

### Đã sửa

Browser áp rich-text marks cho Summary nhưng PDF trước đây chỉ in `run.text`,
trong khi section khác giữ marks. PDF hiện dùng một partial chung cho mọi block:

- Bold, italic, underline.
- Font family, font size và color.
- Paragraph/bullet.
- Django autoescape ở renderer boundary.

Editor cho lề trang 5–16 mm, PDF dùng giá trị persisted, nhưng browser preview
trước đây clamp 6–18 mm. Preview hiện dùng cùng range 5–16 mm.

### Deferred: `CV-005`

Cần inventory template/version trước khi đổi:

- `inline_text_styles` của section title/item fields chưa hiện đầy đủ ở
  read-only preview và PDF.
- Browser lấy row topology từ renderer contract; PDF lấy `region.row` persisted.
- Frontend fallback renderer và backend fail-closed chưa có compatibility plan
  khi thêm renderer/version mới.
- Font fallback stack và background/avatar parity còn thiếu matrix đầy đủ.

Không sửa các mục này bằng fallback im lặng vì có thể thay output của version
đã lưu.

## 5. Kiểm chứng

| Gate | Kết quả |
| --- | --- |
| Backend Ruff | Pass; 424 file formatted |
| Backend architecture | 555 file, 831 dependency; 2/2 contract kept; DRF layering pass |
| Django system/migration | System check pass; không có migration mới |
| Backend tests | 376/376 pass; coverage 85,77% |
| Backend warnings | 2 warning chỉ từ migration lịch sử `cvs/0004_cv_exports.py` |
| Frontend boundary/lint | API/feature boundary pass; lint pass với 12 `max-lines` warning đã biết |
| Frontend architecture | 628 module, 1.278 dependency, 0 violation; negative fixtures bắt đúng 3 rule |
| Frontend unit/coverage | 112 file, 391/391 pass; statements 39,49%, branches 35,51%, functions 35,14%, lines 41,92% |
| Build/bundle | Build pass; initial JS 284,9/320 KiB, CSS 33,4/35 KiB; 263 chunk, 67 dynamic route |
| Smoke E2E | 81/81 pass; CV editor/view/delete/apply pass ở desktop, tablet và mobile |

Toàn bộ gate chạy bằng `./scripts/check_all.sh`.

## 6. Rollback

- Revert commit resource identity chỉ khôi phục lifecycle cũ; không cần data
  repair.
- Revert renderer chỉ đổi presentation; immutable version và stored document
  không bị viết lại.
- Regression snapshot không đổi production behavior.
- Không có migration hoặc backfill trong Giai đoạn 6.
