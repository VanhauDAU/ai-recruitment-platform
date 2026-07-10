# Changelog

Tất cả thay đổi đáng chú ý của dự án sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html) khi bắt đầu phát hành phiên bản. Trong giai đoạn chưa cắt phiên bản, thay đổi được nhóm theo ngày dưới `[Unreleased]`.

## [Unreleased]

### 2026-07-10

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
