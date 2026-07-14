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
