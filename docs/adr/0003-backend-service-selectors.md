# ADR 0003 — Backend view/serializer mỏng + service/selectors

**Trạng thái:** Accepted — 2026-07-13

## Bối cảnh

Backend đã chia theo Django domain app (tốt). Nhưng một số view/serializer đang gánh
cả use-case ghi dữ liệu nhiều model, gửi email, gọi task và query phức tạp. `jobs`
đã có sẵn `services/` và `selectors/` — mô hình cần chuẩn hóa và mở rộng có chọn lọc.

## Quyết định

Chuẩn hóa layering cho các app có hotspot (không áp dụng máy móc cho app nhỏ):

```
apps/<domain>/
  api/         # serializers, views, urls — mỏng: validate + gọi service/selector
  services/    # use case GHI: transaction nhiều model, gửi email, enqueue task
  selectors/   # use case ĐỌC: query tối ưu, không thay đổi dữ liệu
  models/
  tasks/
  tests/
```

- **View/serializer mỏng:** không chứa transaction nhiều model; serializer không gửi
  email/gọi task ngoài validation và `save` rất nhỏ.
- **Service không phụ thuộc request/response HTTP** (nhận dữ liệu đã validate).
- **Selector không thay đổi dữ liệu** và tối ưu query (tránh N+1, kiểm bằng query-count test).
- `common/` backend KHÔNG import app nghiệp vụ.

## Hệ quả

- (+) Use-case test được không qua HTTP; view dễ đọc; query có nơi tối ưu rõ ràng.
- (+) Giảm rủi ro side-effect ẩn trong serializer.
- (−) Thêm indirection cho thao tác đơn giản — chấp nhận, chỉ tách khi có hotspot thật.

## Thay thế đã cân nhắc

- Fat view/serializer như hiện tại: khó test, dễ lẫn side-effect.
- Áp service/selectors cho MỌI app: thừa cho app nhỏ — bị loại.
