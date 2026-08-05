# Changelog

Tất cả thay đổi đáng chú ý của dự án sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html) khi bắt đầu phát hành phiên bản. Trong giai đoạn chưa cắt phiên bản, thay đổi được nhóm theo ngày dưới `[Unreleased]`.

## [Unreleased]

### 2026-08-05

#### Added — FAQ/Help Center KB-P1 foundation

- Thêm app Django `knowledgebase` theo ADR-0010 với category, article ổn định,
  revision có partial unique constraint cho một bản mở và media asset có kích
  thước xác minh; ID public dùng prefix `kbc/kba/kbr/kbm`.
- Seed idempotent đúng bảy chuyên mục đã chốt và bốn permission
  `knowledgebase.view/manage/review/publish`; role `content-cv` staff được biên
  tập, manager được duyệt/phát hành.
- Tách sanitizer HTML giàu nội dung dùng chung sang `common/content_html.py`,
  chặn active content, credential và URL scheme nguy hiểm; blog chuyển sang
  helper chung mà vẫn giữ policy URL tương thích.
- Targeted backend test, migration drift check, Ruff, import-linter và backend
  layering gate đều đạt.

#### Added — FAQ/Help Center KB-P2 workflow và admin API

- Thêm transactional service cho toàn bộ lifecycle revision/article/category,
  khóa hàng và `revision_token` trả 409 khi stale; bản public tiếp tục ổn định
  trong lúc bản sửa còn draft/in-review/rejected và hỗ trợ rollback revision đã
  duyệt.
- Mở admin API quản lý category, article, revision, reorder, review, publish,
  archive/restore và media; bốn permission được kiểm độc lập ở backend, response
  quản trị luôn `private, no-store`.
- Nội dung được sanitize/canonicalize, sinh plain text + SHA-256, ảnh bắt buộc
  thuộc media library và có alt; upload chỉ nhận JPEG/PNG/WebP tối đa 5 MB,
  resize trong 1600×1600 và lưu kích thước sau xử lý.
- Audit chỉ ghi metadata nhỏ, không ghi body/review note. List admin giữ query
  budget cố định 3 query cho 5 bài. 22 targeted/regression test cùng Ruff,
  migration drift, import-linter và layering gate đều đạt.

#### Added — FAQ/Help Center KB-P3 workspace quản trị

- Thêm route lazy `/admin/app/knowledgebase`, trang tạo và workspace biên tập;
  navigation và permission catalog dùng đủ `view/manage/review/publish`.
- Danh sách quản trị có dashboard, tìm kiếm, filter category/type/revision/review
  due, sort và phân trang server-side lấy URL làm nguồn chuẩn; drawer chuyên mục
  hỗ trợ tạo, sửa, sắp xếp, bật/tắt và cảnh báo ảnh hưởng nội dung công khai.
- Editor rich text lưu tường minh, dirty guard, local recovery, media library
  JPEG/PNG/WebP, readiness checklist, preview sanitized, optimistic concurrency
  và khóa metadata sau lần publish đầu.
- Workflow revision có diff với bản public, lịch sử, submit/approve/reject có
  ghi chú, publish với ngày rà soát, archive/restore; action tách feature và ẩn
  theo RBAC. Modal workflow mobile dùng footer full-width không chồng nút.
- Lint phần thay đổi và architecture check sạch, production build đạt, 13
  targeted test pass; smoke lưu → duyệt → xuất bản pass ở desktop/tablet/mobile.

#### Added — FAQ/Help Center KB-P4 public help center

- Mở public API category/article browse, search không dấu nhiều token, filter
  type, pagination và detail có related/trước/sau; selector fail-closed chỉ lộ
  revision approved đang publish của article/category active.
- Thêm throttle IP 120/phút, cache policy public 60 giây + stale-while-revalidate
  300 giây, ETag/304, generation invalidation sau mutation public và fallback
  đọc DB khi cache lỗi; kill switch production trả 404 mà không ảnh hưởng admin.
- Thêm SEO shell thật cho home/category/detail với canonical, Open Graph,
  Article và BreadcrumbList; 404 có status thật, toàn bộ rollout KB-P4 giữ
  `noindex, nofollow` và không dùng FAQPage schema.
- Thêm ba route lazy `/tro-giup`, `/tro-giup/:categorySlug` và detail; giao diện
  responsive theo mô hình hero search + sidebar category + question rows, URL
  là nguồn chuẩn cho search/type/page, có loading/empty/error/retry/404 và rich
  content sanitize với ảnh lazy/broken-image fallback.
- 28 test knowledgebase backend pass; 9 frontend regression pass; lint,
  architecture, build pass và smoke browse → search → detail → 404 pass trên
  desktop/tablet/mobile.

### 2026-07-29

#### Added — Account status enforcement theo vai trò

- Thay thao tác đổi trạng thái chung bằng state machine rõ: tạm khóa, cấm,
  bắt đầu khôi phục, gỡ giữ tài nguyên và mở lại; cấm/khôi phục tài khoản bị
  cấm vẫn superuser-only ở P0.
- Thêm `AccountStatusTransition` cùng `temporary_lock`/`ban_review`/
  `legacy_lock` cho campaign và job. Workflow không còn đổi campaign active
  thành paused, nhờ đó không làm sai trạng thái nghiệp vụ và chỉ khôi phục đúng
  lớp hold của thao tác.
- Public job selector fail-closed theo job, campaign, poster và campaign owner,
  bao gồm cả danh sách việc làm ứng viên đã lưu; mutation job/campaign/
  application khóa account trước resource để đóng race với admin enforcement.
- Candidate bị hạn chế vẫn giữ CV/application snapshot; employer chỉ được
  chuyển hồ sơ sang `rejected`, không được đẩy pipeline tiến thêm.
- UI admin có modal rộng, thông tin đối chiếu user, dấu bắt buộc, preview tác
  động theo vai trò và hướng dẫn quy trình khôi phục nhiều bước. 409 tự tải lại
  preview nhưng không tự confirm.
- Thêm transactional notice không chứa evidence, permission không grant mặc
  định, command đối soát read-only/`--apply`, tài liệu thiết kế và runbook
  rollout/rollback.
- Quality gate toàn repo: 633 backend test pass, coverage 86.25%; 699 frontend
  unit/integration test pass; production build và bundle budget đạt; 159 E2E
  smoke test pass trên desktop/tablet/mobile. Reconciliation staging local có
  0 mismatch và hai permission nhạy cảm có 0 role grant.

#### Fixed — Animation dải thông báo

- `slide` và `fade` của một thông báo nay lặp nhẹ theo khoảng 4–15 giây đã cấu
  hình; trước đây hiệu ứng chỉ chạy 280–320 ms lúc component vừa mount nên
  người dùng gần như luôn thấy nội dung đứng yên.
- Nhóm có nhiều thông báo vẫn chuyển item theo thời lượng riêng; `static` không
  chuyển động. Animation dừng khi hover/focus/tab bị ẩn và tự tắt khi thiết bị
  yêu cầu reduced motion.
- Preview quản trị chạy đúng loại và thời lượng animation của bản nháp. Verify:
  683 frontend test, lint/architecture/build/bundle budget và 12/12 smoke
  runtime trên desktop/tablet/mobile đều pass.

#### Fixed — Luân phiên và tạm ẩn thông báo cùng hạng

- Khi tạm ẩn một item trong hàng đợi cùng hạng, runtime xác định lại index và
  đưa item kế tiếp lên ngay. Focus còn ở nút đóng vẫn pause animation nhưng nội
  dung mới luôn nhìn thấy; không còn trạng thái mất chữ nhưng nền dải còn lại.
- Editor đổi nhãn thành **Thứ tự trong cùng hạng** và giải thích: số lớn chạy
  trước, mọi item thuộc hạng cao nhất vẫn luân phiên từng cái chứ không hiển thị
  đồng thời.
- Regression mới đóng lần lượt hai item cùng hạng và kiểm tra count, nội dung,
  opacity cùng focus-pause trên desktop/tablet/mobile. Verify: 684 frontend
  test, lint/architecture/build/bundle budget và 15/15 smoke runtime pass.

#### Changed — Trải nghiệm soạn thông báo đa cổng

- Thay ô nhập URL CTA nội bộ bằng danh mục có tìm kiếm, nhóm theo bốn portal và
  tự sinh URL đúng cho local hoặc subdomain triển khai. Nơi hiển thị và trang
  CTA độc lập nên thông báo ở cổng Ứng viên có thể dẫn sang Marketing NTD.
- Gắn nhãn **Công khai** hoặc **Cần đăng nhập** cho trang CTA; cảnh báo trực
  tiếp khi thông báo dành cho guest nhưng CTA đi vào workspace được bảo vệ.
- Thay textarea route include/exclude bằng multi-select có tìm kiếm, lọc theo
  surface và vẫn cho nhập prefix nâng cao với validation tương thích backend.
- Catalog có test contract cho URL/prefix/access. Route mới được đăng ký một
  lần để xuất hiện ở mọi editor sau lần triển khai; revision đã publish không
  bị tự viết lại URL.
- Verify: 683 frontend test pass; lint/architecture/build và bundle budget
  293,6/320 KiB JS, 34,2/35 KiB CSS pass; smoke quản trị thông báo 6/6 trên
  desktop/tablet/mobile.

#### Fixed — Preview bản nháp thông báo

- Bước Xem trước nay đọc toàn bộ form store, không còn nhận object rỗng và hiện
  placeholder sau khi quản trị viên đã soạn nội dung ở bước đầu.
- Route selector chuyển tiếp đầy đủ `value`, `onChange` và `id` của Ant Form,
  tránh trạng thái nhìn như đã chọn nhưng payload không lưu prefix.

#### Added — Announcement AN-P5 rollout hardening

- Thêm kill switch runtime fail-closed theo từng surface bằng
  `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES`. Feed bị tắt trả
  `remote_enabled=false`, danh sách rỗng và không query dữ liệu; label xác thực,
  bảo mật và tuân thủ do hệ thống sở hữu vẫn tiếp tục hiển thị.
- Thêm telemetry PII-free cho latency/feed/contract/render error, throttle cho
  runtime event và error boundary trả banner legacy khi strip gặp lỗi. Client
  chỉ nhận contract remote khi backend xác nhận `remote_enabled=true`.
- Thêm command read-only `announcement_rollout_preflight`, kiểm tra integrity,
  critical end time, live/scheduled surface và nhóm rotation xung đột trước khi
  mở rollout.
- Bổ sung runbook staging theo thứ tự Admin → NTD marketing → workspace NTD →
  ứng viên, ngưỡng monitoring, failure injection, kill-switch rehearsal và
  rollback không reverse schema hay xóa dữ liệu.
- Quality gate code cuối: 615 backend test (86,12% coverage), 666 frontend test,
  architecture/import contract sạch, OpenAPI validate, bundle 293,6 KiB JS /
  34,2 KiB CSS gzip và 153 smoke E2E trên desktop/tablet/mobile. Rollout staging
  thực tế vẫn cần evidence vận hành theo runbook trước khi chốt AN-P5 hoàn tất.

#### Fixed — Announcement analytics khi Redis gián đoạn

- Failure injection trên staging cô lập phát hiện rate-limit truy cập Redis
  trước service analytics và trả HTTP 500, dù tracking được thiết kế
  best-effort.
- Hai endpoint telemetry announcement nay fail-open riêng ở lớp throttle khi
  cache lỗi, phát metric PII-free `announcement_throttle`; giới hạn vẫn hoạt
  động bình thường khi cache khỏe và analytics dedupe vẫn không tăng aggregate
  khi Redis lỗi.
- Chạy lại với Redis dừng đạt HTTP 202, sau đó Redis được khôi phục healthy và
  active feed tiếp tục trả 200. Bằng chứng bốn surface, priority và kill switch
  nằm tại
  [rehearsal staging 2026-07-29](docs/06-deployment/announcement-staging-evidence-2026-07-29.md).
- Full gate sau bản vá đạt 617 backend test với coverage 86,13%, 666 frontend
  test, bundle budget và 153 smoke E2E desktop/tablet/mobile.

#### Fixed — Đặt mật khẩu lần đầu cho tài khoản mạng xã hội

- Thay cảnh báo “Cần đăng nhập lại để tạo mật khẩu” (chỉ hiện sau khi người dùng
  điền xong form rồi bấm lưu, và xoá phiên để đá về `/login`) bằng luồng xác
  thực lại tại chỗ: banner hiện ngay khi mở trang, nút “Xác thực với
  &lt;Provider&gt;” mở OAuth với `next` là trang hiện tại nên người dùng quay về
  đúng chỗ đang làm, không mất phiên.
- Thêm `GET /api/auth/password/` trả `{has_usable_password, requires_reauth,
  reauth_provider, reauth_max_age_seconds}` để client biết trước điều kiện của
  phiên. `POST` trả kèm `reauth_provider` trong lỗi 403 `reauth_required`.
- Nút “Tạo mật khẩu” bị vô hiệu hoá khi phiên chưa đủ điều kiện; tài khoản không
  liên kết provider nào được hướng sang luồng “Quên mật khẩu” thay vì kẹt.
- Giữ nguyên cửa sổ bảo mật `AUTH_REAUTH_MAX_AGE_SECONDS` (mặc định 5 phút) —
  đây là bằng chứng duy nhất thay cho mật khẩu hiện tại, không nới lỏng.

#### Fixed — Hàng chờ và chi tiết xác thực nhà tuyển dụng

- Đồng nhất badge “Chờ xác thực NTD” với bộ lọc mặc định “Cần xử lý”: hàng chờ
  nay gồm hồ sơ `pending`, `in_review` và hồ sơ có giấy tờ hiện hành chờ duyệt,
  nên không còn badge có số nhưng bảng rỗng.
- Sửa cảnh báo Ant Design `columns.render return cell props is deprecated` ở
  bảng tài khoản. Formatter ngày nay chỉ nhận giá trị ô, không nhận nhầm cả
  record làm fallback khi ngày trống.
- Thu gọn hành trình 9 bước theo mặc định, cho phép mở chi tiết khi cần; nhóm
  bộ giấy tờ theo quyền đại diện, pháp lý doanh nghiệp và bảo vệ dữ liệu.
- Làm rõ đối chiếu mã số thuế là bằng chứng bổ trợ về pháp nhân công ty trong
  hồ sơ xác thực quyền đại diện, không phải dấu hiệu NTD đã tạo hoặc chỉnh sửa
  công ty; yêu cầu cập nhật công ty tiếp tục là workflow độc lập.

### 2026-07-27

#### Changed — Quyền truy cập nhà tuyển dụng

- Bỏ yêu cầu MFA khi nhà tuyển dụng truy cập dữ liệu ứng viên, tạo hồ sơ công
  ty hoặc quản lý ảnh công ty. Các endpoint vẫn yêu cầu phiên employer hợp lệ
  và giữ nguyên ràng buộc phạm vi tin tuyển dụng, công ty và vai trò owner.
- Khôi phục hành trình xác thực employer về năm bước chính; “Đăng tin tuyển
  dụng đầu tiên” tiếp tục là bước thứ sáu tách riêng, không đưa các trạng thái
  email, onboarding hoặc chờ admin duyệt thành bước bổ sung.
- Sửa liên kết mở văn bản DLCN riêng tư: nội dung được tải qua API client đã
  xác thực rồi mở bằng blob URL, tránh tab mới gọi trực tiếp backend và nhận
  lỗi `401 Unauthorized`.

### 2026-07-26

#### Added — Account Management G3

- Thêm migration `accounts.0016`, seed bảy permission `account.*`,
  `AdminProvisioningScope` và `AdminInvitation`; mỗi lời mời dùng token ký có
  version, hết hạn 72 giờ và chỉ chấp nhận một lần.
- Thêm migration `accounts.0017` cho index phiên theo user/portal/IP/trạng thái
  thu hồi, phục vụ danh sách thiết bị và impact thu hồi phiên.
- Mở API quản lý Candidate/Employer/Admin, phiên, hoạt động, impact đổi trạng
  thái/thu hồi phiên, lời mời Admin và whitelist cấp tài khoản. Các thao tác
  ghi dùng transaction, row locking, audit và impact token; thu hồi scope đồng
  thời thu hồi mọi lời mời pending liên quan.
- Thêm `/admin/app/accounts` với năm tab, bộ lọc nâng cao, action icon/tooltip,
  drawer xem nhanh, trang chi tiết hồ sơ–bảo mật–audit và luồng nhận lời mời có
  MFA email cùng mã dự phòng chỉ hiển thị một lần.
- Trang Phân quyền có tab “Cấp tài khoản” dành riêng cho superuser, hiển thị
  whitelist nguồn–đích, số lời mời pending và impact preview trước khi thu hồi.
- Thêm command local idempotent `seed_admin_account_demo` tạo superuser, nhân
  sự được ủy quyền và Admin kiểm duyệt kèm mã dự phòng demo.

#### Security — Account Management G3

- Admin được ủy quyền phải đồng thời có một membership hiệu lực, permission
  `account.admin.invite` và scope nguồn–đích active; backend chặn request giả
  mạo role ngoài whitelist và mọi role chứa quyền quản trị nhạy cảm.
- Người mời thường chỉ thấy và quản lý lời mời của chính mình. Sau kích hoạt,
  mọi thay đổi trạng thái, chức danh hoặc bảo mật của Admin vẫn superuser-only.
- Accept đồng thời được serialize bằng row lock; chỉ một transaction tạo đúng
  một membership. Audit không ghi token, mật khẩu, MFA secret hay mã dự phòng.
- Sửa reset mật khẩu Admin: email dùng đúng nhãn “Quản trị” và link cổng
  `/admin/app/reset-password?portal=admin`; backend ràng buộc token với cổng
  Admin, kiểm tra trạng thái ở lúc gửi/lúc dùng, và từ chối reset cho tài khoản
  `inactive` hoặc `banned`.

#### Changed — Gán chức danh nhân viên

- Migration `accounts.0015` hợp nhất dữ liệu lịch sử về một membership active
  cho mỗi nhân viên và thêm ràng buộc database tương ứng. Gán chức danh mới nay
  là thao tác thay thế nguyên tử: thu hồi chức danh cũ, audit trước/sau và bust
  cache quyền sau commit.
- Bỏ endpoint, payload và UI “phòng ban chính”. Preview đổi chức danh hiển thị
  rõ chức danh hiện tại cùng quyền được thêm/mất; trang Nhân viên chỉ còn một
  dòng chức danh hiệu lực cho mỗi người.
- Thêm regression cho thay thế membership và hai xác nhận đồng thời: chỉ một
  transaction được commit, yêu cầu còn lại nhận stale impact token.
- Bổ sung bộ lọc nhanh theo nội dung/trạng thái/MFA, action icon có tooltip và
  drawer xem chi tiết nhân viên; bảng phòng ban/chức danh hiển thị thêm mã và
  số liệu vận hành nhưng không lặp thao tác chỉnh sửa trong menu.

#### Changed — Bảo mật tài khoản quản trị

- Admin có thể bật hoặc tắt Email MFA, ứng dụng xác thực và mã dự phòng như
  các tài khoản khác. Mọi thao tác tắt vẫn bắt buộc step-up bằng phương thức
  MFA đang có và được ghi audit không chứa mã xác minh hay secret.

#### Added — Quản trị phân quyền (RBAC G2)

- Thêm migration `accounts.0014`, cờ `is_system_managed` cho department/role,
  ma trận seed code-owned và command tạo admin thường không bypass RBAC.
- Mở API `/api/admin/` cho phòng ban, chức danh, permission runtime, membership
  và staff; có impact preview, restore mặc định, audit/cache và primary
  deterministic.
- Thêm trang `/admin/app/access-control` ba tab, PermissionPicker giữ grant
  deprecated, badge MFA, trạng thái loading/empty/error và impact modal cho mọi
  thao tác nguy hiểm.

#### Security — RBAC admin G2

- Mọi ghi, mọi impact preview và dữ liệu nhân sự là superuser-only; admin
  `admin_access.view` chỉ được đọc cấu trúc tổ chức.
- Impact token ký ràng buộc revision/operation/resource/payload, hết hạn 10
  phút; xác nhận khoá row phụ thuộc và trả `409 admin_resource_changed` khi
  preview stale.
- Chặn gán người vào role không có permission active và chặn xoá sạch quyền của
  role còn membership hoạt động; code trùng được map ổn định về 400.
- Quality gate cuối: 417 backend test (85,54% coverage), 416 frontend test,
  architecture/import contract sạch, build trong bundle budget và 81 smoke E2E.

#### Added — RBAC admin G1.1

- Thêm registry permission code-owned, phòng ban, chức danh, membership có lịch
  sử thu hồi, primary deterministic, cache 60 giây và audit log luôn bật.
- Thêm command đồng bộ/deprecate permission, seed hội tụ ma trận phòng ban,
  export contract frontend, bootstrap MFA và readiness gate trước khi siết API.
- `/api/auth/me/` trả `admin_access`; cổng admin có trang “Quyền của tôi”, badge
  phòng ban, sidebar/route/login destination dùng chung một access policy.

#### Security — RBAC admin G1.2

- Siết site settings ở mức superuser; áp permission chi tiết cho catalogue dịch
  vụ, lead tư vấn, catalogue CV và kiểm duyệt tin.
- Chặn nhân viên CV đi vòng qua `PATCH is_active/status`; dữ liệu do staff tạo
  mặc định ẩn/draft, gồm cả upload background đi qua service riêng.
- Chuẩn hoá mọi lỗi thiếu quyền thành `403 admin_permission_denied`; frontend
  revalidate session có cooldown khi nhận chùm 403.

#### Documentation & Verification

- Bổ sung thiết kế database RBAC, ma trận seed, runbook hai release, cảnh báo
  endpoint dashboard/blog còn legacy và gate chống lệch registry backend/frontend.

### 2026-07-24

#### Added — Cá nhân hóa tài khoản ứng viên

- Mở ba trang thật trong cụm `/tai-khoan`: cài đặt thông báo qua email, đổi mật khẩu và danh sách việc làm phù hợp; route tiếp tục được bảo vệ theo thứ tự `AuthGuard → RoleGuard(candidate)`.
- Thêm 12 lựa chọn email theo ba nhóm hệ thống/cơ hội việc làm/giới thiệu dịch vụ. Các lựa chọn mặc định bật và tự lưu từng thay đổi qua `GET/PATCH /api/candidate/email-notification-settings/`; email xác thực, đặt lại mật khẩu và 2FA là email giao dịch ngoài preference này.
- Thêm feed `GET /api/jobs/recommendations/for-me/` có phân trang, lý do/điểm khớp, nguồn CV đang dùng và trạng thái thiết lập/consent. Preference là nguồn chính, CV mặc định hoặc CV gần nhất bổ sung vị trí/headline/kỹ năng; không tuyên bố dùng lịch sử tìm kiếm vì backend chưa lưu tín hiệu đó.

#### Changed — Menu, consent và bảo mật ứng viên

- Dropdown tài khoản desktop chuyển sang mở bằng click, single-open accordion, tự mở nhóm chứa route hiện tại và cuộn nội bộ theo viewport; header tài khoản cùng nút đăng xuất luôn nhìn thấy. Bỏ badge thông báo giả.
- Form nhu cầu việc làm luôn cho phép bật hoặc rút consent gợi ý; nội dung giải thích đúng nguồn dữ liệu thực tế và nhãn quyền hiển thị hồ sơ cho nhà tuyển dụng không còn bị diễn đạt thành email/sự kiện. Endpoint gợi ý theo CV cũng dừng đọc nội dung CV khi chưa có consent; cập nhật hoặc rút consent xóa cache feed để không lóe lại kết quả cũ.
- Form đổi mật khẩu dùng chung candidate/employer nhưng không còn hardcode điều hướng employer; candidate thấy email đăng nhập read-only, rule mật khẩu khớp backend và tiếp tục hỗ trợ xoay token/đăng xuất thiết bị khác.
- Trang cài đặt email rút về ba nhóm phẳng theo TopCV, bỏ card/icon/mô tả lặp và không hiển thị email giao dịch bảo mật như một switch riêng.

#### Changed — Việc làm đã lưu và gợi ý tương tự

- Nâng cấp `/viec-lam-da-luu` với empty/error/retry rõ ràng, thời điểm lưu, CTA tạo CV đúng đích và feed việc làm vẫn hữu ích khi ứng viên chưa lưu tin nào.
- Thay phép chọn một category phổ biến ở frontend bằng
  `GET /api/jobs/recommendations/by-saved/`: xếp hạng pairwise tối đa 20 tin lưu
  gần nhất theo chuyên môn, tiêu đề, kỹ năng, địa điểm và hình thức làm việc;
  loại tin đã lưu, đã ứng tuyển hoặc không còn public.
- Khi chưa có tín hiệu, trả tin active mới nhất và hiển thị trung thực là “Việc
  làm bạn có thể quan tâm”; lưu/bỏ lưu thành công tự làm mới feed. Route
  standalone được bảo vệ bằng `AuthGuard → RoleGuard(candidate)`.
- Siết public availability khi lưu tin và semantic anchor khi xếp hạng: không
  thể lưu tin nháp/đóng bằng public ID; kỹ năng nhiễu hoặc từ chức danh chung
  không đủ để biến một công việc khác chuyên môn thành “tương tự”.

#### Documentation & Verification

- Bổ sung tài liệu thuật toán recommendation, schema email preference, contract API/frontend, ownership map FSD, tiến độ và OpenAPI.
- Ghi lại khảo sát TopCV ở trạng thái 0 và 3 tin đã lưu, tài liệu hóa trọng số,
  fallback, privacy và contract của feed gợi ý theo lịch sử lưu.
- Thêm regression backend cho preference email, permission/consent, fallback không CV và feed candidate; thêm unit frontend cho menu, email auto-save, đổi mật khẩu, API và các trạng thái trang việc làm phù hợp.
- Sau review, bổ sung regression cho prefilter không dấu/kỹ năng JSON, salary mở, CV archived/failed, job đã ứng tuyển, số query phẳng, consent trên trang lưu CV, cache khi rút quyền, lỗi tải preference, re-auth OAuth và accessibility keyboard/link.
- Ổn định regression báo cáo chiến dịch ở ranh giới ngày UTC bằng cách tạo daily counter theo cùng múi giờ báo cáo `Asia/Ho_Chi_Minh`; quality gate đã đạt backend coverage 85,50%, 374 frontend test và 81 smoke E2E; regression cuối cho saved-job đạt 15 test.

### 2026-07-20

#### Added — Quản lý hồ sơ công ty đầy đủ

- Nâng cấp `/tuyendung/app/account/settings/company` thành ba trạng thái hoàn chỉnh: catalogue công ty dùng chung có recent/search/phân trang; form tạo Doanh nghiệp/Hộ kinh doanh; và hồ sơ đã liên kết theo quyền owner/member/pending.
- Form mới có option card theo luồng, logo/website/tên thương mại với checkbox phụ thuộc, catalogue lĩnh vực/quy mô/thị trường/khách hàng, TipTap rich text 10.000 ký tự, gallery nhiều ảnh và hồ sơ chứng minh cho thay đổi pháp lý.
- Bổ sung `GET /api/employer/company/catalogs/`; chuẩn hóa `company/search` trả sáu công ty mỗi trang, mới nhất trước khi không có từ khóa và tìm không dấu theo tên/tên thương mại/MST khi có từ khóa.
- Thêm migration `employers.0014` seed idempotent catalogue lĩnh vực đầy đủ; media công ty chỉ nhận JPG/PNG/WebP tối đa 5 MB, gallery tối đa 10 ảnh và dọn file khi thao tác DB lỗi.

#### Security — Nội dung công ty và cập nhật pháp lý

- Mô tả/phúc lợi được lưu dưới HTML allowlist (`p`, `br`, `strong`, `em`, `u`, `ul`, `ol`, `li`), bỏ thuộc tính/script/style nguy hiểm và giới hạn theo 10.000 ký tự nhìn thấy; API chi tiết việc làm tiếp tục trả mô tả công ty dạng plain text.
- Owner gửi thay đổi qua `CompanyUpdateRequest`; đổi tên/MST bắt buộc lý do, loại hồ sơ và tài liệu gắn đúng request trước khi admin có thể duyệt. Member chỉ xem, request pending thứ hai tiếp tục bị chặn.

#### Verification — Trang thông tin công ty

- Thêm regression backend cho catalogue, validation, rich-text XSS, gallery và update-request proof; unit frontend cho mapping/diff/media cùng option cards/recent list.
- Thêm Playwright smoke riêng chạy xanh desktop, tablet `834×1112` và Pixel mobile, kiểm tra không tràn ngang và nhãn động Hộ kinh doanh.

#### Changed — Quy tắc liên kết công ty

- Bỏ điều kiện phải xác thực số điện thoại trước khi tạo công ty mới hoặc gửi hồ sơ liên kết công ty có sẵn; xác thực điện thoại tiếp tục là một bước bảo mật độc lập.
- Sau lần tạo hoặc chọn công ty đầu tiên, tài khoản không thể chuyển sang công ty khác. Backend khóa recruiter trong giao dịch để chặn cả request đồng thời; frontend chỉ hiển thị hồ sơ đã liên kết và thông báo đây là liên kết cố định.

#### Changed — Catalogue công ty gọn hơn

- Luồng tìm công ty chuyển về bố cục tab ngang, ô tìm kiếm chiếm toàn bộ hàng, kèm nhãn **Lưu ý!** về tên công ty theo dữ liệu Cục Thuế.
- Card catalogue rút gọn thành logo, tên, MST, một dòng `địa chỉ | quy mô nhân viên`, lĩnh vực và nút **Chọn** nhỏ; lĩnh vực bị giới hạn một dòng có ellipsis, hover để xem đầy đủ; mobile tự xếp lại mà không tràn ngang.
- Khu chọn logo trong form tạo công ty được rút về cụm căn giữa không khung: avatar/logo tròn có affordance camera, nhãn bắt buộc và checkbox “Tôi không có logo”.
- Bỏ trường Năm thành lập khỏi form; các phần thông tin còn lại dùng đường phân cách nhẹ thay vì nhiều card, giúp input liền mạch và gọn hơn.
- Tiếp tục nén form theo spacing TopCV: bỏ heading nhóm thị giác, giảm khoảng cách alert/label/form item và chiều cao editor, giữ nguyên nhãn và validation của từng trường.
- Chứng minh Tên thương mại giờ chỉ hiện CTA **+ Thêm giấy tờ chứng minh Tên thương mại**. CTA mở popup chọn **Giấy tờ** (JPEG/JPG/PNG/PDF, tối đa 5 MB) hoặc **Website**; sau khi lưu hiện link mở tab mới và nút **Chỉnh sửa**.
- Dropdown **Lĩnh vực chính** bị khóa cho đến khi người dùng chọn ít nhất một **Lĩnh vực hoạt động**, tránh chọn dữ liệu không hợp lệ.
- Khi chọn “Tên thương mại trùng với tên đăng ký kinh doanh”, hệ thống ẩn thao tác thêm/chỉnh sửa giấy tờ chứng minh tên thương mại vì không còn cần thiết.
- Chọn một công ty từ catalogue giờ liên kết ngay, không mở modal và không bắt người dùng tải hồ sơ ở bước này; trạng thái liên kết vẫn chờ quản trị viên duyệt.
- Làm lại trạng thái công ty đã liên kết theo hierarchy TopCV: khối “Yêu cầu cập nhật thông tin công ty” có thời điểm gần nhất/CTA tạo yêu cầu, tiếp theo là hồ sơ đọc dạng nhãn–giá trị; form yêu cầu có tiêu đề và mô tả ngữ cảnh rõ ràng.
- Liên kết công ty có hiệu lực ngay sau khi chọn; bỏ hoàn toàn trạng thái/alert chờ duyệt liên kết.
- Mọi employer đã liên kết công ty, gồm cả member, đều thấy và tạo được **Yêu cầu cập nhật**; yêu cầu vẫn ở trạng thái chờ quản trị viên duyệt trước khi áp dụng.
- Tương thích liên kết cũ còn trạng thái `pending`: chỉ cần tài khoản đã có công ty là luôn hiển thị **Tạo yêu cầu**.

#### Changed — Dashboard nhà tuyển dụng: khối "Xin chào" theo UX TopCV

- Dựng lại section hành trình xác thực (`DashboardVerificationJourney`) theo mẫu TopCV: mỗi bước là thẻ pill bo góc riêng biệt cuộn ngang, bước đang làm có viền + chữ + nút mũi tên xanh, bước đã xong hiển thị check tròn và chữ mờ.
- Thêm hai nút chevron trái/phải ở header để cuộn qua các bước; ghim sticky thẻ "Đăng tin tuyển dụng đầu tiên" ở ngoài cùng bên phải, tách khỏi vùng cuộn.
- Màu chủ đạo dùng biến thương hiệu (`--brand-primary`, `--brand-primary-soft`, `brand_primary_color`) từ site settings thay cho hardcode, đồng bộ khi đổi màu brand.

#### Fixed — Gộp danh sách domain email miễn phí về một nguồn

- Bỏ `PUBLIC_EMAIL_DOMAINS` chép tay ở frontend (`account-verification-level.js`); cấp độ xác minh email doanh nghiệp giờ tin hoàn toàn vào cờ `email_domain_verified` do backend trả, tránh lệch danh sách khi thêm domain mới.

#### Fixed — CI frontend

- Sửa regression coverage của trang cài đặt bảo mật: test thao tác phương thức 2FA giờ bám vào `data-testid` ổn định thay vì class layout, nên không hỏng khi UI chuyển từ flex sang grid.
- Bỏ import icon không dùng làm `static-quality` dừng lint; giữ kiểm tra ranh giới API/feature và kiến trúc sạch.
- Điều chỉnh ngân sách CSS initial gzip từ 30 KiB lên 35 KiB, phản ánh stylesheet responsive của shell settings hiện ở 31,5 KiB mà vẫn giữ giới hạn rõ ràng; JavaScript initial vẫn ở 279/320 KiB.
- Khôi phục đầy đủ chuỗi kiểm tra: coverage 76 file/270 test, production build, bundle budget và 63 Playwright smoke desktop/tablet/mobile đều chạy xanh.
- Sửa smoke xác thực employer: tài khoản đã hoàn tất năm điều kiện vẫn được redirect khỏi checklist, đồng thời test xác nhận CTA **Đăng tin tuyển dụng đầu tiên** còn hiển thị như hành động ghim độc lập, không bị tính là bước xác thực.

### 2026-07-19

#### Changed — Xác thực giấy tờ nhà tuyển dụng

- Hoàn thiện UX trang `/tuyendung/app/account/settings/gpkd`: hai phương thức giấy ĐKDN hoặc giấy ủy quyền + CCCD/hộ chiếu luôn giữ thứ tự dọc; mỗi phương thức chỉ mở các ô hồ sơ tương ứng, có khoảng cách thao tác rõ ràng trên desktop và mobile.
- Thay minh họa code-native bằng ba ảnh mẫu đã tối ưu trong `frontend/public/images/employer/`; cập nhật link tải mẫu giấy ủy quyền và link hướng dẫn đăng tải.
- Trong giai đoạn hiện tại, người dùng vẫn xem/chọn file cục bộ nhưng nút Lưu được khóa; không gửi tài liệu lên API trước khi workflow cập nhật thông tin công ty và lưu giấy tờ được bật.

#### Added — Văn bản xử lý Dữ liệu cá nhân

- Hoàn thiện `/tuyendung/app/account/settings/personal-data-protection` theo hai khối độc lập: thỏa thuận Ứng viên–Nhà tuyển dụng có hướng dẫn, tải mẫu DOCX local, tải lên/lưu; và thỏa thuận nền tảng–Nhà tuyển dụng có link văn bản đầy đủ cùng xác nhận inline.
- Đưa mẫu DOCX người dùng cung cấp vào `frontend/public/documents/` để nhà tuyển dụng tải về và chỉnh sửa. Giao diện chỉ nhận một tệp DOC/DOCX/PDF tối đa 5 MB; chọn tệp mới sẽ thay thế tệp đang chờ lưu.
- Thêm migration `employers.0012`: văn bản DLCN được gắn với recruiter thay vì bắt buộc công ty, có thể lưu/thay thế khi chưa cập nhật thông tin công ty; dữ liệu DLCN cũ theo company vẫn được đọc để giữ nguyên tiến độ xác thực.

#### Added — Quản lý nhu cầu tuyển dụng

- Mở route `/tuyendung/app/account/settings/recruitment-demand`: hiển thị toàn bộ nhu cầu đã khai báo lúc onboarding và cho phép thêm, sửa, xóa, bật/tắt từng nhu cầu. Nguồn ngân sách là thiết lập dùng chung Công ty/Cá nhân, được lưu cho các nhu cầu hiện có và tự áp dụng khi tạo nhu cầu mới.
- Migration `employers.0013` chuyển nhu cầu từ một bản ghi onboarding cố định sang nhiều nhu cầu theo recruiter, giữ dữ liệu cũ và trạng thái hoạt động mặc định; thêm API CRUD `/api/employer/recruitment-needs/`.
- Tinh chỉnh UX theo mẫu TopCV: form thêm/sửa có hierarchy rõ ràng, danh sách responsive không cuộn ngang và thiết lập nguồn ngân sách mở popover radio với nút Lưu/Hủy.

#### Changed — Responsive toàn bộ cổng nhà tuyển dụng

- Chuẩn hóa shell employer cho mobile/tablet: sidebar workspace mở dạng drawer phủ có mask, tiêu đề route không tràn, content không phát sinh cuộn ngang và menu cài đặt chuyển thành dropdown trên màn hình nhỏ.
- Responsive lại dashboard, xác minh tài khoản, hồ sơ/công ty, GPKD, DLCN, bảo mật, đổi mật khẩu và nhu cầu tuyển dụng; grid tự xếp cột, text dài ngắt an toàn, modal/popover giới hạn theo viewport và nút form chiếm đủ chiều rộng trên mobile.
- Tinh chỉnh typography, CTA và card của toàn bộ trang marketing employer; thêm Playwright project tablet `834x1112` cùng regression chống tràn ngang cho desktop, tablet và Pixel mobile.
- Ghi responsive mobile-first thành baseline bắt buộc trong `frontend/ARCHITECTURE.md` cho mọi giao diện employer phát triển sau này.

#### Changed — Trang đăng ký nhà tuyển dụng

- Bỏ thanh **Các bước tạo tài khoản** ở đầu trang đăng ký; luồng hai phần vẫn tiếp tục bằng CTA phía cuối form và giữ nút Quay lại ở phần thông tin nhà tuyển dụng.
- Thêm khối **Quy định đăng ký tài khoản** theo UX tham khảo TopCV: mặc định mở, cho phép hiện/ẩn bằng nút có trạng thái truy cập `aria-expanded`, dùng tên website và hotline từ site settings.
- Làm phẳng phần giới thiệu và hai phần form, bỏ card viền/đổ bóng bao quanh để giảm lớp thị giác; bổ sung regression Playwright cho trạng thái Quy định và chống tràn ngang trên desktop, tablet, mobile.
- Form mật khẩu employer hiển thị mức độ yếu/trung bình/mạnh, thanh tiến trình và bốn điều kiện cập nhật theo từng ký tự; chỉ cho tiếp tục khi có đủ độ dài, hoa/thường, chữ số và ký tự đặc biệt.
- Hướng dẫn xác minh mật khẩu chỉ hiển thị khi ô Mật khẩu đang được focus và tự đóng khi người dùng rời ô, tránh che hoặc kéo dài form không cần thiết.
- Thêm lưu ý ngay dưới email đăng ký: email không thuộc tên miền công ty có thể bị giới hạn quyền mua hoặc sử dụng một số dịch vụ.

#### Fixed — Hoàn tất xác thực employer

- Đồng bộ checklist, progress dashboard và redirect `/employer-verify` theo đúng năm điều kiện xác thực; mục **Đăng tin tuyển dụng đầu tiên** là hành động sản phẩm, không còn được tính vào tiến độ hay giữ tài khoản đã xác thực ở checklist.
- Thiết kế lại hành trình xác thực trên dashboard theo hierarchy TopCV: phần trăm/lời chào rõ ràng, năm bước có trạng thái; bố cục tự chuyển thành danh sách dễ quét trên mobile.
- Căn chỉnh lại journey sát mẫu dashboard TopCV: năm bước nằm trong dải cuộn riêng, tiêu đề mỗi bước mở đúng màn hình tác vụ ở tab mới; mục **Đăng tin tuyển dụng đầu tiên** được ghim ngoài cùng bên phải ở trạng thái khóa và không còn hiển thị điểm thưởng.
- Tải và self-host SVG `v-brand` tham khảo từ TopCV; dùng làm nền trang trí cho khối hành trình xác thực, không phụ thuộc CDN ngoài khi hiển thị.
- Đồng bộ vị trí ảnh nền `v-brand` theo CSS mẫu TopCV (`top: -250px; bottom: 0; right: 5%`) để họa tiết neo đúng cạnh phải của journey.

#### Fixed — Màu liên kết DLCN

- Ép màu emerald cho các liên kết/hành động trên trang DLCN (hướng dẫn, tải mẫu, xem nội dung đầy đủ, thỏa thuận và tài liệu đã tải) để không bị màu xanh mặc định của Ant Design ghi đè.
- Đặt checkbox xác nhận thỏa thuận nền tảng ở một dòng/khối riêng dưới liên kết xem văn bản, giữ khoảng cách và căn chỉnh ổn định khi nội dung dài.

#### Fixed — Toast workspace nhà tuyển dụng

- Thay toàn bộ lớp `message` Ant Design bằng Sonner: toast được render độc lập ở cấp `document.body`, không thể bị header hay vùng cuộn của workspace cắt mất nội dung. Các trạng thái thành công, lỗi, cảnh báo, thông tin và đang tải có biểu tượng/màu riêng; người dùng có thể đóng từng toast.

#### Changed — Nộp giấy tờ nhà tuyển dụng

- Bỏ yêu cầu MFA và xác thực lại phiên đối với thao tác nộp/thay thế giấy tờ doanh nghiệp, giấy tờ liên kết công ty và văn bản DLCN. Endpoint vẫn yêu cầu phiên nhà tuyển dụng hợp lệ để gắn đúng chủ sở hữu; mọi tài liệu nộp mới tiếp tục chờ admin duyệt.
- Sau khi lưu văn bản DLCN, hiển thị toast xác nhận tiếp nhận theo tên hệ thống, nhãn “Hệ thống đang xử lý” và chỉ cho mở form thay tệp qua nút Chỉnh sửa/Hủy. Tài liệu DOC/DOCX đã nộp mở bằng Google Docs Viewer; thời điểm chấp nhận thỏa thuận nền tảng hiển thị đến giây theo giờ Việt Nam.
- Khi văn bản DLCN đang được xử lý, vẫn giữ khối **Văn bản mẫu** và nút tải xuống cạnh tệp đã nộp; bỏ nhãn trạng thái trùng lặp ở dòng tệp để chỉ dùng nhãn trạng thái tại tiêu đề.
- Khi chọn **Chỉnh sửa**, giữ liên kết xem tệp đã nộp và hiển thị tên tệp thay thế ngay trong ô tải lên. Sau khi lưu, tên hiển thị chuẩn của tài liệu là **Thỏa thuận xử lý DLCN**, không dùng tên gốc của tệp tải lên.
- API ưu tiên văn bản DLCN mới gắn recruiter trước bản DLCN lịch sử theo company, tránh mở nhầm PDF cũ khi hai bản cùng tồn tại. DOC/DOCX tại URL HTTPS storage công khai/S3 có chữ ký mở qua Google Docs Viewer; PDF và URL localhost mở trực tiếp. Hover liên kết tệp dùng màu thương hiệu cấu hình của hệ thống.

#### Documentation

- Cập nhật hướng dẫn xác thực employer, tiến độ EMP-P8/EMP-P9 và regression test desktop/mobile cho layout/asset GPKD cùng DLCN; chuẩn hóa thông báo toàn ứng dụng qua Sonner.

### 2026-07-18

#### Added — Cổng marketing nhà tuyển dụng

- Thêm app backend `services` với danh mục/gói dịch vụ song ngữ, lead tư vấn, public API bảng giá, admin CRUD API, cache + signal invalidation, throttle form và seed 5 nhóm/11 gói idempotent.
- Hoàn thiện 5 route marketing `/tuyendung`: Landing đủ chuỗi section AI/dịch vụ/số liệu/form/giá trị/đối tác/liên hệ; Giới thiệu, Dịch vụ, Báo giá động và Liên hệ; header/footer riêng, drawer mobile, language switcher VI/EN và CTA tư vấn nổi.
- Thêm `entities/service-package`, `entities/consultation-lead`, feature gửi tư vấn, widget footer nhà tuyển dụng; bảng giá fallback ngôn ngữ, loading/error/empty state và CTA prefill theo gói.
- Thêm hai màn admin `/admin/app/services` và `/admin/app/consultation-leads` để quản lý danh mục/gói và xử lý lead.

#### Added — Xác thực tài khoản nhà tuyển dụng

- Thêm API đăng ký employer riêng, tạo atomically tài khoản, recruiter profile và consent có phiên bản; trả JWT và gửi email xác thực ngay sau đăng ký. Công ty không còn được tạo ngầm trong bước này.
- Thêm hồ sơ đăng ký recruiter (giới tính, số liên hệ, địa điểm, thời điểm hoàn tất, consent/marketing) bằng migration `employers.0009`; thêm endpoint hoàn thiện profile cho tài khoản Google.
- Thêm giao diện login/register tách biệt cổng ứng viên, màn xác thực email riêng tại `/account/verify`, khảo sát nhu cầu tại `/consulting-need`, trang điều khoản/quyền riêng tư và route recovery riêng cho employer.
- Thêm model/API `RecruitmentNeed` cho vị trí chuyên môn, cấp bậc, thời hạn hoặc tuyển liên tục, số lượng, khoảng/nguồn ngân sách và nhu cầu tư vấn; email employer có mã NTD, CTA xác thực và cảnh báo bảo mật riêng.
- Thêm `/tuyendung/app/employer-verify` theo shell quản trị employer: checklist điện thoại/công ty/giấy ĐKDN/hai bước DLCN/tin đầu tiên và lựa chọn xác thực sau; email không lặp lại vì đã là điều kiện vào trang.
- Thêm nhóm route account nội bộ `/account/phone-verify`, `/account/settings/password-login`, `/account/settings/company?update=true`, `/account/settings/gpkd` và `/account/settings/personal-data-protection`; trang company có hai tab tìm/liên kết công ty có sẵn và tạo công ty mới.
- Thêm API đổi/đặt mật khẩu khi đã đăng nhập. Tài khoản Google chưa có mật khẩu được chặn trước bước OTP bằng modal an toàn và dẫn tới màn đặt mật khẩu đầu tiên.
- Thêm read-model `GET /api/dashboard/employer/` trong `apps.dashboard` cùng dashboard responsive: KPI tuyển dụng, biểu đồ hồ sơ 7 ngày, pipeline, tin/hồ sơ gần đây, nhu cầu ưu tiên, tiến độ xác thực và hồ sơ công ty.
- Thêm email chào mừng riêng cho nhà tuyển dụng: tài khoản email chỉ nhận sau khi xác thực thành công, tài khoản Google mới nhận ngay sau callback; nội dung có tên, mã NTD, CTA quay về state machine cổng tuyển dụng và thông tin CSKH từ site settings.

#### Changed

- Employer đăng ký email giữ session và đi theo state machine `/account/verify → /consulting-need → /dashboard`; employer mới qua Google bổ sung hồ sơ tại `/account/complete-profile` rồi đi thẳng tới khảo sát vì email đã được provider xác thực. State onboarding không còn phụ thuộc company; company chỉ hoàn tất sau thao tác chọn/tạo rõ ràng.
- Link đặt lại mật khẩu trong email được dựng theo role; link employer dùng host/path của cổng tuyển dụng. Dashboard guard bắt buộc email + hồ sơ + consulting, còn company/membership thuộc checklist xác thực có thể hoàn thiện dần.
- Trường nhu cầu tư vấn trong khảo sát tuyển dụng chỉ cho phép chọn một lựa chọn; frontend gửi mảng một phần tử tương thích API và backend từ chối payload nhiều lựa chọn.
- Làm lại giao diện đăng ký nhà tuyển dụng: form hiển thị tuần tự bước 01 rồi mới sang bước 02 (có quay lại), khối tài khoản và hồ sơ tách bạch, email không còn chừa cột trống trên desktop và lựa chọn giới tính không còn viền bao quanh trên mobile.
- Luồng sau khai báo nhu cầu chuyển thành `/consulting-need → /employer-verify → /dashboard`; checklist bảo mật không tạo state onboarding bắt buộc mới. Workspace dùng đúng `100dvh`, chỉ cuộn vùng nội dung; link dịch vụ/bảng giá và workflow chưa triển khai được disabled rõ ràng, không thoát sang landing page.
- Tách trạng thái tài liệu thỏa thuận ứng viên–nhà tuyển dụng (`candidate_dpa`) khỏi trạng thái chấp nhận thỏa thuận nền tảng–nhà tuyển dụng; tin tuyển dụng đầu tiên bị khóa đến khi đủ năm điều kiện trước.
- Thiết kế lại toàn bộ shell quản trị employer theo mẫu dashboard nghiệp vụ: dải cảnh báo tuân thủ theo trạng thái DLCN, topbar tối toàn chiều ngang, sidebar trắng có hồ sơ/mã NTD/tiến độ xác thực và menu phân nhóm, header tên trang cùng content cuộn nội bộ. Dashboard mới có thông báo quan trọng, banner code-native, hành trình xác thực ngang, khu khám phá và CV đề xuất; KPI/read-model thật vẫn được giữ bên dưới. Mọi tính năng chưa có workflow đều disabled “Sắp mở”.

#### Security

- Consent bắt buộc và marketing consent được lưu tách biệt kèm thời điểm/phiên bản; backend kiểm tra captcha, password policy, email không phân biệt hoa/thường, số điện thoại duy nhất và transaction rollback.
- Transactional outbox giới hạn đúng một welcome job trên mỗi tài khoản bằng cả thao tác idempotent và partial unique constraint; callback Google lặp lại, đăng nhập social cũ hoặc token xác thực dùng lại không gửi trùng thư chào mừng.

#### Fixed

- Sửa destination sau đăng nhập nhà tuyển dụng: tài khoản còn thiếu bước bảo mật/pháp lý vào `/tuyendung/app/employer-verify` và không bị `returnUrl=/dashboard` bỏ qua; tài khoản đã xác thực đủ năm điều kiện hiện hành vào thẳng bảng tin hoặc deep-link an toàn. CTA email chào mừng vẫn dùng điểm vào checklist cho tài khoản mới.
- Sidebar workspace nhà tuyển dụng dùng thang “Tài khoản xác thực: Cấp 0/3–3/3” theo điện thoại, thông tin công ty và ĐKDN; dấu `?` mở popover có tiến độ, ba action tương ứng và CTA tìm hiểu thêm, thay vì hiển thị 6 bước checklist.
- Sidebar desktop nay thu gọn theo đúng mô hình icon rail của TopCV (216px → 64px), không biến mất khỏi layout; icon được phóng to và căn giữa. Khi rail đang thu gọn, hover vào sẽ mở tạm menu/hồ sơ và tự thu lại khi rời chuột; trạng thái mặc định vẫn luôn mở. Trên mobile vẫn thu về 0px để không che vùng làm việc.
- Giữ nguyên query `?token=` khi redirect link xác thực employer cũ từ `/xac-thuc-email` sang `/account/verify`; đồng bộ `EMPLOYER_EMAIL_VERIFICATION_PATH` trong môi trường phát triển để email mới dùng trực tiếp route chuẩn.
- Sửa toàn bộ link footer nhà tuyển dụng từ prefix cũ `/nha-tuyen-dung` sang route thật `/tuyendung` bằng seed và data migration `sitecontent.0015`.
- Header marketing hiển thị rõ route hiện tại (màu thương hiệu, gạch chân và `aria-current`), dùng màu trung tính nhất quán cho link chưa chọn; thêm mục Trang chủ. Card giá/dịch vụ có vùng thao tác thật, con trỏ pointer và focus keyboard thay vì chỉ có hiệu ứng thị giác.
- Khóa form consulting sau lần hoàn tất đầu tiên ở cả frontend và backend; sửa race session refresh khiến URL vừa tới `employer-verify` lại bị redirect sang dashboard.
- Sửa hồ sơ company rỗng do luồng đăng ký cũ bị hiểu nhầm là đã hoàn tất; vẫn cho phép người dùng thay thế bằng thao tác tìm/tạo công ty thật.
- Sửa upload giấy tờ dùng validator ảnh cho file PDF; ĐKDN nay nhận JPG/PNG/PDF còn thỏa thuận `candidate_dpa` nhận PDF/DOC/DOCX với kiểm tra MIME, chữ ký file và giới hạn 5 MB.

#### Documentation

- Ghi rõ boundary i18n chỉ thuộc chunk employer marketing, ownership FSD cho domain dịch vụ/lead và cập nhật tiến độ dự án.
- Thêm tài liệu state machine/validation/API cho auth employer, email xác thực/chào mừng, khảo sát nhu cầu, checklist và dashboard; kiểm chứng 85 backend test `accounts/employers/dashboard`, 220 frontend test với coverage 86,96%, lint/architecture/build và 38 Playwright smoke test desktop/mobile. Full backend có 229 test, còn 5 lỗi legacy độc lập ở `apps.applications.tests_migrations` do schema migration thiếu cột `contact_name`.

### 2026-07-15

#### Added

- CV Builder Phase 0: thêm canonical `compose_cv_document` dùng chung để map content vào published template version, áp presentation và validate document/capabilities; bổ sung regression test và ADR 0007.
- CV Builder Phase 1: position options hỗ trợ locale/ordering/content availability; preview API trả canonical document/renderer/revision, hỗ trợ blank và cache base không chứa PII thực.
- CV Builder Phase 2: thêm `CvDraft.document_hash`, latest-recoverable endpoint, read-only template projection và `source_cv_public_id` để copy draft sang CV mới.
- CV Builder Phase 3: thêm registry/API `Locale`, migration FK song song có backfill cho localization/sample/blueprint, canonical `content_json_template` dual-read và route catalogue locale mở rộng.
- CV Builder Phase 4: thêm admin REST/publishing portal, structured sample editor và snapshot worker canonical WeasyPrint→pypdfium2 theo fingerprint, idempotent/write-then-swap.
- CV Builder Phase 5: nâng import PDF/DOCX thành durable AI job có MIME sniffing, idempotency, provider adapter, canonical validation/composition, retry/throttle/retention và modal polling.
- CV Builder Phase 6: gom preview selector/zoom/swatches, thêm versioned cache + PII-free product metrics, rollout runbook và hoàn tất full backend/frontend/E2E gates.

#### Fixed

- AI import adapter đọc `GEMINI_API_KEY`, `OPENAI_API_KEY` và `ANTHROPIC_API_KEY` qua `python-decouple`, nên secret trong `backend/.env` được worker/web process dùng đúng thay vì chỉ đọc `os.environ`.
- Badge cấu hình secret ở Admin dùng cùng resolver `python-decouple`, nên phản ánh đúng key trong `backend/.env` mà không bao giờ trả giá trị key về client.
- `DELETE /api/v2/cvs/{id}/` chuyển từ archive mềm sang xóa vĩnh viễn; loại bỏ UI/API archive/restore, xóa library artifacts và giữ snapshot đã nộp ở trạng thái detached cho workflow tuyển dụng.

- Chuẩn hóa taxonomy kho mẫu CV bằng quan hệ many-to-many `CvTemplate.categories` qua `CvTemplateCategoryLink`; bổ sung `CvColor` và `CvTemplateColorLink` để một template có nhiều màu, mỗi màu có thumbnail/preview URL, thứ tự và trạng thái mặc định riêng.
- Public CV Template API V2 trả thêm `colors[]` từ database; Django admin có màn quản lý category/color và inline gán category/color cho từng template.
- Migration `cv_templates.0004_cv_template_taxonomy_colors` backfill màu từ style JSON cũ sang bảng quan hệ; `seed_cv_catalog` chuyển category legacy thành link thật, seed palette màu/localization/sample content theo cách idempotent.
- Luồng tạo CV V2 nhận tùy chọn `theme_color`, chỉ chấp nhận màu active đã gán cho template và ghi màu đã chọn vào initial version cùng draft.
- Thêm unit/regression test cho contract category/color, URL preview theo màu và việc lưu màu vào CV; smoke test desktop/mobile phủ hover màu đổi preview và trang detail mở create flow.
- Tách contract vị trí sample CV qua migration `cv_templates.0005`: `job_category_slug` giữ định danh ổn định, `position_name_vi` giữ nhãn dropdown tiếng Việt ở mọi locale, còn `position_name` và `content_json` được seed theo ngôn ngữ preview (ví dụ AI/Machine Learning Engineer).
- Sửa mapping locale `en-US` cho các vị trí có tên gốc tiếng Việt (`Chăm sóc khách hàng` → `Customer Service`, `Nhân viên kinh doanh` → `Sales Executive`, `Kế toán` → `Accountant`, `Nhân sự` → `Human Resources`); chạy seed idempotent để sửa sample generated hiện hữu.
- Migration `jobs.0017` chuyển position picker sang taxonomy-driven: `JobCategory` có `public_id`, `JobCategoryLocalization` quản lý tên 4 locale trong admin; dropdown lấy toàn bộ vị trí chuyên môn và chỉ hiển thị `name_vi` có tìm kiếm.
- Migration `cv_templates.0006` thêm `CvContentBlueprint` cấu hình theo locale/experience trong admin và position-content resolver: ưu tiên curated `CvSampleContent`, nếu chưa có thì materialize canonical content từ blueprint. Baseline 61 vị trí × 4 locale được bootstrap, validate thành 244 preview document.
- Migration `cvs.0006` lưu FK position trên CV; `POST /api/v2/cvs/` nhận `position_public_id` và clone nội dung đã resolve vào initial immutable version/draft. `sample_content_public_id` được giữ tương thích trong cửa sổ chuyển đổi.
- Hoàn thiện parity cho account library ở V2: `POST /api/v2/cvs/imports/` nhận PDF/DOCX, `PATCH /api/v2/cvs/{id}/` đổi title/default CV, và `DELETE` archive CV bằng lifecycle service. Response import chỉ trả metadata file, không lộ storage URL.
- Bổ sung constraint DB chỉ cho phép một CV mặc định còn active mỗi candidate; migration giữ CV default cập nhật gần nhất nếu dữ liệu cũ có nhiều bản ghi.
- Bổ sung `POST /api/v2/cvs/{id}/duplicate/`, archive list và `POST …/restore/`. Duplicate builder CV tạo aggregate/version/draft độc lập từ snapshot immutable; restore owner-only trong restore window cấu hình được (`CV_ARCHIVE_RESTORE_WINDOW_DAYS`, mặc định 30 ngày) và không tự đặt lại default CV.
- Bổ sung `GET|POST /api/v2/applications/` cho candidate. Request ghi rõ `cv_public_id` và `version_public_id`; backend tạo `application_snapshot` từ version đó, không đọc draft và không làm đổi CV pointer.

#### Changed

- Luồng create CV V2 và switch draft template dùng chung canonical composer, giữ nguyên CAS draft, immutable version, payload và dual-write legacy.
- Modal và template detail mặc định render sample locale/vị trí đầu tiên, chống request race, đổi màu tức thì; xóa toàn bộ persona/sample/layout hardcode khỏi frontend.
- Previous hoạt động thật; Restore tự dùng duy nhất draft dirty mới nhất, giữ nguyên content và switch template/màu bằng CAS. Editor flush autosave trước điều hướng nội bộ và khi tab chuyển hidden.
- Catalogue/preview/create chỉ chấp nhận locale active; frontend tải locale từ API qua entity riêng, giữ fallback bốn SEO locale và không làm router phụ thuộc request bất đồng bộ.

- Card mẫu CV bỏ danh sách màu fallback hard-code; hover/focus một màu dùng đúng `preview_url` của quan hệ template–color, còn compatibility fallback chỉ giữ một màu cho node API chưa migrate.
- Trang template detail và modal dùng chung `CvSourcePanel`; màu của modal mẫu liên quan có state riêng, không làm đổi màu template chính. Catalog không còn tải sample content rồi truyền vào prop không được sử dụng.
- Đổi tên page `CvEditorPlaceholder` thành `CvEditor` vì route `/cvs/{public_id}/edit` đã render editor thật; thu hẹp public API của entity `cv-template` bằng cách bỏ export preview component không có consumer ngoài slice.
- Trang “CV của tôi” dùng entity API V2 cho archive, rename, default, share và import; upload gọi backend thật rồi refresh danh sách, không còn thông báo thành công bằng timeout hoặc gọi V1.
- Trang “CV của tôi” đã duplicate CV builder thật, hiển thị kho archive để restore, đồng thời bỏ các CTA giả cho “đẩy top” và trạng thái searchable chưa có backend.
- Smoke desktop/mobile của candidate library phủ contract list, owner view, restore và application chọn version; permission/lifecycle vẫn được kiểm tra bằng regression test backend, không đánh đồng mock API với integration test.
- CTA trên card CV dẫn rõ tới owner view để xem và xuất PDF từ immutable version, tái sử dụng feature export hiện có thay vì tạo luồng export thứ hai.
- CTA “Ứng tuyển ngay” mở workflow chọn CV/version bất biến, ưu tiên bản published, cảnh báo khi chưa publish và chỉ gửi payload V2 sau bước xác nhận.
- V1 `/api/cvs/` và `/api/cv-templates/` giữ hoạt động trong thời gian cutover nhưng mọi response đã có `Deprecation`, `Sunset`, `Link: rel="successor-version"` và event telemetry endpoint-level không ghi URL, user-agent hay định danh người dùng.

#### Documentation

- Cập nhật kiến trúc, API, database inventory, tiến độ và kế hoạch CV Builder theo nguồn dữ liệu category/color mới, V1→V2 cutover, các biến môi trường deprecation/sunset và phần còn lại của workflow clone/restore/import analysis.

### 2026-07-14

#### Added

- Hoàn tất onboarding ứng viên và trang cài đặt gợi ý việc làm dùng chung workflow preference: modal chọn vị trí chuyên môn responsive, giới tính tại settings qua candidate profile, validation/toast rõ ràng và cột hồ sơ sticky trên desktop.
- Thêm entity frontend `candidate-profile` cho contract `GET/PATCH /api/candidate/profile/` và regression API test; cập nhật E2E route cho form settings và validation trên desktop/mobile.
- Thêm Cookie Consent Foundation: signed HttpOnly consent cookie, API public `GET/POST /api/privacy/consent/`, provider toàn ứng dụng, banner/modal responsive, trang `/chinh-sach-cookie`, điểm mở lại tại footer và gate cho color scheme/search history.
- Thêm Job View Tracking consent-aware: GET chi tiết việc làm không còn tăng view; `POST /api/jobs/{slug}/views/` dùng consent backend, viewer cookie ký số, Redis Lua dedupe 24 giờ và DB atomic increment.
- Bổ sung inventory cookie/browser storage, tài liệu API/rollout và regression test cho consent, GET read-only, consent-required và first view.

#### Changed

- Tối ưu response API theo use case frontend: tách DTO list/detail/write cho job và employer job, session user/candidate profile/location/blog chỉ trả field đang hiển thị; relation public dùng DTO tối thiểu và không lộ contact nhận hồ sơ hay field quản trị.
- Tối ưu query tương ứng bằng query list/detail riêng, `select_related`, `prefetch_related`, `only` và `defer`; bổ sung regression test so sánh tập key chính xác để chặn field model mới tự lọt ra API.
- Đồng bộ contract `desired_salary_vnd`: frontend và backend đều bắt buộc lương kỳ vọng là số nguyên VND lớn hơn 0; backend thêm regression test cho payload thiếu lương.
- Sửa popup tìm kiếm desktop: cột lịch sử không còn chiếm toàn bộ chiều rộng làm bóp cột việc làm thành vùng trắng; giới hạn chiều cao theo viewport và thêm regression test cho tỷ lệ hai cột.
- Chuẩn hóa toast toàn app: tối đa một thông báo hiện hành để không chồng nhiều lỗi khi người dùng click liên tục.
- CORS giữ origin allowlist nhưng cho phép credential riêng cho consent/tracking first-party cookie.
- Bỏ feature flag job-view tracking dư thừa: tracking chạy khi và chỉ khi Analytics consent hợp lệ; `.env.example` không chứa secret hoặc thông tin database mẫu có thể bị dùng nhầm.
- Consent settings không gửi lại POST nếu lựa chọn không thay đổi, tránh đốt quota khi mở lại modal; lỗi `429` hiện thời gian chờ cụ thể thay vì thông báo chung.
- Môi trường development không áp dụng throttle cho consent để QA có thể đổi lựa chọn liên tục; production vẫn giữ giới hạn `20/hour`.
- Đăng nhập qua Google/Facebook/LinkedIn bỏ qua email 2FA sau khi provider xác thực thành công; đăng nhập email/mật khẩu vẫn yêu cầu mã 2FA khi tài khoản đã bật.
- Đăng ký hoặc OAuth thành công của ứng viên chưa hoàn tất preference luôn chuyển vào `/onboard-user`, kể cả khi có URL quay lại an toàn.
- Nâng chính sách mật khẩu từ 6–25 lên 8–25 ký tự; vẫn chặn mật khẩu phổ biến và bắt buộc có chữ hoa, chữ thường, chữ số.
- Tách email xác thực và email chào mừng cho candidate: đăng ký email chỉ gửi xác thực, sau khi xác thực mới gửi chào mừng; candidate tạo lần đầu qua OAuth nhận email chào mừng ngay vì provider đã xác thực email.
- Form đăng ký candidate kiểm tra email sau 500ms người dùng ngừng gõ, hủy request cũ để kết quả không bị ghi đè; backend có endpoint pre-check giới hạn 12 lần/phút, còn `RegisterSerializer` vẫn là lớp xác thực cuối cùng.

### 2026-07-13

#### Changed

- Hoàn tất đợt tái cấu trúc R3–R8 và R10: feature hóa auth/account/2FA/jobs/applications/saved jobs, tách Django settings theo môi trường, và đưa Candidate/CV/CV template về selector/service khi có use case thực tế.
- Xóa compatibility re-export đã hết hạn ở frontend; consumer dùng public API của `features/*` hoặc `shared/api/*`. Frontend CI kiểm tra thêm feature boundary để chặn deep import alias xuyên feature.
- Giữ R9 onboarding ngoài đợt cleanup để triển khai lại theo thiết kế mới.

### 2026-07-11

#### Fixed

- **Thiếu tỉnh Đà Nẵng trong danh sách địa điểm**: DB chỉ có 33/34 tỉnh — Thành phố Đà Nẵng (code 48) và toàn bộ 94 phường/xã trực thuộc không có bản ghi nào (lần seed trước không nạp đủ; lệnh `seed_locations` bọc atomic toàn bộ nên dữ liệu vào không trọn vẹn). Chạy lại `seed_locations` (idempotent theo `code`, không phá FK) + `seed_province_merges` → khôi phục đủ 34 tỉnh + 3.321 phường/xã, Đà Nẵng có `merged_from = ['Quảng Nam', 'Đà Nẵng']`. Đã xác minh qua API public và picker địa điểm trên `/viec-lam`.
- **Bộ lọc "Theo danh mục nghề" không tự tick con khi chọn cha**: trước đây tick ô nhóm nghề chỉ lưu id nhóm còn checkbox con so khớp id riêng nên không sáng, gây hiểu nhầm là chưa chọn. Nay checkbox suy trạng thái từ tập lá đang chọn: tick cha → mọi con hiển thị checked; bỏ 1 con khi đang chọn cả nhóm → cha thành indeterminate và URL tự khai triển phần còn lại; chọn đủ các con → tự gộp lên id nhóm cho URL ngắn. Logic cây tách vào util dùng chung `pages/main/jobs/utils/categoryTree.js` (có test 8 case), `CategoryPicker` (modal) refactor dùng lại cùng util nên hành vi cha/con nhất quán giữa modal và sidebar.

#### Added — Chuẩn hóa schema tin tuyển dụng (migration `jobs.0012`–`0013`)

- Thay dữ liệu phẳng trên `Job` bằng các bảng quan hệ có cấu trúc: `JobCategoryAssignment` (danh mục theo vai trò — 1 **vị trí chuyên môn chính** unique/job + nhiều **kiến thức chuyên ngành**), `JobLocation` (địa điểm theo **phường/xã** + địa chỉ cụ thể; ghi mới bắt buộc ward có tỉnh cha), `JobWorkSchedule` (khung giờ cấu trúc: thứ từ/đến + giờ + `is_overnight` + ghi chú), `Benefit`/`JobBenefit` (quyền lợi chuẩn hóa), `Language`/`JobLanguageRequirement` (ngoại ngữ: 5 mức trình độ, chứng chỉ, bắt buộc/ưu tiên), `JobApplicationContact`+`JobApplicationEmail` (người nhận hồ sơ 1-5 email — nội bộ, **không expose qua API public**, có test chống lộ).
- `Job` thêm `gender_requirement`, `age_min/age_max`, `number_of_vacancies`, `salary_type` 5 loại (thỏa thuận/khoảng/cố định/từ mức/đến mức) — ràng buộc CheckConstraint ở DB + validate chéo trong serializer theo từng loại.
- `JobSerializer` nhận nested writes cho cả 6 quan hệ (thay thế trọn gói khi update, validate trùng lặp); field cũ frontend đang dùng (`category`, `locations_detail`, `short_description`, `is_salary_visible`) chuyển thành computed read-only. Filter `?category=` match qua `category_assignments` (giữ mở rộng cấp con).

#### Added — Trang chi tiết việc làm bản mới (job detail v2)

- **API view-model, không thêm cột DB**: `JobDetailSerializer` trả thêm `primary_specialization`/`domain_knowledge` (`{id,name,slug}`), `workplace_groups` (địa điểm nhóm theo tỉnh/thành, mỗi dòng có `display` ghép sẵn "địa chỉ, phường/xã"), `requirement_tags` (kinh nghiệm, tuổi, học vấn "Từ X trở lên", giới tính, kỹ năng required), `benefit_tags`, và `proficiency_label` trên `language_requirements` — frontend bỏ hẳn lớp tự suy luận `buildJobTagGroups`; dữ liệu nested thô giữ nguyên cho form employer.
- **Nội dung theo thứ tự đọc mới** (`JobDetailContent`): tag tóm tắt (Yêu cầu/Quyền lợi/Chuyên môn — chuyên môn chính tô emerald) → mô tả → yêu cầu ứng viên → quyền lợi → **yêu cầu ngoại ngữ** ("Tiếng Hàn — Giao tiếp — TOPIK 2", nhãn "Ưu tiên" khi không bắt buộc) → **địa điểm nhóm theo tỉnh** → **thời gian làm việc render JSX** (component `WorkScheduleList` thay chuỗi HTML tự ghép — an toàn hơn, hỗ trợ nhiều ca + ghi chú) → cách thức ứng tuyển (câu cố định của sản phẩm) → CTA ứng tuyển/lưu/báo cáo. Các khối tách vào `JobDetailBlocks.jsx` (6 component nhỏ).
- **Sidebar**: "Thông tin chung" còn đúng 5 mục Cấp bậc/Học vấn/Số lượng tuyển/Hình thức/Loại hình (bỏ "Kinh nghiệm" vì đã có ở Hero + tag yêu cầu); "Danh mục nghề liên quan" link theo **từng** category (`?cat=<id>` riêng cho chuyên môn chính và từng kiến thức chuyên ngành) thay vì mọi tag đổ về chung `job.category`.
- **Sticky bar**: 4 anchor Chi tiết/Mô tả công việc/Địa điểm làm việc/Việc làm liên quan; 2 anchor sau **tự ẩn khi tin không có dữ liệu tương ứng** (tin remote không văn phòng, tin chưa có việc liên quan) — không còn nút cuộn chết.
- **Mobile**: khối tag Yêu cầu thu gọn tối đa ~3 dòng + nút "Xem thêm"/"Thu gọn" (đo `scrollHeight`, chỉ hiện khi thực sự tràn; `sm:` trở lên bỏ giới hạn); sidebar xếp sau nội dung chính; giữ thanh đáy Lưu tin/Ứng tuyển ngay.
- Seed `seed_demo_jobs` làm giàu dữ liệu demo để phủ đủ biến thể trang chi tiết: ~20% tin lương thỏa thuận, ~30% có khoảng tuổi, ~20% yêu cầu giới tính, ~35% có 1-2 ngoại ngữ (chứng chỉ theo mã: TOEIC/TOPIK/JLPT/HSK), 40% làm 2 ca (sáng/chiều), 3-5 quyền lợi, 2-4 kỹ năng, tin remote chỉ 0-1 địa điểm, kiến thức chuyên ngành gắn từ parent của vị trí chuyên môn.
- Verify: 7/7 test `apps.jobs` (2 test mới cho view-model: nhóm địa điểm đúng 2 tỉnh + tag đúng thứ tự; tin tối giản trả mảng rỗng an toàn), 17/17 vitest, lint + `vite build` pass; kiểm chứng browser thật 4 loại tin (onsite 2 tỉnh nhiều địa chỉ, remote không địa điểm, lương thỏa thuận, 2 ngoại ngữ + 2 ca làm việc) và mobile 375px (nút Xem thêm/Thu gọn hoạt động, sticky anchor ẩn/hiện đúng theo dữ liệu).

#### Added — Trang thương hiệu (brand page) cho nhà tuyển dụng

- `EmployerProfile.has_brand_page` (BooleanField, migration `employers.0005`) — admin gán qua Django admin (`list_editable`, cùng khuôn với `Job.tier`); sau này sẽ gán tự động theo gói dịch vụ ở Giai đoạn 6. Bật thì toàn bộ tin tuyển dụng của công ty mở dưới URL riêng `/brand/<company-slug>/tuyen-dung/<job-slug>` kèm header thương hiệu (banner cover + logo + tên công ty), thay vì `/viec-lam/<job-slug>` thông thường.
- `JobSerializer` thêm 2 field đọc: `brand_slug` (suy từ `employer_profile.has_brand_page`, `null` nếu công ty không bật) và `company_cover_url`.
- Frontend: gom toàn bộ logic dựng URL chi tiết job vào **một nơi duy nhất** — `config/jobPaths.js` (`jobDetailPath(job)`), kèm test `jobPaths.test.js` (4 case: tin thường, tin có brand, thiếu `brand_slug`, job rỗng). Migrate mọi điểm gọi cũ tự ghép chuỗi `/viec-lam/${slug}` (`SearchDropdown`, `BestJobsResults`, `FlashBadge`, `MarketStats`, `JobCard`, `JobQuickView`) sang dùng hàm này, không còn nơi nào tự dựng URL job thủ công.
- `MainRoutes` thêm route `/brand/:companySlug/tuyen-dung/:slug` (dùng chung `JobDetailPage`); `JobDetail.jsx` tự `navigate(..., { replace: true })` về đúng URL chuẩn nếu người dùng vào sai dạng URL (ví dụ vào `/viec-lam/...` của một tin có brand), và render component `BrandHeader` khi `job.brand_slug` có giá trị.
- Seed `seed_demo_jobs`: bật `has_brand_page` cho 3 công ty demo (FPT Software, VNG Corporation, Shopee Việt Nam).
- Verify: `manage.py test apps.jobs apps.employers` pass, `vitest run` 4/4 pass, `vite build` pass; kiểm chứng trên browser thật cả 2 luồng — tin công ty có brand page redirect đúng sang `/brand/...` và hiện header thương hiệu; tin công ty thường giữ nguyên `/viec-lam/...`, không phát sinh header thừa.

#### Changed — Tối ưu cấu trúc code (theo quy ước `docs/02-tong-quan/quy-uoc-code.md`)

- Backend: tách `apps/accounts/views.py` (395 dòng, trộn 4 mối quan tâm) thành package `apps/accounts/views/` gồm `auth.py` (đăng ký/đăng nhập/me/avatar), `verification.py` (xác thực email), `password_reset.py` (đặt lại mật khẩu), `oauth.py` (social login) — mỗi module views khớp 1-1 với module service cùng tên có sẵn; helper JWT dùng chung (`issue_tokens`, `revoke_refresh_tokens`) tách vào `views/tokens.py`; `views/__init__.py` re-export nên `urls.py` và mọi import bên ngoài giữ nguyên.
- Frontend: `JobList.jsx` 493 → 367 dòng — toàn bộ logic đọc/ghi bộ lọc lên URL (search/category/location/salary/experience/sort/page, clear, persist) gom vào hook mới `pages/main/jobs/hooks/useJobListFilters.js` (184 dòng), page chỉ còn ghép UI + state cục bộ (dropdown, drawer, quick view); state đóng dropdown giữ ở page vì là UI, bọc quanh `runSearch` của hook.
- Frontend: `FloatingActions.jsx` 343 → 178 dòng — form góp ý sản phẩm (chip chủ đề, emoji hài lòng, phone/email khách vãng lai, submit + constants khớp backend) tách thành `components/layout/FeedbackModal.jsx` (179 dòng), thêm reset form theo mỗi lần mở qua `useEffect` thay vì reset thủ công trước khi mở.
- Frontend: dọn 2 file lệch quy ước — `PopularSearches.jsx` chuyển từ `pages/main/components/layout/` (xoá luôn thư mục trùng tên gây nhầm với `components/layout/`) về `components/layout/` vì nó là thành phần của `MainLayout`, không phải của trang nào; `SavedJobsProvider.jsx` chuyển từ `components/job/` về `contexts/` nằm cạnh `AuthProvider` và `savedJobsContext.js` theo đúng convention provider.
- Verify: backend 30/30 test + `check` + `makemigrations --check` sạch; frontend lint + 17/17 unit test + build pass; kiểm chứng browser: bộ lọc URL (`?cat=&wt=`) render đúng breadcrumb/pill/đếm filter, nút "Xóa bộ lọc & từ khóa" reset sạch URL, modal "Bạn muốn?" → form góp ý mở đúng, tim việc đã lưu + footer PopularSearches vẫn hiển thị.

### 2026-07-10

#### Added — Đặt lại mật khẩu (quên mật khẩu) qua link email

- Luồng 2 bước: `/forgot-password` (nhập email) → email chứa link → `/reset-password?token=` (đặt mật khẩu mới) → điều hướng về đúng cổng đăng nhập theo `role`.
- Backend: module mới `apps/accounts/password_reset.py` — token `secrets.token_urlsafe(32)` lưu Redis, **TTL 30 phút** (ngắn hơn xác thực email 24h vì đây là luồng chiếm được tài khoản), cooldown 60s/tài khoản. Khoá `password_reset:latest:<user_id>` giữ token mới nhất nên **xin link mới là link cũ chết ngay**; token tiêu một lần qua `atomic_pop`.
- Tách helper mail dùng chung `apps/accounts/mailing.py` (`site_setting`, `from_email`, `frontend_link`, `send_html_email`); `email_verification.py` refactor dùng lại thay vì nhân bản.
- Endpoints mới: `POST /api/auth/password-reset/` (captcha; **luôn trả cùng một `detail`** dù email tồn tại hay không → không dò được danh sách email; cooldown xử lý im lặng để phản hồi không lệch; email đẩy qua outbox `AuthEmailJob` kind `password_reset`), `GET /api/auth/password-reset/validate/?token=` (kiểm tra link **không tiêu token**, trả `{email, role}` → hiện ngay màn "link hết hạn" thay vì bắt user gõ xong mật khẩu mới báo lỗi), `POST /api/auth/password-reset/confirm/` (validate mật khẩu **trước** khi tiêu token, để mật khẩu yếu không đốt link).
- Sau khi đổi mật khẩu: `email_verified=True` (nhận được mail ở địa chỉ đó = đã chứng minh quyền sở hữu hòm thư) và **blacklist toàn bộ refresh token cũ** qua `rest_framework_simplejwt.token_blacklist` — phiên đăng nhập cũ không gia hạn được nữa (access token vẫn sống tới khi hết hạn vì SimpleJWT không kiểm blacklist cho access token).
- Rule mật khẩu tách thành `password_field()` dùng chung với `RegisterSerializer` (6–25 ký tự, có hoa/thường/số, `validate_password`).
- Frontend: 2 trang lazy `ForgotPassword.jsx` / `ResetPassword.jsx` (dùng lại `PasswordRequirements` realtime + rule "nhập lại không khớp"); thêm `MAIN_FORGOT_PASSWORD_URL` trong `portals.js` vì cổng NTD/admin chạy subdomain riêng phải link tuyệt đối về host chính — `LoginForm` render `<a>` thay `<Link>` khi link là absolute URL.
- Env mới: `PASSWORD_RESET_TTL=1800`, `PASSWORD_RESET_RESEND_COOLDOWN=60` (đã thêm vào `.env` và `.env.example`).
- **Bug tự gây ra rồi sửa**: ban đầu cả 3 endpoint dùng chung `throttle_scope='password_reset'` (5/phút theo IP) → gõ sai mật khẩu mới vài lần là hết quota và **không confirm được nữa** dù link còn hạn. Tách bucket riêng `password_reset_confirm` (10/phút).
- Verify: 15 assertion qua HTTP client thật (chống dò email, cooldown im lặng, link cũ chết khi xin link mới, token dùng một lần, mật khẩu yếu không đốt token, refresh token bị blacklist, `email_verified` bật) + kiểm chứng trên browser (submit thật → 200, màn "link không còn hiệu lực", mobile 375px không tràn ngang).

#### Fixed — `JWT_SIGNING_KEY` bỏ trống làm hỏng mọi lần phát token

- `SIMPLE_JWT['SIGNING_KEY']` dùng `config('JWT_SIGNING_KEY', default=SECRET_KEY)`, nhưng `python-decouple` chỉ áp dụng `default` khi key **vắng mặt** — dòng `JWT_SIGNING_KEY=` (đúng như `.env.example` hướng dẫn) trả về chuỗi rỗng, khiến PyJWT ném `InvalidKeyError: HMAC key must not be empty` ở mọi lần phát token. Đổi sang `config('JWT_SIGNING_KEY', default='') or SECRET_KEY` (cùng pattern `EMAIL_FROM_ADDRESS` sẵn có); kiểm tra bắt buộc khai báo key riêng khi `ENVIRONMENT=production` vẫn giữ nguyên.
- `.env.example`: 2 dòng `EMAIL_VERIFICATION_*` viết comment **cùng dòng với giá trị** (`86400  # 24h`) — decouple không cắt comment nên `cast=int` ném `ValueError`, ai copy nguyên xi thì backend không boot. Chuyển comment lên dòng riêng và ghi chú rõ; bổ sung `PASSWORD_RESET_*`, `OAUTH_STATE_TTL`, `OAUTH_CODE_TTL` cho khớp `settings.py`.

#### Fixed — Email phân biệt hoa/thường giữa đặt lại mật khẩu và đăng nhập

- `password-reset` tra user bằng `email__iexact`, còn login đi qua `authenticate()` → `get_by_natural_key()` so sánh **chính xác** (Postgres phân biệt hoa/thường), và `BaseUserManager.normalize_email()` chỉ hạ chữ phần domain chứ không hạ phần trước `@`. Hệ quả: tài khoản đăng ký `Hau@gmail.com` **đặt lại mật khẩu được nhưng đăng nhập bằng `hau@gmail.com` thì 401**.
- Sửa: `UserManager.normalize_email()` hạ chữ **toàn bộ** địa chỉ; `UserManager.get_by_natural_key()` dùng `iexact`; thêm ràng buộc DB `UniqueConstraint(Lower('email'), name='uniq_users_email_lower')` — nếu thiếu, `iexact` có thể khớp 2 bản ghi và `authenticate()` ném `MultipleObjectsReturned` (500 thay vì 401). `RegisterSerializer.validate_email()` chặn trùng theo `iexact` để trả 400 tử tế, vì `UniqueValidator` mặc định của ModelSerializer cũng phân biệt hoa/thường và sẽ vỡ ở index DB.
- Migration `accounts.0004_email_case_insensitive`: `RunPython` hạ chữ email cũ trước khi gắn ràng buộc, và **dừng kèm danh sách địa chỉ cụ thể** nếu môi trường đã lỡ có 2 tài khoản chỉ khác nhau hoa/thường — gộp hay xoá tài khoản nào là quyết định của con người, không phải của migration.
- Verify: rollback về `0003` → tạo xung đột thật → migrate lại và thấy đúng `RuntimeError` mong đợi. Qua HTTP: đăng ký `Hau.Test@Example.com` lưu thành `hau.test@example.com`; login được với cả `hau.test@…`, `Hau.Test@…`, `HAU.TEST@…`; đăng ký lại khác case → 400 (không phải 500); reset bằng email chữ hoa rồi login chữ thường → 200. 25/25 test `apps.accounts` pass.

#### Added — Ghi nhận `last_login`

- `User.last_login` (có sẵn từ `AbstractUser` nhưng chưa từng được cập nhật vì JWT không đi qua `django.contrib.auth.login()`) nay được set ở cả 3 luồng phát token: đăng nhập email/mật khẩu (`RoleTokenObtainPairSerializer.validate`, chỉ set sau khi qua được kiểm tra `portal` — sai mật khẩu hoặc sai cổng không tính là đăng nhập), đăng ký auto-login và social login (cả hai qua `_issue_tokens()`). Expose thêm field `last_login` trong `UserSerializer`.
- Test: 5 test mới (`LastLoginTests`) cho cả 3 luồng + 2 case âm (sai mật khẩu, sai cổng không set). Phát hiện và sửa 2 vấn đề cô lập test khi viết: Django test runner luôn ép `DEBUG=False` (cần override tường minh để bypass captcha khi test), và `ScopedRateThrottle` dùng chung cache Redis thật nên phải override `CACHES` sang `LocMemCache` để không cộng dồn số lần gọi `/api/auth/login/` giữa các lần chạy test.

#### Added — Social login (OAuth Google / Facebook / LinkedIn)

- Đăng nhập mạng xã hội theo **OAuth Authorization Code Flow qua backend callback**: ứng viên dùng Google/Facebook/LinkedIn, nhà tuyển dụng chỉ Google, admin không có. App chạy được ngay cả khi chưa cấu hình credential — nút social chỉ báo "chưa cấu hình" khi bấm.
- Backend: model `SocialAccount` (`user`, `provider`, `provider_user_id`, `email`, `raw_profile`, unique `(provider, provider_user_id)`); `User.Provider` thêm `facebook`/`linkedin`. Service `apps/accounts/oauth.py`: build authorize URL, `state` chống CSRF lưu Redis TTL 10 phút (one-shot), đổi code lấy token, đọc + chuẩn hoá profile (OIDC cho Google/LinkedIn, Graph cho Facebook), `one_time_code` Redis TTL 60s.
- Endpoints mới: `GET /api/auth/oauth/<provider>/start/?portal&next` (redirect sang provider), `GET /api/auth/oauth/<provider>/callback/` (verify state → tạo/liên kết user → redirect frontend kèm code), `POST /api/auth/oauth/complete/` (đổi one_time_code lấy `{user, access, refresh}`, throttle 10/min).
- Luật tài khoản: có `SocialAccount` → đăng nhập luôn; email trùng **cùng vai trò** → tự liên kết (đánh dấu `email_verified=True`, giữ mật khẩu cũ); email trùng **khác vai trò** → chặn "Tài khoản không thuộc cổng này"; user mới → vai trò theo cổng, `email_verified=True`, mật khẩu unusable. Tham số `next` chỉ nhận path nội bộ (chặn absolute/`//`).
- Frontend: component chung `SocialLoginButtons` (full-page redirect sang start URL, `next` = trang hiện tại trừ trang auth), trang `OAuthCallback` dùng chung 2 cổng (`/oauth/callback`, `/tuyendung/app/oauth/callback`; guard chống StrictMode gọi effect 2 lần vì code one-shot), lưu token đúng portal key, lỗi → quay về trang login của cổng kèm `?oauth_error=` hiển thị trong Alert (map mã lỗi → tiếng Việt ở `errorMessage.js`). Login/Register cổng NTD thêm nút Google + divider.
- Cấu hình `.env`: `OAUTH_{GOOGLE,FACEBOOK,LINKEDIN}_CLIENT_ID/SECRET`, `OAUTH_FACEBOOK_GRAPH_VERSION`, `OAUTH_MAIN/EMPLOYER_CALLBACK_URL`, `OAUTH_STATE_TTL`, `OAUTH_CODE_TTL`. Hướng dẫn lấy key từng provider: `docs/05-huong-dan/social-login.md`.
- Test: 13 test OAuth backend (portal rules, tạo/liên kết/chặn theo vai trò, state one-shot, one_time_code one-shot, chặn `next` absolute).

#### Changed — Media lưu storage key thay vì URL tuyệt đối

- Toàn bộ tham chiếu ảnh (`User.avatar_url`, `EmployerProfile.company_logo_url`/`cover_image_url`, `JobCategory.logo_url`, `Banner.image_url`, `SiteSetting` kiểu image, `UserCv.file_url`/`pdf_url`/`thumbnail_url`) nay lưu **storage key** (vd `site/settings/logo.png`) trong DB thay vì URL tuyệt đối; serializer resolve ra URL công khai theo domain/CDN **tại thời điểm trả API** qua `media_url_from_value`. Nhờ vậy đổi domain hoặc bật `MEDIA_PUBLIC_BASE_URL` không còn để lại `localhost:8000` cũ trong dữ liệu/cache.
- `apps/common/media_storage` thêm `media_storage_path` (đọc được cả key mới, `/media/...` cũ và URL `http://localhost:8000/media/...` legacy, chống path traversal, chỉ nhận host media hợp lệ để không xoá nhầm ảnh bên thứ ba), `normalise_media_value`, `media_url_from_value`. Xoá file cũ khi thay ảnh chỉ chạy sau `transaction.on_commit`.
- Command mới `normalize_media_references` (dry-run mặc định, `--apply` để ghi) chuyển dữ liệu URL legacy sẵn có sang storage key; URL ngoài hệ thống giữ nguyên.
- `POST /api/site/admin/settings/upload/` nay resize ảnh theo `UPLOAD_MAX_DIMENSIONS` (favicon giới hạn 256×256, dùng Pillow) và trả `{key, value, url}`; upload avatar/logo/cover cũng lưu storage key.

#### Changed — Tối ưu hiệu năng frontend (đợt 1)

- Favicon: `frontend/index.html` từng trỏ ảnh logo 2000×2000 nặng **957KB** tải mọi trang. Dựng `favicon-32.png` (1.9KB) + `apple-touch-icon.png` (18.8KB) resize từ đúng logo ProCV bằng Pillow; đặt làm default ở `index.html`, `siteSettingsContext.js` và seed `sitecontent`. Fix cả tầng runtime (`SiteSettingsProvider` ghi đè `<link rel=icon>` từ `brand_favicon_url`) lẫn seed idempotent để không revert về ảnh nặng.
- Vite: tách vendor `react` (react/react-dom/react-router-dom/scheduler) thành chunk riêng qua `manualChunks` (dạng **function** — Vite 8 dùng rolldown) để cache độc lập qua các lần deploy; cố ý **không** gom antd vào 1 chunk để tránh kéo antd trang admin vào initial load.
- Thêm dependency `Pillow==11.3.0` (resize favicon + ảnh upload).

### 2026-07-09

#### Added — Hệ thống cài đặt admin 15 nhóm (schema-driven)

- `SiteSetting` mở rộng thành nền tảng cấu hình toàn hệ thống: thêm `value_type` (text/textarea/number/boolean/select/color/image/email/url/json/env), `options` (choices cho select, `env_var` cho kiểu env), `order`; nhóm mở rộng từ 4 → 15 (chung, trang chủ, SEO, ứng viên, NTD, việc làm, CV, email, thanh toán, bảo mật, upload, footer, liên hệ, phân quyền admin, AI). Migration gộp nhóm `appearance` cũ vào `general`.
- Seed `seed_sitecontent` viết lại: 96 keys đủ 15 nhóm, idempotent — đồng bộ metadata nhưng không ghi đè `value` admin đã chỉnh. Secrets (API key AI, SMTP, VNPay) giữ trong `.env`, DB chỉ lưu trạng thái qua kiểu `env`.
- API admin mới: `GET/PATCH /api/site/admin/settings/` (trả cấu hình gộp theo nhóm kèm metadata; bulk update có validate theo `value_type`, từ chối key kiểu env) + `POST /api/site/admin/settings/upload/` (upload ảnh dùng chung `media_storage`); permission `IsAdmin` mới. Public `/api/site/settings/` được cache 1h, signal `post_save/post_delete` tự invalidate.
- Trang React `/admin/settings`: tabs 15 nhóm, form tự sinh từ metadata (`SettingField` map value_type → control AntD: Switch/InputNumber/Select/ColorPicker/Upload ảnh/JSON editor/tag env), dirty-tracking + lưu theo nhóm + hoàn tác, tag "Public" cho key lộ ra frontend. Nav admin trong `DashboardLayout` bỏ 2 menu chết (users/skills), thêm "Cài đặt hệ thống", highlight theo route.
- Tài liệu: hướng dẫn mới `docs/05-huong-dan/cau-hinh-site-settings.md` (bảng đủ 96 keys, quy ước env, quy tắc seed), cập nhật `docs/04-api/tai-lieu-api.md` và tiến độ 6.6–6.8.
- Dọn dẹp: xoá file trùng lặp mồ côi `frontend/src/components/brand/siteSettingsContext.js`.

#### Added — Storage nội bộ cho logo/ảnh upload

- Thêm helper `apps.common.media_storage` để validate ảnh JPG/PNG/GIF/WebP, giới hạn dung lượng upload, lưu file qua Django `default_storage`, sinh public URL theo `MEDIA_URL`/`MEDIA_PUBLIC_BASE_URL`, và tự xóa file cũ nếu thuộc storage nội bộ.
- Thêm cấu hình `MEDIA_PUBLIC_BASE_URL`, `IMAGE_UPLOAD_MAX_SIZE`; bổ sung API upload `POST /api/auth/avatar/`, `POST /api/employer/profile/logo/`, `POST /api/employer/profile/cover/`; upload CV cũng dùng chung hàm sinh media URL.
- Django admin hỗ trợ upload ảnh nội bộ cho `JobCategory.logo_url` và `Banner.image_url`; frontend có helper `mediaService.js` cho multipart upload.
- Chuẩn hóa asset ProCV: `brand_logo_url` dùng logo ngang `/images/logo/logo_proCV_2000_600.png` cho header, còn `brand_logo_mark_url`/`brand_favicon_url` dùng logo vuông `/images/logo/logo_proCV_2000_2000.png`; cập nhật default site settings, seed `sitecontent`, DB local và favicon mặc định trong `frontend/index.html`.

#### Changed — Header và branding

- Header chỉ ẩn khi cuộn xuống ở trang danh sách việc làm (`/viec-lam`, `/viec-lam/tai/...`, `/jobs`); trang chủ và các trang khác giữ header sticky luôn hiện.
- Site settings/brand logo dùng fallback ProCV thống nhất; sửa bản context trùng trong `frontend/src/components/brand/siteSettingsContext.js` để không còn key sai.
- Màu thương hiệu chính (`brand_primary_color`) từ DB nay điều khiển Ant Design `ConfigProvider` và các class màu brand phổ biến qua CSS variables (`--brand-primary`, `--brand-primary-hover`, `--brand-primary-soft`), thay vì chỉ set biến nhưng UI vẫn hardcode `#00b14f`.

#### Fixed

- Sửa lọc "Mức lương" trong section "Việc làm tốt nhất": thêm query `salary_bucket` cho homepage, bucket theo mức lương cao nhất hiển thị của job thay vì logic giao nhau khoảng lương. Nhờ vậy chọn "Dưới 10 triệu" không còn trả job `8 - 13tr` hoặc `10 - 25tr`.
- Thêm test backend cho salary bucket và test upload avatar/logo công ty qua media storage; chạy lại `manage.py check`, test liên quan và `npm run build`.

### 2026-07-07

#### Added — Tài liệu API Swagger + dashboard thống kê trang chủ

- Tích hợp `drf-spectacular` (OpenAPI 3): Swagger UI tại `/api/docs/`, ReDoc tại `/api/redoc/`, schema tại `/api/schema/`. Cấu hình JWT Bearer để "Authorize" thử API ngay trên trình duyệt, gom endpoint theo tag tiếng Việt, đặt tên enum tường minh (`ENUM_NAME_OVERRIDES`) để schema sạch (0 warning/error). Annotate 2 APIView đặc biệt (`UserCvUploadView` upload multipart, `JobStatsView`) bằng `@extend_schema`.
- Endpoint `GET /api/jobs/stats/` (public): thống kê cho dashboard trang chủ — số việc làm đang tuyển, số công ty, việc làm mới trong 24h, chuỗi tăng trưởng 7 ngày (cộng dồn job active theo ngày), nhu cầu tuyển dụng theo nhóm ngành (cuộn lên từ danh mục 3 cấp), và 10 việc làm mới nhất.
- Frontend: section `MarketStats` trên trang chủ (thẻ nền xanh đậm) gồm mascot + danh sách "Việc làm mới nhất" tự xoay 10 giây/lần, 3 ô số liệu nhanh, biểu đồ đường tăng trưởng và biểu đồ cột nhu cầu theo ngành (vẽ bằng SVG, bảng màu kiểm định CVD theo skill dataviz). Banner cạnh danh mục đổi thành `BannerCarousel` (tự trượt 5s, nút trước/sau, dot, dừng khi hover). Áp dụng bộ lọc địa điểm ở trang chủ tìm ngay không cần bấm "Tìm kiếm".
- Lệnh `seed_demo_jobs` tạo 8 công ty demo + ~30 tin tuyển dụng active (trải theo ngày/ngành/địa điểm) để dashboard và danh sách job có dữ liệu minh hoạ; re-runnable, có cờ `--clear`.

#### Added — Trang chủ, danh sách/chi tiết job (Giai đoạn 1.14)

- Trang chủ (`Home.jsx`): hero xanh với ô tìm kiếm (từ khoá + `LocationFilter`), banner quảng cáo dạng carousel (`BannerCarousel` — tự trượt mỗi 5 giây, dừng khi hover, nút trước/sau, dot điều hướng, 3 slide mẫu), mega-menu danh mục 3 cấp (`CategoryMenu` — hover một nhóm nghề hiện nghề + vị trí chuyên môn ở 2 cột bên phải, phân trang nhóm nghề bằng nút mũi tên có hiệu ứng hover), lưới "Việc làm mới nhất".
- Trang danh sách job (`pages/jobs/JobList.jsx`, route `/jobs`): thanh tìm kiếm trên cùng gồm `CategoryPicker` (modal chọn danh mục 3 cấp, multi-select, tự rút gọn về id nhóm/nghề khi chọn đủ toàn bộ danh mục con), ô từ khoá, `LocationFilter`, nút Tìm kiếm; sidebar lọc thêm hình thức làm việc/loại hình/cấp bậc; phân trang kết quả.
- Trang chi tiết job (`pages/jobs/JobDetail.jsx`, route `/jobs/:slug`): hiển thị đầy đủ mô tả công việc, số lượng cần tuyển, yêu cầu học vấn, danh sách nhiều địa điểm tuyển, nút Ứng tuyển (điều hướng sang đăng nhập nếu chưa có tài khoản).
- Component dùng chung mới: `Header`/`Footer` (mega-menu dropdown theo từng mục Việc làm/Tạo CV/Công cụ/Cẩm nang nghề nghiệp — có icon, vách ngăn giữa các cột, mũi tên hiệu ứng khi hover từng mục), `JobCard`/`JobCardSkeleton`, `MainLayout`, `CategoryMenu`, `CategoryPicker` (modal 3 cấp, chuyển sang chế độ drill-down 1 cột trên mobile), `LocationFilter` (chọn nhiều tỉnh/thành + phường/xã cùng lúc, 2 ô tìm kiếm, drill-down mobile, nhãn "Tỉnh (Tất cả)"/"Tỉnh (n phường/xã)"), `BannerCarousel`.
- `api/jobService.js`, `api/locationService.js`, `api/pagination.js` (helper `fetchAllPages()` gộp toàn bộ trang của một endpoint bị phân trang thành 1 mảng), `constants/jobOptions.js` (nhãn tiếng Việt cho work_type/employment_type/experience_level/education_level, hàm `formatSalary`/`formatEducation`/`formatLocations`).
- Toàn bộ trang chuyển sang lazy-load (`React.lazy` + `Suspense` trong `AppRoutes.jsx`), thay `Spin` bằng Ant Design `Skeleton` cho danh sách job, theme Ant Design đổi màu chủ đạo sang xanh `#00b14f` qua `ConfigProvider`.
- Áp dụng bộ lọc địa điểm ở trang chủ giờ tìm kiếm ngay khi bấm "Áp dụng" trong popover, không cần bấm thêm nút "Tìm kiếm".

#### Changed — Job hỗ trợ nhiều địa điểm, số lượng tuyển, yêu cầu học vấn

- `Job.location` (ForeignKey, PROTECT) đổi thành `Job.locations` (ManyToManyField tới `locations.Location`) — một tin tuyển dụng có thể tuyển nhiều tỉnh/phường cùng lúc; migration tự động chuyển dữ liệu `location` cũ sang bảng M2M trước khi xoá cột, không mất dữ liệu job đã tạo trước đó.
- Thêm `Job.number_of_vacancies` (số lượng cần tuyển) và `Job.education_level` (yêu cầu học vấn tối thiểu: none/high_school/intermediate/college/university/postgraduate).
- API `/api/jobs/` nhận nhiều `?location=` (id tỉnh hoặc phường/xã — id tỉnh tự khớp mọi job ở các phường/xã trực thuộc) và nhiều `?category=` (id ở bất kỳ cấp nào trong danh mục 3 cấp, tự mở rộng xuống các danh mục con).
- `JobSerializer` đổi trường ghi `location`/đọc `location_name` thành `locations` (ghi, nhận danh sách id) và `locations_detail` (đọc, danh sách object `{id, name, level}`).
- `job_categories` reseed thành taxonomy 3 cấp qua `seed_job_categories` (nhóm nghề → nghề → vị trí chuyên môn: 8 nhóm, 24 nghề, 61 vị trí); danh mục 2 cấp cũ chuyển `status=inactive` thay vì xoá.
- `/api/locations/` tắt phân trang (`pagination_class = None`, giới hạn 500 bản ghi/lần) — endpoint tra cứu tỉnh/phường trả trọn danh sách trong 1 lần gọi thay vì phân trang 20/trang.

#### Fixed

- `getProvinces()`/`getJobCategories()` gọi thẳng `.map()` lên response bị lỗi vì `/api/locations/` và `/api/jobs/categories/` bị phân trang mặc định (`PAGE_SIZE=20`) trong khi có 34 tỉnh/nhiều danh mục hơn 1 trang — thêm `fetchAllPages()` gộp hết các trang trước khi trả về component.
- `CategoryPicker`/`LocationFilter` bị tràn và không thao tác được bằng cảm ứng trên mobile do hiển thị nhiều cột cố định (280px/640px) — chuyển sang chế độ drill-down 1 cột có nút quay lại khi ở màn hình nhỏ, giữ nguyên nhiều cột trên desktop.

### 2026-07-06

#### Added — Khởi tạo dự án + nền tảng (Giai đoạn 0 + 4 bảng đầu Giai đoạn 1)

- Khởi tạo file changelog để theo dõi thay đổi của dự án.
- Chốt công nghệ theo PRD: ReactJS + Vite (frontend), Django + Django REST Framework (backend), PostgreSQL, JWT (simplejwt).
- Scaffold Django project `backend/config` với các app: `accounts`, `skills`, `candidates`, `employers`, `cv_templates`, `cvs`, `jobs`, `applications`, `interviews`, `ai_core`, `dashboard`.
- Scaffold frontend React + Vite + Tailwind CSS + Ant Design, cấu trúc `src/{pages,components,layouts,services,hooks,routes}`.
- Triển khai 4 bảng đầu của Giai đoạn 1 (theo tài liệu database v1.4, mục 7): `users` (custom User kế thừa AbstractUser, role candidate/employer/admin, public_id, status, soft-delete), `skills` (nguồn kỹ năng chuẩn duy nhất, seed 34 kỹ năng qua `seed_skills`), `candidate_profiles`, `employer_profiles`.
- API JWT auth (`/api/auth/register`, `/login`, `/refresh`, `/me`) và profile theo vai trò (`/api/candidate/profile`, `/api/employer/profile`), có phân quyền theo role.
- Frontend: trang đăng ký/đăng nhập, dashboard shell theo vai trò (candidate/employer/admin), test end-to-end thành công.
- Cấu trúc `docs/` theo 8 chủ đề (01-phan-tich ... 08-frontend), mỗi thư mục một file tài liệu đặt tên cụ thể.
- Thêm `docs/TIEN-DO-DU-AN.md` theo dõi tiến độ toàn dự án theo từng giai đoạn.
- Local dev: PostgreSQL qua Homebrew (không dùng Docker ở giai đoạn đầu, theo khuyến nghị PRD mục 8.4).

#### Added — Hoàn thành Giai đoạn 1 (MVP lõi): 8 bảng còn lại

- `job_categories` — danh mục ngành nghề, self-referential parent.
- `locations` — địa điểm hành chính 2 cấp (tỉnh/xã), seed dữ liệu thật 34 tỉnh + 3.321 xã/phường từ `provinces.open-api.vn` qua management command `seed_locations`.
- `cv_templates` — mẫu CV, API public list/detail.
- `user_cvs` — CV Builder + upload CV có sẵn (PDF/DOCX), soft-delete.
- `cv_skills` — kỹ năng theo từng CV, lồng trong API `user_cvs`.
- `jobs` — tin tuyển dụng, API public list/detail (tăng `view_count`, lọc theo category/location/work_type/employment_type/experience_level/search) và employer CRUD.
- `job_skills` — kỹ năng yêu cầu của job, lồng trong API `jobs`.
- `applications` — hồ sơ ứng tuyển, UNIQUE(candidate, job) chặn ứng tuyển trùng (kiểm tra ở cả serializer và DB constraint), employer xem/cập nhật trạng thái (tự set mốc thời gian tương ứng).
- API tra cứu địa điểm `/api/locations/` (cascading tỉnh → xã) phục vụ chọn địa điểm khi đăng job.
- Test end-to-end toàn bộ luồng: đăng job → tạo CV → ứng tuyển → employer duyệt hồ sơ.

#### Fixed

- `ApplicationSerializer` trả lỗi 500 khi ứng tuyển trùng job (IntegrityError từ DB constraint) — thêm `validate_job()` để trả lỗi 400 rõ ràng trước khi chạm DB.
- `UserCvSerializer` yêu cầu `cv_type` trong payload dù giá trị được set ở server — chuyển `cv_type` sang `read_only_fields`.

#### Changed — Tái cấu trúc thư mục cho gọn hơn

- Backend: gom toàn bộ 12 Django app (`accounts`, `skills`, `candidates`, `employers`, `locations`, `cv_templates`, `cvs`, `jobs`, `applications`, `interviews`, `ai_core`, `dashboard`) vào `backend/apps/`, giữ `backend/config/` (settings/urls) và `backend/common/` (tiện ích dùng chung) ở ngoài vì không phải app. Cập nhật `AppConfig.name`, `INSTALLED_APPS`, toàn bộ import chéo giữa các app và `include()` trong `config/urls.py` sang `apps.<tên_app>`. Không phát sinh migration mới (app_label giữ nguyên), đã test lại toàn bộ API sau khi đổi.
- Frontend: đổi `src/services/` thành `src/api/` (chứa `api.js` và `authService.js`), cập nhật import ở `hooks/useAuth.jsx` và `pages/auth/Register.jsx`. Build và test đăng nhập lại thành công.

### Removed

- Gỡ `backend/venv` cũ (thiết lập FastAPI/Alembic bị vô tình commit vào git) do đổi hướng backend sang Django.
