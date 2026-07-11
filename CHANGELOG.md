# Changelog

Tất cả thay đổi đáng chú ý của dự án sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html) khi bắt đầu phát hành phiên bản. Trong giai đoạn chưa cắt phiên bản, thay đổi được nhóm theo ngày dưới `[Unreleased]`.

## [Unreleased]

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
