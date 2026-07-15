# ADR 0007 — Một pipeline composition canonical cho CV Builder

- **Trạng thái:** Accepted
- **Ngày:** 2026-07-15

## Bối cảnh

Create và switch template từng tự lặp lại việc lấy template version, map section
vào region, áp style và validate document. Position preview mới cần cùng contract;
nếu frontend hoặc từng workflow tự compose thì preview có thể khác CV được lưu.

## Quyết định

`apps.cvs.composition` là owner của presentation-neutral composition:

```text
canonical content + published template version + optional theme
→ content_json + layout_json + style_json + schema_version
```

Composer deep-copy input, không sửa published template version, map section bằng
template region contract và chạy cả document validation lẫn capability validation.
Preview, create, copy, restore, import và snapshot phải dùng contract này.

Content resolver theo vị trí/locale vẫn thuộc `apps.cv_templates`; lifecycle CV
vẫn sở hữu transaction, CAS draft, immutable version và dual-write legacy.

## Hệ quả

- Preview và write workflow không được tự dựng layout/style riêng.
- Frontend chỉ render canonical document; không sở hữu business composition.
- Request-specific identity/màu có thể được áp sau base cache nhưng document cuối
  vẫn phải đi qua validation.
- Refactor này không đổi URL, payload, storage key hoặc dữ liệu hiện hữu.
