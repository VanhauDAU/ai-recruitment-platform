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

Gate còn cấm cycle trong toàn bộ `src`, import giữa hai entity slice, import
page xuyên portal (`main`, `employer`, `admin`) và dùng feature/widget của cổng
khác (xem "Tổ chức thư mục trong từng layer"). Danh sách portal được đọc từ filesystem để folder
mới tự nhận rule. `npm run check:architecture` chạy cả graph thật, kiểm tra cấu
trúc nhóm và negative fixtures; fixture phải bị đúng các rule no-cycle,
cross-entity, cross-feature, page portal isolation và cross-portal slice bắt lại,
tránh config bị nới lỏng âm thầm.

## Tổ chức thư mục trong từng layer

Mọi layer dùng cùng một bộ tên: cổng (`main`, `employer`, `admin`, `common`) và
danh từ nghiệp vụ (`account`, `job`, `company`, `cv`, `campaign`…).

| Layer | Cấu trúc | Nhóm cấp 1 |
| --- | --- | --- |
| `pages` | `pages/<cổng>/<mục>/<Page>.jsx` | `main`, `employer`, `admin`, `common` (trang dùng chung mọi cổng, vd. 404) |
| `widgets` | `widgets/<cổng>/<widget>/index.js` | `main`, `employer`, `admin`, `common` |
| `features` | `features/<cổng>/<module>/<slice>/index.js` | `main`, `employer`, `admin`, `common` |
| `entities` | `entities/<domain>/<entity>/index.js` | `account`, `job`, `company`, `cv`, `application`, `campaign`, `content`, `notification`, `dashboard`, `system`, `messaging` |
| `shared` | `shared/<segment>/…` | `api`, `config`, `hooks`, `lib`, `ui` |

```text
features   cổng      module (số slice)
           main      job (9) · application (4) · cv (5) · company (2) · account (3) · messaging (3)
           employer  account (5) · company (4) · job (2) · candidate (8) · campaign (4) · marketing (3) · messaging (3)
           admin     account (5) · company (4) · job (2) · content (7) · system (2)
           common    account (4) · cv (1) · privacy (1) · messaging (2)
```

- **Cổng** (`features`, `widgets`): đặt slice vào cổng duy nhất đang dùng nó
  (page, widget hoặc layout của cổng đó). Chỉ đặt vào `common` khi ít nhất hai
  cổng thật sự dùng; khi một slice bắt đầu được cổng thứ hai dùng thì dời nó sang
  `common`. `pages/<cổng>` và `widgets/<cổng>` chỉ dùng feature/widget cùng cổng
  hoặc `common`; `widgets/common` chỉ dùng `features/common`; `app` là
  composition root nên được dùng mọi nhóm (`no-cross-portal-slice`).
- **Module** (`features`) và **domain** (`entities`): danh từ nghiệp vụ mà hành
  động hoặc dữ liệu thuộc về. Ưu tiên nhóm đã có; chỉ tạo nhóm mới khi không
  nhóm nào khớp. Không tạo nhóm `misc`/`utils`. Entity không chia theo cổng vì
  phần lớn được nhiều cổng dùng; entity riêng một cổng giữ tiền tố cổng
  (`entities/job/admin-job`).
- **Widget** không có cấp module (mỗi cổng dưới 16 widget) và không lặp tiền tố
  cổng trong tên: `widgets/admin/dashboard`, không phải `widgets/admin/admin-dashboard`.
- **Page** chia theo mục của cổng, giống route: `pages/admin/cvs/CvTemplates.jsx`,
  `pages/employer/jobs/JobForm.jsx`. Không có cấp `app` trung gian; trang marketing
  của NTD nằm ở `pages/employer/marketing`. Code chỉ một mục dùng đặt trong
  `ui/`, `model/`, `lib/` của mục đó.
- **Shared UI** gồm nhiều file cho cùng một khối thì gom thư mục
  (`shared/ui/rich-text`, `shared/ui/confirm-action`, `shared/ui/toast`); component
  một file giữ phẳng.
- Thư mục nhóm chỉ để tổ chức: không chứa file, không có `index.js`, không có
  code dùng chung. Hai slice cùng nhóm vẫn không được import nhau
  (`no-cross-feature-import`, `no-cross-widget-import`, `no-cross-entity-import`).
- `check-architecture-rules.mjs` từ chối cổng không có trong `pages/` (trừ
  `common`), file lạc trong thư mục nhóm và slice thiếu `index.js`.

## Public API rule

- Import feature/entity/widget từ public API: `@/features/main/job/saved-jobs`,
  `@/entities/account/session`, `@/widgets/main/popular-searches`.
- Không deep-import slice khác như
  `@/features/main/job/saved-jobs/model/useToggleSavedJob`.
- `shared` là hạ tầng theo segment, nên có thể import trực tiếp chính xác thứ cần
  dùng, ví dụ `@/shared/api/client` hoặc `@/shared/ui/PageLoading`.
- Mỗi public API chỉ export contract cần cho consumer. File `api`, `model`, `ui`
  nội bộ không phải contract liên-layer mặc định.

```js
// Đúng: consumer chỉ biết public contract của feature.
import { useSavedJobs } from '@/features/main/job/saved-jobs'

// Sai: phụ thuộc vào cách feature tổ chức nội bộ.
import { useToggleSavedJob } from '@/features/main/job/saved-jobs/model/use-toggle-saved-job'

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

Dùng `entities/<domain>/<entity>` cho danh từ nghiệp vụ có model, API hoặc UI
được nhiều feature/page sử dụng: `account/session`, `job/job`,
`system/location`, `content/blog`.
Entity không điều phối ý định của người dùng và không import feature.

### Khi nào dùng feature

Dùng `features/<cổng>/<module>/<action>` cho một ý định hoặc workflow của người dùng: đăng nhập,
lưu việc, tìm việc, phản hồi, chỉnh sửa profile hoặc đổi mật khẩu. Feature sở hữu
state và API của hành động đó, nhưng dùng entity/shared để đọc domain hoặc hạ tầng.

### Khi nào dùng widget

Dùng `widgets/<cổng>/<name>` cho cụm giao diện lớn ghép nhiều feature/entity và có ngữ
cảnh portal/layout rõ ràng, như main header hoặc floating actions. Widget không
chứa route definition hay business API mới.

### Page, app và shared

- `pages/<portal>` là điểm vào route, ưu tiên composition mỏng thay vì đặt logic
  nghiệp vụ mới tại đây.
- `app` sở hữu providers, router, guards, lazy registry và layout cấp ứng dụng.
- `shared` chỉ chứa code không biết domain: HTTP client, token store, formatter,
  hook kỹ thuật, configuration và UI nguyên tử.
- Component chỉ dùng bởi một page đặt cạnh page; component chỉ dùng bởi một
  feature đặt trong `features/<cổng>/<module>/<name>/ui`.

## Cross-feature dependency

Không được import `@/features/<cổng>/<module>/<feature-khác>` từ trong
`src/features`, kể cả khi hai feature cùng cổng và module. Khi hai
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
3. Khai báo lazy loader ở `src/app/router/lazy/<portal>.pages.js`.
4. Thêm route vào file tương ứng trong `src/app/router/routes/`; giữ guard và
   URL contract hiện có hoặc bổ sung test redirect/404 khi contract mới.
5. Chạy `npm run lint`, `npm run check:architecture`, unit tests và E2E phù hợp.

## Quy ước URL

- Path người dùng nhìn thấy viết tiếng Việt không dấu, nối bằng gạch ngang, kể cả trong
  workspace (`/tuyendung/app/tin-tuyen-dung/:id/chinh-sua`, `/admin/app/duyet-tin`).
  Hành động dùng `tao-moi`, `chinh-sua`, `thiet-lap`, `xem`. Ngoại lệ có chủ đích: tiền
  tố `app`, `/oauth/callback` (đã khai với nhà cung cấp OAuth), `/blog`, tên thương hiệu
  `/procv-connect`. Query param giữ nguyên (`?tab=…`).
- Đổi path đang chạy phải thêm cặp `[cũ, mới]` vào `app/router/redirects/legacy-paths.js`
  (redirect giữ tham số, query, hash); không xóa cặp cũ vì email và thông báo đã lưu vẫn
  trỏ tới. Đồng bộ link backend (`apps/*/services`, setting `*_PATH`) và
  `sitecontent.selectors.legacy_paths` nếu prefix thông báo đa cổng bị ảnh hưởng.

## Tiêu đề trang

Mọi `<title>` có dạng `<nội dung trang> | <thương hiệu cổng>`, thương hiệu sinh
từ `site_name` (`portalSiteTitle`): `ProCV` (ứng viên), `ProCV cho Nhà tuyển
dụng`, `Quản trị ProCV`. Riêng trang chủ dùng nguyên `seo_default_title`.

- Tiêu đề mặc định theo route ở `src/app/router/document-title.js`; route mới
  phải có mục ở đây, không thì tab hiện "Trang không tồn tại" và route bị
  `noindex`. Thanh trên cùng của workspace NTD đọc cùng nguồn này.
- Trang có dữ liệu động tự đăng ký qua `useDocumentMetadata`: tin
  `Tuyển <vị trí> - <công ty>`, công ty `<tên> tuyển dụng`, danh sách việc làm
  `Tuyển dụng <N> việc làm <ngữ cảnh> mới nhất` (không đưa ngày vào tiêu đề),
  danh mục `<tên> - <mục cha>`; `seo_title` admin nhập thắng mặc định.
- Tiêu đề khớp nội dung người dùng thấy: theo H1 hoặc nhãn menu của trang; trạng
  thái lỗi dùng đúng câu đang hiển thị (`Không tìm thấy công ty`…) kèm `noindex`.
- Ngăn cấp dùng ` - `, chỉ một ` | ` trước thương hiệu. Không đưa dữ liệu cá
  nhân (tên ứng viên) vào tiêu đề.
- Trang marketing NTD lấy tiêu đề theo ngôn ngữ từ khóa `meta.*` của locale
  employer (`EmployerMarketingLayout`).
- Route công khai có SEO shell ở backend (`apps/*/seo/views.py`, helper
  `seo_page_title`) phải ra cùng tiêu đề với frontend.

## Đo bundle và lazy route

- Production build sinh Vite manifest tại `dist/.vite/manifest.json`.
  `npm run check:bundle-budget` dùng manifest này để ghi mọi JavaScript chunk
  vào `dist/bundle-stats.json`, gồm static import, dynamic import và stylesheet
  trực tiếp của chunk.
- Hai budget initial vẫn là gate fail build: JavaScript gzip `256 KiB`, CSS
  gzip `35 KiB`. Ngày 25/11/2026 trần hạ từ 334/38,5 KiB sau khi build đo còn
  252,1/33,6 KiB (xem hai mục dưới). Không nới trần cho code tính năng; thứ chỉ
  một route dùng phải nằm sau dynamic import.
- Thư viện mà bundle đầu import tĩnh gom vào một chunk `vendor`
  (`codeSplitting.groups` với tag `$initial` trong `vite.config.js`), React ở
  chunk `react` riêng. Antd của route lazy vẫn để bundler tự tách: gom chung theo
  số route dùng làm Home nặng gấp đôi (đã thử 25/11).
- `index.js` của slice trong `features`, `entities`, `widgets` được khai báo
  không có side effect, nên bundler đi thẳng tới module được dùng thay vì kéo cả
  barrel: guard chỉ cần `withReturnUrl` không còn kéo form đăng nhập vào bundle
  đầu. Hệ quả: barrel chỉ được export, không gọi hàm, gán hay import trần lúc
  import; `check:architecture` chặn các dòng như vậy.
- Image production nén sẵn `dist/` bằng gzip mức 9
  (`scripts/precompress-dist.mjs`); nginx bật `gzip_static` để gửi file `.gz`.
- Ảnh trang trí đặt trong `public/images` dưới dạng WebP, thu nhỏ theo cỡ hiển
  thị ×2; không dùng PNG gốc trên R2 cho ảnh nền hay minh họa lớn.
- `dynamicRoutes` đo chi phí tăng thêm của từng lazy entry trong `src/pages`:
  JavaScript/CSS của entry và toàn bộ static import transitively, trừ asset đã
  có trong initial HTML. Asset nhị phân được liệt kê để audit nhưng không cộng
  vào gzip JS/CSS.
- Lazy route hiện chỉ có measurement, chưa có threshold. Chỉ thêm budget theo
  route sau khi có baseline đủ ổn định và lý do sản phẩm/hiệu năng rõ ràng.

## Thêm portal route mới

1. Chọn registry `main.routes.jsx`, `employer.routes.jsx` hoặc `admin.routes.jsx`.
2. Dùng lazy page từ registry tương ứng; không import page trực tiếp vào
   `AppRouter`.
3. Áp dụng `AuthGuard` trước `RoleGuard` cho route cần đăng nhập; role portal
   phải khớp với contract backend. Route login/register dùng `GuestGuard`: chỉ
   redirect khi session thuộc đúng portal, để các portal vẫn đăng nhập độc lập.
4. Bổ sung smoke/route test cho direct navigation, redirect unauthorized và
   responsive project nếu route là public hoặc protected.
5. Chỉ thêm portal mới khi có base path, role contract, layout và test strategy
   được chốt; không suy diễn từ một route đơn lẻ.

## Responsive baseline — cổng nhà tuyển dụng

- Mọi giao diện mới hoặc được sửa trong `pages/employer`, các widget employer và
  feature được compose vào cổng employer phải triển khai mobile-first. Không xem
  responsive là bước polish tùy chọn sau khi hoàn thành desktop.
- Bắt buộc kiểm tra tối thiểu ba viewport đại diện: mobile Chromium (Pixel 5),
  tablet `834x1112` và desktop Chromium. Trang không được làm `document` tràn
  ngang; khu vực cuộn ngang chỉ được dùng khi bản thân dữ liệu đòi hỏi và phải có
  UX nhận biết rõ ràng.
- Dưới tablet, sidebar workspace phải hoạt động như drawer phủ có mask và cách
  đóng rõ ràng; nội dung phía sau không được co xuống hoặc nhận thao tác khi menu
  đang mở. Menu settings dùng control chọn mục thay vì dãy tab ngang dài.
- Grid nhiều cột phải hạ về một cột trên mobile và chỉ tăng cột khi chiều rộng
  thực tế của vùng content đủ dùng (tính cả sidebar). Text dài cần `min-w-0`,
  `break-words` hoặc `truncate` theo ngữ cảnh; không dùng fixed width làm vỡ
  viewport.
- Nút hành động trong form/modal xếp dọc và chiếm đủ chiều rộng trên mobile,
  chuyển sang hàng ngang từ breakpoint phù hợp. Modal/popover phải giới hạn theo
  `100vw` và vẫn có khoảng đệm chạm hai cạnh màn hình.
- Route hoặc workflow employer bị tác động phải bổ sung regression trong
  `tests/e2e/smoke/employer.spec.js`, gồm kiểm tra hiển thị và không tràn ngang ở
  cả ba Playwright project.

## Xác nhận hành động trong ứng dụng

- Xác nhận nhị phân trong giao diện phải dùng
  `@/shared/ui/confirm-action/ConfirmAction`, `ConfirmActionModal` hoặc
  `use-confirm-action`; không tạo thêm `Popconfirm`, `Modal.confirm` hay
  `window.confirm` trong luồng in-app.
- Tiêu đề nói rõ hành động; nội dung phải nêu đích bị tác động và
  hệ quả. Hành động không thể hoàn tác dùng `danger`, nút an toàn mặc
  định là `Đóng`.
- Callback bất đồng bộ phải trả Promise để modal khóa đóng, chặn gửi
  trùng và chỉ đóng sau khi thành công. Phân biệt `onDismiss` với
  `onCancel` nếu nút hủy cũng thực hiện một thay đổi dữ liệu.
- Modal có form, OTP, impact preview, consent hoặc quy trình nhiều bước vẫn
  thuộc feature sở hữu; không ép vào component xác nhận đơn giản.
- Popup xử lý của admin có lý do hoặc tác động dựng từ các khối chung trong
  `shared/ui/confirm-action`: `ActionDialog` (tiêu đề + đối tượng, footer
  "Hủy" + nút mang đúng động từ, Ctrl/⌘+Enter, bottom sheet dưới 640px; tông
  `danger` chỉ cho hành động phá hủy), `ReasonField` (chip lý do mẫu + bộ đếm),
  `ImpactFacts` (fact một dòng, blocker, "Xem chi tiết") và
  `useImpactConfirmation`. Hook preview tác động ngay khi popup mở (backend
  nhận preview với lý do trống), khi bấm xác nhận thì preview lại với giá trị
  cuối rồi xác nhận trong cùng một click; tác động đổi hoặc 409 thì hiện lại
  và chờ bấm lần hai. Trường nghiệp vụ và lý do mẫu ở lại nơi sở hữu (entity
  hoặc feature `model/`), không đưa vào `shared`. Cảnh báo
  `beforeunload` khi đóng/reload tab phải dùng hộp thoại native của trình duyệt.

## Mã hiển thị cho người dùng

Mã tin (`job.code`), mã công ty (`company.code`) và mã tài khoản (`public_id` của
user) hiển thị bằng `@/shared/ui/code-badge/CodeBadge`: nhãn monospace kèm nút sao
chép, tự chặn lan sự kiện để dùng được trong dòng danh sách bấm được. Không đặt
badge bên trong `<button>`/`<a>` (nút lồng nút); không hiển thị `public_id`
dạng `jb_…`/`co_…` cho người dùng.

## Bảng dữ liệu quản trị

- Mọi cột dữ liệu của bảng quản trị phải có sorter và icon tăng/giảm rõ ràng.
  Cột chọn dòng, kéo sắp thứ tự và thao tác là ngoại lệ vì không đại diện cho
  một giá trị dữ liệu có thể sắp xếp.
- Bảng có phân trang phải sort phía server bằng field được backend whitelist;
  không sort riêng các bản ghi của trang hiện tại. Frontend giữ sorter ở trạng
  thái controlled, đưa trang về trang 1 khi đổi sort và giữ thứ tự mặc định ổn
  định khi người dùng bỏ chọn sorter.
- Khi thêm bảng hoặc cột mới, bổ sung regression kiểm tra icon sorter, query
  ordering tăng/giảm và thứ tự kết quả.

## Cấu trúc hiện tại

```text
src/
├── app/                    # Composition root
│   ├── providers/          #   QueryClient, theme, i18n
│   ├── router/             #   routes/ theo cổng, lazy/ registry, guards/, redirects/, admin/ (menu)
│   ├── layouts/            #   Layout từng cổng
│   └── print/              #   Entry trang in CV (cv-print.html)
├── pages/<cổng>/<mục>/     # main · employer · admin · common (404 dùng chung)
├── widgets/<cổng>/<widget>/
├── features/<cổng>/<module>/<slice>/
│   └── index.js · ui/ · model/ · api/ · lib/
├── entities/<domain>/<entity>/
├── shared/                 # api · config · hooks · lib · ui
└── test/                   # Vitest setup và helper render
```

Route được đăng ký trong `app/router/routes`, còn page và layout được lazy-load
theo portal. Compatibility shim đã hết consumer phải được xóa, không giữ lại để
phòng hờ.

Slice nào sở hữu module nào (cẩm nang, CV Builder, chiến dịch, ProCV Connect…):
[bản đồ sở hữu theo module](../docs/08-frontend/ban-do-so-huu.md).

## i18n vi/en (ADR-0023)

- **Thư viện:** Paraglide JS. Chuỗi nằm ở `frontend/messages/<vùng>/{vi,en}.json`.
  Mỗi vùng thêm mới phải khai trong `project.inlang/settings.json` (`pathPattern`).
- **Mã sinh:** plugin Vite biên dịch thành `src/shared/config/i18n/paraglide/`
  (không commit). Chỉ `@/shared/config/i18n` được import mã sinh. Component gọi
  `m.<khóa>()`; định dạng số/ngày dùng `getIntlLocale()`, không viết cứng `'vi-VN'`.
- **Đặt khóa:** snake_case phẳng, tiền tố theo vùng sở hữu (`marketing_`,
  `common_`…). Danh sách và nhãn động là mảng/map hàm message, không ghép khóa
  bằng template string.
- **Ngôn ngữ đang dùng:** lấy từ `preferred_language` của tài khoản
  (`SessionProvider` áp khi khôi phục phiên), rồi localStorage `procv_lang`, rồi
  `vi`. Không đọc ngôn ngữ trình duyệt và không đổi URL.
- **Đổi ngôn ngữ:** tải lại trang. Bộ chọn
  `features/common/preferences/switch-language` lưu vào tài khoản trước nếu đã
  đăng nhập. Chỉ đặt bộ chọn ở vùng đã dịch xong.
- **Thư viện UI:** locale antd đặt ở `app/providers/ui-locale.js`. dayjs import
  từ `@/shared/lib/dayjs` (oxlint chặn import trực tiếp `dayjs`).
- **Axios:** gửi `Accept-Language`; backend tự dịch thông báo và nhãn `*_label`.
- **Nội dung từ site settings:** song ngữ đọc trường `<tên>_${getLocale()}`; giá
  trị tiếng Anh rỗng phải fallback về tiếng Việt.
- **Cổng kiểm tra:** `npm run lint` chạy `scripts/check-i18n.mjs`.
  - Khóa và tham số giữa vi/en phải khớp.
  - Mọi `m.<khóa>` phải tồn tại trong `messages/`; cấm truy cập động `m[...]`.
  - Ratchet số dòng tiếng Việt viết cứng theo vùng
    (`scripts/i18n-baseline.json`). Di trú xong một vùng thì chạy
    `npm run check:i18n -- --update`.
- **Cổng marketing NTD:** 4 trang (trang chủ, giới thiệu, dịch vụ, liên hệ),
  trang pháp lý và footer dùng khóa `marketing_*`.
- Page marketing chỉ compose section; footer lớn ở `widgets/employer/footer`.
  Cổng marketing không có bảng giá hay form lead; CTA dẫn tới đăng ký nhà tuyển
  dụng hoặc `/lien-he`.

## SEO shell và metadata khi điều hướng SPA

```text
backend public SEO route
  → common/seo.py chèn head vào Vite index.html
    → React DocumentMetadataManager
      → page override qua shared/hooks/use-document-metadata
```

- Route public có nội dung tìm kiếm được phải có SEO shell phía backend; không
  chỉ đặt `document.title` trong React. Shell giữ nguyên body SPA, chỉ thay
  `title`, description, robots, canonical, Open Graph, Twitter và JSON-LD.
- Owner backend của nội dung sở hữu metadata động và sitemap tương ứng:
  `jobs`, `blog`, `cv_templates`, `employers` (`/cong-ty/:slug` và
  `sitemaps/companies.xml`); `sitecontent` sở hữu homepage, landing tĩnh,
  `robots.txt` và sitemap index. HTML/JSON-LD dùng helper an toàn tại
  `common/seo.py`, không tự nối chuỗi script ở từng app.
- Reverse proxy chỉ chuyển các route public đã đăng ký qua SEO shell. Fallback
  nginx của SPA luôn phát `X-Robots-Tag: noindex, nofollow`, vì đó là workspace,
  auth, route chưa phân loại hoặc 404; route public mới phải được thêm đồng thời
  vào backend URL, nginx và sitemap.
- Frontend dùng `DocumentMetadataManager` làm nguồn metadata duy nhất khi chuyển
  route không tải lại trang. Page có dữ liệu async đăng ký override bằng
  `useDocumentMetadata`; không thêm `MutationObserver`, không deep-import app
  từ page và không giữ JSON-LD của route trước.
- URL `/jobs/:slug` và `/brand/:company/tuyen-dung/:slug` chỉ là compatibility
  route; canonical V1 luôn là `/viec-lam/:slug`. Mọi link mới phải đi qua
  `entities/job/job.jobDetailPath()`.
- Workspace, auth, CV riêng tư và route không tồn tại luôn `noindex`. Nội dung
  đã đóng/gỡ phải trả HTTP 404 thật từ SEO shell; React UI 404 không thay thế
  status HTTP.
- Khi thêm route indexable, regression tối thiểu phải khóa title, description,
  canonical, robots, status 404 và sitemap; structured data domain phải được
  test riêng (`JobPosting`, `Article`, `BreadcrumbList`, ...).
