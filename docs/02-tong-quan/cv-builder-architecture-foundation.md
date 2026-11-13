# CV Builder — Kiến trúc

Tài liệu mô tả kiến trúc **hiện hành** của CV Builder: document canonical,
template/renderer, lifecycle API V2, editor WYSIWYG, import, export và quản trị
catalogue. Bảng dữ liệu được tóm tắt ở
[thiết kế database](../03-database/thiet-ke-database.md) (mục 7). Mọi route CV
nằm dưới `/api/v2/`; API CV V1 đã bị gỡ.

## 1. Document canonical

Mỗi `CvVersion` và `CvDraft` lưu đúng ba JSON tách biệt:

- `content_json`: PII, section instance và item instance có ID ổn định; không
  chứa CSS, component hay logic render.
- `layout_json`: khổ trang, region (`row` tùy chọn, mặc định `0`;
  `width_percent` cộng đủ 100 theo từng row), thứ tự `section_instance_ids` và
  `hidden_section_instance_ids` (section còn dữ liệu nhưng template hiện tại
  không hỗ trợ — ID phải tồn tại, không trùng, không đồng thời nằm trong region).
- `style_json`: màu (`theme_color`), font, tỷ lệ và override presentation an toàn.

`schema_version = 1`. Validator backend (`apps/cvs/schemas.py`) giới hạn kích
thước, section key, ID trùng, region/layout, font/màu và rich text; HTML tùy ý
bị từ chối. Rich text có hai dạng cùng hợp lệ:

- `rich_text_v1`: block text an toàn (giữ hợp lệ vĩnh viễn cho dữ liệu cũ);
- `rich_text_v2`: block `paragraph|bullet`, mỗi block có `text` và `runs`;
  `text` phải bằng chuỗi nối `runs[].text`. Mark cho phép: `bold`, `italic`,
  `underline`, `font_family`, `font_size_pt` (8–32) và màu hex.

Section key là registry template-agnostic (`apps/cv_templates/section_registry.py`,
mirror vào `CvSectionDefinition`), gồm các section nội dung (`personal_info`,
`summary`, `experience`, `skills`, `activities`, `references`, `interests`…) và
ba marker `nameplate`, `contact`, `avatar` lấy dữ liệu từ `personal_info`.
`nameplate` không xóa được. Ảnh trong document chỉ được tham chiếu bằng public
ID của `CvAsset`; response trả map `assets` nằm ngoài document.

## 2. Composition

Mọi workflow ghép content với template gọi
`apps.cvs.composition.compose_cv_document`: lấy template version published,
deep-copy content, map section instance vào region (section không được hỗ trợ
vào danh sách ẩn), áp style/theme và chạy validation document + capability của
renderer. Create, đổi mẫu, apply sample, position preview, import và snapshot
đều dùng chung pipeline này; frontend và service khác không tự dựng document.

## 3. Template, renderer và bất biến

- `CvTemplate` giữ identity/catalogue. `CvTemplateVersion` lưu `renderer_key`,
  `renderer_version`, schema/default layout/style, `capabilities`,
  `content_contract`. Component không lưu trong DB: `renderer_key` là khóa trong
  registry layout `apps/cv_templates/layouts.json` (bản sao giống hệt ở
  `frontend/src/entities/cv/model/cv-layouts.json`, có test so khớp). Mỗi layout
  khai báo các vùng theo hàng (`row`, `width`, `tone` plain/tint/band, `arrange`
  stack/inline), `avatar`, `variant` (standard/timeline/compact) và giới hạn kéo
  độ rộng cột. Tám layout: `single_column_v1`, `single_column_photo_v1`,
  `sidebar_left_v1`, `sidebar_left_photo_v1`, `sidebar_right_v1`,
  `header_band_two_column_v1`, `timeline_v1`, `compact_two_column_v1`.
- Không layout nào có header dựng cứng: tên (`nameplate`), liên hệ (`contact`) và
  ảnh (`avatar`) là section lấy dữ liệu từ `personal_info`; template version đặt
  chúng vào vùng nào thì composition tạo sẵn instance ở đó. Một renderer chung
  (`CvDocumentPreview`) dựng mọi layout từ registry, dùng cho preview, editor,
  trang in PDF và ảnh catalogue. Khối tên cũ chỉ còn cho document cũ không có
  `nameplate`.
- Version đã published không sửa được renderer/schema/default/capability/section,
  chỉ chuyển sang `retired`. CV ghim version qua `CvVersion.template_version` nên
  publish version mới không đổi cách render CV cũ. Muốn đổi layout cho mẫu cũ thì
  publish version mới.
- `CvTemplateSection` chỉ cấu hình section theo region/version, không định nghĩa
  schema content riêng cho từng template.

**Ownership của CV.** `UserCv` là aggregate metadata mutable. Mỗi CV builder có
một `CvDraft` autosave mutable (optimistic `lock_version`) và nhiều `CvVersion`
bất biến (`initial`, `manual_save`, `published`, `application_snapshot`,
`export_snapshot`, `imported`). `Application.submitted_cv_version` luôn trỏ một
version `application_snapshot`; recruiter không suy nội dung từ `Application.cv`.

## 4. Catalogue, taxonomy, màu và nội dung khởi tạo

```text
CvTemplate ──< CvTemplateCategoryLink >── CvCategory
CvTemplate ──< CvTemplateColorLink    >── CvColor
```

- Category là M2M có `sort_order`; `category_type=feature` được serialize thành
  `tags`, `style`/`position`/`audience` thành `categories`.
- `CvColor` là palette dùng lại; `CvTemplateColorLink` giữ `thumbnail_url`,
  `preview_url`, thứ tự và tối đa một màu mặc định mỗi template. Màu catalogue
  không tạo template version mới; màu được chọn khi tạo CV được copy vào
  `style_json.theme_color` của initial version/draft.
- Catalogue public chỉ hiện template `active`, lifecycle `published`, có
  `display_name_<vi|en>` khác rỗng ở ngôn ngữ đang xem và
  `current_published_version` đang published.
- Ngôn ngữ CV là enum `CvLanguage` (`vi-VN`, `en-US`) ở
  `apps/cv_templates/models/language.py`, kèm `CATALOG_LANGUAGES` (path kho mẫu,
  nhãn, hậu tố trường song ngữ); frontend mirror ở
  `entities/cv-template/model/cv-languages.js`. Tên/mô tả/SEO của template là
  các trường `*_vi`/`*_en` trên `CvTemplate` (CVT-1a gộp `CvTemplateLocalization`
  và gỡ bảng `sitecontent.Locale`). Kho `/mau-cv-tieng-nhat`,
  `/mau-cv-tieng-trung`, `/mau-cv/ngon-ngu/:locale` redirect 301 về `/mau-cv`.
- Trang chi tiết mẫu đồng bộ lựa chọn với query string: `nguon`
  (`cv-cu|tai-len|trong`, mặc định nội dung mẫu), `vi-tri` (slug
  `JobCategory`), `ngon-ngu` (`vi|en`), `mau` (slug `CvColor`). Không đưa mã CV
  hay dữ liệu cá nhân lên URL; canonical luôn là path gốc.
- Vị trí: dropdown đọc `JobCategory(category_type=specialization)` active có
  `CvPositionProfile` đang bật (1-1, CVT-1b), value là `public_id`, nhãn là
  `JobCategoryLocalization(vi-VN).display_name`. Profile giữ `section_preset`
  (thứ tự, bật/tắt section) áp cho mọi nội dung dựng từ vị trí đó.
- Nội dung mẫu `CvSampleContent` theo `(position_profile, locale, experience_band)`;
  `position_profile = null` là nội dung chung chứa token `{position}`.
  `experience_band` (`entry`, `junior`, `mid`, `senior`) tương ứng các khoảng của
  `Job.ExperienceYears`, mặc định `junior`. Resolver chọn nhóm kinh nghiệm gần
  nhất trước, cùng khoảng cách thì nội dung riêng của vị trí trước nội dung chung;
  nội dung chung được thay `{position}` bằng tên vị trí theo ngôn ngữ. Vị trí mới
  chỉ cần localization tiếng Việt/Anh và profile; không phải tạo sample cho từng
  template. Thư viện mẫu của editor (`apply-sample`) chỉ nhận nội dung riêng của
  vị trí (nội dung chung còn token).
- Trường matching (CVT-1c): `UserCv.experience_years` là giá trị
  `Job.ExperienceYears`, tính lại ở mỗi `create_version` từ ngày bắt đầu/kết thúc
  các mục kinh nghiệm đang bật (gộp khoảng chồng lấn, mục chưa kết thúc tính tới
  tháng hiện tại) — `apps/cvs/services/matching_profile.py`. Vị trí mục tiêu dùng
  `UserCv.position` (`JobCategory`). Gợi ý việc làm theo CV dùng giá trị này thay
  cho khai báo của ứng viên khi CV có kinh nghiệm.
- `CvTemplate` chỉ dùng `lifecycle_status` để quyết định hiển thị công khai; ảnh
  xem trước nằm ở `CvTemplateColorLink` (card `thumbnail_url` và detail
  `preview_url` lấy từ màu mặc định).

## 5. API V2

CV của ứng viên (`/api/v2/cvs/`, owner-only):

| Route | Hành vi |
| --- | --- |
| `GET\|POST /` | Danh sách CV; tạo CV từ `template_public_id`, `language`, `title`, tùy chọn `position_public_id`, `theme_color` (chỉ màu active gán cho template). Một transaction khóa template, kiểm version published, compose content (nội dung mẫu theo vị trí/nhóm kinh nghiệm hoặc trắng); nhận thêm `experience_band`, tạo `UserCv` + initial `CvVersion` + `CvDraft`. |
| `GET\|PATCH\|DELETE /{id}/` | Metadata; đổi `title`/`is_default`; xóa vĩnh viễn (gỡ draft/version/share/export/file; application snapshot được tách khỏi CV và giữ nguyên). |
| `POST /{id}/duplicate/` | Chỉ CV builder: copy latest immutable version sang CV mới có initial version + draft riêng; không copy draft, share link, trạng thái published. |
| `GET\|PUT /{id}/draft/` | Đọc/autosave draft. Autosave không tạo `CvVersion`. |
| `PUT /{id}/template/`, `GET /{id}/template-preview/` | Đổi mẫu/màu bằng CAS (giữ content, cập nhật hidden section) và projection read-only trước khi đổi. |
| `POST /{id}/apply-sample/` | Thay section nội dung bằng sample, giữ `personal_info`, locale, marker, title, style; compose ở backend. |
| `POST /{id}/save-version/`, `POST /{id}/publish/` | Tạo version `manual_save` / `published`. |
| `GET /{id}/versions/[{version_id}/]`, `GET /{id}/view/` | Lịch sử version và owner view. |
| `GET\|POST /{id}/thumbnail/` | Đọc ảnh WebP hoặc yêu cầu worker sinh lại từ latest version (idempotent). |
| `/{id}/shared-links/[…]`, `GET /shares/{token}/` | Tạo/thu hồi link chia sẻ gắn một version; public đọc qua token (DB chỉ lưu hash). |
| `/{id}/exports/[…]/(retry\|download)/` | Export PDF bất đồng bộ theo `version_public_id`, poll, tải owner-only. |
| `POST /imports/`, `POST /{id}/imports/retry/` | Nhập PDF/DOCX (mục 8). |
| `POST /assets/`, `GET /assets/{asset_id}/content/`, `GET /backgrounds/` | Avatar của ứng viên và danh sách background. |

`PUT draft`, đổi mẫu, apply sample, save và publish bắt buộc header
`If-Match: "lock-version-N"`; lock lệch trả `409` kèm `current_lock_version`,
client tải lại thay vì ghi đè.

Catalogue public (cache control/ETag): `GET /api/v2/cv-templates/` (card gọn,
không trả layout/style/renderer config, lọc `locale`/`category`/`tag`),
`/cv-templates/{slug}/`, `/cv-templates/{slug}/related/`, `/cv-categories/`,
`/cv-backgrounds/`, `/cv-position-options/`, `/cv-position-preview/`,
`/cv-sample-contents/` (thư viện nội dung mẫu riêng theo vị trí của editor).

Ứng tuyển và recruiter:

- `GET|POST /api/v2/applications/`: POST bắt buộc CV và `version_public_id` cùng
  aggregate; service copy đúng version đó thành `application_snapshot`, không
  đổi con trỏ draft/latest/published và không tự chọn latest hay draft.
- `GET /api/v2/recruiter/applications/{id}/cv/`: trả `submitted_cv_version`, chỉ
  cho recruiter đã đăng tin (`job.posted_by`).
- `GET /api/jobs/recommendations/by-cv/{cv_public_id}/`: xếp hạng tin active theo
  CV của chính ứng viên bằng rule giải thích được (điểm, lý do, keyword).
- `GET|PATCH /api/candidate/recruiter-visibility/`: bật cần xác nhận tường minh;
  mỗi quyết định cập nhật `CandidateConsent` và append `CandidateConsentEvent`.

Quản trị (`/api/v2/admin/`, kiểm quyền `HasAdminPermission` với
`cv_template.*`): `cv-templates` (kèm action tạo draft version từ version hiện
hành, publish, retire, regenerate snapshot; nhận các trường song ngữ),
`cv-categories`, `cv-colors`, `cv-backgrounds`, `cv-sample-contents` (nhận
`position_public_id`, `experience_band`). Hồ sơ vị trí CV quản lý ở Django admin
cho tới CVT-4.

## 6. Editor WYSIWYG

Route `/cvs/:publicId/edit` (candidate sở hữu CV) là page mỏng `CvEditor`;
workflow nằm ở feature `edit-cv-draft`:

```text
pages/main/cvs/CvEditor
  → features/edit-cv-draft
    → entities/cv, entities/cv-template, entities/locale
      → shared
```

- Entity `cv` sở hữu validator, thao tác rich text, renderer projection, model
  phân trang, DTO asset và document surface; feature sở hữu inline session,
  toolbar, DnD, panel, autosave/history, đổi mẫu và apply sample.
- Shell desktop: header website, action bar, rail công cụ (6 công cụ), panel đóng
  được và canvas A4; mobile dùng drawer. Mục "Gợi ý viết CV" chỉ hiển thị "Sắp ra mắt".
- Một document surface dùng chung cho chế độ đọc và sửa. Preview luôn A4 và dùng
  renderer đã ghim; client chỉ project content vào region của `layout_json`, không
  có nhánh theo template.
- Phân trang đo DOM ở tỷ lệ 1:1 sau khi font sẵn sàng (zoom chỉ áp lên wrapper),
  pack theo chiều cao A4, giữ heading với item đầu, chỉ tách ở ranh giới item;
  item cao hơn một trang giữ nguyên và báo overflow.
- DnD section/item dùng `@dnd-kit/core` + `@dnd-kit/sortable`, chuẩn hóa tọa độ
  theo zoom, touch delay 250 ms, có keyboard sensor và nút lên/xuống thay thế.
  Hỗ trợ thêm section, resize region cùng row, avatar và background.
- Inline editor giữ DOM khi focus, commit sau 400 ms idle và flush trước undo/redo,
  save, preview, đổi mẫu, apply sample, điều hướng và khi tab bị ẩn. History gộp
  command cùng `coalesceKey` trong một giây; đổi mẫu reset history, apply sample
  là một command undo được. Đổi locale reset tiêu đề section/placeholder chuẩn
  nhưng giữ nội dung tự viết.
- Autosave debounce gọi `PUT draft` với `If-Match`; trạng thái chưa lưu/đang
  lưu/đã lưu/lỗi; `409` dừng autosave và yêu cầu tải lại.
- WYSIWYG là mặc định qua site setting `cv_builder_wysiwyg_enabled`; đặt `false`
  thì `CvDraftEditor` render `CvLegacyDraftEditor` (form cũ) để rollback.

**Asset.** `CvAsset` `kind=avatar|background`, owner null cho asset hệ thống.
Avatar nhận JPEG/PNG/WebP tối đa 5 MB, kiểm magic bytes, re-encode bỏ metadata,
resize tối đa 512×512. Background do admin quản lý, ứng viên chỉ chọn asset
active. Ảnh cá nhân đọc qua endpoint owner-authorized hoặc URL ký ngắn hạn trong
response shared/recruiter; PDF worker đọc storage nội bộ.

## 7. Lưu, thumbnail, export và chia sẻ

- Nút lưu cuối workflow: flush edit, `PUT draft`, rồi `POST save-version` đúng
  một lần. Sau commit, backend enqueue thumbnail WebP cho version đó; trang
  `/save-cv-success/:publicId` poll metadata tới khi artifact sẵn sàng.
- Tải PDF: POST export với `version_public_id`, poll job, GET download
  owner-only. `CvExport` unique theo version + `render_config`, `storage_key` chỉ
  nội bộ; không tải draft, không dùng URL storage trực tiếp, không tạo PDF trong
  browser. PDF render phía server: worker mở trang in `cv-print.html` của
  frontend (`CV_PRINT_URL`) bằng Chromium headless (Playwright), đưa document vào
  bằng `page.evaluate` và in A4, nên PDF dùng đúng renderer của preview. Trang in
  chỉ được tải tài nguyên cùng origin và `data:` (ảnh nhúng base64); mọi request
  khác bị chặn để nội dung CV không thể ra ngoài. Chromium chạy trong một luồng
  riêng của worker vì Playwright sync API làm Django chặn truy vấn DB trong luồng
  gọi nó.
- Font CV tự host (OFL qua `@fontsource`): Inter, Roboto, Be Vietnam Pro, Lora.
  Font cũ (Arial, Calibri, Source Sans Pro) vẫn hợp lệ trong document đã lưu và
  được map sang font tự host tương ứng.
- Link chia sẻ bearer gắn một immutable version, có hạn/thu hồi; token thô chỉ
  xuất hiện trong response tạo. Mọi truy cập CV nhạy cảm ghi `CvAccessLog`.

## 8. Import PDF/DOCX

- `POST /api/v2/cvs/imports/` (tùy chọn template/language/màu) trả `202`, tạo
  `CvImportJob` bền vững, idempotent theo `Idempotency-Key` của ứng viên; throttle
  `cv_import` 10/giờ.
- Chỉ nhận PDF/DOCX có signature thật, tối đa 5 MB; PDF tối đa 20 trang; PDF scan
  chưa OCR trả failure code riêng.
- Worker trích text (`pypdf`/`python-docx`) rồi gọi `structure_cv_text`
  (`apps/ai_core/services/cv_import.py`). Hàm này gọi thẳng REST của Gemini, OpenAI
  hoặc Anthropic theo site setting `ai_provider`/`ai_model`, không qua runtime
  `ai_core` (không bị `AI_RUNTIME_ENABLED` chặn, không ghi `AiInvocation`, không
  quota), và fallback heuristic khi thiếu API key hoặc provider lỗi. Sau đó map/
  validate canonical, compose bằng đúng template version và tạo version `imported`.
- Raw text và response provider không persist/log; UI chỉ nhận failure code đã
  allowlist. Identity parse được được giữ, chỉ điền field còn trống.
- Retry owner-only tối đa 3 attempt; Celery beat redispatch job queued và xóa
  file nguồn hết hạn retention (không xóa document canonical).

## 9. Quản trị catalogue và snapshot

- Portal admin `cv-catalogue` (sau `AuthGuard → RoleGuard`) quản lý template/
  version, category, color, background và sample (structured editor theo
  section/item); không yêu cầu sửa raw JSON.
- Publish chạy trong transaction với row lock, gọi `full_clean()` trước khi đổi
  con trỏ published, đồng thời retire version cũ.
- Snapshot thumbnail/preview: canonical composer → trang in Chromium → raster
  trang đầu bằng `pypdfium2`. Fingerprint gồm template/renderer/màu/source
  revision/phiên bản snapshot; worker idempotent, ghi asset mới trước rồi swap
  pointer trong transaction, chỉ xóa asset cũ sau commit.
- Nội dung mẫu không chứa danh tính. Ảnh catalogue và preview cho khách chưa đăng
  nhập thêm danh tính minh họa lúc hiển thị (`apps/cv_templates/demo_identity.py`,
  ảnh catalogue kèm ảnh đại diện bóng người); người đăng nhập thấy danh tính của
  chính họ. Danh tính minh họa không bao giờ ghi vào DB.

## 10. Việc còn mở

- UAT bộ 8 layout trên dữ liệu thật; sau một release ổn định thì gỡ editor legacy và cờ
  `cv_builder_wysiwyg_enabled`.
- Purge CV archive mềm còn từ dữ liệu cũ (chỉ sau backup và xác nhận riêng).
- Audit trail chi tiết người publish/retire template và chặn xóa taxonomy đang
  được dùng.
- Hardening: retention/revoke tổng thể cho share/export, benchmark catalog,
  autosave và renderer/PDF với CV lớn.
- Chưa có: AI writer ("Gợi ý viết CV"), import LinkedIn, ATS/matching và quota/
  consent AI cấp sản phẩm.
