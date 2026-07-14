# Frontend architecture

Frontend sử dụng Feature-Sliced Design giản lược. Mục tiêu là đặt mỗi thay đổi
vào layer sở hữu trách nhiệm, giữ dependency một chiều và giữ URL/API contract
ổn định khi refactor.

```text
app → pages → widgets → features → entities → shared
```

## Dependency matrix

Mỗi layer chỉ được import chính nó hoặc layer nằm bên phải trong sơ đồ.

| Layer | Trách nhiệm | Có thể import |
| --- | --- | --- |
| `app` | Composition root, providers, router, route layouts | `pages`, `widgets`, `features`, `entities`, `shared` |
| `pages` | Route-level page; lấy route params và ghép UI | `widgets`, `features`, `entities`, `shared` |
| `widgets` | Khối UI lớn phục vụ một portal/layout | `features`, `entities`, `shared` |
| `features` | Hành động người dùng và workflow | `entities`, `shared` |
| `entities` | Domain model, API và UI domain tái sử dụng | `shared` |
| `shared` | Hạ tầng và UI không biết domain | `shared` |

Các hướng ngược (`shared → entities`, `entities → features`, `features → widgets`
hoặc `features → pages`) bị cấm. Một feature cũng không import feature khác.
`dependency-cruiser` và `npm run check:architecture` là source of truth tự động
cho các quy tắc này.

## Public API rule

- Import feature/entity/widget từ public API: `@/features/saved-jobs`,
  `@/entities/session`, `@/widgets/popular-searches`.
- Không deep-import slice khác như
  `@/features/saved-jobs/model/useToggleSavedJob`.
- `shared` là hạ tầng theo segment, nên có thể import trực tiếp chính xác thứ cần
  dùng, ví dụ `@/shared/api/client` hoặc `@/shared/ui/PageLoading`.
- Mỗi public API chỉ export contract cần cho consumer. File `api`, `model`, `ui`
  nội bộ không phải contract liên-layer mặc định.

```js
// Đúng: consumer chỉ biết public contract của feature.
import { useSavedJobs } from '@/features/saved-jobs'

// Sai: phụ thuộc vào cách feature tổ chức nội bộ.
import { useToggleSavedJob } from '@/features/saved-jobs/model/useToggleSavedJob'

// Đúng: shared có thể được import theo segment cụ thể.
import { apiClient } from '@/shared/api/client'
```

## Quy tắc placement

### Khi nào dùng entity

Dùng `entities/<domain>` cho danh từ nghiệp vụ có model, API hoặc UI được nhiều
feature/page sử dụng: `session`, `job`, `location`, `blog`, `account`.
Entity không điều phối ý định của người dùng và không import feature.

### Khi nào dùng feature

Dùng `features/<action>` cho một ý định hoặc workflow của người dùng: đăng nhập,
lưu việc, tìm việc, phản hồi, chỉnh sửa profile hoặc quản lý 2FA. Feature sở hữu
state và API của hành động đó, nhưng dùng entity/shared để đọc domain hoặc hạ tầng.

### Khi nào dùng widget

Dùng `widgets/<name>` cho cụm giao diện lớn ghép nhiều feature/entity và có ngữ
cảnh portal/layout rõ ràng, như main header hoặc floating actions. Widget không
chứa route definition hay business API mới.

### Page, app và shared

- `pages/<portal>` là điểm vào route, ưu tiên composition mỏng thay vì đặt logic
  nghiệp vụ mới tại đây.
- `app` sở hữu providers, router, guards, lazy registry và layout cấp ứng dụng.
- `shared` chỉ chứa code không biết domain: HTTP client, token store, formatter,
  hook kỹ thuật, configuration và UI nguyên tử.
- Component chỉ dùng bởi một page đặt cạnh page; component chỉ dùng bởi một
  feature đặt trong `features/<name>/ui`.

## Cross-feature dependency

Không được import `@/features/<feature-khác>` từ trong `src/features`. Khi hai
feature cần cùng dữ liệu hoặc UI, chọn một trong các cách sau:

1. Đưa domain contract dùng chung xuống `entities`.
2. Đưa UI/hạ tầng không biết domain xuống `shared`.
3. Compose hai feature ở `widgets` hoặc `pages`.

Ngoại lệ chỉ được thêm sau ADR, whitelist cụ thể trong rule kiến trúc và test
cho lý do ngoại lệ. Không tạo bridge/re-export tạm thời để né rule.

## Thêm page mới

1. Đặt page tại `src/pages/main`, `src/pages/employer` hoặc `src/pages/admin`
   theo portal sở hữu; chỉ giữ route composition và UI local.
2. Đặt action/domain/UI tái sử dụng vào feature, entity, widget hoặc shared theo
   các quy tắc ở trên trước khi import vào page.
3. Khai báo lazy loader ở `src/app/router/lazy/<portal>.pages.jsx`.
4. Thêm route vào file tương ứng trong `src/app/router/routes/`; giữ guard và
   URL contract hiện có hoặc bổ sung test redirect/404 khi contract mới.
5. Chạy `npm run lint`, `npm run check:architecture`, unit tests và E2E phù hợp.

## Thêm portal route mới

1. Chọn registry `main.routes.jsx`, `employer.routes.jsx` hoặc `admin.routes.jsx`.
2. Dùng lazy page từ registry tương ứng; không import page trực tiếp vào
   `AppRouter`.
3. Áp dụng `AuthGuard` trước `RoleGuard` cho route cần đăng nhập; role portal
   phải khớp với contract backend.
4. Bổ sung smoke/route test cho direct navigation, redirect unauthorized và
   responsive project nếu route là public hoặc protected.
5. Chỉ thêm portal mới khi có base path, role contract, layout và test strategy
   được chốt; không suy diễn từ một route đơn lẻ.

## Cấu trúc hiện tại

```text
src/
├── app/       # providers, router, guards, lazy registries và layouts
├── pages/     # route pages theo main, employer, admin
├── widgets/   # các khối UI lớn ghép domain
├── features/  # user actions/workflows
├── entities/  # session, account, application, blog, job, location, site-settings
├── shared/    # infrastructure và UI không biết domain
└── test/      # test setup
```

Route được đăng ký trong `app/router/routes`, còn page và layout được lazy-load
theo portal. Compatibility shim đã hết consumer phải được xóa, không giữ lại để
phòng hờ.

## Ownership map — CV Builder

```text
app/router
  → pages/main/cv-templates, pages/main/cvs, pages/main/account/MyCvs
    → features/create-cv-from-template, edit-cv-draft, view/export-cv-version
      → entities/cv-template, entities/cv
        → shared/api, shared/ui
```

- `entities/cv-template` sở hữu API đọc catalogue, normalization màu và UI card
  domain. `colors[]` từ API là nguồn chuẩn; page/feature không tự tạo palette.
- `features/create-cv-from-template` sở hữu chọn nguồn, sample preview và POST
  create. Màu được chọn là input của workflow, không phải state toàn app.
- `features/edit-cv-draft` sở hữu autosave/history/section/layout editing;
  `entities/cv` sở hữu canonical document, renderer contract và preview.
- `pages/main/cv-templates` chỉ lấy locale/route params và compose catalogue,
  detail, source panel/modal. `pages/main/cvs/CvEditor.jsx` chỉ lấy `publicId`
  rồi compose editor feature.
- `pages/main/account/MyCvs.jsx` là owner-local account UI; nó chỉ gọi public
  API `entities/cv` (V2 metadata/archive/import/duplicate/restore/share), không
  gọi HTTP client trực tiếp hoặc contract V1. CTA chỉ xuất hiện khi backend
  workflow tồn tại; không dùng timeout/local state để mô phỏng thành công.
- Backend compatibility fields như `theme_color`/`color_variants` có thể tồn
  tại trong response lúc dual-read, nhưng frontend mới không được dùng chúng để
  dựng nhiều màu giả khi `colors[]` đã có.

## Ownership map — Job application

```text
pages/main/jobs/JobDetail
  → features/apply-for-job
    → entities/application, entities/cv
      → shared/api
```

- `entities/application` chỉ sở hữu application HTTP contract V2; không chứa
  lựa chọn CV hoặc state modal.
- `features/apply-for-job` sở hữu tải CV/version, cảnh báo publish và submit
  explicit `version_public_id`. Page chỉ kiểm tra session/role rồi mở feature.
