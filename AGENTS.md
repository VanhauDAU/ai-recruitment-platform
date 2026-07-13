# Frontend implementation guide

Đọc `frontend/ARCHITECTURE.md` trước khi thêm hoặc sửa frontend. Tài liệu đó là
nguồn chi tiết; file này là checklist bắt buộc khi làm việc trong repository.

## Mục tiêu cấu trúc

```text
app → pages → widgets → features → entities → shared
```

- Chỉ import xuống layer thấp hơn. `features` không import feature khác.
- Import feature/entity/widget qua public `index.js`; không deep-import nội bộ
  slice khác.
- `shared` được import theo segment cụ thể, ví dụ `@/shared/api/client`.
- Không đổi URL, API payload, token/storage key hoặc role/guard nếu task không
  yêu cầu rõ ràng.

## Chọn nơi đặt code

| Nhu cầu | Vị trí |
| --- | --- |
| Route-level composition theo portal | `frontend/src/pages/{main,employer,admin}` |
| Provider, router, guard, layout, lazy registry | `frontend/src/app` |
| Hành động/workflow người dùng | `frontend/src/features/<action>` |
| Domain model, API hoặc UI domain tái sử dụng | `frontend/src/entities/<domain>` |
| Khối UI lớn ghép nhiều domain | `frontend/src/widgets/<name>` |
| UI nguyên tử hoặc hạ tầng không biết domain | `frontend/src/shared` |

Không tạo `utils` chung không có owner. Component chỉ dùng một page/feature phải
đặt gần owner thay vì đưa vào `shared`.

## Khi thêm giao diện hoặc route

1. Xác định portal và owner bằng bảng trên trước khi tạo file.
2. Thêm page trong portal sở hữu; page chỉ compose UI và lấy route params.
3. Đặt action/domain/UI tái sử dụng vào feature, entity, widget hoặc shared.
4. Thêm dynamic loader tại `src/app/router/lazy/<portal>.pages.jsx`.
5. Đăng ký route ở `src/app/router/routes/<portal>.routes.jsx`; không import
   page trực tiếp vào `AppRouter`.
6. Protected route phải theo thứ tự `AuthGuard` rồi `RoleGuard`.
7. Bổ sung unit/regression test và E2E cho route hoặc workflow bị ảnh hưởng.

## Kiểm tra trước khi bàn giao

Chạy tại `frontend/` theo phạm vi thay đổi:

```bash
npm run lint
npm run check:architecture
npm run test:coverage
npm run build
npm run test:e2e:smoke
```

Không bỏ qua lỗi kiến trúc bằng alias sâu, shim vô thời hạn hoặc whitelist mới
nếu chưa có ADR và lý do cụ thể. Cập nhật `frontend/ARCHITECTURE.md` khi thêm
quy tắc, portal hoặc mô hình ownership có tác động lâu dài.
