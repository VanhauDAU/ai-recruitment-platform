# Kế hoạch hoàn thiện CV Builder theo giai đoạn

**Cập nhật:** 2026-07-15  
**Nguồn kiến trúc:** [CV Builder — Architecture Foundation](cv-builder-architecture-foundation.md)

## Mục tiêu và nguyên tắc

Hoàn thiện CV Builder trên nền canonical document và lifecycle V2 hiện có,
không viết lại renderer hoặc tạo schema riêng cho từng template.

```text
Template catalogue → chọn nguồn/màu → initial version + draft
→ autosave → manual/published version → owner/share/export/apply
```

- Backend: view nhận/trả HTTP, serializer validate contract, service giữ use
  case/transaction, selector giữ read query, model giữ persistence/constraint.
- Frontend: `pages` compose, `features` sở hữu workflow, `entities` sở hữu CV và
  template domain, `shared` không biết domain.
- Migration dữ liệu theo Expand → Backfill → Switch → Contract; không reset DB,
  không `--fake`, không sửa published template version tại chỗ.
- URL/API/storage key/role guard chỉ thay đổi khi có contract và regression test.

## Trạng thái tổng thể

| Mã | Hạng mục | Trạng thái | Kết quả/điểm còn thiếu |
| --- | --- | --- | --- |
| CVB-0 | Runtime, migration, create lifecycle | ✅ Hoàn tất | V2 create/draft/version, application snapshot, migration/preflight |
| CVB-0.2 | CV API V1→V2 cutover | 🟡 Đang đo | V2 có archive/import/metadata; V1 có deprecation headers + telemetry, chưa đủ điều kiện 410/xóa |
| CVB-1 | Template catalog đa ngôn ngữ | ✅ Hoàn tất | Filter DB, infinite scroll, detail, related, responsive |
| CVB-1.1 | Sample content đa ngôn ngữ | ✅ Hoàn tất | Dropdown tiếng Việt ổn định; preview headline/section theo locale; sample detail tải lazy |
| CVB-1.2 | Category và color từ database | ✅ Hoàn tất | M2M taxonomy/color, asset theo màu, màu được lưu vào draft/version |
| CVB-2 | Builder MVP | ✅ Hoàn tất | Canonical editor, autosave lock, history, template switch, layout resize |
| CVB-3 | Candidate “My CV” | ✅ Hoàn tất | Archive/default/rename/import/duplicate/restore thật; smoke desktop/mobile phủ workflow chính; CTA mở owner view với export PDF immutable |
| CVB-4 | Apply flow | ✅ Hoàn tất | Candidate V2 chọn CV/version, snapshot đúng version và smoke desktop/mobile xác nhận payload |
| CVB-5 | Admin template publishing | 🟡 Một phần | Admin taxonomy/color có; thiếu workflow draft→preview→publish→retire hoàn chỉnh |
| CVB-6 | Production hardening | 🟡 Một phần | Share/export có; cần worker/storage/observability/retention benchmark |
| CVB-7 | Import và AI | ⬜ Chưa làm | Parse PDF/DOCX/LinkedIn, AI writer, ATS, matching/quota/audit |

## CVB-1.1 — Sample content đa ngôn ngữ

- [x] Dropdown vị trí dùng `job_category_slug` làm khóa ổn định và
  `position_name_vi` làm nhãn tiếng Việt, không đổi khi chọn English/Japanese/
  Chinese.
- [x] Preview lấy `content_json` của đúng `(job_category, locale)`; headline,
  section title, mô tả và skill được seed theo locale. List API chỉ trả metadata;
  detail mới tải canonical content.
- [x] Migration `cv_templates.0005` bổ sung nhãn picker, seed idempotent cập
  nhật các sample generated cũ nhưng không ghi đè nội dung đã chỉnh tay.
- [x] Mapping `en-US` dịch cả vị trí gốc tiếng Việt (ví dụ `Chăm sóc khách
  hàng` → `Customer Service`), tránh headline/role tiếng Việt trong preview
  tiếng Anh.

## CVB-1.2 — Category và color từ database

### Đã hoàn tất

- `CvTemplate.categories` là many-to-many qua `CvTemplateCategoryLink`; một
  template thuộc nhiều category và một category chứa nhiều template.
- `CvTemplate.colors` là many-to-many qua `CvTemplateColorLink`; asset preview
  nằm trên link vì cùng một màu có thể có ảnh khác nhau theo renderer/template.
- API card/detail trả `colors[]`; `theme_color` và `color_variants` được giữ tạm
  để client cũ không gãy nhưng không còn là nguồn chuẩn của frontend mới.
- Hover/focus swatch đổi URL ảnh preview. Màu được chọn đi qua
  `POST /api/v2/cvs/` và được ghi vào initial version + draft.
- Backend chỉ chấp nhận màu active thuộc template; DB chặn link trùng và nhiều
  màu mặc định.
- Migration `cv_templates.0004` backfill dữ liệu JSON cũ; `seed_cv_catalog`
  idempotent cho palette, category legacy, localization và sample content.
- Admin có category/color registry cùng inline link trên template.

### Việc vận hành bắt buộc

```bash
cd backend
./venv/bin/python manage.py migrate
./venv/bin/python manage.py seed_cv_catalog
```

Sau backfill, admin cần gán `thumbnail_url`/`preview_url` riêng cho từng
template–color nếu muốn ảnh thực sự khác nhau. Migration chỉ có thể dùng asset
legacy làm fallback; nó không tự sinh ảnh renderer.

### Contract cleanup về sau

- Đo usage API V1 và client còn đọc `CvTemplate.category`,
  `default_style_json.color_variants`, `theme_color`/`color_variants` card.
- Khi usage bằng 0: ngừng dual-read, data preflight, migration contract xóa
  field legacy, rồi thu gọn serializer/seed. Không làm trong cùng release với
  migration expand/backfill.

## Các giai đoạn tiếp theo

### CVB-3 — Candidate “My CV”

- [x] Chốt DTO list V2 cho metadata file/default và trạng thái empty/loading cơ bản.
- [x] Duplicate builder CV clone latest immutable content sang CV/draft/version
  mới, không chia sẻ mutable draft, share link hay published lifecycle. Upload
  CV không có duplicate để tránh dùng chung object storage không tường minh.
- [x] Archive/default/rename CV bằng service transaction và permission owner;
  DB chặn nhiều default active trong cùng một candidate.
- [x] Upload PDF/DOCX chỉ báo thành công sau `POST /api/v2/cvs/imports/` thật;
  UI không mô phỏng upload bằng timeout.
- [x] Restore là use case `POST` owner-only, không tự khôi phục soft-delete qua
  PATCH metadata; giới hạn bằng `CV_ARCHIVE_RESTORE_WINDOW_DAYS` (mặc định 30).
- [x] Smoke desktop/mobile cho candidate library: list, view và archive/restore
  qua contract V2; route unauthorized vẫn được phủ bởi smoke router. Các test này
  mock API có chủ đích, còn permission/service được regression test ở backend.
- [x] CTA từ card dẫn đến owner view, nơi feature `export-cv-pdf` chọn immutable
  version, theo dõi job, retry và tải PDF qua endpoint owner-scoped.

### CVB-4 — Apply flow

- [x] Candidate chọn CV và immutable version trước khi confirm apply qua
  `POST /api/v2/applications/`; API không tự chọn latest hoặc dùng draft.
- [x] Application tiếp tục lưu `submitted_cv_version`; snapshot copy từ đúng
  version đã chọn, nên thay đổi draft sau apply không làm đổi hồ sơ recruiter thấy.
- [x] UX ưu tiên published version, cảnh báo CV chưa publish và dẫn tới editor
  để lưu version mới trước khi xác nhận.
- [x] Regression permission cho candidate, CV owner và recruiter/company membership.
- [x] Smoke desktop/mobile cho modal apply: chọn version và xác nhận payload V2.

### CVB-5 — Admin template workflow

- [ ] Form draft template/version, schema/capability validation và preview nội bộ.
- [ ] Publish bằng service atomically retire/repoint version đúng policy.
- [ ] Upload/normalize asset preview theo storage convention, không lưu domain
  tuyệt đối nếu storage layer đã hỗ trợ key.
- [ ] Audit người tạo/publish/retire và ngăn xóa color/category đang được dùng.

### CVB-6 — Production hardening

- [ ] PDF export worker retry/idempotency, object storage và signed download.
- [ ] Retention/revoke policy cho share link/export; metric latency/error/queue.
- [ ] Benchmark catalog query, builder autosave và renderer/PDF với CV lớn.
- [ ] Hoàn tất cutover V1→V2 theo telemetry trước khi xóa compatibility fields.

### CVB-0.2 — CV API V1→V2 cutover

- [x] V2 có đủ thao tác account library đang được frontend dùng: metadata,
  archive và import; frontend mới không gọi V1 cho các luồng này.
- [x] V1 phát `Deprecation`, `Sunset`, successor `Link` và telemetry tối thiểu,
  không redirect request ghi và không tạo alias `/api/v1/`.
- [ ] Dashboard/alert đọc event `deprecated_api_request`, chốt SLO usage V1 = 0
  theo từng endpoint/client release.
- [ ] Sau thời hạn sunset và SLO đạt: release riêng trả `410 Gone`, theo dõi
  rollback window, rồi mới xóa V1 và compatibility fields.

### CVB-7 — Import và AI

- [ ] Pipeline upload PDF/DOCX/LinkedIn: scan → extract → normalize → user review.
- [ ] Không tự ghi nội dung AI/import vào immutable version trước khi user duyệt.
- [ ] AI writer/ATS/matching có quota, audit, consent và bảo vệ PII.

## Definition of Done cho mỗi lát cắt

- Migration/check/preflight phù hợp rủi ro; không phá dữ liệu hiện hữu.
- Backend unit/API/permission test và frontend unit/regression test.
- `npm run lint`, `npm run check:architecture`, `npm run test:coverage`,
  `npm run build`, smoke E2E theo route/workflow bị ảnh hưởng.
- Tài liệu API/database/architecture, tiến độ và changelog được cập nhật cùng PR.
- Không để CTA giả báo thành công cho workflow backend chưa tồn tại.
