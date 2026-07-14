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
| CVB-1.2 | Category và color từ database | ✅ Hoàn tất | M2M taxonomy/color, asset theo màu, màu được lưu vào draft/version |
| CVB-2 | Builder MVP | ✅ Hoàn tất | Canonical editor, autosave lock, history, template switch, layout resize |
| CVB-3 | Candidate “My CV” | 🟡 Đang làm | Archive/default/rename/import thật đã có; còn duplicate/restore và E2E đầy đủ |
| CVB-4 | Apply flow | 🟡 Một phần | Snapshot có; UX chọn/confirm version khi apply cần hoàn thiện |
| CVB-5 | Admin template publishing | 🟡 Một phần | Admin taxonomy/color có; thiếu workflow draft→preview→publish→retire hoàn chỉnh |
| CVB-6 | Production hardening | 🟡 Một phần | Share/export có; cần worker/storage/observability/retention benchmark |
| CVB-7 | Import và AI | ⬜ Chưa làm | Parse PDF/DOCX/LinkedIn, AI writer, ATS, matching/quota/audit |

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
- [ ] Duplicate CV phải clone canonical content sang draft mới, không chia sẻ
  mutable draft hoặc thay đổi version cũ.
- [x] Archive/default/rename CV bằng service transaction và permission owner;
  DB chặn nhiều default active trong cùng một candidate.
- [x] Upload PDF/DOCX chỉ báo thành công sau `POST /api/v2/cvs/imports/` thật;
  UI không mô phỏng upload bằng timeout.
- [ ] Restore phải là use case tường minh với retention policy, không tự khôi
  phục soft-delete qua PATCH metadata.
- [ ] E2E desktop/mobile: list, edit, view, archive/restore và unauthorized.

### CVB-4 — Apply flow

- [ ] Candidate chọn CV và immutable version trước khi confirm apply.
- [ ] Application tiếp tục lưu `submitted_cv_version`; thay đổi draft sau apply
  không làm đổi hồ sơ recruiter thấy.
- [ ] UX cảnh báo CV chưa publish và hỗ trợ tạo version ngay trong flow.
- [ ] Regression permission cho candidate/recruiter/company membership.

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
