# Kế hoạch hoàn thiện chức năng CV Builder theo từng giai đoạn

**Dự án:** `VanhauDAU/ai-recruitment-platform`  
**Mốc rà soát:** `main` tại commit merge `3122d89`  
**Mục tiêu:** Hoàn thiện CV Builder theo hướng production-ready, giữ nguyên nền tảng kiến trúc tốt đã có, sửa các điểm đang chặn vận hành và nâng cấp UI/UX theo đúng luồng đã mô tả.

---

## 1. Kết luận hiện trạng

CV Builder hiện đã có nền tảng kỹ thuật tương đối tốt:

- Canonical CV Schema: `content_json`, `layout_json`, `style_json`.
- `CvDraft` có optimistic locking.
- `CvVersion` bất biến.
- `CvTemplateVersion` bất biến sau khi publish.
- Application snapshot.
- Recruiter read-only snapshot.
- Template Catalog và Create CV Flow.
- Builder form, section management, drag/drop, resize cột, Undo/Redo.
- Owner view.
- Shared link bảo mật.
- PDF export từ immutable version.

Tuy nhiên chức năng chưa thể coi là hoàn thiện vì còn các vấn đề:

1. Migration `applications.0004_application_cv_snapshot` lỗi trên database có dữ liệu cũ.
2. Môi trường Python local chưa được khóa phiên bản.
3. UI `/mau-cv` chưa đúng mô tả nghiệp vụ và giao diện mong muốn.
4. Builder có nhiều chức năng nhưng UI đang rối.
5. Chưa có Candidate “My CV” hoàn chỉnh.
6. Chưa hoàn thiện chọn CV khi ứng tuyển.
7. Chưa có Admin CV/Template workflow đầy đủ.
8. Shared link, PDF worker và object storage chưa được hardening cho production.
9. API V1 và V2 vẫn đang dual-write, chưa có kế hoạch contract/cleanup thực tế.
10. Chưa làm các phần AI, import pipeline, thumbnail worker và performance benchmark.

---

# 2. Nguyên tắc thực hiện bắt buộc

## 2.1. Không viết lại nền tảng đã đúng

Giữ nguyên các quyết định:

```text
UserCv
├── CvDraft
├── CvVersion
├── CvSharedLink
├── CvExport
└── CvAccessLog
```

Giữ nguyên:

- Canonical schema.
- Renderer Contract.
- Section Registry.
- Template versioning.
- CV versioning.
- Application snapshot.
- Optimistic locking.
- API V2.
- Service/selector separation.
- Frontend feature boundaries.

## 2.2. Không phát triển tính năng mới khi nền tảng chưa chạy sạch

Thứ tự bắt buộc:

```text
Runtime ổn định
→ Migration chạy sạch
→ Tạo CV thành công
→ UI /mau-cv
→ Template detail
→ Builder UX
→ Candidate workflow
→ Admin workflow
→ Production hardening
→ Phase 2 còn lại
→ AI
```

## 2.3. Quy tắc Clean Architecture

### Backend

- View chỉ nhận request và trả response.
- Serializer validate API contract.
- Service xử lý use case và transaction.
- Selector xử lý query đọc.
- Model chứa persistence và constraint cơ bản.
- Không nhồi business logic lớn vào `save()`, signal hoặc serializer.
- API V2 mới không phụ thuộc API legacy.

### Frontend

- Page chỉ compose các feature.
- Entity chứa domain model, renderer và API đọc cơ bản.
- Feature chứa workflow cụ thể.
- Không gọi Axios ngoài shared API layer.
- Không deep-import feature khác.
- Không tạo component hàng nghìn dòng.
- Không copy renderer cho từng template.
- Không dùng array index làm identity của section/item.

## 2.4. Quy tắc migration

Mọi thay đổi database phải theo:

```text
Expand → Backfill → Switch → Contract
```

Không được:

- `--fake` để bỏ qua lỗi.
- Reset database chỉ để migration chạy.
- Xóa migration đã áp dụng ở môi trường dùng chung.
- Gộp backfill dữ liệu và ALTER constraint nguy hiểm trong cùng bước.
- Hard-delete CV version đang được application sử dụng.

---

# 3. Roadmap tổng thể

| Giai đoạn | Tên | Mục tiêu |
|---|---|---|
| 0 | Stabilization | Sửa runtime, migration và luồng tạo CV |
| 1 | `/mau-cv` UX | Hoàn thiện kho mẫu CV đúng đặc tả |
| 2 | Template Detail & Create Flow | Hoàn thiện preview và popup dùng mẫu |
| 3 | Builder UX Refactor | Làm sạch giao diện Builder, giữ nguyên nghiệp vụ |
| 4 | Candidate CV Management | My CV, duplicate, archive, restore, default |
| 5 | Apply Flow | Chọn CV, confirm version, snapshot khi ứng tuyển |
| 6 | Admin CV/Template | Quản trị template, CV metadata và sensitive audit |
| 7 | Production Hardening | Shared link, PDF worker, storage, monitoring, legacy cutover |
| 8 | Phase 2 còn lại | Version restore, import, thumbnail, performance |
| 9 | Phase 3 AI | AI Writer, ATS, matching, quota và audit |

---

# 4. Giai đoạn 0 — Stabilization

## 4.1. Mục tiêu

Đưa repository về trạng thái:

- Cài dependencies được.
- Migration chạy được trên database hiện tại.
- Backend và frontend chạy được.
- Tạo CV thành công.
- Không phải reset database.
- Có test ngăn lỗi migration tái diễn.

## 4.2. Công việc

### A. Khóa Python version

Chọn một phiên bản thống nhất, đề xuất:

```text
Python 3.11
```

Tạo:

```text
.python-version
backend/.python-version
docs/setup-development.md
scripts/bootstrap-backend.sh
```

Cập nhật Backend CI dùng cùng phiên bản Python local.

### B. Sửa migration Application Snapshot

Migration hiện tại cần tách:

```text
0004_application_snapshot_expand
0005_application_snapshot_backfill
0006_application_snapshot_contract
```

#### `0004 Expand`

- Thêm `submitted_cv_version` nullable.
- Thêm `submitted_cv_title`.
- Thêm `submitted_cv_source`.
- Thêm `submitted_at`.
- Không backfill.
- Không đổi NOT NULL.

#### `0005 Backfill`

- Tạo snapshot cho application cũ.
- Ghim đúng `cv_id`.
- Không tạo snapshot trùng khi chạy lại.
- Không ALTER schema.
- Có logging hoặc metric số record backfill.

#### `0006 Contract`

- Kiểm tra không còn `submitted_cv_version IS NULL`.
- Chuyển FK thành bắt buộc.
- Thêm index.
- Thêm constraint cần thiết.

### C. Thêm migration upgrade test

Test phải mô phỏng:

```text
Migrate về applications.0003
→ tạo UserCv legacy
→ tạo Application legacy
→ migrate lên latest
→ kiểm tra snapshot và dữ liệu
```

Phải chạy trên PostgreSQL thật trong CI.

### D. Sửa lỗi Create CV hiển thị quá chung chung

Frontend cần map đúng lỗi:

- Backend chưa kết nối.
- Template chưa publish.
- Sample content không hợp lệ.
- Email chưa xác thực.
- Không phải Candidate.
- Database/migration lỗi.
- 401/403/404/409/500.

Không chỉ hiển thị:

```text
Không thể tạo CV lúc này. Vui lòng thử lại.
```

### E. Kiểm tra runtime

Backend:

```bash
python --version
python manage.py check
python manage.py showmigrations
python manage.py migrate
python manage.py test
python manage.py runserver
```

Frontend:

```bash
npm ci
npm run lint
npm run check:architecture
npm run test
npm run build
npm run dev
```

## 4.3. Definition of Done

- [ ] Python local, CI và deployment dùng cùng major/minor.
- [ ] Fresh database migrate pass.
- [ ] Existing database có application cũ migrate pass.
- [ ] Không còn lỗi `pending trigger events`.
- [ ] `POST /api/v2/cvs/` trả `201`.
- [ ] Template published tạo được CV blank.
- [ ] Template published tạo được CV từ sample content.
- [ ] Backend tests pass.
- [ ] Frontend quality pass.
- [ ] Migration upgrade test được thêm vào CI.
- [ ] Không dùng `--fake`.
- [ ] Không reset database.

## 4.4. Nhánh/PR đề xuất

```text
fix/cv-builder-runtime-migrations
```

Chỉ sửa migration, runtime và error handling. Không sửa UI lớn trong PR này.

---

# 5. Giai đoạn 1 — Hoàn thiện giao diện `/mau-cv`

## 5.1. Mục tiêu

Xây trang kho mẫu CV gần đúng luồng đã mô tả:

- Sạch.
- 3 card mỗi hàng desktop.
- Lọc theo ngôn ngữ, style, position và feature.
- Card có preview, màu, tag, badge và hover.
- URL phản ánh filter.
- Không thay đổi API create CV.

## 5.2. Viết UI Specification trước khi code

Tạo tài liệu:

```text
docs/cv-builder/ui/template-catalog-spec.md
```

Nội dung bắt buộc:

- Wireframe desktop/tablet/mobile.
- Kích thước container.
- Grid.
- Card ratio.
- Typography.
- Spacing.
- Hover/focus state.
- Loading/empty/error state.
- Filter behavior.
- URL contract.
- Accessibility.
- Screenshot reference.

## 5.3. Route đề xuất

```text
/mau-cv
/mau-cv/:language
/mau-cv/:language/:categorySlug
```

Ví dụ:

```text
/mau-cv/vi
/mau-cv/vi/chuyen-nghiep
/mau-cv/en/modern
```

Giữ redirect tương thích từ route cũ nếu cần.

## 5.4. Thành phần UI

```text
TemplateCatalogPage
├── TemplateCatalogHeader
├── LanguageTabs
├── TemplateCategoryChips
├── PositionFilter
├── FeatureTagFilter
├── TemplateResultSummary
├── TemplateGrid
│   └── TemplateCard
└── UseTemplateModal
```

## 5.5. Template Card

Mỗi card cần:

- Preview thật hoặc preview renderer ổn định.
- Tên template.
- Danh sách màu.
- Tag ATS/style/feature.
- Badge do Admin cấu hình.
- Premium badge nếu có.
- Hover overlay “Dùng mẫu”.
- Click card mở detail.
- Click tag chỉ filter, không mở detail.
- Click màu đổi preview.
- Chiều cao đồng nhất.

Grid:

```text
Mobile: 1 card
Tablet: 2 card
Desktop: 3 card
```

Không dùng 4 card desktop trong thiết kế chính.

## 5.6. API cần kiểm tra

API list chỉ trả card metadata:

- `public_id`
- `slug`
- `display_name`
- `description`
- `thumbnail_url`
- `preview_url`
- `theme_colors`
- `categories`
- `tags`
- `badges`
- `is_premium`

Không trả:

- `default_layout_json`
- `default_style_json`
- `content_contract`
- Internal renderer config không cần thiết.

## 5.7. Definition of Done

- [ ] UI specification được chốt trước code.
- [ ] 3 card desktop, 2 tablet, 1 mobile.
- [ ] Language filter hoạt động.
- [ ] Filter đồng bộ URL.
- [ ] Color swatch đổi preview.
- [ ] Hover “Dùng mẫu” đúng.
- [ ] Click tag không trigger card.
- [ ] Loading skeleton đẹp.
- [ ] Empty state có nút reset filter.
- [ ] Error state phân biệt lỗi API.
- [ ] Keyboard focus rõ.
- [ ] Unit tests pass.
- [ ] E2E filter/card/modal pass.
- [ ] Có screenshot trước/sau trong PR.

## 5.8. Nhánh/PR đề xuất

```text
feat/cv-template-catalog-ui
```

---

# 6. Giai đoạn 2 — Template Detail và Create CV Flow

## 6.1. Mục tiêu

Hoàn thiện trang chi tiết template theo đúng luồng:

```text
Danh sách
→ Chi tiết template
→ Chọn màu
→ Chọn nguồn nội dung
→ Tạo CV
→ Builder
```

## 6.2. Layout

Desktop:

```text
Breadcrumb
Title + color selector

┌─────────────────────────────┬──────────────────────┐
│ Preview HTML / A4           │ Create CV panel      │
│                             │                      │
│                             │ Radio source options │
│                             │ Language             │
│                             │ Position/sample      │
│                             │ Create button        │
└─────────────────────────────┴──────────────────────┘

Related templates
SEO/article content (giai đoạn sau nếu cần)
```

Tỷ lệ đề xuất:

```text
Preview: 70%
Action panel: 30%
```

## 6.3. Nguồn tạo CV

Giai đoạn này hỗ trợ:

1. Nội dung mẫu.
2. Tạo từ đầu.
3. Tạo từ CV có sẵn nếu đã có My CV API phù hợp.

Upload/import chưa làm trong giai đoạn này.

## 6.4. Preview

Ưu tiên:

- HTML/read-only renderer.
- Màu thay đổi real-time.
- Không tạo bản CV thật khi chỉ preview.
- Không dùng placeholder giả nếu template production đã có preview.

## 6.5. Related templates

- Nhóm theo style/feature.
- Carousel 4–5 item desktop.
- Có “Xem tất cả”.
- Không lặp template hiện tại.
- Không dùng cùng một card quá lớn như catalog.

## 6.6. Definition of Done

- [ ] Breadcrumb đúng.
- [ ] URL có language và slug.
- [ ] Preview HTML đúng template.
- [ ] Color selector hoạt động.
- [ ] Panel tạo CV rõ ràng.
- [ ] Create blank thành công.
- [ ] Create sample thành công.
- [ ] Lỗi create được hiển thị cụ thể.
- [ ] Related templates đúng taxonomy.
- [ ] Responsive pass.
- [ ] Unit/E2E pass.

## 6.7. Nhánh/PR đề xuất

```text
feat/cv-template-detail-ui
```

---

# 7. Giai đoạn 3 — Refactor UI/UX Builder

## 7.1. Mục tiêu

Giữ nguyên:

- API V2.
- Autosave.
- Optimistic locking.
- Undo/Redo.
- Drag/drop.
- Resize.
- Section Registry.
- Renderer.
- Canonical document.

Chỉ tổ chức lại UI để dễ sử dụng.

## 7.2. Layout mục tiêu

```text
Topbar
├── Back
├── CV title
├── Save state
├── Undo
├── Redo
├── Preview
├── Save version
└── Publish

Workspace
├── Tool rail
├── Context panel
└── A4 canvas
```

### Tool rail

- Nội dung.
- Thiết kế.
- Thêm mục.
- Bố cục.
- Đổi mẫu.
- Gợi ý viết CV.
- Phiên bản.

### Context panel

Chỉ hiển thị panel đang chọn.

Không hiển thị cùng lúc:

- Style.
- Template switch.
- Resize.
- Section manager.
- Personal info.
- Tất cả collection form.

## 7.3. Refactor component

Tách `CvDraftEditor` thành:

```text
CvBuilderShell
CvBuilderTopbar
CvBuilderToolRail
CvBuilderPanel
CvBuilderCanvas
ContentPanel
DesignPanel
SectionsPanel
LayoutPanel
TemplatePanel
VersionPanel
```

Các form hiện có được tái sử dụng.

## 7.4. UX rules

- Section controls chỉ hiện khi hover hoặc active.
- Delete cần confirm hoặc Undo.
- Drag handle riêng.
- Move Up/Down vẫn giữ cho accessibility.
- Canvas tự căn giữa khi đóng panel.
- Zoom là UI state, không lưu database.
- Mobile chỉ preview và chỉnh sửa cơ bản.
- Không cố hỗ trợ full desktop drag/drop trên màn hình nhỏ.
- Save state luôn nhìn thấy.
- Conflict 409 có hướng dẫn rõ.

## 7.5. Definition of Done

- [ ] Không thay đổi canonical/API contract.
- [ ] Tool rail và context panel hoạt động.
- [ ] Không hiển thị toàn bộ form cùng lúc.
- [ ] Preview A4 căn giữa.
- [ ] Autosave vẫn hoạt động.
- [ ] Undo/Redo vẫn hoạt động.
- [ ] Drag/drop vẫn hoạt động.
- [ ] Template switch không mất content.
- [ ] Conflict UI rõ ràng.
- [ ] Safari desktop manual test.
- [ ] Responsive basic pass.
- [ ] Visual regression baseline.

## 7.6. Nhánh/PR đề xuất

```text
refactor/cv-builder-ui-shell
```

---

# 8. Giai đoạn 4 — Candidate My CV

## 8.1. Mục tiêu

Ứng viên quản lý toàn bộ CV tại một nơi.

Route đề xuất:

```text
/tai-khoan/cv
/tai-khoan/cv/:publicId
```

## 8.2. Chức năng

- Danh sách CV.
- Lọc draft/published/archived.
- Rename.
- Edit.
- View.
- Duplicate.
- Archive.
- Restore.
- Set default.
- Share.
- Export.
- Xem latest/published version.
- Xem trạng thái export.

## 8.3. API V2 cần bổ sung

```text
PATCH /api/v2/cvs/{id}/
POST /api/v2/cvs/{id}/duplicate/
POST /api/v2/cvs/{id}/archive/
POST /api/v2/cvs/{id}/restore/
POST /api/v2/cvs/{id}/set-default/
```

Không dùng legacy service cho frontend mới.

## 8.4. Version history

```text
GET /api/v2/cvs/{id}/versions/
POST /api/v2/cvs/{id}/versions/{versionId}/restore/
```

Restore không sửa version cũ.

Restore phải:

- Copy version thành draft mới.
- Tăng lock version.
- Không tự publish.
- Ghi audit metadata.

## 8.5. Definition of Done

- [ ] My CV list hoàn chỉnh.
- [ ] Duplicate tạo CV độc lập.
- [ ] Archive/restore V2.
- [ ] Default CV duy nhất mỗi Candidate.
- [ ] Version history.
- [ ] Restore version thành draft.
- [ ] Owner authorization/IDOR tests.
- [ ] E2E lifecycle pass.

## 8.6. Nhánh/PR đề xuất

```text
feat/candidate-my-cvs
```

---

# 9. Giai đoạn 5 — Apply Flow

## 9.1. Mục tiêu

Ứng viên nộp đúng một immutable version và Recruiter luôn xem đúng snapshot.

## 9.2. Luồng

```text
Job Detail
→ Apply
→ Chọn CV
→ Preview version
→ Confirm
→ Create application snapshot
→ Success
```

## 9.3. Quy tắc

- Không nộp draft chưa lưu.
- Cho phép Candidate save/publish trước khi apply.
- Application phải lưu `submitted_cv_version`.
- Không đọc mutable `UserCv` ở Recruiter view.
- Candidate sửa CV sau apply không thay đổi hồ sơ đã nộp.
- CV archived sau apply không làm mất snapshot.

## 9.4. Definition of Done

- [ ] Chọn CV từ My CV.
- [ ] Preview trước khi nộp.
- [ ] Confirm version.
- [ ] Transaction tạo application + snapshot.
- [ ] Recruiter đọc snapshot.
- [ ] Candidate xem bản đã nộp.
- [ ] IDOR tests.
- [ ] E2E apply pass.

## 9.5. Nhánh/PR đề xuất

```text
feat/cv-application-flow
```

---

# 10. Giai đoạn 6 — Admin CV và Template Management

## 10.1. Mục tiêu

Admin quản lý template và CV bằng form có cấu trúc, không sửa JSON/HTML tự do.

## 10.2. Template workflow

```text
Template identity
→ Draft version
→ Configure
→ Preview
→ Validate
→ Publish
→ Retire
```

Admin quản lý:

- Template metadata.
- Localization.
- Category.
- Position/audience/feature.
- Theme colors.
- Badge.
- Sample content.
- Section configuration.
- Capabilities.
- Sort order.
- Premium flag.

## 10.3. CV metadata management

Danh sách chỉ trả:

- CV ID.
- Owner metadata tối thiểu.
- Template.
- Lifecycle status.
- Latest/published version.
- Application count.
- Shared link count.
- Export status.
- Created/updated.

Không trả content/layout/style trong list.

## 10.4. Sensitive access

Admin muốn xem nội dung phải:

- Có permission riêng.
- Nhập reason.
- Ghi `CvAccessLog`.
- Không log full CV JSON.
- Ghi actor/action/version/channel/time/IP hash/UA hash.

## 10.5. Admin operations

- Archive/restore/block CV.
- Revoke shared link.
- Retry export.
- Retire template version.
- Không hard-delete version được application sử dụng.

## 10.6. Definition of Done

- [ ] Template CRUD có cấu trúc.
- [ ] Draft/preview/publish/retire.
- [ ] Published version immutable.
- [ ] Admin CV metadata list.
- [ ] Sensitive endpoint có permission.
- [ ] Reason bắt buộc.
- [ ] Audit đầy đủ.
- [ ] IDOR/security tests.
- [ ] Admin E2E pass.

## 10.7. Nhánh/PR đề xuất

```text
feat/admin-cv-template-management
```

---

# 11. Giai đoạn 7 — Production Hardening

## 11.1. Shared link

Bổ sung:

- Rate limit.
- `max_views`.
- Atomic `view_count`.
- Expiry policy.
- Archived CV policy.
- Banned Candidate policy.
- Abuse monitoring.
- Invalid token metrics.
- Access-log retention.

## 11.2. PDF export

Production cần:

- Private object storage.
- Controlled download hoặc signed URL ngắn hạn.
- Queue riêng `cv-export`.
- Worker health check.
- Retry policy.
- Timeout.
- Failed/pending-too-long alert.
- Artifact retention cleanup.
- Font packages.
- Pango/Cairo/libffi runtime.
- E2E download PDF thật.

## 11.3. Observability

Metrics:

- Draft save latency.
- Conflict 409 rate.
- Version creation failure.
- Shared link access.
- Export queue wait time.
- Export render duration.
- Export failure.
- Template create conversion.
- Builder abandonment.

## 11.4. Legacy cutover

Quy trình:

```text
Inventory consumers
→ dual-read comparison
→ migrate all frontend to V2
→ mark V1 deprecated
→ observe rollback window
→ stop dual-write
→ remove V1 routes
→ remove legacy fields
```

Legacy candidates:

- `cv_data`
- `style_config`
- `status`
- `current_version`
- API V1 routes/services

Không xóa trước khi có số liệu mismatch và rollback plan.

## 11.5. Definition of Done

- [ ] Shared link rate limit.
- [ ] Max views atomic.
- [ ] Object storage private.
- [ ] Worker deployment documented.
- [ ] Alerts configured.
- [ ] Backup/restore runbook.
- [ ] V1 consumer inventory.
- [ ] Dual-read mismatch metric.
- [ ] Contract migration plan approved.

## 11.6. Nhánh/PR đề xuất

Tách nhỏ:

```text
feat/cv-share-hardening
feat/cv-export-production
chore/cv-v1-cutover
```

---

# 12. Giai đoạn 8 — Phase 2 còn lại

## 12.1. Import pipeline

```text
Upload
→ Virus/type validation
→ Import job
→ Parse PDF/DOCX
→ Normalize text
→ Map canonical sections
→ Candidate review
→ Save draft
```

Không ghi thẳng kết quả parser thành published CV.

## 12.2. Thumbnail worker

- Version-bound thumbnail.
- Dedupe theo version/render config.
- Retry.
- Internal storage key.
- Cleanup.
- Catalog/Admin dùng thumbnail production.

## 12.3. Performance benchmark

Test:

- 30 sections.
- 200 items.
- Rich text dài.
- 3–5 trang A4.
- Autosave payload gần giới hạn.
- Drag/drop nhiều item.
- PDF render lớn.
- Version history dài.

Đặt budget:

- Builder initial render.
- Input update latency.
- Autosave latency.
- Template switch latency.
- PDF render duration.

## 12.4. Definition of Done

- [ ] Version restore.
- [ ] Import pipeline.
- [ ] Candidate review import.
- [ ] Thumbnail worker.
- [ ] Large CV benchmark.
- [ ] Safari/touch validation.
- [ ] Performance budgets trong CI hoặc benchmark script.

---

# 13. Giai đoạn 9 — Phase 3 AI

Chỉ bắt đầu khi Phase 1 production-ready và Phase 2 ổn định.

## 13.1. AI CV Writer

- Consent bắt buộc.
- Gợi ý theo section.
- Không tự ghi vào CV.
- Candidate accept/reject.
- Lưu prompt/model/version.
- Lưu token/cost.
- Quota/rate limit.
- Safety filter.
- Không log CV PII thô ngoài phạm vi cần thiết.

## 13.2. JD matching

- Hash Job Description.
- Extract keyword.
- ATS suggestion.
- Match score.
- Explainable recommendation.
- Projection table.
- pgvector chỉ khi use case/search volume thực sự cần.

## 13.3. Definition of Done

- [ ] AI consent.
- [ ] AI run audit.
- [ ] Suggestion accept/reject.
- [ ] Prompt/model version.
- [ ] JD hash.
- [ ] Quota/rate limit.
- [ ] Cost monitoring.
- [ ] Safety monitoring.
- [ ] AI fallback khi provider lỗi.

---

# 14. Thứ tự PR khuyến nghị

```text
PR 1  fix/cv-builder-runtime-migrations
PR 2  feat/cv-template-catalog-ui
PR 3  feat/cv-template-detail-ui
PR 4  refactor/cv-builder-ui-shell
PR 5  feat/candidate-my-cvs
PR 6  feat/cv-application-flow
PR 7  feat/admin-cv-template-management
PR 8  feat/cv-share-hardening
PR 9  feat/cv-export-production
PR 10 chore/cv-v1-cutover
PR 11 feat/cv-import-pipeline
PR 12 feat/cv-ai-writer
```

Mỗi PR phải:

- Có mục tiêu.
- Có phạm vi.
- Có ngoài phạm vi.
- Có screenshot nếu sửa UI.
- Có migration impact.
- Có test commands và kết quả.
- Có risk.
- Có rollback plan.
- Không vượt quá phạm vi milestone.

---

# 15. Quality Gate bắt buộc

## Backend

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py test
```

Bổ sung:

- Migration upgrade test.
- IDOR tests.
- Transaction rollback tests.
- Snapshot immutability tests.
- Shared/export authorization tests.

## Frontend

```bash
npm run lint
npm run check:architecture
npm run test:coverage
npm run build
npm run check:bundle-budget
npm run test:e2e:smoke
```

Coverage gate cần thêm CV Builder:

```text
src/entities/cv/**
src/entities/cv-template/**
src/features/create-cv-from-template/**
src/features/edit-cv-draft/**
src/features/view-cv-version/**
src/features/export-cv-pdf/**
```

## UI review

Mỗi UI PR cần:

- Screenshot desktop.
- Screenshot tablet.
- Screenshot mobile.
- Hover/focus state.
- Loading.
- Empty.
- Error.
- Accessibility keyboard check.
- So sánh với UI specification.

---

# 16. Việc cần làm ngay sau khi nhận file này

## Bước 1

Tạo nhánh:

```bash
git switch main
git pull
git switch -c fix/cv-builder-runtime-migrations
```

## Bước 2

Sửa và tách migration Application Snapshot.

## Bước 3

Khóa Python 3.11 và cập nhật hướng dẫn setup.

## Bước 4

Chạy migration trên:

1. Database sạch.
2. Database local hiện tại.
3. Database test có application legacy.

## Bước 5

Kiểm tra tạo CV:

```text
/mau-cv
→ Dùng mẫu
→ Create CV
→ /cvs/{public_id}/edit
```

## Bước 6

Commit checkpoint ổn định.

## Bước 7

Viết `template-catalog-spec.md`.

## Bước 8

Bắt đầu refactor `/mau-cv`.

---

# 17. Definition of Done toàn bộ CV Builder

CV Builder chỉ được coi là hoàn thiện production khi:

- [ ] Migration chạy trên database có dữ liệu thật.
- [ ] Python/runtime được khóa.
- [ ] `/mau-cv` đúng UI specification.
- [ ] Template detail đúng flow.
- [ ] Builder sạch, dễ dùng.
- [ ] Autosave/conflict/version ổn định.
- [ ] My CV hoàn chỉnh.
- [ ] Apply snapshot hoàn chỉnh.
- [ ] Recruiter authorization đầy đủ.
- [ ] Admin template workflow đầy đủ.
- [ ] Admin sensitive audit đầy đủ.
- [ ] Shared link hardening.
- [ ] PDF production worker.
- [ ] Object storage private.
- [ ] E2E Candidate/Recruiter/Admin pass.
- [ ] V1 cutover có kế hoạch.
- [ ] Backup/rollback runbook.
- [ ] Monitoring và alert cơ bản.
- [ ] Không còn blocker P0/P1.
