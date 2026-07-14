# CV Builder — Architecture Foundation

Triển khai này chốt contract V1 cho CV Builder. Đây là nền tảng backend, chưa
bao gồm Builder UI, kéo-thả nâng cao, PDF worker, shared link hoặc AI.

## Canonical document

Mỗi `CvVersion` và `CvDraft` lưu đúng ba JSON tách biệt:

- `content_json`: PII, section instance và item instance ổn định; không chứa
  CSS, component hoặc logic render.
- `layout_json`: khổ trang, region và thứ tự `section_instance_ids`.
- `style_json`: màu, font, tỷ lệ và override presentation an toàn.

Mọi document có `schema_version = 1`. Validator backend giới hạn kích thước,
section key, ID trùng, region/layout, font/màu và rich text (`rich_text_v1` với
block text an toàn); HTML tùy ý bị từ chối.

## Ownership và bất biến

`UserCv` vẫn là aggregate mutable/metadata. Mỗi CV builder có một `CvDraft`
autosave mutable (optimistic `lock_version`) và các `CvVersion` bất biến.
`Application.submitted_cv_version` luôn trỏ đến một version kind
`application_snapshot`; recruiter không được suy luận nội dung từ `Application.cv`.

`CvTemplate` giữ identity/catalogue. `CvTemplateVersion` lưu renderer key,
renderer version, schema/layout/style defaults và capabilities. Component không
được lưu trong database: `renderer_key` chỉ map tới renderer đã deploy trong
`apps.cv_templates.renderers`.

Sau khi một `CvTemplateVersion` được published, ORM không cho sửa renderer,
schema, layout/style/default/capability hoặc section của version đó; chỉ được
chuyển version sang `retired`. Vì vậy CV đã ghim version sẽ không thay đổi cách
render do một lần chỉnh template sau này.

`CvSectionDefinition` là registry DB, được seed từ registry code
template-agnostic. `CvTemplateSection` chỉ cấu hình section theo region/version,
không định nghĩa một schema content riêng cho từng template.

## Rollout migration

1. **Expand**: migrations thêm bảng version/draft/template registry và các FK
   mới; field legacy (`cv_data`, `style_config`, `status`, template layout/style
   và `Application.cv`) không bị xóa.
2. **Backfill**: template cũ có version 1/localization/category relation; CV cũ
   có baseline version/draft; application cũ có `application_snapshot` theo dữ
   liệu tốt nhất tại thời điểm migration.
3. **Switch / dual write**: create/update builder V1 vẫn ghi legacy data và
   mirror sang draft V2; create application tạo snapshot V2 trong transaction.
4. **Contract**: `submitted_cv_version` chỉ thành NOT NULL sau backfill. Không
   contract/xóa cột legacy trong release này; chỉ thực hiện sau khi API V2 và
   renderer đã dual-read/so sánh ổn định.

Giới hạn đã biết của backfill: ứng dụng cũ chỉ nhận được snapshot “best
available at migration time”; không thể tái tạo nội dung lịch sử trước đó.

## API V2 lifecycle

Frontend Builder mới phải gọi các route V2, không gọi endpoint legacy
`/api/cvs/` để autosave:

- `POST /api/v2/cvs/` tạo CV từ một template published;
- `GET|PUT /api/v2/cvs/{public_id}/draft/` đọc/autosave canonical draft;
- `POST /api/v2/cvs/{public_id}/save-version/` tạo `manual_save` immutable;
- `POST /api/v2/cvs/{public_id}/publish/` tạo `published` immutable;
- `GET /api/v2/cvs/{public_id}/versions/` đọc history immutable;
- `GET /api/v2/recruiter/applications/{application_public_id}/cv/` chỉ trả
  `submitted_cv_version` khi recruiter là người đăng Job hoặc member đã duyệt
  của công ty.

`PUT draft`, save và publish bắt buộc gửi `If-Match:
"lock-version-N"`. Stale lock trả `409` cùng `current_lock_version`; client
phải reload/merge thay vì ghi đè. Autosave không tạo `CvVersion`.

## Template Catalog và Create CV Flow

Public catalogue chỉ đọc `CvTemplate` đang `active`, có lifecycle `published`,
localization đang active và `current_published_version` đang `published`. Các
route V2 là:

- `GET /api/v2/cv-templates/?locale=vi-VN&category=...&tag=...` trả contract
  card gọn: public ID, slug, localized name/description, thumbnail, premium,
  theme color, categories và tags — không trả layout/style hoặc renderer config;
- `GET /api/v2/cv-templates/{slug}/` trả metadata preview, renderer capability
  an toàn và danh sách section, vẫn không trả configuration JSON;
- `GET /api/v2/cv-templates/{slug}/related/`, `GET /api/v2/cv-categories/` và
  `GET /api/v2/cv-sample-contents/` đều là public metadata có cache control/ETag.

`CvCategory.category_type=feature` là tag. `CvTemplateLocalization` giữ tên,
mô tả và SEO theo locale; `default_style_json.theme_color` của **published
template version** là nguồn màu cho card/preview. `CvSampleContent` chỉ chứa
canonical content theo locale/vị trí/cấp độ; public API không bao giờ trả
`content_json`.

`POST /api/v2/cvs/` nhận `template_public_id`, `language`, title và tùy chọn
`sample_content_public_id`. Trong một transaction, service khóa template và
sample, kiểm tra version hiện hành đúng thuộc template và đang published, clone
canonical sample hoặc content trắng, dựng layout từ section registry, clone
style của version, tạo `UserCv`, immutable initial `CvVersion` và `CvDraft`.
Vì `CvVersion.template_version` được set lúc này, CV luôn ghim chính xác template
version đã published; việc xuất bản template mới không làm thay đổi CV cũ.

Frontend catalog dùng độc quyền `/api/v2/*`; sau khi tạo thành công nó điều
hướng candidate đến `/cvs/{public_id}/edit`. Route này hiện là điểm vào bảo vệ
cho Builder ở phase kế tiếp, không ngụ ý Builder/drag-and-drop đã được triển
khai.

## CV Builder MVP cơ bản

`/cvs/{public_id}/edit` chỉ dành cho candidate sở hữu CV và đọc song song CV
metadata cùng `CvDraft`. UI chỉnh canonical `content_json` cho `personal_info`,
`summary`, `experience` và `skills`; nếu CV trắng chưa có ba section instance
thì client thêm ID ổn định và ghi chúng vào `layout_json` trong autosave đầu
tiên. Việc đổi màu/font chỉ thay `style_json`, không chuyển đổi hoặc tái tạo
content.

Preview luôn có khổ A4 và dùng renderer key đã ghim trong `CvVersion`/CV:
`classic_single_column_v1` hoặc `classic_two_column_v1`. Client chỉ project
content vào region được khai báo bởi `layout_json`; section registry chỉ cung
cấp label và preferred generic region (ví dụ skills dùng sidebar khi renderer
có sidebar), không có nhánh theo template. Một canonical content vì thế render
được qua cả hai renderer mà không cần migration content.

Autosave debounce gọi `PUT /api/v2/cvs/{public_id}/draft/` với `If-Match`
current lock. Autosave chỉ đổi `CvDraft`; trạng thái UI là chưa lưu, đang lưu,
đã lưu hoặc lưu thất bại. `409` dừng autosave và yêu cầu candidate tải lại
draft để không ghi đè tab khác. Nút **Lưu phiên bản** flush draft trước rồi gọi
`POST /save-version/` đúng một lần để tạo immutable `manual_save`.
