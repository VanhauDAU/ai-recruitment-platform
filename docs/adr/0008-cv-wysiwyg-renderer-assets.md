# ADR 0008 — Renderer WYSIWYG và asset reference cho CV

- **Trạng thái:** Accepted
- **Ngày:** 2026-07-16

## Bối cảnh

CV Builder cần chỉnh trực tiếp trên A4, layout nhiều hàng, rich text, avatar và
hình nền. Contract hiện tại chỉ có preview ước lượng, region một hàng và các ID
asset chưa có persistence hoặc authorization.

## Quyết định

Canonical document tiếp tục dùng schema version 1 với các field additive:
`rich_text_v2`, `region.row` và `hidden_section_instance_ids`. Backend composer
vẫn là nguồn duy nhất map content vào template; frontend không tự compose khi
đổi mẫu hoặc áp dụng sample.

Browser read-only và editable mode dùng chung document surface và pagination đo
DOM ở tỷ lệ 1:1. PDF giữ renderer server-side, cùng quy tắc region/row và ngắt
section/item, được khóa bằng regression raster.

Ảnh CV được tham chiếu bằng public ID tới `CvAsset`; canonical JSON không lưu
URL/storage key. Asset cá nhân chỉ được resolve qua quyền owner hoặc URL ký theo
ngữ cảnh version/share/recruiter. Asset hệ thống do admin quản lý.

## Hệ quả

- Draft/version V1 không cần migration và vẫn render/export.
- Published template cũ không đổi; renderer header cần template version mới.
- Template switch có thể giữ content không hỗ trợ ở trạng thái ẩn và phục hồi
  khi template khác hỗ trợ.
- Xóa CV không được xóa asset còn được immutable application snapshot tham chiếu.
- Editor cũ phải tồn tại sau feature flag cho tới khi rollout ổn định.
