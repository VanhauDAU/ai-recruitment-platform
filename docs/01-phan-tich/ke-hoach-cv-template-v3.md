# Kế hoạch làm lại Template CV, tạo CV và trích xuất CV upload (CVT-v3)

| Mục | Giá trị |
| --- | --- |
| Ngày lập | 2026-11-13 |
| Trạng thái | 📝 Đề xuất — chờ duyệt trước khi triển khai |
| Phạm vi | Cổng ứng viên (kho mẫu, trang chi tiết mẫu, tạo CV, upload và trích xuất), cổng quản trị (quản lý template, vị trí, nội dung mẫu, CV ứng viên), backend `cv_templates`, `cvs`, `ai_core` |
| Tài liệu nền | [Kiến trúc CV Builder](../02-tong-quan/cv-builder-architecture-foundation.md), [Thiết kế database mục 7](../03-database/thiet-ke-database.md), [`AGENTS.md`](../../AGENTS.md), [`frontend/ARCHITECTURE.md`](../../frontend/ARCHITECTURE.md) |
| Mã giai đoạn | `CVT-0` … `CVT-7` (mục 13) |

---

## 1. Bối cảnh và hiện trạng

Kết quả rà soát code trên nhánh `dev` (commit `658c4073`):

| # | Vấn đề người dùng nêu | Nguyên nhân trong code |
| --- | --- | --- |
| H1 | Kho mẫu có 4 ngôn ngữ (Việt, Anh, Nhật, Trung), rối và kém hiệu quả | Ngôn ngữ là dữ liệu động ở `sitecontent.Locale`; route cứng cho 4 path ở `app/router/routes/main.routes.jsx` cộng route động `/mau-cv/ngon-ngu/:locale`; `CvTemplateLocalization`, `CvSampleContent`, `CvContentBlueprint` đều dual-read `locale` ↔ `locale_ref` |
| H2 | Chọn mẫu thì preview không hiện, phải bấm qua mục khác rồi bấm lại "Nội dung CV mẫu … gợi ý" | `features/create-cv-from-template/model/use-cv-source.js`: effect khởi tạo phụ thuộc `locales`, `user`, `onPreviewChange` nên chạy lại khi các giá trị đó tải xong; mỗi lần chạy nó đặt `positionsLocale = null`. Effect tải vị trí chỉ phụ thuộc `[source, sampleLocale]` nên không chạy lại → `resolvePreviewSelection` trả `waiting` vĩnh viễn. Đổi `source` mới kích hoạt lại effect. Ba effect lồng nhau với 20 `useState` tạo race condition khó kiểm soát |
| H3 | Mục "Khôi phục bản chưa lưu" thừa | Nguồn `restore` trong `use-cv-source.js`, `CvSourcePanel.jsx`, `preview-selection.js`, API `getLatestRecoverableDraft` |
| H4 | Tiêu đề, breadcrumb, URL không khớp lựa chọn ở cột phải | `TemplateDetail.jsx` dựng H1/breadcrumb chỉ từ `template` + `locale` của path; lựa chọn nguồn/vị trí/màu chỉ nằm trong state, reload là mất |
| H5 | Chọn vị trí chỉ đổi chữ mẫu, mọi vị trí cùng một cấu trúc | `CvSampleContent` và `CvContentBlueprint` chỉ có `content_json`; blueprint hard-code 4 nhóm (tóm tắt, kinh nghiệm, học vấn, kỹ năng); không có khái niệm section/trường riêng theo vị trí |
| H6 | Quản trị template sơ sài, rối, không dùng được | `widgets/admin-cv-catalogue/ui/AdminCvCatalogue.jsx` (332 dòng) là 6 tab bảng thô (template, nội dung mẫu, blueprint, ngôn ngữ, danh mục & màu, hình nền); không có wizard, không có preview, không thấy độ phủ nội dung theo vị trí, không quản lý CV ứng viên |
| H7 | Khung CV không đa dạng, thông tin cá nhân luôn nằm trên cùng | `entities/cv/ui/CvDocumentPreview.jsx` dòng 138 dựng cứng `<header>` họ tên + liên hệ ở trang 1 phía trên mọi region (trừ `header_two_column_v1`). Chỉ có 3 renderer ở `apps/cv_templates/renderers.py`. `nameplate`, `contact`, `avatar` đã là section marker trong registry nhưng renderer không cho đặt tự do |
| H8 | Upload CV chưa điền vào mẫu đã chọn một cách tin cậy | Pipeline đã có (`POST /api/v2/cvs/imports/` → `process_cv_import_job` → `structure_cv_text`) nhưng: gọi thẳng REST provider, không qua runtime `ai_core` (không quota, không `AiInvocation`, không kill switch); gửi nguyên văn bản có PII sang AI; không có độ tin cậy theo trường; mở thẳng editor, không có bước rà soát |
| H9 | PDF có thể lệch với preview | Preview dùng React (`CvDocumentPreview`), PDF dùng Django template + WeasyPrint (`apps/cvs/services/pdf_renderer.py`, `apps/cvs/templates/pdf`). Mỗi layout phải viết hai lần |

Những thứ **giữ lại** vì đã tốt: document canonical 3 JSON (`content_json`, `layout_json`, `style_json`), `compose_cv_document` là pipeline duy nhất, `CvTemplateVersion` bất biến sau khi publish, `CvDraft` autosave với `lock_version`, upload quarantine/claim, throttle `cv_import`, chọn màu CV.

---

## 2. Mục tiêu

1. Ứng viên chọn mẫu → thấy ngay bản xem trước đúng với lựa chọn → bấm **Tạo CV** → vào editor, không lỗi, không phải thao tác thừa.
2. CV đa dạng bố cục thật sự: 8 layout, thông tin cá nhân/ảnh/liên hệ đặt được ở nhiều vị trí, kéo thả section giữa các vùng.
3. Mỗi vị trí công việc có bộ section, trường riêng và nội dung mẫu theo nhóm kinh nghiệm; dữ liệu CV cùng từ vựng với JD để làm matching sau này.
4. Upload CV PDF/DOCX → trích xuất bằng AI → rà soát → điền vào mẫu đã chọn.
5. Quản trị viên tạo và xuất bản một template mới trong ≤ 10 phút, thấy ngay vị trí nào thiếu nội dung mẫu.
6. Không lộ thông tin ứng viên ở URL, cache public, log, AI provider hay trang quản trị.
7. Trang chi tiết mẫu nhanh và mượt trên cả mobile.

### Ngoài phạm vi

- Trình thiết kế layout kéo thả cho admin (layout mới vẫn do dev viết code).
- Ngôn ngữ ngoài tiếng Việt và tiếng Anh; dịch CV tự động bằng AI.
- OCR cho PDF scan (vẫn trả mã lỗi `scanned_pdf_ocr_unavailable`).
- Import LinkedIn, AI writer, chấm điểm CV, matching CV–JD.
- Template trả phí (giữ cờ `is_premium` nhưng không bán, theo ADR-0015).

---

## 3. Quyết định đã chốt (2026-11-13)

| # | Hạng mục | Quyết định |
| --- | --- | --- |
| D1 | Bố cục | Bộ 8 layout dựng sẵn bằng code; ứng viên kéo thả section giữa các vùng, bật/tắt section, đổi màu/font |
| D2 | Admin | Wizard cấu hình trên layout có sẵn; không có trình thiết kế kéo thả layout |
| D3 | Theo vị trí | Vị trí quyết định bộ section gợi ý + thứ tự, trường riêng do admin định nghĩa, nội dung mẫu theo cấp độ |
| D4 | Nội dung mẫu | AI sinh nháp hàng loạt, admin sửa và duyệt; import/export JSON |
| D5 | Upload | Bấm Tạo CV → AI trích xuất → màn rà soát → editor |
| D6 | File gốc | Xóa ngay sau khi trích xuất thành công; nếu lỗi giữ tối đa 24h để thử lại; che PII trước khi gửi AI |
| D7 | Ngôn ngữ | Chỉ tiếng Việt và tiếng Anh, là thuộc tính của CV; enum `CvLanguage` trong code với giá trị BCP 47 `vi-VN`/`en-US` (giữ mã mà `content_json.locale`, API và frontend đang dùng); gỡ hẳn `sitecontent.Locale`; một kho mẫu chung, hai trang SEO |
| D8 | Tiêu đề/URL | Lựa chọn đồng bộ vào query string; H1, breadcrumb, `<title>` đổi theo; canonical luôn là trang mẫu gốc |
| D9 | Ảnh | Có ảnh tùy layout; ảnh là asset riêng tư |
| D10 | Dữ liệu cũ | Được xóa template, nội dung mẫu và CV cũ, seed lại bộ mới (dữ liệu hiện tại là dữ liệu phát triển) |
| D11 | Lộ trình | `CVT-0` sửa lỗi trước trên hệ cũ, sau đó làm lại theo giai đoạn |
| D12 | Tài liệu | Kế hoạch này; khi xong cập nhật kiến trúc CV Builder, database, API, tiến độ |
| D13 | Hướng matching | Dữ liệu CV dùng chung từ vựng với tin tuyển dụng (JD) ngay từ đầu: cùng taxonomy vị trí, kỹ năng, cùng enum kinh nghiệm/cấp bậc/học vấn — xem mục 5.6 |

---

## 4. Kiến trúc mục tiêu

```text
                  ┌──────────── Cổng ứng viên ─────────────┐
 Kho mẫu  ──►  Trang chi tiết mẫu (URL state)  ──►  Tạo CV ──► Editor
                  │ nguồn: mẫu | CV cũ | upload | trống      ▲
                  │                                          │
                  └─ upload ─► CvImportJob ─► Màn rà soát ───┘

 Backend (/api/v2/)
   cv_templates:  CvTemplate ─< CvTemplateVersion ─< CvTemplateSection
                  CvPositionProfile ─< CvPositionField
                  CvSampleContent (vị trí × cấp độ × ngôn ngữ)
                  CvColor, CvCategory
   cvs:           UserCv ─< CvDraft / CvVersion, CvAsset, CvImportJob
   ai_core:       runtime (quota, AiInvocation, kill switch)
                  ├─ cv_import.extract (che PII, JSON schema, độ tin cậy)
                  └─ cv_sample.generate (sinh nội dung mẫu cho admin)

 Layout registry (code, mirror FE ↔ BE):  8 layout × contract vùng
 Render:  React renderer (preview + editor)  ──►  PDF  (xem mục 6.4)
```

Tuân thủ ADR-0010 (`api → services/selectors → models`, `tasks → services`) và FSD frontend (`app → pages → widgets → features → entities → shared`).

---

## 5. Mô hình dữ liệu mới

Vì được xóa dữ liệu cũ (D10), làm sạch luôn thay vì giữ dual-read. **Bắt buộc `pg_dump` trước khi chạy migration** (Docker backend tự migrate khi khởi động).

### 5.1 Ngôn ngữ (✅ CVT-1a)

- Enum `CvLanguage` ở `apps/cv_templates/models/language.py`: `vi-VN`, `en-US`
  (mã BCP 47, không đổi sang mã ngắn để tránh chuyển đổi dữ liệu và API không
  cần thiết). `CATALOG_LANGUAGES` giữ path kho mẫu, nhãn và hậu tố trường song
  ngữ; frontend mirror ở `entities/cv-template/model/cv-languages.js`.
- Gỡ bảng `sitecontent.Locale`, API `/api/site/locales/`, `/api/site/admin/locales/`
  và mọi FK `locale_ref` (kể cả ở `JobCategoryLocalization`, vốn chỉ phục vụ kho
  CV). `JobCategoryLocalization.Locale` còn `vi-VN`/`en-US`.

### 5.2 Template

| Model | Thay đổi |
| --- | --- |
| `CvTemplate` | ✅ CVT-1a: thêm `display_name_vi/en`, `description_vi/en`, `seo_title_vi/en`, `seo_description_vi/en`; template có mặt ở kho ngôn ngữ nào khi `display_name_<ngôn ngữ>` khác rỗng (không cần trường `supported_languages`); xóa `description`. CVT-1b: xóa `category` (chuỗi legacy), `status` (legacy), `layout_config`, `style_config`, `thumbnail_url`, `preview_url` (chuyển sang color link). Giữ `lifecycle_status`, `current_published_version`, `usage_count`, `sort_order`, `is_premium` |
| `CvTemplateLocalization` | ✅ Xóa ở CVT-1a, dữ liệu vi/en được chép sang các trường `_vi/_en` bằng data migration |
| `CvTemplateVersion` | Giữ bất biến. `renderer_key` → đổi tên ý nghĩa thành `layout_key` (xem 6.1); thêm `style_preset` (font, cỡ chữ, khoảng cách, kiểu tiêu đề section, kiểu gạch chân) |
| `CvTemplateSection` | Giữ; thêm ràng buộc section phải nằm trong `allowed_sections` của vùng theo layout |
| `CvTemplateColorLink` | Giữ (thumbnail/preview theo từng màu); ảnh xuất WebP |
| `CvContentBlueprint` | Xóa. Thay bằng `CvSampleContent` có `position = null` làm nội dung chung theo cấp độ |

### 5.3 Vị trí và trường riêng (mới)

> CVT-1b đã làm `CvPositionProfile` (`job_category` 1-1, `section_preset`, `is_active`, `sort_order`; tên/slug lấy từ `JobCategory`, không lưu lặp `name_vi/en`, `slug`, `industry_group`). `CvPositionField` và `keywords` làm ở CVT-3 cùng form nhập liệu dùng chúng.

```text
JobCategory(specialization) 1──1 CvPositionProfile 1──< CvPositionField
                                       │
                                       └──< CvSampleContent (level × language)
```

**`CvPositionProfile`**

| Trường | Kiểu | Ghi chú |
| --- | --- | --- |
| `public_id`, `slug` | str | slug dùng trên URL (`vi-tri=ky-su-ai`) |
| `job_category` | FK `jobs.JobCategory` unique | tái dùng taxonomy ngành nghề sẵn có |
| `name_vi`, `name_en` | str | nhãn hiển thị và token `{position}` |
| `industry_group` | FK `JobCategory` cha | nhóm trong ô chọn (IT, Kinh doanh, Thiết kế…) |
| `section_preset` | JSON | danh sách có thứ tự `{section_key, enabled, region_hint: primary|secondary}` |
| `keywords` | JSON list | từ khoá kỹ năng gợi ý; AI dùng để đối chiếu vị trí khi trích xuất |
| `is_active`, `sort_order`, `usage_count` | | |

**`CvPositionField`** (trường riêng do admin định nghĩa)

| Trường | Kiểu | Ghi chú |
| --- | --- | --- |
| `profile` | FK | |
| `key` | slug | unique trong profile, ví dụ `github_url`, `portfolio_url`, `doanh_so_nam` |
| `label_vi`, `label_en`, `placeholder_vi`, `placeholder_en`, `help_vi`, `help_en` | str | |
| `field_type` | enum | `text`, `long_text`, `url`, `number`, `date`, `select`, `multi_select`, `tags` |
| `options` | JSON | cho `select`/`multi_select` |
| `validation` | JSON | `max_length`, `min/max`, regex URL được allowlist; không nhận regex tự do |
| `is_required_hint` | bool | chỉ gợi ý, không chặn lưu CV |
| `sort_order`, `is_active` | | |

Trường riêng được lưu trong section mới `position_details` của `content_json`:

```json
{
  "instance_id": "sec_pd_1",
  "section_key": "position_details",
  "title": "Thông tin chuyên môn",
  "position_profile_id": "cvpos_x1",
  "fields": [
    { "key": "github_url", "label": "GitHub", "type": "url", "value": "https://github.com/..." }
  ]
}
```

Nhãn được **chụp vào document** lúc tạo CV, nên đổi/xóa trường ở admin không làm hỏng CV cũ. Validator `apps/cvs/schemas.py` kiểm tra kiểu và độ dài từng giá trị. Tăng `schema_version` lên `2`.

**Section mới vào registry** (`section_registry.py` + `entities/cv/model/section-registry.js`): `position_details`, `languages` (ngoại ngữ + trình độ), `portfolio` (link + mô tả), `publications`. Các section hiện có giữ nguyên.

### 5.4 Nội dung mẫu

`CvSampleContent`: unique `(position_profile, experience_band, language)`; `position_profile = null` là nội dung chung.

- `experience_band`: 4 nhóm **suy ra từ enum `Job.ExperienceYears` của JD** (không tạo enum riêng): `entry` = `none`/`under_1`, `junior` = `1`/`2`, `mid` = `3`/`4`, `senior` = `5`/`over_5`. Bảng nhóm đặt một chỗ (mục 5.6) để CV, nội dung mẫu và matching dùng chung.
- `status`: `draft` → `in_review` → `published` → `archived` (CVT-1b giữ `draft/published/archived`; `in_review` thêm ở CVT-3 cùng hàng đợi duyệt AI).
- `origin`: `ai`, `manual`, `import`; `ai_invocation` FK (nếu sinh bằng AI); `reviewed_by`, `reviewed_at` — làm ở CVT-3.
- Danh tính mẫu cố định, hư cấu (`Nguyễn Văn A`, `nguyenvana@example.com`); validator chặn email/SĐT không thuộc allowlist mẫu để AI không lọt dữ liệu thật.

Thứ tự resolve khi ứng viên chọn vị trí P, nhóm kinh nghiệm L, ngôn ngữ G (✅ CVT-1b, điều chỉnh so với bản đầu):
nhóm kinh nghiệm gần L nhất trước, cùng khoảng cách thì nội dung riêng `(P, ·, G)` trước nội dung chung `(null, ·, G)` (thay `{position}` bằng tên vị trí), rồi nhóm cao hơn. Lý do: nội dung riêng ở nhóm khác sẽ ghi sai số năm kinh nghiệm và chức danh. `section_preset` của P áp cho mọi nội dung. Luôn có kết quả nếu seed nội dung chung đủ 4 nhóm × 2 ngôn ngữ.

### 5.5 CV và import

| Model | Thay đổi |
| --- | --- |
| `UserCv` | Xóa `cv_data`, `style_config`, `status` legacy (đã ghi trong việc còn mở của CV Builder). `language` dùng enum `vi|en`. Thêm các trường matching ở mục 5.6 (`experience_years`, `position_level`, `education_level`; vị trí dùng `UserCv.position` có sẵn) |
| `CvImportJob` | Thêm trạng thái `awaiting_review`; `extraction_summary` JSON chỉ chứa **metadata** (số section, danh sách đường dẫn trường có độ tin cậy thấp, vị trí gợi ý) — không chứa nội dung; `consent_at`; `source_deleted_at` |
| `CvDraft` | Nội dung trích xuất nằm trong draft như mọi CV khác; không có bản sao thứ hai |
| `CvAsset` (avatar) | Thêm `kind=avatar`; xử lý ảnh: bỏ EXIF, cắt vuông, resize 400×400 WebP |

---

### 5.6 Dữ liệu chuẩn hướng tới matching CV–JD (D13)

Nguyên tắc: **mọi chiều sẽ dùng để so khớp đều là dữ liệu có cấu trúc, cùng
từ vựng với JD**, được tạo ra ngay ở form, nội dung mẫu và trích xuất upload.
Không để matching sau này phải đọc lại rich text hay đoán từ chữ tự do.

| Chiều so khớp | Phía JD (đã có) | Phía CV (chuẩn hóa trong kế hoạch này) | Nguồn dữ liệu CV |
| --- | --- | --- | --- |
| Vị trí / ngành | `Job` → `JobCategory` | `UserCv.position` (FK `JobCategory` đã có sẵn, được ghi khi tạo CV từ vị trí — không thêm `target_category` trùng lặp) — cùng taxonomy với ô chọn vị trí (`vi-tri` trên URL đã là slug `JobCategory` từ CVT-0) | Vị trí chọn khi tạo CV; AI gợi ý khi upload |
| Kỹ năng | `JobSkill`: FK `skills.Skill`, `importance`, `min_level` (`beginner/intermediate/advanced`), `min_years_experience` | `CvSkill`: FK `skills.Skill`, `level` (cùng enum), `years_experience`, `source` (`manual/ai_extracted`), `confidence_score` | Item trong section `skills` có `skill_id` (chọn từ taxonomy, gõ tự do thì giữ `name` và vào hàng đợi chuẩn hóa) |
| Số năm kinh nghiệm | `Job.experience_years` (`ExperienceYears`) | `UserCv.experience_years` cùng enum, **tính tự động** từ ngày bắt đầu/kết thúc các item kinh nghiệm (gộp khoảng chồng lấn) | Section `experience` với ngày dạng `YYYY-MM` bắt buộc hợp lệ |
| Cấp bậc | `Job.position_level` (`PositionLevel`) | `UserCv.position_level` cùng enum | Ứng viên chọn; AI gợi ý từ chức danh gần nhất |
| Học vấn | `Job.education_level` (`EducationLevel`) | `UserCv.education_level` cùng enum = bậc cao nhất | Item `education` có `degree_level` (cùng enum) ngoài chữ tự do |
| Ngoại ngữ | (bổ sung sau nếu JD cần) | Section `languages`: mã ISO 639-1 + trình độ CEFR | Form / AI |
| Trường riêng theo vị trí | — | `CvPositionField.maps_to` = `skills` \| `none`: trường kiểu `tags` có thể đổ thẳng vào `CvSkill` | Admin cấu hình |

Cách triển khai để không phức tạp từ đầu:

1. **Một nguồn sự thật cho enum:** CV import enum từ `apps/jobs` (qua
   `apps/jobs/services/__init__.py` theo ADR-0010), không sao chép giá trị.
   Bảng nhóm `experience_band` ↔ `ExperienceYears` đặt cạnh enum đó.
2. **Một service dẫn xuất duy nhất:** `apps/cvs/services/matching_profile.py`
   → `build_matching_profile(content_json)` thuần, deterministic, có test; gọi
   khi lưu version (`manual_save`, `published`, `imported`,
   `application_snapshot`) để cập nhật các trường ở `UserCv` và đồng bộ `CvSkill`.
   Draft autosave không chạy để giữ autosave nhanh.
3. **Snapshot ứng tuyển** lưu kèm profile tại thời điểm nộp, để điểm match
   của đơn không đổi khi ứng viên sửa CV sau đó.
4. **Validator** (`apps/cvs/schemas.py`) bắt buộc kiểu cho các trường trên:
   ngày `YYYY-MM`, `degree_level`/`level` thuộc enum, `skill_id` tồn tại.
5. **Trích xuất AI (mục 8.3)** phải trả đúng các trường này: tên kỹ năng được
   khớp với `Skill` qua bảng alias, kỹ năng chưa có vào hàng đợi chuẩn hóa của
   admin thay vì tự tạo `Skill` mới.
6. **Chưa làm thuật toán matching ở epic này.** Epic chỉ bảo đảm dữ liệu sạch và
   cùng từ vựng; matching (rule-based hiện có hoặc embedding) đọc trực tiếp các
   trường trên ở giai đoạn AI 2–3.

Giai đoạn: enum và trường ở `CVT-1`; form/section ở `CVT-3`; service dẫn xuất
và đồng bộ `CvSkill` ở `CVT-3`; AI trả trường chuẩn ở `CVT-6`.

## 6. Hệ thống bố cục (khung CV đa dạng)

### 6.1 Layout registry

Mỗi layout là một contract trong code, mirror ở `apps/cv_templates/layouts.py` và `entities/cv/model/layouts.js` (test so khớp hai bên bằng snapshot JSON xuất từ backend):

```python
LayoutContract(
    key='sidebar_left_photo_v1',
    regions=(
        Region('sidebar', row=0, width=(28, 40), default_width=33,
               allowed=ALL_SECTIONS, background='theme_tint'),
        Region('main', row=0, width=(60, 72), default_width=67, allowed=ALL_SECTIONS),
    ),
    supports_avatar=True,
    avatar_shapes=('circle', 'square'),
)
```

Bộ 8 layout ban đầu:

| Key | Mô tả | Ảnh | Vùng |
| --- | --- | --- | --- |
| `single_column_v1` | Một cột, tên trên cùng | Không | `main` |
| `single_column_photo_v1` | Một cột, ảnh cạnh tên | Có | `header`, `main` |
| `sidebar_left_v1` | Sidebar trái màu nhạt | Không | `sidebar`, `main` |
| `sidebar_left_photo_v1` | Sidebar trái, ảnh trên đầu sidebar | Có | `sidebar`, `main` |
| `sidebar_right_v1` | Sidebar phải | Tùy chọn | `main`, `sidebar` |
| `header_band_two_column_v1` | Dải header màu theme + 2 cột | Tùy chọn | `header`, `main`, `sidebar` |
| `timeline_v1` | Một cột, kinh nghiệm/học vấn dạng timeline | Tùy chọn | `header`, `main` |
| `compact_two_column_v1` | Hai cột đều, mật độ cao cho người nhiều kinh nghiệm | Không | `header`, `left`, `right` |

Bỏ 3 renderer cũ (D10 cho phép).

### 6.2 Bỏ header cứng

- Xóa nhánh dựng `<header>` cố định trong `CvDocumentPreview.jsx`. `nameplate`, `contact`, `avatar` trở thành section bình thường, đặt vào bất kỳ vùng nào layout cho phép.
- Mỗi template version có `default_layout_json` quyết định vị trí mặc định của chúng (ví dụ `sidebar_left_photo_v1`: avatar + contact ở `sidebar`, nameplate ở đầu `main`).
- Renderer tách theo layout và **lazy load** (`React.lazy` theo `layout_key`) để trang chi tiết mẫu chỉ tải layout đang xem.

### 6.3 Ứng viên tùy biến trong editor

- Kéo thả section giữa các vùng (chỉ vào vùng có `allowed` chứa section đó); bật/tắt; thêm section từ thư viện (gồm section theo vị trí).
- Kéo độ rộng cột trong khoảng `width` của contract.
- Đổi màu (giữ D-màu hiện có), font (danh sách allowlist), cỡ chữ, khoảng cách dòng.
- Đổi template trong editor giữ nguyên nội dung; section không vùng nào nhận được đưa vào `hidden_section_instance_ids` và hiện cảnh báo "Mẫu mới không hiển thị: …".

### 6.4 PDF khớp với preview

Rủi ro lớn nhất của 8 layout là viết mỗi layout hai lần (React + Django template). Đề xuất:

- **Phương án A (khuyên dùng):** xuất PDF bằng headless Chromium (Playwright trong worker Celery) render chính trang `/cvs/:id/print` của frontend. Một renderer duy nhất, khớp tuyệt đối. Chi phí: image worker nặng hơn (~400 MB), mỗi PDF ~1–2 s.
- **Phương án B:** giữ WeasyPrint, viết song song template Django cho từng layout, kèm golden test so ảnh trang đầu (pixel diff ≤ 2%).

**Đã chốt A (CVT-2).** Trang in là entry riêng `cv-print.html` của frontend (không qua router/đăng nhập); worker đưa document vào bằng `page.evaluate`, ảnh nhúng `data:`, trang chỉ được tải tài nguyên cùng origin. Đo trên máy dev: ~0,2 s/PDF khi Chromium đã chạy, ~0,9 s lần đầu; image backend tăng do Chromium headless shell.

---

## 7. Luồng ứng viên

### 7.1 Trang chi tiết mẫu

**Đường dẫn và trạng thái URL** (D7, D8):

| Path | Ngôn ngữ mặc định |
| --- | --- |
| `/mau-cv/chi-tiet/:slug` | `vi` |
| `/mau-cv-tieng-anh/chi-tiet/:slug` | `en` |

Bỏ `/mau-cv-tieng-nhat`, `/mau-cv-tieng-trung`, `/mau-cv/ngon-ngu/:locale` → redirect 301 về `/mau-cv` (SEO shell backend giữ slug mẫu: `/mau-cv-tieng-nhat/chi-tiet/x` → `/mau-cv/chi-tiet/x`; điều hướng trong SPA dùng `Navigate replace`). Đã làm ở CVT-0.

Query string (tiếng Việt không dấu, ngắn, chỉ dữ liệu không nhạy cảm):

| Tham số | Giá trị | Mặc định |
| --- | --- | --- |
| `nguon` | `mau`, `cv-cu`, `tai-len`, `trong` | `mau` |
| `vi-tri` | slug `CvPositionProfile` | vị trí đầu tiên theo `sort_order` hoặc vị trí liên quan danh mục mẫu |
| `kinh-nghiem` | `entry`, `junior`, `mid`, `senior` | `junior` |
| `ngon-ngu` | `vi`, `en` | theo path |
| `mau` | slug `CvColor` | màu mặc định của template |

- **Không** đưa `public_id` CV cũ, tên file upload hay bất kỳ dữ liệu người dùng nào lên URL. Với `nguon=cv-cu`, CV được chọn nằm trong state; mặc định CV cập nhật gần nhất.
- Đổi lựa chọn dùng `setSearchParams(…, { replace: true })` để không làm đầy lịch sử trình duyệt.
- Tham số sai hoặc không tồn tại → bỏ qua, dùng mặc định, sửa URL về giá trị hợp lệ.

**Tiêu đề đồng bộ:**

| Lựa chọn | H1 / breadcrumb cuối / `<title>` |
| --- | --- |
| `nguon=mau` | `Mẫu CV {Vị trí} {ngôn ngữ} - {Tên mẫu}` (ngôn ngữ theo `ngon-ngu`) |
| Nguồn khác | `Mẫu CV {ngôn ngữ của path} - {Tên mẫu}` |

Breadcrumb: `Trang chủ / Mẫu CV {tiếng Việt|tiếng Anh} / {Danh mục đầu tiên} / {H1}`. `<link rel="canonical">` luôn là path gốc không có query (tránh trùng lặp nội dung SEO). Mọi trang có query được `noindex` nếu khác mặc định.

**Bố cục trang** (desktop ≥ `lg`): trái 7/10 preview A4 fit-zoom, phải 3/10 panel cố định (sticky). Mobile: preview trên, panel thành bottom sheet có nút "Tạo CV" luôn hiển thị; chọn màu chuyển xuống dưới H1, cuộn ngang.

**Panel "Bạn muốn tạo CV từ?"** — 4 nguồn, bỏ "Khôi phục bản chưa lưu":

1. **Nội dung mẫu gợi ý** (mặc định, mở sẵn): ô chọn vị trí có tìm kiếm không dấu, nhóm theo ngành, ghim 8 vị trí phổ biến; chọn nhóm kinh nghiệm (segmented, theo mục 5.6); công tắc VI/EN.
2. **CV đã tạo trước đó** (chỉ hiện khi đăng nhập vai trò ứng viên và có ≥ 1 CV): danh sách cuộn ảo, tối đa 50 CV gần nhất.
3. **Tải CV từ máy tính**: vùng kéo thả, chỉ nhận PDF/DOCX ≤ 5 MB; kiểm tra phía client trước khi upload; chưa đăng nhập → bấm vào nguồn này mở hộp đăng nhập ngay (file không giữ được qua redirect).
4. **Tạo CV trống**.

Nút cuối panel: **Tạo CV** (chính), **Quay lại danh sách mẫu** (phụ).

### 7.2 State và sửa lỗi preview (H2)

Viết lại `use-cv-source.js` thành:

- `use-template-selection.js`: đọc/ghi URL search params → object `selection` thuần (nguồn, vị trí, cấp độ, ngôn ngữ, màu). Nguồn sự thật duy nhất là URL.
- Truy vấn bằng TanStack Query (đã có trong dự án), không tự quản lý `useEffect` + `AbortController`:
  - `useQuery(['cv-positions', lang, q])` — `staleTime` 10 phút.
  - `useQuery(['cv-preview', templateVersionId, source, position, level, lang])` — `placeholderData: keepPreviousData` để preview cũ vẫn hiển thị (mờ nhẹ) trong lúc tải bản mới, không nháy trắng.
  - Màu **không** nằm trong query key: áp `theme_color` phía client bằng CSS variable → đổi màu tức thì, không gọi API.
- Không có effect "reset khi đổi template": state nằm trong URL nên đổi `slug` là trạng thái mới tự nhiên.
- Test hồi quy: render trang với `locales`/`session` resolve trễ (mock delay) → preview phải hiện mà không cần thao tác.

### 7.3 Tạo CV

| Nguồn | Hành động khi bấm Tạo CV | Đích |
| --- | --- | --- |
| Mẫu gợi ý | `POST /api/v2/cvs/` với `{template, language, theme_color, source: sample, position, band}` | `/cvs/:id/edit?mode=create` |
| CV cũ | `POST /api/v2/cvs/` với `{…, source: copy, source_cv}` (nội dung copy sang CV mới, CV cũ không đổi) | như trên |
| Trống | `POST /api/v2/cvs/` với `{…, source: blank}` | như trên |
| Upload | mục 8 | `/cvs/:id/import-review` |

- Chưa đăng nhập: mở hộp đăng nhập; sau khi đăng nhập quay lại đúng URL (query string giữ toàn bộ lựa chọn) và tự bấm Tạo CV một lần.
- Chưa xác thực email hoặc không phải vai trò ứng viên: thông báo như hiện tại.
- Chống bấm hai lần: khóa nút + `Idempotency-Key` (đã có cho import, mở rộng sang create).
- Tên CV mặc định: `CV {Vị trí} – {Tên mẫu}`.

### 7.4 Kho mẫu `/mau-cv`

- Bộ lọc: danh mục style, vị trí (lọc mẫu được gắn vị trí), có ảnh/không ảnh, số cột; công tắc ngôn ngữ chuyển giữa hai path.
- Thẻ mẫu: thumbnail WebP theo màu, `loading="lazy"`, `width/height` cố định chống layout shift; hover đổi màu bằng swap ảnh đã có sẵn.
- Phân trang vô hạn (`useInfiniteQuery`), 24 mẫu/trang.

---

## 8. Upload CV và trích xuất

### 8.1 Luồng

```text
Chọn file ─► kiểm tra client (đuôi, MIME, ≤5 MB)
         ─► (lần đầu) hộp đồng ý xử lý AI ─► Bấm Tạo CV
         ─► POST /api/v2/cvs/imports/  (multipart, Idempotency-Key)   ← 202 + job id
         ─► Worker: quarantine/ClamAV → trích text → che PII → AI → hợp nhất → compose theo template đã chọn
         ─► job = awaiting_review ─► /cvs/:id/import-review
         ─► Ứng viên rà soát/sửa ─► Xác nhận ─► /cvs/:id/edit
```

Tiến trình hiển thị theo bước thật từ job: `Đang tải lên (x%)` → `Kiểm tra an toàn` → `Đọc nội dung` → `Phân tích bằng AI` → `Điền vào mẫu`. Poll `GET /api/v2/cvs/imports/:job/` với backoff 1 s → 2 s → 3 s, dừng khi tab ẩn (`document.visibilityState`), tối đa 90 s rồi chuyển sang "Chúng tôi sẽ thông báo khi xong" (thông báo trong notification center).

### 8.2 Che PII trước khi gửi AI (D6)

1. Regex/thư viện tách: email, số điện thoại VN/quốc tế, URL (LinkedIn, GitHub, portfolio), ngày sinh, số CMND/CCCD (12 số), địa chỉ nhà (heuristic theo từ khoá "Địa chỉ", "Address").
2. Thay bằng token `⟦EMAIL_1⟧`, `⟦PHONE_1⟧`, `⟦URL_1⟧`… trước khi gửi.
3. AI trả JSON có token → hệ thống thay token về giá trị thật phía server.
4. CCCD/CMND bị **loại bỏ hẳn**, không đưa vào CV.
5. Tên người không che được tin cậy bằng regex → chấp nhận gửi tên (ghi rõ trong hộp đồng ý).

### 8.3 Trích xuất bằng AI

- Chuyển `apps/ai_core/services/cv_import.py` sang đi qua runtime `ai_core`: ghi `AiInvocation`, tôn trọng `AI_RUNTIME_ENABLED`, quota ngày theo người dùng và toàn hệ thống (`ai_daily_request_limit` đang seed mà chưa dùng).
- Structured output theo JSON schema cố định (không cho mô hình tự do): `personal_info`, `summary`, `experience[]`, `education[]`, `skills[]`, `languages[]`, `certifications[]`, `projects[]`, `awards[]`, `activities[]`, `unmapped_text[]`, `suggested_position_slug`, `experience_years`, `position_level`, `education_level`, `skills[].skill_id`/`name`/`level`, và `confidence` (0–1) cho từng trường.
- Prompt gồm danh sách `CvPositionField` của vị trí được gợi ý để AI điền trường riêng nếu có.
- Văn bản CV được đặt trong khối dữ liệu có ranh giới rõ; output luôn qua validator `apps/cvs/schemas.py`. Mọi chỉ dẫn nằm trong CV (prompt injection) không có tác dụng vì output chỉ là dữ liệu đã kiểm tra kiểu.
- Ngôn ngữ: phát hiện ngôn ngữ CV gốc; nếu khác ngôn ngữ đã chọn thì **giữ nguyên văn bản gốc**, đặt `language` CV theo ngôn ngữ gốc và báo cho ứng viên (không dịch — ngoài phạm vi).
- Fallback heuristic hiện có giữ lại khi provider lỗi/thiếu key, đánh dấu toàn bộ trường `confidence = 0.3`.
- Không bao giờ mất chữ: mọi đoạn AI không phân loại được vào `unmapped_text`, hiện ở màn rà soát.

### 8.4 Màn rà soát `/cvs/:id/import-review`

- Trái: form theo section, mỗi trường có huy hiệu `Cần kiểm tra` khi `confidence < 0.7`; trường bắt buộc còn trống được tô viền. Khối "Nội dung chưa phân loại" cho phép kéo/copy vào section.
- Phải: preview trực tiếp bằng template và màu đã chọn (cùng renderer với editor).
- Gợi ý vị trí: "Chúng tôi nhận thấy bạn là **Kỹ sư AI** – thêm mục *Thông tin chuyên môn*?" (thêm section `position_details` + trường riêng).
- Nút: **Xác nhận và chỉnh sửa** (lưu version `imported`, chuyển editor), **Hủy** (xóa CV vừa tạo, hỏi xác nhận).
- Rời trang khi chưa xác nhận: CV vẫn nằm trong "CV của tôi" với nhãn "Chờ rà soát".

### 8.5 Lưu giữ dữ liệu

| Dữ liệu | Thời hạn |
| --- | --- |
| File gốc | Xóa ngay khi job thành công; job lỗi giữ ≤ 24 h cho retry, sau đó task định kỳ xóa |
| Văn bản thô, văn bản đã che | Chỉ trong bộ nhớ worker, không lưu DB, không log |
| Response AI | Không lưu; `AiInvocation` chỉ lưu token count, latency, mã lỗi |
| Kết quả trích xuất | Nằm trong `CvDraft` của chính CV (người dùng sở hữu, xóa được) |

---

## 9. Cổng quản trị (làm lại hoàn toàn)

Xóa `widgets/admin-cv-catalogue` và route `cv-catalogue` cũ. Thay bằng nhóm menu **Mẫu CV** gồm 6 trang, theo nguyên tắc admin gọn (nút quay lại nhỏ căn trái, alert một dòng, nội dung chính lên trên fold).

### 9.1 Tổng quan `/admin/cv/overview`

- Ô số liệu: số template đang xuất bản, CV tạo trong 7/30 ngày, tỉ lệ "xem chi tiết mẫu → tạo CV", tỉ lệ import thành công, chi phí AI tháng.
- Bảng **Top mẫu** theo lượt dùng và tỉ lệ chuyển đổi.
- **Cảnh báo việc cần làm**: vị trí chưa có nội dung mẫu cho cấp độ/ngôn ngữ nào, nội dung chờ duyệt, template có version nháp quá 7 ngày, thumbnail lỗi.

### 9.2 Mẫu CV `/admin/cv/templates`

- Lưới thẻ có thumbnail (chuyển được sang bảng), lọc theo trạng thái/layout/danh mục, tìm theo tên, sắp xếp kéo thả `sort_order`.
- Hành động nhanh: xem trước, nhân bản, ẩn/hiện, lưu trữ.
- **Wizard tạo/sửa** (lưu nháp tự động mỗi bước):
  1. **Thông tin**: tên VI/EN, mô tả, slug (tự sinh), danh mục, tags, ngôn ngữ hỗ trợ.
  2. **Bố cục**: chọn 1 trong 8 layout từ thư viện có ảnh minh hoạ.
  3. **Section**: mỗi vùng là một cột kéo thả; đánh dấu bắt buộc/mặc định bật; độ rộng cột mặc định.
  4. **Phong cách**: chọn 3–8 màu từ thư viện màu, màu mặc định, font, cỡ chữ, khoảng cách, kiểu tiêu đề section.
  5. **Xem trước**: chọn vị trí/cấp độ/ngôn ngữ/màu bất kỳ → render thật; nút "Xuất PDF thử".
  6. **Xuất bản**: checklist tự động (đủ tên 2 ngôn ngữ, có ≥ 1 màu, thumbnail sinh xong, PDF thử thành công, không section nào bị ẩn với nội dung mẫu phổ biến) → Publish.
- Sửa template đã xuất bản tạo **version nháp mới**; CV cũ vẫn ghim version cũ. Trang chi tiết có tab **Lịch sử version** (ai publish, khi nào, khác gì).

### 9.3 Vị trí & nội dung mẫu `/admin/cv/positions`

- Danh sách vị trí nhóm theo ngành, cột **độ phủ**: ma trận nhỏ 4 nhóm kinh nghiệm × 2 ngôn ngữ, ô xanh = đã xuất bản, vàng = nháp/chờ duyệt, xám = dùng nội dung chung.
- Trang chi tiết vị trí có 3 tab:
  - **Bộ section**: kéo thả thứ tự, bật/tắt, gợi ý vùng chính/phụ.
  - **Trường riêng**: CRUD `CvPositionField`, preview form ứng viên sẽ thấy.
  - **Nội dung mẫu**: lưới cấp độ × ngôn ngữ; mỗi ô mở editor có cấu trúc (dùng lại form của editor ứng viên, không sửa JSON) + preview.
- **Sinh bằng AI hàng loạt** (D4): chọn nhiều vị trí × cấp độ × ngôn ngữ → xác nhận số lượt và chi phí ước tính → job Celery → nội dung vào trạng thái `in_review` → hàng đợi duyệt (preview cạnh nội dung, nút Duyệt / Sửa / Sinh lại).
- Import/export JSON cho cả vị trí (bộ section + trường + nội dung) để chuyển giữa môi trường.

### 9.4 Thư viện `/admin/cv/library`

- Màu (tên, hex, kiểm tra tương phản WCAG AA với chữ trắng/đen), danh mục (style/feature/audience), hình nền. Chặn xóa mục đang được dùng, hiển thị số template dùng.

### 9.5 CV ứng viên `/admin/cv/user-cvs`

Quản lý ở mức **metadata** để bảo vệ ứng viên:

- Bảng: mã CV, mã ứng viên (không hiện email mặc định), template, ngôn ngữ, nguồn tạo, trạng thái, ngày tạo/cập nhật, số lần dùng ứng tuyển.
- Lọc theo template/nguồn/trạng thái import lỗi — phục vụ thống kê và hỗ trợ.
- Xem nội dung CV chỉ khi có quyền `cv_user.view_content`, phải nhập lý do; mỗi lần xem ghi audit log (người xem, lý do, thời điểm). Không có thao tác sửa nội dung CV của ứng viên.
- Hành động: khóa CV vi phạm (ẩn khỏi chia sẻ công khai), xem job import lỗi (chỉ mã lỗi).

### 9.6 Phân quyền

| Permission | Cho phép |
| --- | --- |
| `cv_template.view` | Xem mọi trang Mẫu CV |
| `cv_template.manage` | Tạo/sửa template, thư viện, vị trí, trường |
| `cv_template.publish` | Xuất bản/lưu trữ template và nội dung mẫu |
| `cv_content.generate_ai` | Chạy sinh nội dung bằng AI |
| `cv_user.view` | Xem metadata CV ứng viên |
| `cv_user.view_content` | Xem nội dung CV ứng viên (có audit) |

Cập nhật `apps/accounts/constants/admin_permissions.py`, `admin_departments.py`, `entities/admin-access/model/module-labels.js` và test `test_admin_access*.py`.

---

## 10. API (đề xuất, tiền tố `/api/v2/`)

### 10.1 Public / ứng viên

| Method | Path | Mô tả | Cache |
| --- | --- | --- | --- |
| GET | `cv-templates/?lang=&category=&position=&has_photo=&page=` | Danh sách mẫu | public, 5 phút, ETag |
| GET | `cv-templates/{slug}/?lang=` | Chi tiết mẫu + màu + layout key + version id | public, 5 phút, ETag |
| GET | `cv-templates/{slug}/related/` | Mẫu liên quan | public, 5 phút |
| GET | `cv-positions/?lang=&q=` | Vị trí (nhóm ngành, slug, tên, phổ biến) | public, 10 phút |
| GET | `cv-templates/{slug}/preview/?position=&level=&lang=` | Document xem trước từ nội dung mẫu (hoặc trống nếu không có `position`) | public, 10 phút, key theo version + revision nội dung |
| GET | `cvs/{id}/template-preview/?template=` | Xem CV cũ trên mẫu mới | `private, no-store`, chủ sở hữu |
| POST | `cvs/` | Tạo CV từ `sample`/`copy`/`blank` | Idempotency-Key |
| POST | `cvs/imports/` | Upload + tạo job | throttle `cv_import` 10/giờ |
| GET | `cvs/imports/{job}/` | Trạng thái + bước hiện tại | `no-store` |
| POST | `cvs/imports/{job}/retry/` | Thử lại (≤ 3 lần) | |
| GET | `cvs/{id}/import-review/` | Document + `extraction_summary` | `no-store` |
| POST | `cvs/{id}/import-review/confirm/` | Xác nhận, tạo version `imported` | |
| DELETE | `cvs/{id}/` | Hủy CV khi rà soát | |
| POST | `cvs/assets/` (`kind=avatar`) | Upload ảnh đại diện | |

Xóa: `cv-sample-contents/` public, `cv-position-preview/`, endpoint recoverable draft, `admin/cv-template-localizations/`, `admin/cv-content-blueprints/`.

### 10.2 Admin (`/api/v2/admin/`)

| Path | Hành động |
| --- | --- |
| `cv-layouts/` | GET registry layout (chỉ đọc) |
| `cv-templates/` | CRUD, `?status=&layout=&q=` |
| `cv-templates/{id}/versions/` | GET lịch sử, POST tạo version nháp |
| `cv-templates/{id}/versions/{n}/` | PATCH (chỉ khi nháp) |
| `cv-templates/{id}/versions/{n}/publish/` | POST, kiểm tra checklist |
| `cv-templates/{id}/preview/` | POST cấu hình nháp → document xem trước |
| `cv-templates/{id}/test-pdf/` | POST → job xuất PDF thử |
| `cv-templates/reorder/` | POST danh sách id |
| `cv-positions/`, `cv-positions/{id}/fields/` | CRUD |
| `cv-positions/coverage/` | Ma trận độ phủ cho mọi vị trí (1 query tổng hợp) |
| `cv-sample-contents/` | CRUD, `?position=&band=&lang=&status=` |
| `cv-sample-contents/generate/` | POST batch → job id |
| `cv-sample-contents/{id}/review/` | POST `approve` / `reject` |
| `cv-positions/export/`, `cv-positions/import/` | JSON |
| `cv-colors/`, `cv-categories/`, `cv-backgrounds/` | CRUD |
| `cv-stats/overview/` | Số liệu trang tổng quan |
| `user-cvs/`, `user-cvs/{id}/` , `user-cvs/{id}/content/` (cần lý do) | Metadata / nội dung có audit |

Mọi endpoint danh sách giữ số query phẳng — thêm case vào `tests/test_query_budget.py`. Cập nhật `docs/04-api/openapi.yaml` và `tai-lieu-api.md`.

---

## 11. Hiệu năng

| Chỉ số | Mục tiêu | Cách đạt |
| --- | --- | --- |
| LCP trang chi tiết mẫu (4G, mobile) | < 2,5 s | SSR không có → ưu tiên: preload JSON chi tiết + ảnh preview màu mặc định (`fetchpriority="high"`), skeleton A4 đúng tỉ lệ |
| Đổi màu | < 50 ms | CSS variable phía client, không gọi API |
| Đổi vị trí/cấp độ (đã cache) | < 100 ms | TanStack Query cache + prefetch khi hover/focus vị trí |
| Đổi vị trí/cấp độ (chưa cache) | p95 < 600 ms | Endpoint preview cache Redis theo `(version, sample revision, lang)`; `keepPreviousData` |
| CLS | < 0,05 | Kích thước cố định cho preview, thumbnail |
| JS tải thêm cho trang chi tiết | < 120 KB gzip | Lazy load renderer theo layout, panel upload và màn rà soát tách chunk riêng |
| Import CV p50 / p95 | < 15 s / < 40 s | Text extraction nhanh, một lượt AI với structured output, model flash |
| Admin danh sách template/vị trí | < 300 ms server | Query budget, annotate độ phủ bằng một query `GROUP BY` |

Thêm:

- Thumbnail và preview WebP sinh sẵn theo từng màu (task snapshot đã có), `srcset` 1x/2x.
- Font CV tự host, subset Latin + Vietnamese, `font-display: swap`.
- Danh sách vị trí dài dùng virtual list; tìm kiếm debounce 200 ms, so khớp không dấu phía client khi dữ liệu < 500 mục.
- Invalidate cache preview khi publish template version hoặc nội dung mẫu (signal sau commit).

---

## 12. Bảo mật và quyền riêng tư

| # | Biện pháp |
| --- | --- |
| S1 | Endpoint public chỉ trả nội dung mẫu hư cấu; không bao giờ trả dữ liệu ứng viên |
| S2 | Preview CV cũ, import, rà soát: chỉ chủ sở hữu (`IsCandidateOwner`), `Cache-Control: private, no-store`; test IDOR cho từng endpoint (đọc, sửa, xóa, retry của người khác → 404) |
| S3 | URL không chứa PII hay id CV; log truy cập không ghi query của endpoint CV cá nhân |
| S4 | Upload: kiểm tra signature, ≤ 5 MB, ≤ 20 trang, quarantine + ClamAV (luồng `upload_claims` hiện có), storage private, key ngẫu nhiên, URL ký TTL ngắn |
| S5 | Che PII trước khi gửi AI (mục 8.2); hộp đồng ý lần đầu ghi `consent_at`; có thể rút đồng ý trong cài đặt quyền riêng tư (`apps/privacy`) |
| S6 | Output AI chỉ là dữ liệu qua validator; rich text qua `@/shared/lib/sanitize-html` (DOMPurify) khi render |
| S7 | Ảnh đại diện: bỏ EXIF/GPS, resize, phục vụ qua URL ký; chỉ hiện trong CV chủ sở hữu, link chia sẻ, hoặc snapshot ứng tuyển |
| S8 | Admin xem nội dung CV ứng viên cần quyền riêng + lý do + audit log |
| S9 | Nội dung mẫu sinh bằng AI phải qua validator chặn email/SĐT ngoài allowlist mẫu |
| S10 | Throttle: `cv_import` 10/giờ, `cv_create` 30/giờ, `cv_preview` public 120/phút/IP; quota AI theo người dùng/ngày |
| S11 | Xóa CV hoặc tài khoản → xóa asset, draft, version, job import liên quan (trừ snapshot ứng tuyển đã gửi theo chính sách hiện hành) |

---

## 13. Lộ trình triển khai

Ước lượng cho 1 lập trình viên full-stack, đơn vị ngày làm việc. Mỗi giai đoạn là một nhánh + PR riêng vào `dev`, phải xanh toàn bộ lệnh kiểm tra ở mục 14.4.

| GĐ | Tên | Ước lượng | Phụ thuộc |
| --- | --- | --- | --- |
| CVT-0 | Sửa lỗi nhanh trên hệ hiện tại | 2–3 | — |
| CVT-1 | Nền tảng dữ liệu, reset và seed | 3–4 | CVT-0 |
| CVT-2 | Hệ thống layout + PDF | 6–8 | CVT-1 |
| CVT-3 | Vị trí, trường riêng, nội dung mẫu, sinh AI | 5–6 | CVT-1 |
| CVT-4 | Cổng quản trị mới | 7–9 | CVT-2, CVT-3 |
| CVT-5 | Trang chi tiết mẫu + tạo CV ứng viên | 4–5 | CVT-2, CVT-3 |
| CVT-6 | Upload, trích xuất, màn rà soát | 5–6 | CVT-5 |
| CVT-7 | Hiệu năng, bảo mật, QA, tài liệu | 3–4 | tất cả |
| | **Tổng** | **35–45 ngày (~7–9 tuần)** | CVT-2 ∥ CVT-3 làm song song được |

### CVT-0 — Sửa lỗi nhanh

- **Đầu vào:** code hiện tại; ảnh lỗi người dùng cung cấp.
- **Công việc:**
  1. Sửa race condition preview (H2): bỏ `locales`, `user`, `onPreviewChange` khỏi deps của effect khởi tạo (dùng `user?.public_id`, `user?.role`), cho effect tải vị trí phụ thuộc thêm một `resetKey`; thêm test hồi quy dữ liệu đến trễ.
  2. Bỏ nguồn `restore` (UI, hook, `preview-selection`, API client, test).
  3. Đồng bộ H1/breadcrumb/`<title>` với vị trí đã chọn; đưa `nguon`, `vi-tri`, `mau` lên query string.
  4. Chỉ còn VI/EN: bỏ route Nhật/Trung/động (redirect về `/mau-cv`), backend từ chối locale khác ở endpoint tạo/preview.
- **Đầu ra:** PR nhỏ, không migration.
- **Nghiệm thu:** mở trang chi tiết lần đầu (đã/chưa đăng nhập) luôn thấy preview mẫu gợi ý trong ≤ 1,5 s; reload giữ lựa chọn; không còn mục "Khôi phục bản chưa lưu"; `/mau-cv-tieng-nhat` chuyển về `/mau-cv`.

### CVT-1 — Nền tảng dữ liệu

Tách hai PR để giữ dưới ngưỡng 60 file của quy trình PR:

- **CVT-1a — Ngôn ngữ (✅ gộp vào `dev`, PR #178 + #179):** enum
  `CvLanguage`; gộp `CvTemplateLocalization` vào trường song ngữ của
  `CvTemplate` bằng data migration; gỡ `sitecontent.Locale`, API locale, FK
  `locale_ref`, tab "Ngôn ngữ" ở admin và entity frontend `locale`; xóa dữ liệu
  mẫu/blueprint/taxonomy tiếng Nhật, Trung. **Không xóa CV người dùng**: các bước
  này không cần đến (điều chỉnh D10).
- **CVT-1b — Vị trí và nội dung mẫu (✅ PR #180):**
  `CvPositionProfile`, `ExperienceBand`, `CvSampleContent` theo
  `(position_profile, locale, experience_band)`, bỏ `CvContentBlueprint` (blueprint
  thành nội dung chung bằng data migration), resolver/picker/preview/tạo CV theo
  `experience_band`, viết lại seed (nội dung chung 4 nhóm × 2 ngôn ngữ, nội dung
  riêng 9 vị trí chuyên môn), gỡ tab/menu "Blueprint" và mục menu "Ngôn ngữ" còn
  sót từ CVT-1a. Danh sách 30 vị trí ưu tiên (I1) chưa có: hồ sơ được tạo cho mọi
  vị trí chuyên môn đang hoạt động.
- **CVT-1c — Trường matching và dọn legacy (✅ PR #181):** thêm
  `UserCv.experience_years` (giá trị `Job.ExperienceYears`) tính từ mục kinh nghiệm
  ở mỗi `create_version`, gợi ý việc làm theo CV dùng giá trị này; vị trí mục tiêu
  dùng `UserCv.position` có sẵn. Gỡ `UserCv.cv_data/style_config/status/
  current_version/raw_text/normalized_text/pdf_url/last_analyzed_at`,
  `CvTemplate.category/status/layout_config/style_config/thumbnail_url/preview_url`
  (ảnh lấy từ màu mặc định), `theme_color`/`color_variants` trên card, đầu vào
  `sample_content_public_id` khi tạo CV và endpoint chi tiết nội dung mẫu, adapter
  V1 (`canonicalize_legacy_cv_data`, `sync_legacy_builder_draft`,
  `update_builder_cv`). `position_level`/`education_level` chuyển sang CVT-3, khi
  form nhập liệu là nguồn dữ liệu.

Section mới và `schema_version 2` chuyển sang CVT-3, làm cùng form nhập liệu, để
không đăng ký section chưa có giao diện dùng.

- **Đầu vào:** quyết định D7, D10; `pg_dump` DB local.
- **Công việc:** như hai PR trên; seed: template hiện có, 30 vị trí ưu tiên, nội dung chung 4 nhóm kinh nghiệm × 2 ngôn ngữ, màu.
- **Đầu ra:** migration, lệnh `seed_cv_catalog` mới, test model/validator.
- **Nghiệm thu:** `makemigrations --check` sạch; seed chạy lại nhiều lần không lỗi (idempotent); resolver nội dung luôn trả kết quả cho mọi tổ hợp vị trí × cấp độ × ngôn ngữ.

### CVT-2 — Hệ thống layout và PDF

- **Đầu vào:** thiết kế tham khảo 8 layout (mục 16); spike PDF A/B.
- **Công việc:** layout registry BE/FE + test đồng bộ; bỏ header cứng; 8 renderer React lazy-load; avatar; editor kéo thả giữa vùng, kéo độ rộng cột; xuất PDF theo phương án đã chọn; sinh thumbnail theo màu.
- **Đầu ra:** renderer, contract, test golden ảnh từng layout (3 bộ nội dung: ngắn, trung bình, 3 trang).
- **Nghiệm thu:** mỗi layout render đúng ở preview, editor, PDF (sai lệch ≤ 2% pixel trang đầu); ngắt trang không cắt đôi dòng; nameplate/contact/avatar đặt được ở mọi vùng layout cho phép.
- **Thực hiện (✅ PR #182):** thay 8 component lazy bằng một renderer chung đọc registry (mỗi layout chỉ là dữ liệu: hàng, độ rộng, tone, cách xếp, biến thể), nên thêm layout không cần code React mới. Vì PDF in từ chính renderer đó, so pixel preview–PDF không còn cần: e2e `cv-print.spec.js` kiểm từng layout trên trang in (tỉ lệ cột, tên/ảnh đúng vùng, không tràn ngang, nội dung dài sang trang theo từng mục). Font chốt 4 font OFL tự host (I5). Thiết kế 8 layout do dev phác, người dùng duyệt qua ảnh chụp (I2).

### CVT-3 — Vị trí, trường riêng, nội dung mẫu

- **Đầu vào:** danh sách 30 vị trí ưu tiên + trường riêng mong muốn (mục 16).
- **Công việc:** service/selectors cho profile, field, resolver; section `position_details` trong editor (form sinh từ định nghĩa trường); service sinh nội dung mẫu qua runtime `ai_core` + job Celery batch + validator chống PII; import/export JSON.
- **Đầu ra:** API admin vị trí/nội dung, task sinh AI, test.
- **Nghiệm thu:** chọn "Kỹ sư phần mềm" và "Nhân viên kinh doanh" cho ra bộ section khác nhau và trường riêng khác nhau; sinh 8 nội dung (1 vị trí × 4 nhóm kinh nghiệm × 2 ngôn ngữ) trong < 2 phút, tất cả qua validator.
- **Thực hiện (🟨 xong code):** đạt cả hai tiêu chí (test `test_positions_get_different_section_sets_and_their_own_fields`; chạy thật 8 nội dung Sales Online xong trong ~13 giây). Điều chỉnh so với kế hoạch, để không phức tạp hơn mức cần: trường riêng là item của section `position_details` (dùng chung cơ chế item, id ổn định) thay vì mảng `fields`; document giữ `schema_version 1` vì chỉ bổ sung trường tùy chọn; kỹ năng khớp taxonomy theo tên chuẩn hóa/alias khi lưu version thay vì bắt ứng viên chọn `skill_id`; ngoại ngữ CEFR hoãn tới khi JD có yêu cầu ngoại ngữ; lượt sinh AI là model `CvSampleGeneration` để admin theo dõi theo `batch_id`; ràng buộc unique của nội dung mẫu chỉ áp cho bản xuất bản. Giao diện admin cho các API này làm ở CVT-4 (cổng hiện tại đã duyệt được bản AI).

### CVT-4 — Cổng quản trị mới

- **Đầu vào:** API từ CVT-2, CVT-3.
- **Công việc:** 6 trang mục 9; wizard 6 bước có autosave; ma trận độ phủ; hàng đợi duyệt AI; CV ứng viên có audit; permission mới; xóa widget/route cũ.
- **Đầu ra:** `widgets/admin-cv-*` mới, page admin, route, E2E.
- **Nghiệm thu:** một admin chưa từng dùng tạo và xuất bản template mới trong ≤ 10 phút (đo bằng thử nghiệm người dùng); không có màn nào yêu cầu sửa JSON thô; không cuộn ngang ở 1280 px; dùng được ở 768 px.
- **Thực hiện (🟨 xong code):** sau thử nghiệm, wizard 6 bước được thay bằng **một trang chỉnh sửa** (thiết lập bên trái gồm Thông tin, Bố cục, Màu & chữ, Các mục — thu gọn mặc định; xem trước dính bên phải; mọi thay đổi tự lưu vào bản nháp tạo tự động). Tạo mẫu chỉ hỏi tên VI/EN và bố cục; backend xếp sẵn mục theo bản đồ `section_plans` dùng chung với seed và gán 6 màu đầu thư viện, nên mẫu mới chỉ còn thiếu PDF thử là xuất bản được. Xuất bản qua hộp checklist có nút PDF thử ngay tại chỗ. Màn hẹp: thiết lập và xem trước là hai tab.

### CVT-5 — Trang chi tiết mẫu và tạo CV

- **Đầu vào:** layout và API vị trí.
- **Công việc:** mục 7 đầy đủ: URL state, TanStack Query, panel 4 nguồn, bottom sheet mobile, kho mẫu có bộ lọc mới, tạo CV có idempotency, quay lại đúng URL sau đăng nhập.
- **Nghiệm thu:** mọi tổ hợp lựa chọn phản ánh đúng ở preview, H1, breadcrumb, `<title>`, URL; đổi màu tức thì; đạt các mục tiêu hiệu năng mục 11 trên Lighthouse mobile.

### CVT-6 — Upload, trích xuất, rà soát

- **Đầu vào:** bộ 30 CV thật đã ẩn danh có nhãn chuẩn (mục 16).
- **Công việc:** mục 8 đầy đủ: hộp đồng ý, che PII, chuyển sang runtime `ai_core`, schema + độ tin cậy, gợi ý vị trí, màn rà soát, tiến trình từng bước, retention.
- **Nghiệm thu:** trên bộ 30 CV: ≥ 95% họ tên/email/SĐT đúng, ≥ 85% mục kinh nghiệm đúng công ty + chức danh + thời gian, 0 trường hợp mất nội dung (mọi chữ có mặt trong CV hoặc `unmapped_text`); request gửi AI không chứa email/SĐT (kiểm bằng test bắt payload); file gốc biến mất khỏi storage sau khi job thành công.

### CVT-7 — Hoàn thiện

- Đo và tối ưu theo mục 11; rà soát bảo mật theo mục 12 (`/security-review`); E2E đầy đủ; cập nhật tài liệu (mục 15); ghi tiến độ.
- **Nghiệm thu:** toàn bộ tiêu chí mục 14 đạt; `./scripts/check_all.sh` xanh.

---

## 14. Tiêu chí nghiệm thu và kiểm thử

### 14.1 Ma trận truy vết yêu cầu

| Yêu cầu gốc | Giải pháp | GĐ | Kiểm chứng |
| --- | --- | --- | --- |
| Chỉ còn tiếng Việt, tiếng Anh | D7, mục 5.1, 7.1 | CVT-0, CVT-1 | Route cũ redirect; API từ chối `ja`/`zh`; test enum |
| Preview lỗi phải bấm qua lại | Mục 7.2 | CVT-0, CVT-5 | Test hồi quy dữ liệu đến trễ; E2E mở trang lần đầu |
| Bỏ khôi phục bản chưa lưu | Mục 7.1 | CVT-0 | E2E không còn nguồn `restore` |
| Title, path, preview đồng bộ cột phải | Mục 7.1 | CVT-0, CVT-5 | E2E đổi vị trí → kiểm H1, `<title>`, URL, preview |
| Vị trí có trường khác nhau | Mục 5.3, 9.3 | CVT-3 | Test 2 vị trí khác bộ section/trường |
| Admin chuẩn, dễ dùng, hiệu quả | Mục 9 | CVT-4 | Thử nghiệm ≤ 10 phút; ma trận độ phủ; không JSON thô |
| Khung CV đa dạng | Mục 6 | CVT-2 | Golden test 8 layout |
| Giữ chọn màu | Mục 7.2 | CVT-5 | Đổi màu < 50 ms, màu lưu vào `style_json` |
| Upload → trích xuất → điền vào mẫu | Mục 8 | CVT-6 | Bộ 30 CV, chỉ số mục CVT-6 |
| Tốc độ tốt | Mục 11 | CVT-5, CVT-7 | Lighthouse, đo p95 API |
| Không lộ thông tin ứng viên | Mục 12 | Mọi GĐ | Test IDOR, test payload AI, `/security-review` |

### 14.2 Kiểm thử tự động

- **Backend (pytest):** model/validator schema v2; resolver nội dung (mọi nhánh fallback); compose với 8 layout; publish version bất biến; che PII (bảng case email/SĐT/URL/CCCD); import job (thành công, lỗi provider → heuristic, timeout, retry, retention); permission admin; IDOR; query budget cho danh sách template, vị trí, độ phủ, CV ứng viên.
- **Frontend (vitest):** `use-template-selection` (URL ↔ state, tham số sai); panel nguồn; form trường riêng sinh từ định nghĩa; màn rà soát (huy hiệu độ tin cậy, unmapped text); wizard admin từng bước.
- **E2E (Playwright, thêm vào smoke):** ẩn danh xem mẫu → đổi vị trí/màu → Tạo CV → đăng nhập → vào editor đúng lựa chọn; ứng viên upload CV mẫu → rà soát → editor; admin tạo template qua wizard → xuất hiện ở kho mẫu; viewport mobile 375 px cho trang chi tiết và rà soát.
- **Visual regression:** ảnh trang đầu 8 layout × 3 bộ nội dung.

### 14.3 Kiểm thử thủ công / UAT

- 3 ứng viên thật thử luồng tạo CV từ mẫu và upload, ghi thời gian và điểm khó.
- 1 người không phải dev thử wizard admin.

### 14.4 Lệnh bắt buộc trước mỗi PR

```bash
cd backend && ruff check . && ruff format --check . && lint-imports && python manage.py makemigrations --check --dry-run && pytest --cov --cov-fail-under=84
```

```bash
cd frontend && npm run lint && npm run check:architecture && npm run test:coverage && npm run build && npm run test:e2e:smoke
```

Hoặc `./scripts/check_all.sh`. Lệnh `manage.py` chạy qua `docker exec` để không vào nhầm Postgres trên host.

---

## 15. Tài liệu cần cập nhật khi hoàn tất

- `docs/02-tong-quan/cv-builder-architecture-foundation.md`: layout registry, ngôn ngữ enum, vị trí, import có rà soát, PDF.
- ADR mới `adr-0017-cv-template-v3.md`: lý do bỏ locale động, bỏ dữ liệu cũ, phương án PDF.
- `docs/03-database/thiet-ke-database.md` mục 7.
- `docs/04-api/openapi.yaml`, `tai-lieu-api.md`.
- `docs/05-huong-dan/`: hướng dẫn quản trị Mẫu CV (có ảnh chụp wizard).
- `docs/07-algorithms/thuat-toan-ai.md`: trích xuất CV, che PII, sinh nội dung mẫu.
- `docs/TIEN-DO-DU-AN.md` sau từng giai đoạn; `CHANGELOG.md`.

---

## 16. Đầu vào cần chủ dự án cung cấp

| # | Đầu vào | Cần trước |
| --- | --- | --- |
| I1 | Danh sách 30 vị trí ưu tiên và trường riêng mong muốn cho ~10 vị trí chính | CVT-1 |
| I2 | Ảnh tham khảo/phác thảo cho 8 layout (có thể chọn từ các CV đẹp bạn thích) | CVT-2 |
| I3 | Bộ 30 CV thật (PDF/DOCX, đa dạng ngành, cả tiếng Anh), đã xin phép hoặc ẩn danh, kèm kết quả đúng mong muốn | CVT-6 |
| I4 | API key AI và ngân sách tháng (để đặt quota) | CVT-3 |
| I5 | Font được phép dùng (license) | CVT-2 |
| I6 | Nội dung hộp đồng ý xử lý AI (có thể dùng bản nháp do dev soạn) | CVT-6 |

---

## 17. Rủi ro và giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| Preview và PDF lệch nhau khi có 8 layout | Cao | Spike A/B đầu CVT-2; golden test bắt buộc |
| AI trích xuất sai/thiếu | Cao | Màn rà soát, độ tin cậy, `unmapped_text`, bộ 30 CV đánh giá trước khi bật |
| Chi phí AI vượt dự kiến (import + sinh nội dung mẫu) | Trung bình | Qua runtime `ai_core` có quota; ước tính chi phí trước khi chạy batch; model flash |
| Phạm vi lớn, kéo dài | Trung bình | Giai đoạn độc lập, mỗi giai đoạn ra được bản dùng; CVT-0 giao giá trị ngay |
| Xóa dữ liệu nhầm môi trường | Trung bình | Migration xóa chỉ chạy khi có cờ môi trường; `pg_dump` trước; ghi rõ trong ADR |
| Trường riêng làm document phình to | Thấp | Giới hạn 20 trường/vị trí, độ dài từng giá trị; validator kích thước JSON hiện có |
| Bot gọi endpoint preview public | Thấp | Cache + throttle theo IP |

---

## 18. Chỉ số đo sau khi phát hành

| Chỉ số | Cách đo | Mục tiêu |
| --- | --- | --- |
| Tỉ lệ xem chi tiết mẫu → tạo CV | event analytics | tăng ≥ 30% so với trước CVT-0 |
| Thời gian từ vào trang mẫu đến vào editor | event | trung vị < 30 s |
| Tỉ lệ import thành công | `CvImportJob` | ≥ 90% (trừ PDF scan) |
| Tỉ lệ trường bị sửa ở màn rà soát | so sánh trước/sau xác nhận (chỉ đếm số trường, không lưu nội dung) | < 20% |
| Độ phủ nội dung mẫu | ma trận admin | 100% vị trí ưu tiên × 4 nhóm kinh nghiệm × 2 ngôn ngữ |
| Thời gian admin xuất bản template | log wizard | < 10 phút |

---

## 19. Câu hỏi còn mở

1. ~~Phương án PDF A hay B~~ — đã chốt A (Chromium) ở CVT-2.
2. Có hiển thị số lượt dùng mẫu ("1.2k người đã dùng") trên kho mẫu không.
3. Có cho ứng viên lưu "vị trí mục tiêu" vào hồ sơ để mặc định chọn sẵn ở trang mẫu không (liên quan onboarding).
