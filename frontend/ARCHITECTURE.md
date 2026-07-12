# Frontend architecture

Frontend dùng Feature-Sliced Design giản lược:

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
`@/features/<name>` hoặc `@/entities/<name>` qua public `index.js`. Module thuần
trong `shared` được import trực tiếp theo segment, ví dụ
`@/shared/ui/PageLoading` hoặc `@/shared/api/error-mapper`, để giữ route chunk
nhỏ và tránh barrel kéo UI không liên quan vào entry bundle.

Page không import nội bộ của page khác. UI dùng chung có domain thuộc `entities`;
UI thuần không biết domain thuộc `shared/ui`.

## Quy ước đặt file

- Folder mới: `kebab-case`; React component: `PascalCase.jsx`; hook: `use-*.js`.
- API domain: `<domain>.api.js` trong feature/entity sở hữu endpoint.
- Test đặt gần code được test.
- Segment chuẩn: `api`, `model`, `ui`, `lib`, `config`; không tạo thư mục gốc
  ngoài các layer đã định nghĩa.
- Route page nằm trong `pages`; route layout nằm trong `app/layouts`.
- Không giữ shim, barrel hoặc module dự phòng khi không còn runtime consumer.

## Migration hiện tại

```text
src/
├── app/       # providers, router, lazy route layouts
├── pages/     # admin, employer, main/{account,auth,blog,home,jobs}
├── widgets/   # header, footer, floating actions, popular searches
├── features/  # auth và các hành động người dùng
├── entities/  # account, blog, job, location, site-settings
├── shared/    # api client, config, hooks, UI thuần
└── test/      # test setup
```

Các layout và page đều lazy-load theo portal. Không còn thư mục legacy ở cấp
`src`, route loader shim hoặc feature trộn page/API như `features/jobs`.
