# Frontend architecture

Frontend đang chuyển dần sang Feature-Sliced Design giản lược:

```text
app → pages → widgets → features → entities → shared
```

- `app`: composition root, provider, router, global styles; không chứa API nghiệp vụ.
- `pages`: một route-level page, chỉ lấy params và ghép widget/feature.
- `widgets`: khối UI lớn ghép nhiều feature/entity (header, footer, dashboard shell).
- `features`: hành động người dùng (`save-job`, `apply-job`, `edit-profile`).
- `entities`: danh từ nghiệp vụ (`job`, `user`, `application`, `cv`).
- `shared`: hạ tầng hoặc UI không biết domain (HTTP client, button, formatter).

## Dependency và public API

Layer chỉ import từ layer phía dưới. Không deep-import module khác: dùng
`@/features/<name>`, `@/entities/<name>` hoặc `@/shared/<segment>` qua `index.js`.
`routes.js` là ngoại lệ có chủ đích cho lazy loader công khai.

## Quy ước đặt file

- Folder mới: `kebab-case`; React component: `PascalCase.jsx`; hook: `use-*.js`.
- API domain: `<domain>.api.js` trong feature/entity sở hữu endpoint.
- Test đặt gần code được test.
- Không tạo file mới ở legacy `api`, `components`, `contexts`, `hooks`, `layouts`,
  `routes` trừ sửa lỗi trong lúc migration. Mỗi đợt di chuyển phải cập nhật route
  inventory, test liên quan và xóa shim ngay khi không còn consumer.

## Migration hiện tại

`app`, `features`, `entities`, `shared` và các widget cổng chính đã dùng được
trong production. State site settings thuộc `entities/site-settings`; login
prompt thuộc `features/auth`; portal config thuộc `shared/config`; metadata và
formatter việc làm thuộc `entities/job`.

Các `components` và `layouts` legacy còn lại sẽ được chuyển theo lát cắt có test
liên quan; không di chuyển hàng loạt hoặc đổi URL/UI trong một PR.
