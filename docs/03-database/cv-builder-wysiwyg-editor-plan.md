# CVB-8 — WYSIWYG CV Builder kiểu TopCV

**Ngày chốt:** 2026-07-16  
**Nguồn kiến trúc:** [CV Builder — Architecture Foundation](cv-builder-architecture-foundation.md)  
**Quyết định liên quan:** [ADR 0007](../adr/0007-canonical-cv-composition.md),
[ADR 0008](../adr/0008-cv-wysiwyg-renderer-assets.md)

**Trạng thái triển khai:** ✅ Hoàn tất code nền, workflow chính và shell TopCV;
WYSIWYG được seed mặc định bật, feature flag vẫn giữ để rollback về editor cũ.

## Mục tiêu và ranh giới

Thay giao diện “form + preview chỉ đọc” tại `/cvs/:publicId/edit` bằng builder
WYSIWYG trên khổ A4. Trang giữ nguyên lifecycle V2, autosave CAS, immutable
version, route và role guard hiện tại.

Phạm vi gồm top bar, sáu công cụ, chỉnh trực tiếp, rich text B/I/U/bullet/font/
cỡ/màu, sắp xếp section/item, layout nhiều hàng, avatar, hình nền, đổi mẫu,
thư viện nội dung và mobile touch. “Gợi ý viết CV” chỉ hiển thị trạng thái
“Sắp ra mắt”; AI writer không thuộc CVB-8.

Editor cũ được giữ làm fallback qua feature flag đến khi builder mới ổn định
ít nhất một release.

## Contract canonical additive

- `schema_version` tiếp tục là `1`; `rich_text_v1` hợp lệ vĩnh viễn.
- `rich_text_v2` dùng block `paragraph|bullet`; mỗi block có `text` và `runs`.
  `text` phải bằng chuỗi nối `runs[].text`. Marks cho phép là `bold`, `italic`,
  `underline`, `font_family`, `font_size_pt` (8–32) và màu hex.
- Region có `row` optional, mặc định `0`; tổng `width_percent` bằng 100 theo
  từng row. Resize chỉ ghép region cùng row.
- `layout_json.hidden_section_instance_ids` chứa section còn dữ liệu nhưng
  template không hỗ trợ. ID ẩn phải tồn tại, không trùng và không đồng thời
  được assign vào region.
- Section mới: `activities`, `references`, `interests`, `nameplate`, `contact`,
  `avatar`. Ba section cuối là marker lấy dữ liệu từ `personal_info`; `nameplate`
  không được xóa.
- Renderer `header_two_column_v1` có `header(row=0,100%)`,
  `main(row=1,60%)`, `sidebar(row=1,40%)`. Published template cũ không sửa tại
  chỗ; admin phải publish version mới.

## Asset và API

`CvAsset` sở hữu ảnh CV với `kind=avatar|background`, owner nullable cho asset
hệ thống, storage key, MIME, kích thước, checksum và trạng thái. JSON canonical
chỉ lưu public ID; response chứa `assets` map ngoài document.

- Avatar nhận JPEG/PNG/WebP tối đa 5 MB, kiểm tra magic bytes, re-encode bỏ
  metadata và resize tối đa 512×512.
- Background do admin quản lý; candidate chỉ chọn asset active.
- Ảnh cá nhân đọc qua endpoint owner-authorized hoặc URL ký ngắn hạn trong
  shared/recruiter response. PDF worker đọc storage nội bộ.

API additive:

- `POST /api/v2/cvs/assets/`
- `GET /api/v2/cvs/assets/{assetId}/content/`
- `GET /api/v2/cv-backgrounds/`
- CRUD `/api/v2/admin/cv-backgrounds/`
- `POST /api/v2/cvs/{publicId}/apply-sample/` với `If-Match`

Template switch và apply sample tiếp tục compose ở backend. Switch bảo toàn
content, cập nhật hidden section và reset history phía client. Apply sample giữ
`personal_info`, locale, marker, title và style; thay section nội dung, compose
layout ở backend và được ghi thành một history command để undo.

## Kiến trúc frontend

```text
pages/main/cvs/CvEditor
  → features/edit-cv-draft
    → entities/cv, entities/cv-template, entities/locale
      → shared
```

- Page chỉ lấy `publicId` và compose feature.
- Entity CV sở hữu validator, rich-text operations, renderer projection,
  pagination model, asset DTO và document surface.
- Feature sở hữu inline session, toolbar, DnD, panel, autosave/history và các
  workflow đổi mẫu/apply sample.
- Một document surface dùng chung cho read-only và editable mode. Pagination
  đo DOM ở tỷ lệ 1:1 sau khi font sẵn sàng; zoom chỉ áp lên visual wrapper.
- Pack theo chiều cao A4, giữ heading với item đầu, chỉ tách ở ranh giới item.
  Item cao hơn một trang giữ nguyên và báo overflow.
- DnD dùng `@dnd-kit/core` và `@dnd-kit/sortable`, normalize tọa độ theo zoom,
  touch delay 250 ms, có keyboard sensor và nút lên/xuống thay thế.
- Inline editor giữ DOM khi focus, commit idle 400 ms và flush trước undo/redo,
  save, preview, switch, apply sample, navigation và tab hidden. History gộp
  command cùng `coalesceKey` trong một giây.

## Các phase giao hàng

1. **Contract và rollout:** tài liệu, ADR, feature flag, validator additive,
   fixture V1.
2. **Builder shell:** top bar, sáu tool, desktop rail/mobile drawer, design
   panel và form cũ trong panel tạm. Desktop dùng đúng ba tầng của DOCX:
   header website, action bar 52 px, rồi rail 144 px + panel 304 px + canvas A4.
3. **Renderer/pagination:** document surface dùng chung, measurement surface,
   page label và overflow.
4. **Inline/DnD/layout:** plain fields, pending-edit flush, coalescing, section/
   item DnD, add-section và row resize.
5. **Rich text:** v2 core marks rồi font/cỡ/màu; cập nhật frontend, plain text,
   shared/owner/version view và PDF.
6. **Header/assets:** registry mới, header renderer, avatar/background, asset
   permission và PDF parity.
7. **Template/sample/mobile:** diff section, hidden behavior, apply-sample CAS,
   full touch editing, a11y, rollout và xóa fallback sau thời gian ổn định.

Ước lượng một senior developer: 55–65 ngày, chưa gồm thiết kế UI, duyệt nội
dung admin và UAT.

## Nghiệm thu

- Backend phủ validator V1/V2, row/hidden, CAS, asset permission/retention,
  migration idempotency và export V1/V2.
- Frontend phủ IME/paste/flush/undo, rich-text round-trip, pagination, zoomed
  DnD, touch/keyboard, template diff, marker và sample undo.
- Browser canvas và PDF có golden riêng; cùng page count và section/item page,
  không clipping/overlap.
- E2E desktop/mobile: tạo → edit/format → thêm/kéo/resize → avatar/background →
  đổi mẫu → apply sample → undo → save → publish/export; phủ conflict và quyền
  asset.

```bash
cd frontend
npm run lint
npm run check:architecture
npm run test:coverage
npm run build
npm run check:bundle-budget
npm run test:e2e:smoke

cd ../backend
./venv/bin/python manage.py check
./venv/bin/python manage.py makemigrations --check
./venv/bin/python manage.py test apps.cvs apps.cv_templates
```

Mỗi phase cập nhật tài liệu roadmap và `docs/TIEN-DO-DU-AN.md` trong cùng commit
với code và test của phase đó.

## Kết quả triển khai 2026-07-16

- Backend có validator additive, composer hidden-section, apply-sample CAS,
  `CvAsset`, catalogue background admin/public, owner/signed asset access và PDF
  parity cho row/marker/rich text/avatar/background.
- Frontend có shell sáu công cụ, inline/rich editor, pending-edit registry,
  coalesced history, DnD touch/keyboard, nút thay thế lên/xuống, pagination đo
  DOM theo item, template diff, sample library, avatar/background và mobile
  drawer. Shell desktop đã đối chiếu trực quan với DOCX/TopCV: header website,
  thanh tên CV và hành động, rail ngang nhãn, panel đóng được, banner gợi ý,
  A4 ở zoom 80%, nhãn trang dạng badge và zoom nổi góc phải. Editor form cũ
  vẫn tồn tại sau feature flag để rollback.
- Gate: 63 Django test, 141 Vitest test, lint, architecture, build, bundle
  budget và 22 Playwright smoke desktop/mobile đều pass.
- WYSIWYG hiện là mặc định (`cv_builder_wysiwyg_enabled=true`); việc vận hành
  còn lại là publish template version dùng `header_two_column_v1`, duyệt golden
  canvas/PDF trên bộ mẫu thật và theo dõi một release trước khi xóa fallback.
