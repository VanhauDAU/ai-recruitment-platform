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
import { useToggleSavedJob } from '@/features/saved-jobs/model/use-toggle-saved-job'

// Đúng: shared có thể được import theo segment cụ thể.
import { apiClient } from '@/shared/api/client'
```

## Quy ước import trong slice

Trong cùng một slice dùng đường dẫn tương đối (`../model/use-foo`,
`./JobCard`); chỉ dùng alias `@/` khi import vượt slice hoặc layer. Quy ước
này chưa có tool enforce nên áp dụng khi chạm vào file (opportunistic),
không mass-rewrite. File hook đặt tên kebab-case (`use-saved-jobs-query.js`);
component đặt tên PascalCase.

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
    → widgets/cv-save-success
      → features/export-cv-pdf, update-recruiter-visibility
    → features/create-cv-from-template, edit-cv-draft, view/export-cv-version
      → entities/cv-template, entities/cv
        → shared/api, shared/ui
```

- `entities/cv-template` sở hữu API đọc catalogue, normalization màu và UI card
  domain. `colors[]` từ API là nguồn chuẩn; page/feature không tự tạo palette.
- `features/create-cv-from-template` sở hữu chọn nguồn, sample preview và POST
  create. Position picker đọc taxonomy qua entity `cv-template`, dùng
  `position_public_id` làm value và chỉ hiển thị `name_vi`; preview document
  được resolve ở backend, frontend không dịch hoặc ghép content. Màu được chọn
  là input của workflow, không phải state toàn app.
- `features/edit-cv-draft` sở hữu autosave/history/section/layout editing;
  `entities/cv` sở hữu canonical document, rich-text model, renderer contract,
  pagination đo DOM và read-only document surface. Feature chỉ thay leaf bằng
  inline editor, điều phối DnD/panel/pending-edit flush; không tự compose
  template hoặc sample.
- Asset avatar/background chỉ đi qua public ID trong canonical document;
  `entities/cv` sở hữu DTO/API asset, response resolve qua `assets` map. Storage
  key và URL công khai không được đưa vào document JSON.
- `pages/main/cv-templates` chỉ lấy locale/route params và compose catalogue,
  detail, source panel/modal. `pages/main/cvs/CvEditor.jsx` chỉ lấy `publicId`
  rồi compose editor feature.
- `pages/main/cvs/CvSaveSuccess.jsx` chỉ lấy route param/navigation state và
  compose widget. Widget đọc CV/job domain qua public entity API; download và
  recruiter consent là feature độc lập. Preview trang này render immutable
  version từ response `save-version` bằng `CvDocumentPreview` ở vùng capture,
  chuyển trang A4 đầu tiên thành Blob và chỉ hiển thị bằng thẻ `<img>`. Vì vậy
  ảnh dùng đúng renderer/assets của editor; direct reload lấy đích danh
  `latest_version_public_id`. Private thumbnail là artifact nền cho card/catalog,
  không chặn trang thành công. Nhãn phù hợp chỉ đọc `match_score/is_high_match`
  từ backend, không tự suy diễn trong page.
- `pages/main/account/MyCvs.jsx` là owner-local account UI; nó chỉ gọi public
  API `entities/cv` (V2 metadata/hard-delete/import/duplicate/share), không
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

## i18n cổng marketing nhà tuyển dụng

- i18next chỉ được khởi tạo từ `EmployerMarketingLayout`; không import
  `@/shared/config/i18n` vào `AppProviders`, main portal hoặc admin portal để
  tránh kéo runtime và resource song ngữ vào các chunk không dùng.
- Namespace `employer` sở hữu toàn bộ copy của 5 trang marketing. Nội dung lấy
  từ database dùng cột đôi `*_vi`/`*_en` và helper `pickLocalized`; tiếng Anh
  rỗng hoặc mảng rỗng phải fallback về tiếng Việt.
- Lựa chọn ngôn ngữ được lưu bằng key `employer_marketing_lang`, không thay đổi
  URL. Route, API payload, auth guard và portal host vẫn dùng contract hiện có.
- Page marketing chỉ compose section; workflow gửi lead nằm ở
  `features/request-consultation`, domain gói/giá ở
  `entities/service-package`, footer lớn ở `widgets/employer-footer`.

## Ownership map — Auth và onboarding nhà tuyển dụng

```text
app/router + EmployerAuthLayout|EmployerSetupLayout|EmployerWorkspaceLayout
  + EmployerOnboardingGuard
  → pages/employer/app/Login|Register|Onboarding|ConsultingNeed|EmployerVerify|Dashboard
    + pages/employer/app/account/PhoneVerify|PasswordLogin|CompanySettings
      |BusinessLicense|PersonalDataProtection
    → widgets/employer-onboarding, employer-consulting-need,
      employer-verification, employer-dashboard, employer-account-settings
      → features/auth, complete-employer-registration,
        capture-employer-recruitment-need, verify-employer-account,
        change-password, manage-employer-company
          → entities/session, employer-profile, employer-dashboard, job, location
            → shared/api, shared/config/portals
```

- `features/auth` sở hữu account action dùng chung và contract xác thực theo portal.
  Access token chỉ tồn tại trong memory của tab; refresh token nằm trong cookie
  `HttpOnly` tách theo portal và không được đọc/ghi bởi JavaScript. Các phiên
  portal không ghi đè nhau khi chuyển URL; logout chủ động đổi marker dùng chung
  để xóa toàn bộ phiên trên các tab/subdomain mà không chia sẻ token;
  employer registration vẫn gọi endpoint riêng vì payload tạo recruiter và
  consent riêng, nhưng không tự tạo/liên kết company và không mở rộng contract
  candidate hiện có.
- `features/complete-employer-registration` sở hữu các field profile/consent tái
  sử dụng giữa đăng ký email và bổ sung hồ sơ sau OAuth. Hai workflow chỉ được
  compose ở page/widget, không import feature lẫn nhau.
- `entities/employer-profile` sở hữu HTTP contract recruiter, nhu cầu ưu tiên,
  tìm/tạo/liên kết công ty và giấy tờ xác minh.
  `widgets/employer-onboarding` chỉ hoàn thiện hồ sơ Google; widget
  `employer-consulting-need` compose form nhu cầu sau xác thực. Email/phone/DPA
  là workflow bảo mật riêng, không còn bị gộp thành checklist onboarding.
- `entities/employer-dashboard` sở hữu read-model tổng hợp từ backend
  `apps.dashboard`; widget dashboard không tải toàn bộ danh sách job/application
  rồi tự cộng số liệu. `features/verify-employer-account` sở hữu OTP điện thoại,
  upload giấy đăng ký doanh nghiệp và hai bước DLCN; `change-password` và
  `manage-employer-company` sở hữu các account action tương ứng. Page verify và
  các page account chỉ compose.
- `EmployerWorkspaceLayout` là shell riêng của vùng quản trị employer, sở hữu
  dải cảnh báo tuân thủ, topbar, sidebar hồ sơ/menu và header tên route. Widget
  dashboard chỉ sở hữu nội dung bảng tin bên trong shell. Menu/action chưa có
  workflow thật phải ở trạng thái disabled rõ ràng, không đăng ký route hoặc
  toast thành công giả.
- Protected employer route giữ thứ tự `AuthGuard → RoleGuard`; dashboard thêm
  `EmployerOnboardingGuard`. State server lần lượt là `registration →
  email_verification → consulting_need → complete`; UI redirect không thay thế
  guard và backend permission.
- `/employer-verify` chỉ là checklist bảo mật sau khi consulting hoàn tất, không
  tạo thêm state onboarding bắt buộc. Checklist không lặp lại email đã xác thực;
  các action mở route account nội bộ và tin đầu tiên chỉ bật sau khi đủ năm điều
  kiện trước đó. Submit consulting đi tới checklist; direct navigation lại
  `/consulting-need` ở state `complete` phải về dashboard.
- `EmployerWorkspaceLayout` chiếm đúng `100dvh`; chỉ vùng `Content` cuộn. Link
  dịch vụ/bảng giá chưa có workflow quản trị phải disabled trong workspace,
  không điều hướng sang landing page marketing.
- Login/register/recovery employer dùng `EmployerAuthLayout` và route helper
  `employerAppPath`; không hardcode host, token key hoặc điều hướng sang cổng
  candidate.
