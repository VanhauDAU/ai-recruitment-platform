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

### Chương trình hoàn thiện CV Builder 2026-07-15

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| 0 | Canonical composition + khóa regression contract | ✅ Hoàn tất |
| 1 | Sample/blank live preview chuẩn hóa | ✅ Hoàn tất |
| 2 | Previous + latest recoverable draft | ✅ Hoàn tất |
| 3 | Locale cấu hình được + canonical blueprint | ✅ Hoàn tất |
| 4 | Admin catalogue + snapshot theo màu | ✅ Hoàn tất |
| 5 | AI import PDF/DOCX | ✅ Hoàn tất |
| 6 | Cleanup, rollout, observability | ✅ Hoàn tất |

Phase 0 đã chuyển create và template switch sang
`apps.cvs.composition.compose_cv_document`; CAS, immutable version và dual-write
giữ nguyên. Quyết định kiến trúc: [ADR 0007](../adr/0007-canonical-cv-composition.md).

Phase 1 đã mở rộng position options theo locale/content availability, thêm thứ
tự vị trí, trả canonical document từ preview API và xóa sample/layout hardcode
ở frontend. Modal/detail mặc định source sample, tự chọn vị trí đầu tiên, chống
request race, hiển thị skeleton và đổi màu client-side không fetch lại content.

Phase 2 đã thêm draft hash/backfill, endpoint latest recoverable chỉ trả một CV,
read-only template projection, source copy tạo CV mới và switch template/màu có
CAS. Autosave flush khi điều hướng nội bộ/tab hidden; Restore không có CV picker.

Phase 3 đã thêm registry `Locale` quản trị được và public/admin API; bốn locale
hiện tại được seed. Localization/sample/blueprint có FK song song tới
`Locale.code`, backfill bằng migration và vẫn giữ cột code để dual-read/write
trong ít nhất một release. Blueprint có `content_json_template` canonical, hỗ
trợ token `{position}` đệ quy và fallback sang các field cũ. Frontend dùng entity
`locale`, giữ bốn SEO route hiện tại và hỗ trợ route mở rộng
`/mau-cv/ngon-ngu/:localeCode` mà không làm router phụ thuộc API bất đồng bộ.

### Phase 3 — Kết quả nghiệm thu

- `Locale.code` bất biến; chỉ có một default active; admin đổi default theo
  transaction và không có public delete contract.
- Locale inactive không còn xuất hiện ở public API, không được dùng cho preview,
  catalogue hoặc CV mới; document cũ vẫn render theo code đã lưu.
- Migration chạy theo Expand → Backfill → Switch. Chưa contract/drop cột
  `locale` cũ; việc đó chỉ được làm sau một release quan sát ổn định.
- Canonical blueprint được validate bằng document schema và materialize token
  trước composition; curated content vẫn có độ ưu tiên cao hơn.
- Regression Phase 3: 12 backend test locale/catalogue xanh; frontend lint,
  architecture check và production build xanh.

### Phase 4 — Kết quả nghiệm thu

- Admin REST phủ template, localization, category, color, sample và blueprint;
  mọi endpoint dùng `IsAdmin`. Template version có action tạo draft từ version
  hiện hành, publish, retire và regenerate snapshot.
- Publish chạy qua transaction/row lock, gọi `full_clean()` trước khi đổi
  pointer published. Published/retired version vẫn tuân thủ bất biến của model.
- Admin portal `/admin-app/cv-catalogue` nằm sau `AuthGuard → RoleGuard`, có
  bảng publishing và sample editor theo section/item, không yêu cầu sửa raw JSON.
- Snapshot dùng canonical composer → HTML/WeasyPrint → pypdfium2 raster trang
  đầu. Fingerprint gồm template/renderer/màu/source revision; worker idempotent,
  ghi asset mới trước rồi swap DB pointer trong transaction, chỉ xóa asset cũ
  sau commit.
- Dependency `WeasyPrint==64.1` và `pypdfium2==4.30.0` được pin. Container/worker
  production phải cung cấp thư mục Fontconfig cache có quyền ghi.
- Regression Phase 4: 12 backend catalogue/admin/snapshot test xanh; raster
  integration PDF→PNG chạy thật; frontend lint, architecture và build xanh.

### Phase 5 — Kết quả nghiệm thu

- `POST /api/v2/cvs/imports/` được mở rộng additive với template/language/màu;
  contract upload-file cũ vẫn hoạt động khi không truyền template. Import builder
  trả `202`, tạo `CvImportJob` durable và dùng `Idempotency-Key` theo candidate.
- Chỉ nhận PDF/DOCX có signature thật, tối đa 5 MB; PDF tối đa 20 trang và PDF
  scan chưa có OCR trả failure code riêng. Text tối đa 100.000 ký tự.
- Worker trích xuất bằng `pypdf`/`python-docx`, gọi adapter Gemini/OpenAI/Anthropic
  theo cấu hình admin, retry schema tối đa một lần, map/validate canonical rồi
  compose bằng đúng template version. Khi chưa cấu hình provider key, heuristic
  an toàn vẫn tạo draft tối thiểu để local/dev không bị khóa.
- Adapter đọc provider key qua `python-decouple`; giá trị trong `backend/.env`
  được web/worker dùng trực tiếp và process environment vẫn có độ ưu tiên cao hơn.
- Identity parse được được giữ; account chỉ fill field còn trống. Raw text và
  provider response không persist/log; UI chỉ nhận failure code đã allowlist.
- Retry owner-only tối đa ba attempt; throttle 10 import/giờ/user. Celery beat
  redispatch queued job và xóa source file sau retention mặc định 30 ngày, không
  xóa canonical document.
- Modal upload chỉ nhận `.pdf/.docx`, poll có timeout, hiển thị lỗi scan cụ thể,
  có retry và lối thoát sang blank; khi analyzed mở editor đúng canonical draft.
- Regression Phase 5: 38 AI/CV V2 test xanh, gồm DOCX thực → editable draft,
  idempotency, spoofed MIME, safe failure/retry và AI schema retry; frontend
  lint, architecture và production build xanh.

### Phase 6 — Kết quả nghiệm thu

- Preview source được gom về `resolvePreviewSelection`; sample/blank/previous/
  restore dùng một selection pipeline, upload là trạng thái async riêng.
- Color swatches và A4 fit-zoom chuyển về entity `cv-template`, dùng chung ở
  card, modal và detail; không còn sample persona/layout frontend hardcode hay
  LinkedIn/.doc placeholder.
- Cache preview dùng namespace versioned `cv-position-preview-v2`, deploy không
  cần flush cache cũ.
- Thêm telemetry boundary PII-free cho preview latency/cache hit, autosave
  conflict, import duration/failure và snapshot duration/failure.
- Có rollout/rollback runbook tại
  [CV Builder rollout runbook](../06-deployment/cv-builder-rollout-runbook.md),
  gồm migration order, worker/dependency, Fontconfig, threshold và contract
  cleanup release sau.
- Final gates: backend 81/81; frontend 38 files/132 tests, coverage 84.65%
  statements, lint/architecture/build xanh; Playwright smoke 22/22 desktop +
  mobile xanh. `makemigrations --check`, Django system check và diff check xanh.

| Mã | Hạng mục | Trạng thái | Kết quả/điểm còn thiếu |
| --- | --- | --- | --- |
| CVB-0 | Runtime, migration, create lifecycle | ✅ Hoàn tất | V2 create/draft/version, application snapshot, migration/preflight |
| CVB-0.2 | CV API V1→V2 cutover | 🟡 Đang đo | V2 có archive/import/metadata; V1 có deprecation headers + telemetry, chưa đủ điều kiện 410/xóa |
| CVB-1 | Template catalog đa ngôn ngữ | ✅ Hoàn tất | Filter DB, infinite scroll, detail, related, responsive |
| CVB-1.1 | Position-driven content đa ngôn ngữ | ✅ Hoàn tất | 61 vị trí taxonomy × 4 locale; picker `name_vi`; resolver blueprint/curated override |
| CVB-1.2 | Category và color từ database | ✅ Hoàn tất | M2M taxonomy/color, asset theo màu, màu được lưu vào draft/version |
| CVB-2 | Builder MVP | ✅ Hoàn tất | Canonical editor, autosave lock, history, template switch, layout resize |
| CVB-3 | Candidate “My CV” | ✅ Hoàn tất | Archive/default/rename/import/duplicate/restore thật; smoke desktop/mobile phủ workflow chính; CTA mở owner view với export PDF immutable |
| CVB-4 | Apply flow | ✅ Hoàn tất | Candidate V2 chọn CV/version, snapshot đúng version và smoke desktop/mobile xác nhận payload |
| CVB-5 | Admin template publishing | ✅ Hoàn tất phạm vi CV Builder | CRUD API, draft→preview→publish→retire, sample/blueprint và snapshot đã có; audit trail chi tiết thuộc backlog hardening |
| CVB-6 | Production hardening | 🟡 Một phần | Telemetry CV Builder, worker idempotency và retention đã có; còn benchmark tải, object storage/signed URL và V1 cutover |
| CVB-7 | Import và AI | 🟡 Phần import hoàn tất | PDF/DOCX → canonical draft, retry/throttle/retention đã có; LinkedIn, AI writer, ATS/matching/quota sản phẩm còn backlog |

## CVB-1.1 — Position-driven content đa ngôn ngữ

- [x] Dropdown đọc toàn bộ `JobCategory` active loại `specialization`, value là
  opaque `public_id`, label duy nhất là `name_vi`; Select có input tìm kiếm.
- [x] `JobCategoryLocalization` quản lý bốn locale và alias trong admin. Seed
  chỉ bootstrap 61 vị trí hiện tại × 4 locale, không ghi đè nội dung admin đã duyệt.
- [x] `CvContentBlueprint` quản lý nội dung generic theo locale/experience;
  resolver ưu tiên curated `CvSampleContent`, nếu thiếu thì materialize từ
  blueprint. Không nhân dữ liệu theo số template.
- [x] Position preview và create CV dùng cùng resolver; create clone canonical
  document vào immutable initial version/draft và lưu FK position trên CV.
- [x] Vị trí mới: admin tạo dưới đúng taxonomy, điền bốn localization; preview
  hoạt động ngay từ blueprint, curated sample chỉ là optional override.

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
./venv/bin/python manage.py seed_job_categories
./venv/bin/python manage.py seed_cv_catalog
```

`seed_job_categories` chỉ bootstrap taxonomy và baseline localization; dùng
`get_or_create` nên không ghi đè wording đã được quản trị duyệt. Sau cài đặt,
admin quản lý tên bốn locale tại inline Job Category, nội dung generic tại CV
Content Blueprint và optional override tại CV Sample Content.

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

- [x] REST + portal cho template/version, locale, localization, category, color,
  sample và blueprint; nội dung mẫu dùng structured editor.
- [x] Preview nội bộ dùng canonical composer; publish bằng service atomically
  retire/repoint version và trigger snapshot đúng policy.
- [x] Snapshot ghi storage key, fingerprint và write-then-swap; public serializer
  resolve URL qua storage layer.
- [ ] Bổ sung audit trail chi tiết người publish/retire và policy chặn xóa
  taxonomy đang được dùng trong một đợt hardening riêng.

### CVB-6 — Production hardening

- [x] Snapshot/import worker idempotent, import có retry/retention và metric
  latency/error allowlist không chứa PII.
- [ ] Object storage/signed download và retention/revoke tổng thể cho share/export.
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

- [x] Pipeline PDF/DOCX: MIME sniff → extract → structured AI/heuristic fallback
  → normalize/validate → canonical editable draft; PDF scan có error code riêng.
- [x] Provider response/raw text không log hoặc persist; identity parse được giữ,
  account chỉ fill field trống; retry/throttle/retention có contract.
- [ ] LinkedIn import, AI writer, ATS/matching và quota/audit/consent cấp sản phẩm.

## Definition of Done cho mỗi lát cắt

- Migration/check/preflight phù hợp rủi ro; không phá dữ liệu hiện hữu.
- Backend unit/API/permission test và frontend unit/regression test.
- `npm run lint`, `npm run check:architecture`, `npm run test:coverage`,
  `npm run build`, smoke E2E theo route/workflow bị ảnh hưởng.
- Tài liệu API/database/architecture, tiến độ và changelog được cập nhật cùng PR.
- Không để CTA giả báo thành công cho workflow backend chưa tồn tại.
