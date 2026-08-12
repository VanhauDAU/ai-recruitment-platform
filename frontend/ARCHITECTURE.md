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

Gate còn cấm cycle trong toàn bộ `src`, import giữa hai entity slice và import
page xuyên portal (`main`, `employer`, `admin`). Danh sách slice/portal được đọc
từ filesystem để folder mới tự nhận rule. `npm run check:architecture` chạy cả
graph thật và negative fixtures; fixture phải bị đúng các rule no-cycle,
cross-entity và portal isolation bắt lại, tránh config bị nới lỏng âm thầm.

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

## Đo bundle và lazy route

- Production build sinh Vite manifest tại `dist/.vite/manifest.json`.
  `npm run check:bundle-budget` dùng manifest này để ghi mọi JavaScript chunk
  vào `dist/bundle-stats.json`, gồm static import, dynamic import và stylesheet
  trực tiếp của chunk.
- Hai budget initial giữ nguyên và vẫn là gate fail build: JavaScript gzip
  `320 KiB`, CSS gzip `35 KiB`.
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
  `@/shared/ui/ConfirmAction`, `ConfirmActionModal` hoặc
  `use-confirm-action`; không tạo thêm `Popconfirm`, `Modal.confirm` hay
  `window.confirm` trong luồng in-app.
- Tiêu đề nói rõ hành động; nội dung phải nêu đích bị tác động và
  hệ quả. Hành động không thể hoàn tác dùng `danger`, nút an toàn mặc
  định là `Đóng`.
- Callback bất đồng bộ phải trả Promise để modal khóa đóng, chặn gửi
  trùng và chỉ đóng sau khi thành công. Phân biệt `onDismiss` với
  `onCancel` nếu nút hủy cũng thực hiện một thay đổi dữ liệu.
- Modal có form, OTP, impact preview, consent hoặc quy trình nhiều bước vẫn
  thuộc feature sở hữu; không ép vào component xác nhận đơn giản. Cảnh báo
  `beforeunload` khi đóng/reload tab phải dùng hộp thoại native của trình duyệt.

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

## Ownership map — Cẩm nang nghề nghiệp

```text
app/router
  → pages/main/blog + pages/admin/app/Blog*
    → features/edit-blog-post, manage-blog-content, manage-blog-tags,
      listen-to-blog-post
      → entities/blog, job, speech
        → shared/api, shared/ui
```

- `entities/blog` sở hữu public/admin HTTP contract, formatter và renderer HTML
  đã sanitize dùng chung giữa trang ứng viên với preview admin.
- `shared/lib/speech` sở hữu hạ tầng phát audio không biết domain:
  `PcmStreamPlayer` (Web Audio cho luồng chưa biết độ dài), `NativeAudioPlayer`
  (asset MP3 đã có sẵn), `playSpeechStream` và chính sách chờ 429/503. Đặt ở
  `shared` vì cả blog lẫn các bề mặt khác đều dùng, mà feature thì không được
  import feature.
- `shared/lib/sound-effects` là registry cho UI sound ngắn dùng lại được;
  `shared/ui/ToastSoundEffect` preload và phát âm thanh theo semantic class của
  Sonner. Workflow chỉ chọn sound qua toast options; lỗi audio luôn best-effort,
  không được chặn submit, navigation hoặc cập nhật session.
- `entities/speech` sở hữu contract session/status dùng lại được nhưng không
  import blog: `createBlogSpeechSession` cho bài viết đã đăng,
  `createTextSpeechSession` bắt buộc surface và `getSpeechAdminOverview` cho
  workflow quản trị. Voice/style production do backend chọn theo surface,
  không phải input hoặc catalogue của client.
- `features/listen-to-blog-post` phát artifact mặc định đã được tạo từ lượt
  nghe trước bằng native audio; chỉ tạo session streaming khi artifact đó chưa
  sẵn sàng. Feature tự giữ
  lifecycle native/Web Audio và AbortController, nhận `postPublicId` từ page;
  nội dung bài không được gửi từ browser sang dịch vụ TTS. Session API là
  control-plane resolve source/rate-limit; các listener cùng artifact identity
  bám một live inference, và MP3 được encode từ chính live PCM đó.
- `features/speak-text` sở hữu `useSpeak({ surface })` — `speak(text)` cho
  chatbot/onboarding. Câu nói KHÔNG sinh artifact lâu dài: quá ngắn và quá
  nhiều để lưu, nên chỉ chạy live stream và ăn cache của engine khi lặp lại.
  Backend giới hạn riêng bằng scope `speech_adhoc` và
  `SPEECH_MAX_ADHOC_TEXT_CHARS`. Chatbot chỉ phát theo nút trên từng message;
  onboarding mặc định off và chỉ gọi live TTS sau khi người dùng chủ động bật.
  Mọi lần phát đầu nằm trong cử chỉ click/tap để mở Web Audio hợp lệ.
- `features/manage-speech-runtime` là admin workflow được Settings page compose
  ngay trong tab AI hiện có. Feature đọc overview qua `entities/speech`, hiển
  thị policy/capacity/cache/usage và không sở hữu route, permission hoặc thao
  tác xóa cache mới. Public flags vẫn thuộc `entities/site-settings` và chỉ tối
  ưu UX; backend luôn enforce hard switch + DB policy.
- `features/edit-blog-post` sở hữu autosave, optimistic revision, upload media,
  preview, chọn/tạo nhanh thẻ và workflow gửi/duyệt/gỡ bài.
  `features/manage-blog-content` sở hữu các tab danh sách, danh mục và bài ghim;
  `features/manage-blog-tags` sở hữu tab quản trị, ẩn, xóa và gộp thẻ. Page
  admin compose hai feature; các feature không import lẫn nhau.
- Page admin chỉ lấy `publicId` hoặc compose feature. Route blog admin dùng
  `blog.view`; action ghi và phát hành tiếp tục được backend khóa bằng
  `blog.manage`/`blog.publish`.

## Ownership map — Danh bạ công ty quản trị

```text
app/router + app/layouts
  → pages/admin/app/Companies + CompanyDetail
    → widgets/admin-company-directory
      → entities/admin-company
        → shared/api
```

- `entities/admin-company` sở hữu HTTP contract chỉ đọc cho danh sách, chi tiết
  và roster NTD. `widgets/admin-company-directory` sở hữu bộ lọc, bảng và cách
  trình bày riêng của portal quản trị; page chỉ lấy route params rồi compose.
- Sidebar quản trị dùng cây `ADMIN_NAVIGATION` tham chiếu route bằng `routeRef`;
  permission được lọc từ leaf lên ancestor. Trạng thái pháp lý của công ty và
  trạng thái xác thực đại diện của từng NTD là hai contract độc lập.

## Ownership map — Người dùng và nhà tuyển dụng quản trị

```text
app/router + app/layouts
  → pages/admin/app/Accounts + Recruiters + AccountDetail + RecruiterDetail
    → widgets/admin-account-management + widgets/admin-account-detail
      → entities/admin-account + entities/admin-employer-verification
        → shared/api
```

- `entities/admin-account` sở hữu DTO, API và query key. Mọi truy vấn danh sách
  từ frontend phải truyền `scope=users` hoặc `scope=recruiters`; query key phải
  chứa scope cùng toàn bộ filter, ordering và pagination.
- `widgets/admin-account-management` sở hữu hai cấu hình workspace riêng.
  `users` chỉ gồm ứng viên và quản trị viên; `recruiters` chỉ gồm tài khoản nhà
  tuyển dụng. Page chỉ chọn scope và compose widget.

## Ownership map — Mascot và trợ lý ứng viên

```text
app/layouts/MainLayout + pages/main
  → widgets/candidate-assistant
    → shared/ui/mascot
      → public/images/mascot

app/layouts/OnboardingLayout + pages/main/onboarding
  → widgets/onboarding-interview
    → features/speak-text, features/configure-job-preferences
    → shared/ui/mascot, shared/hooks/use-progressive-reply
```

- `shared/ui/mascot` sở hữu rig trình bày không biết domain, scene empty-state và
  animation CSS. Mọi layer asset giữ canvas 500×500; thứ tự render là shadow,
  body, tay phải, tay trái, đạo cụ, bàn tay trước, đầu, mắt và miệng. Pose cầm
  đạo cụ hai tay (`checklist`) khai `front` dạng mảng hai bàn tay. Mắt chớp và
  miệng nói đều dùng cặp animation nghịch đảo để không bao giờ chồng hai khẩu
  hình hoặc hai bộ mắt. Animation phải tắt khi người dùng bật
  `prefers-reduced-motion`.
- `widgets/candidate-assistant` sở hữu launcher, panel, kịch bản mẫu và quick
  action của portal ứng viên. Panel được lazy-load khi mở lần đầu; phase 1 không
  gọi API chatbot và phải hiển thị rõ đây là câu trả lời mẫu.
- Widget chỉ mount trong nhánh thường của `MainLayout`, không mount trong CV
  editor. Vị trí launcher phải tránh banner cookie theo chiều cao thực tế và
  thanh ứng tuyển mobile ở trang chi tiết việc làm.
- `widgets/onboarding-interview` sở hữu cuộc phỏng vấn onboarding: kịch bản
  tĩnh, state machine năm bước, bản đồ trạng thái mascot và provider giọng đọc.
  Phải là widget vì ghép hai feature (`speak-text` và `configure-job-preferences`)
  mà feature không được import feature. `OnboardingVoiceProvider` mount ở
  `OnboardingLayout` chứ không phải trong page: AudioContext chỉ mở được trong
  cử chỉ người dùng ở `/onboard-user`, mà page unmount là player bị destroy.
  Bước phỏng vấn giữ nguyên tên trường và payload `PUT` của form một trang.
- `shared/hooks/use-progressive-reply` sở hữu đồng hồ hiện chữ theo tiến độ
  audio, dùng chung cho trợ lý và onboarding; nằm ở `shared` vì hai widget khác
  nhau đều cần và widget không được import widget.
- WebP trong `public/images/mascot` được tái tạo bằng
  `npm run build:mascot-assets -- --src <folder>`; không commit PNG nguồn hoặc
  các ảnh `states/` có thể dựng lại bằng rig.
- URL là nguồn chuẩn cho tab, filter, ordering và page. Lời mời quản trị dùng
  namespace `invite_*`, hàng chờ xác thực NTD dùng `verify_*`; tham số không
  tương thích phải được bỏ khi chuyển tab.
- `/admin/app/accounts/:publicId` là route canonical của ứng viên/admin;
  `/admin/app/recruiters/:publicId` là route canonical của NTD. Route chi tiết
  phải chuyển bằng `replace` khi role không khớp và giữ `pathname + search` của
  nguồn điều hướng nội bộ để nút quay lại khôi phục đúng workspace.
- Summary tài khoản, NTD và công ty là aggregate phía server theo permission,
  không được suy ra từ `results` của một trang phân trang. Trạng thái pháp lý
  công ty, xác thực đại diện NTD và vai trò owner/member là ba contract riêng.

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

## Ownership map — Employer job editor và AI generation

```text
pages/employer/app/jobs/JobForm
  → widgets/employer-job-editor
    → features/post-job + features/generate-job-post
      → entities/job + shared/ui/mascot + shared/api
```

- Page chỉ đọc job id/`campaign`, tải dữ liệu route và compose widget; không poll
  AI hoặc giữ Ant Form instance. Widget sở hữu URL state `mode`/`generation` và
  luôn bảo toàn các query khác khi chuyển mode.
- `widgets/employer-job-editor` sở hữu một controlled form dùng chung cho create
  thủ công, brief AI và dán JD. Widget compose generation với `PostJobForm`;
  form áp whitelist patch đúng một lần theo generation key, giữ nguyên trường
  NTD phải tự nhập và chuyển draft cuối cùng cho `post-job`.
- `features/generate-job-post` sở hữu create/status/cancel/feedback, resume sau
  reload và presentation theo phase thật. Feature không import `post-job`;
  composition và mapping suggestion vào form thuộc widget.
- `features/post-job` chỉ sở hữu mutation lưu tin và validation form canonical.
  `ai_generation_public_id` là provenance write-only, không biến generation
  thành job và không cho phép tự publish.
- AI không có mặt ở route edit V1. Query `campaign` phải được bảo toàn khi đổi
  `mode=manual|ai_brief|jd_text`; mode không hợp lệ fallback thủ công.
- Mascot dùng `shared/ui/mascot`, phase có nhãn văn bản độc lập với animation,
  và tắt motion theo `prefers-reduced-motion`. Lỗi/cancel luôn giữ đường lui về
  form thủ công; reload phải resume từ public id đã lưu, không tạo lượt mới.

## Ownership map — Quản lý tin tuyển dụng quản trị

```text
app/router + app/layouts
  → pages/admin/app/JobModeration + JobModerationDetail
    → widgets/admin-job-management
      → features/review-job-submission + enforce-job-visibility
        → entities/admin-job + entities/admin-access + entities/session
          → shared/api, shared/ui
```

- `entities/admin-job` sở hữu HTTP contract, query key và metadata trình bày cho
  danh sách, aggregate tổng quan, chi tiết và quyết định kiểm duyệt. Contract
  quản trị tách khỏi `entities/job` dùng chung cho ứng viên/nhà tuyển dụng.
- `widgets/admin-job-management` sở hữu URL state `job_*`, bảng sort/phân trang
  phía server, dashboard tổng quan và bề mặt chi tiết đầy đủ. Route danh sách
  giữ `tab=reports` để tương thích hàng đợi báo cáo hiện hành; route chi tiết giữ
  nguồn điều hướng nội bộ để quay lại đúng bộ lọc.
- `features/review-job-submission` sở hữu duyệt/từ chối tin chờ duyệt;
  `features/enforce-job-visibility` sở hữu tạm ẩn/khôi phục tin đang tuyển. Hai
  feature dùng review token của revision đang xem; lỗi `409
  job_moderation_stale` bắt buộc tải lại, không retry hoặc ghi đè ngầm.
- `policy_hold` phản ánh hạn chế từ tài khoản/chính sách; `moderation_hold` phản
  ánh quyết định tạm ẩn nội dung. Tin có một trong hai hold không được xuất hiện
  ở bất kỳ bề mặt công khai nào, nhưng vẫn hiện trong workspace quản trị.

## Ownership map — Catalogue và yêu cầu tư vấn quản trị

```text
pages/admin/app/ConsultationLeads
  → widgets/admin-consultation-leads
    → entities/consultation-lead + entities/admin-access + entities/session
      → shared/api, shared/ui

pages/admin/app/EmployerServices + CvCatalogue
  → widgets/admin-service-catalog + widgets/admin-cv-catalogue
    → entities/service-package + entities/cv-template + entities/locale
      → shared/api, shared/ui
```

- Page chỉ compose page header và widget; filter, tab, bảng, editor và mutation
  thuộc widget sở hữu workflow.
- Danh sách lead dùng URL làm nguồn chuẩn cho tìm kiếm, trạng thái, khoảng ngày,
  ordering và page; filter/sort/phân trang chạy phía server. Xuất lead phải qua
  endpoint riêng, đồng thời kiểm tra `consultation_lead.view` và
  `consultation_lead.export`, giới hạn số dòng và ghi audit không chứa PII.
- Catalogue dịch vụ và CV hiện là contract không phân trang nên widget chỉ
  search/sort dữ liệu đã tải. CSV phía client phải ghi rõ phạm vi tab/dữ liệu
  đang hiển thị; không được gọi đó là xuất toàn bộ dữ liệu hệ thống.
- `entities/service-package` sở hữu cả contract marketing tương thích và
  contract thương mại có cấu trúc: capability đóng, package version, entitlement
  và audit. `widgets/admin-service-catalog` tách tab catalogue marketing khỏi
  tab phiên bản vận hành; publish không sửa version cũ. Kho lượt và audit phân
  trang/sort phía server, còn danh sách version của một catalogue nhỏ tiếp tục
  là contract không phân trang.
- Quyền admin tách `service_catalog.draft.manage`, `service_catalog.publish`,
  `service_entitlement.view|manage` và `service_audit.view`; ẩn nút ở frontend
  chỉ là UX, backend luôn kiểm tra từng mutation. HOT, RED, huy hiệu phản hồi
  nhanh và title 255 không xuất hiện trong capability thương mại.
- Upload hình nền CV là asset workflow, không phải bulk import. Không hiển thị
  nút nhập dữ liệu cho tới khi có contract dry-run, validate, idempotency,
  permission và audit phía server.

## Ownership map — Job engagement

```text
pages/main job cards + job detail/quick view
  → features/track-job-engagement
    → entities/job, entities/consent
      → shared/api

widgets/employer-campaign-workspace/CampaignJobsPanel
  → entities/campaign
    → shared/api
```

- `features/track-job-engagement` sở hữu điều kiện viewability 50%/1 giây,
  timer khi tab visible và batch queue impression. Feature chỉ gửi tracking khi
  consent Analytics ở trạng thái `ready`; backend vẫn là nguồn xác thực consent
  và dedupe 24 giờ.
- `entities/job` sở hữu HTTP contract impression/view; page và widget chỉ gắn
  boundary/hook vào bề mặt job card hoặc nội dung chi tiết thực sự hiển thị.
- Báo cáo chiến dịch đọc API performance theo kỳ từ `entities/campaign`; không
  tự suy ra tỷ lệ từ lifetime counter ở frontend.

## Ownership map — Tài khoản và cá nhân hóa ứng viên

```text
app/router
  → pages/main/account/EmailNotificationSettings|JobAlertSettings|ChangePassword|MatchingJobs
    + pages/main/jobs/JobList|SavedJobs
    → features/configure-email-notifications, manage-job-alerts,
      change-password, saved-jobs
      → entities/candidate-job-alert, candidate-notification-preferences,
        job, location, session
        → shared/api

widgets/main-header/CandidateUserMenu
  → entities/account
```

- `entities/account` là nguồn duy nhất cho nhóm/item/route tài khoản.
  `CandidateUserMenu` và `AccountSidebar` chỉ render config này; dropdown desktop
  dùng single-open accordion, giới hạn theo viewport và để vùng item cuộn riêng.
- `entities/candidate-notification-preferences` sở hữu GET/PATCH preference email.
  Feature email điều phối optimistic auto-save/rollback; page chỉ compose header
  và feature. Email bảo mật luôn bật không thuộc DTO preference.
- `entities/candidate-job-alert` sở hữu HTTP contract CRUD và query key cho tối
  đa năm bộ tiêu chí. `features/manage-job-alerts` sở hữu list/modal, cache
  optimistic, giới hạn, xác thực email và các error code nghiệp vụ; account page
  chỉ compose feature. Modal tạo được public API của cùng feature để `JobList`
  mở tại chỗ sau login mà không điều hướng sang account.
- Taxonomy ba cấp và picker multi-select thuộc `entities/job` vì được dùng chung
  bởi bộ lọc công khai và job alert. Selection lưu danh sách node rút gọn;
  `category_ids` được OR, còn backend mở rộng node cha xuống các cấp con. CTA từ
  danh sách việc làm chỉ prefill tiêu chí biểu diễn chính xác, giữ toàn bộ `cat`
  multi-select và không suy diễn range tùy chỉnh thành salary bucket.
- Job alert chỉ gửi qua email đăng nhập đã xác thực. Công tắc
  `configured_job_alerts` và `suitable_job_recommendations` dùng chung query
  cache preference với trang email; optimistic PATCH phải rollback khi lỗi.
  Suitable recommendation vẫn phụ thuộc consent/job preferences ở workflow
  hiện hữu, không xin consent trong UI job alert.
- `features/change-password` dùng chung hai portal và không chứa redirect/copy
  riêng của employer. Page portal truyền `successRedirect` khi cần; candidate
  giữ nguyên route và có thể hiển thị email read-only.
- Tài khoản OAuth chưa có mật khẩu phải xác thực lại với provider trước khi đặt
  mật khẩu lần đầu. Feature đọc `GET /api/auth/password/` để cảnh báo và khoá
  nút lưu **trước** khi người dùng điền form; 403 `reauth_required` chỉ là
  fallback khi phiên hết hạn giữa chừng. URL OAuth và đường quay lại thuộc về
  page (prop `onReauth`) vì feature không import feature khác — `features/auth`
  sở hữu `startOAuthReauth`, dùng lại full-page redirect của luồng đăng nhập.
- `entities/job` sở hữu contract/keys của feed recommendation. Trang matching
  chỉ hiển thị `status`, `sources`, score và reasons do backend trả; không tự
  tính điểm hoặc tuyên bố dùng search activity. Lưu job và impression tiếp tục
  đi qua feature tương ứng.
- `features/saved-jobs` sở hữu GET/POST/DELETE danh sách lưu, cache optimistic
  và feed `/recommendations/by-saved/`. `pages/main/jobs/SavedJobs` chỉ compose
  danh sách, empty/error state và metadata strategy server trả; không tự chọn
  category hay tính similarity. Feed vẫn hiển thị fallback tin mới khi chưa có
  lịch sử lưu, nhưng UI không gọi fallback là kết quả cá nhân hóa.
- Protected route tài khoản giữ `AuthGuard → RoleGuard(candidate)`. URL, consent,
  token/storage key và payload hiện hành không được đổi từ page/widget.

## Ownership map — Chiến dịch tuyển dụng

```text
pages/employer/app/campaigns/CampaignList|CampaignDetail
  → widgets/employer-campaign-workspace
    → features/manage-campaigns
      → entities/campaign, entities/application, entities/job
        → shared/api
```

- `entities/campaign` sở hữu HTTP contract, query key, tên và trạng thái.
  Các trường nhu cầu tuyển dụng không thuộc campaign; chúng do
  `entities/recruitment-need` và feature tương ứng sở hữu.
  `entities/application` sở hữu list/export hồ sơ phía server;
  `entities/job` sở hữu contract tin tuyển dụng.
- `features/manage-campaigns` sở hữu các workflow tạo nhanh, đổi tên,
  dừng và mở lại. Xác nhận dừng luôn tải `pause-impact`, yêu cầu mã chiến dịch
  khớp hoàn toàn và không tự đổi trạng thái tin.
- `widgets/employer-campaign-workspace` sở hữu header và bốn tab dữ liệu thật:
  Tổng quan, CV ứng tuyển, Tin tuyển dụng và Lịch sử hoạt động. Page chi tiết
  chỉ đọc route param rồi compose widget; query `active_tab` là contract URL,
  còn `tab=applications|jobs` chỉ là mapping tương thích.
- Không thêm KPI/tab credit, kết nối CV, nhãn, dịch vụ hoặc danh tính người xem
  khi chưa có domain backend. Lượt xem tin chỉ được dùng dưới dạng thống kê
  engagement ẩn danh.

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
      employer-verification, employer-dashboard, employer-account-settings,
      employer-notification-center
      → features/auth, complete-employer-registration,
        capture-employer-recruitment-need, verify-employer-account,
        change-password, manage-employer-company
          → entities/session, employer-profile, employer-dashboard,
            employer-notification, job, location
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
  tìm/tạo/liên kết công ty, giấy tờ xác minh và canonical readiness. Readiness
  chỉ hợp lệ khi đủ năm field `job_workspace_ready`, `verification_approved`,
  `candidate_data_access`, `dpa_status`, `blockers`; payload canonical partial,
  sai kiểu hoặc tự mâu thuẫn phải fail closed. Chỉ khi cả năm field đều vắng
  mới được fallback workspace legacy; candidate-data không fallback legacy.
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
- `entities/employer-notification` sở hữu API/query key và presentation model
  cho notification/activity. `widgets/employer-notification-center` sở hữu
  bell badge/popover, list phân trang, mark-read và activity timeline; page
  `/notifications|/activities` chỉ compose widget. Layout được phép compose
  bell qua public index của widget nhưng không gọi API notification trực tiếp.
- Protected employer route giữ thứ tự `AuthGuard → RoleGuard`; dashboard thêm
  `EmployerOnboardingGuard`. State server lần lượt là `registration →
  email_verification → consulting_need → complete`; UI redirect không thay thế
  guard và backend permission. Sau onboarding, `JobWorkspaceGuard` bảo vệ
  jobs/campaigns và `CandidateDataGuard` bảo vệ applications. Khi readiness tải
  thành công nhưng capability bị từ chối, route guard điều hướng về
  `employer-verify`; khi readiness đang tải hoặc lỗi, guard giữ fail-closed và
  chỉ hiện loading/retry. Redirect không thay thế backend permission.
- Consumer candidate-data phải dùng `useEmployerReadiness`, tắt query nhạy cảm
  bằng `enabled=false` khi checking/error/denied và đồng thời không render dữ
  liệu đã cache. Aggregate không chứa danh tính được phép giữ; tên, avatar,
  email, CV/link download, preview và activity/deep-link ứng viên phải bị bỏ.
  Blocker chỉ điều hướng qua machine-action allowlist phía frontend, không dùng
  URL do backend gửi hoặc parse message để quyết định quyền.
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

## Ownership map — Dải thông báo đa cổng

```text
app/layouts
  → widgets/announcement-strip
    → entities/announcement + entities/session|employer-profile|consent
      → shared/api, shared/ui

pages/admin/app/Announcements
  → widgets/admin-announcement-management
    → features/manage-announcement
      → entities/announcement
        → shared/api, shared/ui
```

- `entities/announcement` sở hữu HTTP contract active/state/event/admin-metrics,
  query keys, locale fallback và presentation enum. Entity không biết layout
  hoặc system reminder.
- `widgets/announcement-strip` sở hữu composition giữa feed từ backend với
  email verification, compliance employer và job-preference reminder; pure
  priority resolver nằm trong widget vì đây là logic ghép nhiều domain. Widget
  cũng sở hữu batch impression/click/dismiss best-effort và local state guest;
  signed cookie phía server vẫn là nguồn consent analytics chuẩn. Runtime feed
  chỉ nhận remote item khi backend trả `remote_enabled=true`; health hook chỉ
  gửi enum PII-free và error boundary trong cùng widget trả banner legacy, nên
  app/layout không sở hữu recovery logic domain.
- `features/manage-announcement` chỉ sở hữu mutation create/revision/publish/
  pause/resume/archive/duplicate. Feature không import feature khác.
- `widgets/admin-announcement-management` sở hữu bảng, editor, preview,
  conflict simulator và dashboard metrics 7/30/90 ngày lấy aggregate phía
  server. Page admin chỉ compose widget; route/lazy registry vẫn thuộc `app`.
- Workspace `/admin/app/announcements` dùng URL làm nguồn chuẩn cho filter,
  ordering và page. Mọi cột dữ liệu sort phía server; action column là ngoại
  lệ. Quyền route là `announcement.view`; `manage` và `publish` chỉ điều khiển
  mutation tương ứng, backend vẫn fail-closed khi gọi API trực tiếp.
- Editor giữ form qua năm bước nhưng chỉ submit DTO thật; sửa live tạo immutable
  revision mới. Detail read-model trả revision và audit history chỉ đọc. Lỗi
  `409 announcement_revision_stale` buộc tải lại token hiện hành, không retry
  hoặc ghi đè ngầm.
- Catalog CTA/prefix là metadata trình bày riêng của editor và nằm tại
  `widgets/admin-announcement-management/model/route-catalog.js`; không import
  ngược router từ `app`. Route có thể dùng cho thông báo được đăng ký một lần
  với label, surface và access `public|authenticated`; test catalog giữ URL/
  prefix an toàn. Catalog chỉ sinh lựa chọn cho revision mới, không tự viết lại
  URL của revision đã publish.
- Bốn surface canonical là `candidate`, `employer_marketing`,
  `employer_workspace`, `admin_workspace`. Layout truyền surface và path; không
  hardcode role hoặc tự lọc quyền admin ở component.
- Strip phải fail-safe: lỗi remote feed không được làm mất cảnh báo hệ thống,
  header hoặc main content. Chiều cao được đo và công bố bằng CSS custom
  property; không thêm hằng số viewport theo từng layout.
- Motion thuộc widget: một item `slide|fade` lặp theo `display_seconds`, nhiều
  item chuyển queue theo cùng contract; hover/focus/tab ẩn phải pause,
  `prefers-reduced-motion` và `static` phải tắt animation mà không thay DOM.
- Dismiss/snooze chỉ loại active item và phải chuẩn hóa lại queue index trước
  render kế tiếp. Strip chỉ unmount khi queue rỗng; focus-pause không được để
  item kế tiếp ở opacity 0 trong một rail còn nền.
- Mọi import liên-slice đi qua public `index.js`; các adapter hệ thống chỉ được
  compose trong widget, không chuyển session/profile logic xuống `shared`.

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
  `jobs`, `blog`, `cv_templates`; `sitecontent` sở hữu homepage, landing tĩnh,
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
  `entities/job.jobDetailPath()`.
- Workspace, auth, CV riêng tư và route không tồn tại luôn `noindex`. Nội dung
  đã đóng/gỡ phải trả HTTP 404 thật từ SEO shell; React UI 404 không thay thế
  status HTTP.
- Khi thêm route indexable, regression tối thiểu phải khóa title, description,
  canonical, robots, status 404 và sitemap; structured data domain phải được
  test riêng (`JobPosting`, `Article`, `BreadcrumbList`, ...).
