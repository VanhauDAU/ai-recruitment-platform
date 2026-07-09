# Tiến độ dự án

> Quy ước: mỗi khi hoàn thành một công việc (xong code + test), tick `[x]` và đổi cột Trạng thái ngay trong lần commit đó — không để dồn việc cập nhật lại sau. Cập nhật dòng "Cập nhật lần cuối" ở cuối file.

Thứ tự giai đoạn theo tài liệu database v1.4 (mục 7), đã đối chiếu với PRD mục 11.

## Giai đoạn 0 — Khởi tạo dự án

| # | Công việc | Trạng thái |
|---|---|---|
| 0.1 | Chốt công nghệ (ReactJS+Vite, Django+DRF, PostgreSQL, JWT) | [x] Done |
| 0.2 | Scaffold Django project + apps skeleton | [x] Done |
| 0.3 | Scaffold React + Vite + Tailwind + Ant Design | [x] Done |
| 0.4 | Cấu trúc `docs/` theo chủ đề | [x] Done |
| 0.5 | README, CHANGELOG, hướng dẫn cài đặt local | [x] Done |

## Giai đoạn 1 — MVP lõi

| # | Công việc | Trạng thái |
|---|---|---|
| 1.1 | Bảng `users` (custom User, role, JWT auth) | [x] Done |
| 1.2 | Bảng `skills` (nguồn kỹ năng chuẩn, seed data) | [x] Done |
| 1.3 | Bảng `candidate_profiles` + API | [x] Done |
| 1.4 | Bảng `employer_profiles` + API | [x] Done |
| 1.5 | Frontend: trang đăng ký/đăng nhập, dashboard shell theo role | [x] Done |
| 1.5b | Xác thực email qua link + Redis (kiểu TopCV): đăng ký bằng email xong **đăng nhập luôn** (RegisterView trả về JWT access/refresh) rồi backend gửi mail xác thực; token ngẫu nhiên lưu trong Redis (`django-redis`, cache mặc định) tự hết hạn theo TTL 24h + khoá cooldown chặn spam gửi lại (60s) — không cần bảng/migration. Endpoints mới: `POST /auth/verify/send/` (gửi lại, 429 kèm `retry_after` khi còn cooldown), `POST /auth/verify/confirm/` (token→`email_verified=True`, AllowAny vì token là bằng chứng), `POST /auth/change-email/` (đổi email→reset xác thực + gửi lại); `UserSerializer` expose thêm `email_verified`/`provider`. Frontend: banner nhắc "Tài khoản chưa xác thực… tại đây" ở `MainLayout` (chỉ hiện với provider `local` chưa xác thực), trang `/tai-khoan/xac-thuc-email` (2 chế độ: có `?token=` → tự xác nhận báo thành công/thất bại; không token → nút gửi/gửi lại kèm đồng hồ đếm ngược cooldown, popup "đổi email khác", khung "Khắc phục lỗi thường gặp" lấy hotline/email CSKH từ site settings). Email dev in ra console, cấu hình SMTP qua `.env` khi deploy. Đăng nhập Google/FB/LinkedIn (không cần xác thực email) làm sau | [x] Done |
| 1.6 | Bảng `job_categories` + API | [x] Done |
| 1.7 | Bảng `locations` (2 cấp tỉnh/xã, seed 34 tỉnh + 3321 xã/phường từ provinces.open-api.vn) + API tra cứu | [x] Done |
| 1.8 | Bảng `cv_templates` + API list/detail | [x] Done |
| 1.9 | Bảng `user_cvs` (builder + upload) + API CRUD/upload | [x] Done |
| 1.10 | Bảng `cv_skills` (nested trong API user_cvs) | [x] Done |
| 1.11 | Bảng `jobs` + API public list/detail + employer CRUD | [x] Done |
| 1.12 | Bảng `job_skills` (nested trong API jobs) | [x] Done |
| 1.13 | Bảng `applications` + API ứng tuyển/xem/đổi trạng thái | [x] Done |
| 1.14 | Frontend: CV builder, kho template, danh sách/chi tiết job, ứng tuyển | [ ] Một phần — trang chủ TopCV-style: header mega-menu (Việc làm/Tạo CV/Công cụ/Cẩm nang nghề nghiệp, icon, vách ngăn cột, mũi tên hiệu ứng khi hover), hero search + `LocationFilter`, **banner carousel** (tự trượt, prev/next, dot, dừng khi hover), mega-menu danh mục 3 cấp (nhóm nghề→nghề→vị trí chuyên môn khi hover, next/prev phân trang nhóm); danh sách job (bộ lọc, phân trang), chi tiết job (nhiều địa điểm, số lượng tuyển, học vấn); **CategoryPicker modal 3 cấp (multi-select, rút gọn id khi apply, drill-down mobile)**; **LocationFilter dùng chung Home+Jobs (chọn nhiều tỉnh+phường/xã, click tên là chọn, giữ checkbox khi mở lại, label "Tỉnh (Tất cả)"/"(n phường/xã)", drill-down mobile, áp dụng địa điểm ở trang chủ tìm ngay không cần bấm thêm)**; Skeleton + lazy-load + theme AntD xanh. Còn thiếu CV builder, kho template, luồng ứng tuyển |
| 1.6b | Seed job_categories (taxonomy 3 cấp: 8 nhóm nghề + 24 nghề + 61 vị trí chuyên môn) qua `seed_job_categories`; API lọc job nhận nhiều `?category=` và tự mở rộng xuống cấp con | [x] Done |
| 1.14b | Redesign trang danh sách việc làm kiểu TopCV: thanh tìm kiếm nền xanh (danh mục + từ khóa + địa điểm), heading đếm job + breadcrumb + gợi ý "N việc làm tại Hà Nội", sidebar Lọc nâng cao (danh mục nghề có số lượng & mở rộng cấp con, mức lương bucket + khoảng tự nhập + thoả thuận, cấp bậc, hình thức/loại hình làm việc, Xóa lọc), tabs tìm-theo + sắp xếp (Mới nhất/Lương cao nhất — thêm `?ordering=salary_desc` backend), JobCard mới (logo công ty, chips, kỹ năng, "Đăng N ngày trước", lưu tim localStorage); serializer thêm `company_logo_url` + `published_at` | [x] Done |
| 1.14d | Trang việc làm: header tự ẩn khi cuộn xuống (hook `useHideOnScroll` dùng chung toàn site), thanh tìm kiếm xanh sticky né header (offset động theo header), sidebar lọc dính ngay dưới thanh tìm kiếm (CSS var `--sb-top`), gắn `SearchDropdown` (gợi ý từ khóa + lịch sử + "việc làm quan tâm" + tabs tìm-theo) như trang chủ; các bộ lọc lựa chọn chuyển sang chip bo tròn (`SingleChips`/`MultiChips`) tự xuống hàng gọn thay grid 2 cột bị vỡ; "Lưu bộ lọc" bắt đăng nhập bằng Modal tái dùng đúng component `Login` (Google/Facebook/LinkedIn + email; `Login` thêm prop `onSuccess` để nhúng không điều hướng), đăng nhập xong tự lưu và ở lại trang; URL bộ lọc rút gọn kiểu TopCV: key ngắn (`cat/wt/et/level/weekend/nganh/sort`), gộp nhiều giá trị bằng dấu phẩy (`cat=84,85`, `exp=1,2`), lương 1 param `salary=10-15\|nego` (triệu) — lớp `toApiParams` khai triển lại thành param backend gốc nên API không đổi | [x] Done |
| 1.14c | Bộ lọc đầy đủ kiểu TopCV: thêm 3 field vào `jobs` (`experience_years` — kinh nghiệm theo năm chọn nhiều, `position_level` — 8 cấp bậc, `weekend_policy` — nghỉ/làm thứ 7, backfill dữ liệu demo từ experience_level qua migration 0007); filter API tương ứng + `?industry=` (lĩnh vực công ty, endpoint distinct `/api/employer/industries/`); sidebar mới: Nghỉ thứ 7 (badge AI), Kinh nghiệm checkbox 2 cột, Lĩnh vực công ty select, Cấp bậc 8 bậc, thanh dính đáy "Xóa lọc + Lưu bộ lọc" (localStorage); breadcrumb chuỗi danh mục cha→con click được; JobCard viền xanh nhạt | [x] Done |
| 1.14e | `EmployerProfile.industry` (CharField đơn) → model `Industry` riêng + `industries` M2M (1 công ty nhiều lĩnh vực), vì dữ liệu thật đã lộ nhu cầu này qua giá trị lách "Đa ngành"; migration 3 bước tách rõ ràng (tạo bảng + field mới → backfill dữ liệu cũ → xoá field cũ) để không mất dữ liệu; `IndustryListView` trả object `{id,name,slug}` (chỉ lĩnh vực đang có công ty); `EmployerProfileSerializer` nhận/trả `industries`/`industries_detail` theo khuôn `locations`/`locations_detail`; filter job `?industry=<id>` giữ **single-select** trên UI nhưng match theo M2M (`employer_profile__industries__id=`) nên job của công ty đa ngành vẫn lên đúng khi lọc theo bất kỳ ngành nào của công ty đó; `JobStatsView.featured_employers` dùng `StringAgg` gộp tên các lĩnh vực; Django admin `Industry` + `filter_horizontal` cho `EmployerProfile` | [x] Done |
| 1.14f | Skeleton loading toàn diện cho trang việc làm: sidebar (danh mục nghề, lĩnh vực công ty) có `sidebarLoading` riêng (`Promise.allSettled` cho 4 API song song) hiện `FilterSkeleton`/`Skeleton.Input` thay vì pop-in trống, heading đếm số việc làm dùng `Skeleton.Input` thay chữ "…"; danh sách job giữ `JobCardSkeleton` đã có (chạy cả lúc tải đầu và mỗi lần đổi filter) — quy ước áp dụng cho mọi danh sách sau này, đã ghi vào memory | [x] Done |
| 1.14g | Dải "khám phá nhanh" dưới thanh tìm kiếm (kiểu TopCV): hàng thẻ `ShortcutCard` cuộn ngang gồm lối tắt đặc biệt (Không cần kinh nghiệm→`exp=none`, Thực tập sinh→`level=intern`, Part-time→`et=part_time`) + tất cả nhóm ngành nghề (dùng `logo_url`, click set `cat`) + "Xem tất cả" (cuộn tới bộ lọc danh mục ở sidebar, `#cat-filter`); hàng pill lối tắt (Ưu tiên lương cao→`sort=salary_desc`, Làm từ xa→`wt=remote`, Nghỉ thứ 7→`weekend=off_saturday`) — đều toggle & sáng khi đang áp dụng, có skeleton khi đang tải; sửa điều hướng danh mục từ trang chủ (`CategoryMenu`, `FeaturedIndustriesEmployers`) dùng `?cat=` thay `?category=` cho khớp URL gọn mới | [x] Done |
| 1.14h | Banner thông báo địa danh hành chính mới (sau sáp nhập 1/7/2025) trên trang việc làm: chỉ hiện khi lọc **đúng 1 tỉnh/thành** (`selectedLocationGroups.length===1`), đặt ngay trên lưới sidebar + "Tìm kiếm theo"; nền hổ phách, icon info, nội dung theo tên tỉnh đang chọn, nút Xem thêm/Thu gọn (`line-clamp-1`) và nút × đóng theo từng tỉnh (`dismissedNotice`); backend thêm filter `?education_level=` (field đã có sẵn trên `Job`) để phục vụ lối tắt "không yêu cầu bằng cấp" (education=none) sau này | [x] Done |
| 1.14i | Dữ liệu sáp nhập tỉnh 2025 (63→34) vào `Location.merged_from` (JSONField, list tên tỉnh cũ hợp thành; rỗng = giữ nguyên); seed qua management command `seed_province_merges` (mapping đã đối chiếu nguồn chính phủ/thuvienphapluat, 23/23 tỉnh sáp nhập khớp), admin sửa được; `LocationSerializer` expose `merged_from`; banner ở trang việc làm dùng dữ liệu này: nếu có `merged_from` hiển thị đúng câu "…sau sáp nhập bao gồm phạm vi các tỉnh Bình Phước, Đồng Nai cũ…" (tên tỉnh viết thường giữa câu), nếu rỗng dùng câu fallback quận/huyện→phường/xã | [x] Done |
| 1.14j | Sửa dải "khám phá nhanh": bỏ hẳn cơ chế kéo chuột tự chế bằng `setPointerCapture` (nghi ngờ là nguyên nhân đôi khi nuốt mất click, khiến chọn được nhiều thẻ khó/không nhất quán) — thay bằng `overflow-x-auto` gốc của trình duyệt (đã hỗ trợ sẵn kéo cảm ứng/trackpad) + 2 nút mũi tên `ArrowButton` (tái dùng từ `CategoryMenu`) nổi 2 bên, tự ẩn khi đã cuộn hết; theo dõi vị trí cuộn qua state `canScrollShortcutsLeft/Right` cập nhật theo sự kiện `scroll`/`resize`. Việc chọn nhiều thẻ ngành nghề vốn đã đúng ở tầng dữ liệu (`cat=a,b`), lỗi chỉ nằm ở tầng tương tác chuột — nay loại bỏ | [x] Done |
| 1.14k | Panel "Xem nhanh" job kiểu TopCV: click card (ngoài tiêu đề) hoặc nút "Xem nhanh" → ẩn sidebar lọc, danh sách job chuyển sang cột trái (JobCard `compact` + `active` highlight card đang xem, pagination `simple`), cột phải hiện `JobQuickView` (component mới): header dính (tiêu đề, chip lương/địa điểm/kinh nghiệm, link Xem chi tiết, nút Ứng tuyển ngay + tim), bảng thông tin chung, các section Mô tả/Trách nhiệm/Yêu cầu/Ưu tiên/Quyền lợi/Địa điểm, thẻ công ty; fetch đầy đủ qua `getJobDetail` kèm **Skeleton**, hiệu ứng slide-in, panel sticky cuộn riêng như sidebar; nút × quay lại layout có bộ lọc; JobCard đổi root Link→div (tiêu đề vẫn là Link sang trang chi tiết), tách hook `useSavedJob` dùng chung lưu tim | [x] Done |
| 1.15 | Quy trình duyệt/publish job (status draft -> active) | [ ] Chưa làm — hiện chỉnh trực tiếp qua Django shell/admin |
| 1.16 | Bảo vệ login/register: rate limit theo IP (DRF `ScopedRateThrottle`, 5 lần/phút mỗi endpoint) + Google reCAPTCHA v3 invisible (verify server-side qua `apps/accounts/captcha.py` — check `success` + `action` khớp (`login`/`register`) + `score >= RECAPTCHA_SCORE_THRESHOLD`, bỏ qua 2 field khi thiếu để tương thích test key; field `captcha_token` trên cả 2 serializer); frontend dùng `react-google-recaptcha-v3` (`GoogleReCaptchaProvider` bọc App, `useGoogleReCaptcha().executeRecaptcha(action)` lấy token ẩn lúc submit trên `Login`/`Register`), thông báo riêng khi bị 429 | [x] Done |

## Giai đoạn 2 — AI cơ bản

| # | Công việc | Trạng thái |
|---|---|---|
| 2.1 | Bảng `cv_analysis` | [ ] Chưa làm |
| 2.2 | Bảng `match_results` | [ ] Chưa làm |
| 2.3 | Bảng `ai_suggestions` | [ ] Chưa làm |
| 2.4 | Bảng `ai_usage_logs` | [ ] Chưa làm |
| 2.5 | `ai_core/cv_parser.py` — đọc CV PDF (PyMuPDF) | [ ] Chưa làm |
| 2.6 | `ai_core/skill_extractor.py` — trích xuất kỹ năng | [ ] Chưa làm |
| 2.7 | Dataset + train model phân loại nhóm kỹ năng (`skill_classifier.py`) | [ ] Chưa làm |
| 2.8 | `ai_core/job_matcher.py` — công thức match_score thống nhất | [ ] Chưa làm |

## Giai đoạn 3 — Tối ưu tìm kiếm / matching

| # | Công việc | Trạng thái |
|---|---|---|
| 3.1 | Bảng `embeddings` (pgvector) | [ ] Chưa làm |
| 3.2 | Semantic matching CV-JD (Sentence Transformer) | [ ] Chưa làm |

## Giai đoạn 4 — CV nâng cao

| # | Công việc | Trạng thái |
|---|---|---|
| 4.1 | Bảng `cv_versions` (undo/restore) | [ ] Chưa làm |
| 4.2 | Bảng `cv_exports` + export PDF | [ ] Chưa làm |

## Giai đoạn 5 — Tuyển dụng nâng cao

| # | Công việc | Trạng thái |
|---|---|---|
| 5.1 | Bảng `saved_jobs` | [ ] Chưa làm |
| 5.2 | Bảng `application_status_history` | [ ] Chưa làm |
| 5.3 | Bảng `notifications` | [ ] Chưa làm |

## Giai đoạn 6 — Thương mại & quản trị

| # | Công việc | Trạng thái |
|---|---|---|
| 6.1 | Bảng `subscription_plans` | [ ] Chưa làm |
| 6.2 | Bảng `user_subscriptions` (quota AI) | [ ] Chưa làm |
| 6.3 | Bảng `audit_logs` | [ ] Chưa làm |
| 6.4 | App `sitecontent`: `SiteSetting` (config key-value JSON) + `LinkGroup`/`LinkItem` (cụm link có thứ tự, source manual/auto từ locations·categories) + Django admin + API public `/api/site/`; frontend `PopularSearches` (cụm link SEO trên footer) đọc từ API | [x] Done |
| 6.5 | `sitecontent.Banner` (slide carousel trang chủ: eyebrow/title/subtitle/theme gradient hoặc image_url/CTA, order, is_active) + admin + API `/api/site/banners/`; `Home.jsx` render banner IT/CV từ API thay vì hardcode (slide thống kê vẫn code cứng vì cần số liệu jobCount/categories realtime) | [x] Done |
| 6.6 | `SiteSetting` mở rộng schema-driven: thêm `value_type` (text/textarea/number/boolean/select/color/image/email/url/json/env) + `options` + `order`, 15 nhóm cài đặt (chung, trang chủ, SEO, ứng viên, NTD, việc làm, CV, email, thanh toán, bảo mật, upload, footer, liên hệ, phân quyền, AI), seed 96 keys idempotent (không ghi đè value); cache public API 1h + signal invalidation. Secrets giữ trong `.env` (type `env` chỉ báo đã cấu hình hay chưa). Chi tiết: `docs/05-huong-dan/cau-hinh-site-settings.md` | [x] Done |
| 6.7 | API admin cấu hình: `GET/PATCH /api/site/admin/settings/` (trả theo nhóm + bulk update có validate theo value_type) + `POST /api/site/admin/settings/upload/` (upload ảnh) + permission `IsAdmin` mới trong `accounts/permissions.py` | [x] Done |
| 6.8 | Trang React `/admin/settings`: tabs 15 nhóm, form tự sinh từ metadata (`SettingField` map value_type → control AntD), dirty-tracking + lưu theo nhóm, upload ảnh, tag Public/env; fix nav DashboardLayout (bỏ menu chết users/skills, highlight theo route) | [x] Done |
| 6.9 | Dọn dẹp & chuẩn hóa frontend theo mô hình 3 cổng: gom cổng main vào `pages/main/` (Home, auth, jobs, candidate) cho đối xứng với `pages/employer` & `pages/admin`; đổi `PublicRoutes`→`MainRoutes` (`mainRoutes()`) cho khớp tên `EmployerRoutes`/`AdminRoutes`; migrate màu brand hardcode (`#00b14f/#008a3e/#f0fbf5` ở ~30 file) sang `var(--brand-primary/-hover/-soft)` để đổi màu qua site settings áp dụng toàn site; gỡ `settingText` trùng lặp trong `SiteSettingsProvider`; fix bug có sẵn nested `<a>` (Link bọc BrandLogo vốn đã tự render Link) ở `EmployerMarketingLayout`. Verify: lint + build pass, preview 3 cổng không lỗi | [x] Done |
| 6.10 | Tách `BestJobs.jsx` (643 dòng): đưa `JobPreviewPanel` + `PreviewSection` + helper `textLines` ra file riêng `JobPreviewPanel.jsx`, chuyển helper `formatDeadline` về `constants/jobOptions.js` (cùng nhà với `formatSalary/formatLocations`), và dùng `EXPERIENCE_LEVEL_LABELS` chuẩn thay `experienceLabel` cục bộ (bỏ mapping lạ `senior→"3 năm"`, đồng bộ với JobDetail/JobCard). BestJobs còn 478 dòng. Verify: lint + build pass | [x] Done |

## Giai đoạn 7 — Phỏng vấn AI

| # | Công việc | Trạng thái |
|---|---|---|
| 7.1 | Bảng `interview_question_bank` | [ ] Chưa làm |
| 7.2 | Bảng `interview_sessions` | [ ] Chưa làm |
| 7.3 | Bảng `interview_questions` | [ ] Chưa làm |
| 7.4 | Bảng `interview_answers` + chấm điểm rule-based | [ ] Chưa làm |

## Giai đoạn 8 — Deployment

| # | Công việc | Trạng thái |
|---|---|---|
| 8.1 | Dockerfile backend + docker-compose (backend + PostgreSQL) | [ ] Chưa làm |
| 8.2 | Deploy (Vercel + Render/Railway hoặc Docker tự host) | [ ] Chưa làm |

---

Cập nhật lần cuối: 2026-07-09
