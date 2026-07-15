# Tiến độ dự án

> Quy ước: mỗi khi hoàn thành một công việc (xong code + test), đổi icon trạng thái ngay trong lần commit đó — không để dồn việc cập nhật lại sau. Tiêu đề trong bảng giữ **ngắn gọn 1 dòng**; ghi chú kỹ thuật chi tiết đặt trong khối `<details>` ở mục "Ghi chú chi tiết" cuối mỗi giai đoạn. Cập nhật dòng "Cập nhật lần cuối" ở cuối file.

Thứ tự giai đoạn theo tài liệu database v1.4 (mục 7), đã đối chiếu với PRD mục 11.

**Trạng thái:** ✅ Done · 🟡 Một phần · ⬜ Chưa làm

## Tổng quan

| Giai đoạn | Tiến độ | Trạng thái |
| --- | --- | --- |
| 0 — Khởi tạo dự án | 5/5 | ✅ Hoàn thành |
| 1 — MVP lõi | 40/42 | 🟡 Còn 1.14 (một phần), 1.15 |
| 2 — AI cơ bản | 0/8 | ⬜ |
| 3 — Tối ưu tìm kiếm / matching | 0/2 | ⬜ |
| 4 — CV nâng cao | 0/2 | ⬜ |
| 5 — Tuyển dụng nâng cao | 1/3 | 🟡 |
| 6 — Thương mại & quản trị | 10/13 | 🟡 |
| 7 — Phỏng vấn AI | 0/4 | ⬜ |
| 8 — Deployment | 0/2 | ⬜ |
| **Tổng** | **56/81** | |

## Epic hoàn thiện CV Builder (2026-07-15)

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| CVB-P0 | Canonical composition, regression contract, ADR | ✅ |
| CVB-P1 | Sample/blank live preview | ✅ |
| CVB-P2 | Previous + latest recoverable draft | ✅ |
| CVB-P3 | Locale + canonical blueprint | ✅ |
| CVB-P4 | Admin catalogue + snapshot | ✅ |
| CVB-P5 | AI import PDF/DOCX | ✅ |
| CVB-P6 | Cleanup, rollout, observability | ✅ |

Chi tiết: [kế hoạch CV Builder theo giai đoạn](./03-database/ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md).

## Epic dọn dẹp & nâng cấp frontend (2026-07-15, nhánh `refactor/*` stacked trên `feature/cv-builder`)

Audit FSD không có vi phạm layer; ngân sách dồn vào enforcement, quy ước, tách file lớn và server-state. Baseline: 22 E2E smoke, coverage 84.65/67.36/85.33/89.52, bundle 255.7 KiB gzip.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| FE-P1 | Siết enforcement: widget public API (3 `index.js` + sửa deep-import MainLayout), depcruise đọc slice động (vá 7 feature + 2 widget không được bảo vệ) + rule `no-deep-import-widgets`, oxlint thêm exhaustive-deps/no-unused-vars/import-first/no-duplicates/no-cycle (sửa 36 vi phạm) | ✅ |
| FE-P2 | Đồng nhất quy ước: rename 6 hook camelCase → kebab-case, xóa wrapper `session.storage.js`, tài liệu hóa quy ước import trong slice | ✅ |
| FE-P3 | Tách `MyCvs.jsx` 643 dòng → model hook + 3 UI component, mở đầu coverage ratchet | ✅ |
| FE-P4 | Tách `FeaturedIndustriesEmployers` (449) + `MarketStats` (442) | ✅ |
| FE-P5 | TanStack Query: infra → pilot saved-jobs → jobs pages → thu gọn request-deduplication | ✅ |
| FE-P6 | Perf: precompress, WebP logo (favicon + manualChunks đã xong từ trước) | ⬜ |

## Epic tái cấu trúc (song song, nhánh `feature/restructuring`)

Theo *Kế hoạch tái cấu trúc ProCV sau merge main (2026-07-12)* — 11 giai đoạn, tăng dần, giữ tương thích. Chi tiết baseline: [docs/09-refactor/baseline](./09-refactor/baseline/README.md); quyết định kiến trúc: [docs/adr](./adr/).

| GĐ | Nội dung | Trạng thái |
| --- | --- | --- |
| R0 | Khóa baseline: tag `baseline-refactor-start`, quality suite xanh (74 BE + 31 FE test), bundle report, script inventory hotspot | ✅ |
| R1 | CI (frontend/backend workflow + Postgres/Redis), `scripts/check_all.sh` 1 lệnh, 5 ADR, PR template | ✅ |
| R2 | Tách hạ tầng API frontend (`shared/api`): client/tokenStore/errorMapper/pagination/dedup + re-export tương thích + boundary check axios | ✅ |
| R3 | Tái cấu trúc Auth/Account/2FA thành `features/*` | ✅ `features/auth`, `features/account`, `features/two-factor` hoàn chỉnh; giữ re-export tương thích tới R10. Unit 34/34, Accounts 37/37, E2E 12/12, lint/build xanh |
| R4 | App providers, router, guard đơn trách nhiệm | ✅ `AppProviders`, `AppRouter`, Auth/Role/Onboarding guard, loading shell và returnUrl an toàn; OnboardingGuard chờ R9 tích hợp status/route |
| R5 | Pilot Jobs theo lát cắt dọc | 🟡 Tách candidate feature + backend boundary; còn UI CRUD employer |
| R6 | Applications/Saved jobs + server state | 🟡 Feature state/API và transition backend; còn UI nghiệp vụ |
| R7 | Tách Django settings theo môi trường | ✅ base/development/test/production, CI test settings và production validation giữ nguyên |
| R8 | Dọn backend theo hotspot | 🟡 Candidate/CV/CV template có selector/service; Dashboard/AI chưa có use case, Sitecontent để lát cắt riêng |
| R9 | Onboarding theo kiến trúc mới | ✅ Form preference dùng chung onboarding/settings, API preference có transaction + consent, responsive modal chọn vị trí, regression desktop/mobile |
| R10 | Cleanup, bundle, tài liệu | ✅ Xóa compatibility layer, CI feature boundary, bundle review và tài liệu |

> Lưu ý: nhánh dựa trên `#23`, cần hòa hợp `origin/main` (`#24`) trước khi merge refactor về `main`.

## Giai đoạn 0 — Khởi tạo dự án

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 0.1 | Chốt công nghệ (ReactJS+Vite, Django+DRF, PostgreSQL, JWT) | ✅ |
| 0.2 | Scaffold Django project + apps skeleton | ✅ |
| 0.3 | Scaffold React + Vite + Tailwind + Ant Design | ✅ |
| 0.4 | Cấu trúc `docs/` theo chủ đề | ✅ |
| 0.5 | README, CHANGELOG, hướng dẫn cài đặt local | ✅ |

## Giai đoạn 1 — MVP lõi

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 1.1 | Bảng `users` (custom User, role, JWT auth) | ✅ |
| 1.2 | Bảng `skills` (nguồn kỹ năng chuẩn, seed data) | ✅ |
| 1.3 | Bảng `candidate_profiles` + API | ✅ |
| 1.4 | Bảng `employer_profiles` + API | ✅ |
| 1.5 | Frontend: trang đăng ký/đăng nhập, dashboard shell theo role | ✅ |
| 1.5b | Xác thực email qua link + Redis (auto-login sau đăng ký, cooldown gửi lại, SMTP provider-agnostic) | ✅ |
| 1.6 | Bảng `job_categories` + API | ✅ |
| 1.6b | Seed taxonomy danh mục 3 cấp (8 nhóm + 24 nghề + 61 vị trí); filter nhận nhiều `?category=` tự mở rộng cấp con | ✅ |
| 1.7 | Bảng `locations` (2 cấp tỉnh/xã, seed 34 tỉnh + 3321 xã/phường) + API tra cứu | ✅ |
| 1.8 | Bảng `cv_templates` + API list/detail | ✅ |
| 1.9 | Bảng `user_cvs` (builder + upload) + API CRUD/upload | ✅ |
| 1.10 | Bảng `cv_skills` (nested trong API user_cvs) | ✅ |
| 1.11 | Bảng `jobs` + API public list/detail + employer CRUD | ✅ |
| 1.12 | Bảng `job_skills` (nested trong API jobs) | ✅ |
| 1.13 | Bảng `applications` + API ứng tuyển/xem/đổi trạng thái | ✅ |
| 1.14 | Frontend cổng ứng viên: xong trang chủ + danh sách/chi tiết job; **còn thiếu CV builder, kho template, luồng ứng tuyển** | 🟡 |
| 1.14b | Redesign trang danh sách việc làm (search xanh, sidebar lọc nâng cao, JobCard mới, sort lương) | ✅ |
| 1.14c | Bộ lọc đầy đủ: kinh nghiệm theo năm, cấp bậc, nghỉ thứ 7, lĩnh vực công ty | ✅ |
| 1.14d | Header tự ẩn khi cuộn, thanh tìm kiếm sticky, chip lọc, URL bộ lọc rút gọn | ✅ |
| 1.14e | Tách `Industry` thành model riêng + M2M (1 công ty nhiều lĩnh vực) | ✅ |
| 1.14f | Skeleton loading toàn diện cho trang việc làm | ✅ |
| 1.14g | Dải "khám phá nhanh" dưới thanh tìm kiếm (thẻ lối tắt + pill) | ✅ |
| 1.14h | Banner thông báo địa danh hành chính mới (sáp nhập 1/7/2025) + filter `?education_level=` | ✅ |
| 1.14i | Dữ liệu sáp nhập tỉnh 2025 (63→34) vào `Location.merged_from` + seed command | ✅ |
| 1.14j | Sửa cuộn ngang dải "khám phá nhanh": bỏ drag tự chế, dùng scroll gốc + nút mũi tên | ✅ |
| 1.14k | Panel "Xem nhanh" job 2 cột (`JobQuickView`, danh sách compact bên trái) | ✅ |
| 1.14l | Header ứng viên sau đăng nhập: chuông + avatar dropdown hover, accordion section | ✅ |
| 1.14m | Responsive mobile toàn site chính (Drawer nav, Drawer lọc, bottom-sheet xem nhanh) | ✅ |
| 1.14n | Tìm kiếm tiếng Việt không dấu/đảo từ (Postgres `unaccent`) + empty-state kiểu TopCV | ✅ |
| 1.14o | Việc làm đã lưu (trang riêng, API `SavedJob`, đồng bộ đa thiết bị) + cụm nút nổi Góp ý/Hỗ trợ | ✅ |
| 1.14p | Phân hạng tin (tier standard/featured/top) + nhãn HOT/GẤP/⚡/✓ xác thực | ✅ |
| 1.14q | Chuẩn hóa schema tin tuyển dụng: danh mục theo vai trò, địa điểm phường/xã, lịch làm việc, quyền lợi, ngoại ngữ, liên hệ nhận hồ sơ | ✅ |
| 1.14r | Trang chi tiết việc làm bản mới: view-model API nhóm sẵn + tag tóm tắt, ngoại ngữ, địa điểm nhóm tỉnh, lịch JSX, sticky anchor động | ✅ |
| 1.15 | Quy trình duyệt/publish job (status draft → active) — hiện chỉnh trực tiếp qua Django shell/admin | ⬜ |
| 1.16 | Bảo vệ login/register: rate limit theo IP + Google reCAPTCHA v3 invisible | ✅ |
| 1.17 | Social login Google/Facebook/LinkedIn (OAuth Authorization Code Flow qua backend) | ✅ |
| 1.18 | Ghi nhận `last_login` ở cả 3 luồng phát token (login, đăng ký, social) | ✅ |
| 1.19 | Đặt lại mật khẩu (quên mật khẩu) qua link email + Redis, token một lần | ✅ |
| 1.19b | Email không phân biệt hoa/thường (normalize + `iexact` + unique constraint `Lower(email)`) | ✅ |
| 1.20 | Trang thương hiệu (brand page): URL `/brand/<company>/tuyen-dung/<job>` + header thương hiệu | ✅ |
| 1.21 | Tách công ty khỏi nhà tuyển dụng ([kế hoạch](./03-database/ke-hoach-thiet-ke-lai-cong-ty-nha-tuyen-dung.md)): **Giai đoạn A + B xong** — (A) models `companies`/`company_industries`/`company_images`/`company_documents`/`company_update_requests`/`recruiter_profiles`/`phone_otps` + migration đổ 9 `employer_profiles` sang (gộp theo tax_code, size chuẩn hóa bucket); (B) `jobs` chuyển FK `employer_profile`→`company`, `employer`→`posted_by` (backfill migration 0014–0016), bộ API mới `/api/employer/*` (onboarding 5 bước, OTP SĐT qua email, tạo/tìm/join công ty kèm giấy tờ, update request chờ duyệt), admin actions duyệt (công ty, membership, giấy tờ, update request), employer đăng tin → `status=pending` chờ duyệt, seed + tests cập nhật (54 test pass); (C) xóa model + bảng `employer_profiles` (migration `employers.0008`, phụ thuộc `jobs.0016`). Frontend cổng NTD sẽ xây sau trên bộ API mới | ✅ |
| 1.22 | Khung layout 3 cột trang tài khoản ứng viên `/tai-khoan/*` (sidebar accordion + cột phải hồ sơ + 11 route placeholder) | ✅ |
| 1.23 | Trang "Cài đặt thông tin cá nhân": PATCH `/auth/me/` sửa họ tên + SĐT (nhiều lần), email read-only | ✅ |
| 1.24 | Onboarding và cài đặt gợi ý việc làm: form preference dùng chung, giới tính tại settings, modal chọn vị trí responsive, feedback validation/toast và sidebar hồ sơ sticky | ✅ |
| 1.25 | Cookie consent + job view tracking: signed cookie, UI tùy chỉnh, policy, optional-storage gate và deduplicated tracking | ✅ |
| 1.26 | API response DTO theo màn hình: list/detail/write riêng, query tối thiểu và contract test chống field dư/nhạy cảm | ✅ |

### Ghi chú chi tiết — Giai đoạn 1

<details>
<summary><b>1.5b</b> — Xác thực email qua link + Redis</summary>

Đăng ký bằng email xong **đăng nhập luôn** (RegisterView trả về JWT access/refresh) rồi backend gửi mail xác thực; token ngẫu nhiên lưu trong Redis (`django-redis`, cache mặc định) tự hết hạn theo TTL 24h + khoá cooldown chặn spam gửi lại (60s) — không cần bảng/migration. Endpoints mới: `POST /auth/verify/send/` (gửi lại, 429 kèm `retry_after` khi còn cooldown), `POST /auth/verify/confirm/` (token→`email_verified=True`, AllowAny vì token là bằng chứng), `POST /auth/change-email/` (đổi email→reset xác thực + gửi lại); `UserSerializer` expose thêm `email_verified`/`provider`. Frontend: banner nhắc "Tài khoản chưa xác thực… tại đây" ở `MainLayout` (chỉ hiện với provider `local` chưa xác thực), trang `/tai-khoan/xac-thuc-email` (2 chế độ: có `?token=` → tự xác nhận báo thành công/thất bại; không token → nút gửi/gửi lại kèm đồng hồ đếm ngược cooldown, popup "đổi email khác", khung "Khắc phục lỗi thường gặp" lấy hotline/email CSKH từ site settings). Email gửi qua SMTP provider-agnostic (Gmail/SendGrid/SES/Mailgun): chưa điền credential → in ra console cho dev, điền `EMAIL_HOST_USER/PASSWORD` vào `.env` là **tự chuyển gửi thật** (không đổi code); dùng `EmailMultiAlternatives` (text + HTML), `Reply-To` = `support_email`, `From` name lấy từ site setting `email_from_name`, `EMAIL_TIMEOUT=10` chặn request treo; `.env`/`.env.example` (backend + frontend) đã cập nhật đầy đủ. Đăng nhập Google/FB/LinkedIn (không cần xác thực email) làm sau.

</details>

<details>
<summary><b>1.14</b> — Frontend cổng ứng viên (một phần)</summary>

Đã xong — trang chủ: header mega-menu (Việc làm/Tạo CV/Công cụ/Cẩm nang nghề nghiệp, icon, vách ngăn cột, mũi tên hiệu ứng khi hover), hero search + `LocationFilter`, **banner carousel** (tự trượt, prev/next, dot, dừng khi hover), mega-menu danh mục 3 cấp (nhóm nghề→nghề→vị trí chuyên môn khi hover, next/prev phân trang nhóm); danh sách job (bộ lọc, phân trang), chi tiết job (nhiều địa điểm, số lượng tuyển, học vấn); **CategoryPicker modal 3 cấp (multi-select, rút gọn id khi apply, drill-down mobile)**; **LocationFilter dùng chung Home+Jobs (chọn nhiều tỉnh+phường/xã, click tên là chọn, giữ checkbox khi mở lại, label "Tỉnh (Tất cả)"/"(n phường/xã)", drill-down mobile, áp dụng địa điểm ở trang chủ tìm ngay không cần bấm thêm)**; Skeleton + lazy-load + theme AntD xanh. Còn thiếu CV builder, kho template, luồng ứng tuyển.

</details>

<details>
<summary><b>1.14b</b> — Redesign trang danh sách việc làm</summary>

Thanh tìm kiếm nền xanh (danh mục + từ khóa + địa điểm), heading đếm job + breadcrumb + gợi ý "N việc làm tại Hà Nội", sidebar Lọc nâng cao (danh mục nghề có số lượng & mở rộng cấp con, mức lương bucket + khoảng tự nhập + thoả thuận, cấp bậc, hình thức/loại hình làm việc, Xóa lọc), tabs tìm-theo + sắp xếp (Mới nhất/Lương cao nhất — thêm `?ordering=salary_desc` backend), JobCard mới (logo công ty, chips, kỹ năng, "Đăng N ngày trước", lưu tim localStorage); serializer thêm `company_logo_url` + `published_at`.

</details>

<details>
<summary><b>1.14c</b> — Bộ lọc đầy đủ</summary>

Thêm 3 field vào `jobs` (`experience_years` — kinh nghiệm theo năm chọn nhiều, `position_level` — 8 cấp bậc, `weekend_policy` — nghỉ/làm thứ 7, backfill dữ liệu demo từ experience_level qua migration 0007); filter API tương ứng + `?industry=` (lĩnh vực công ty, endpoint distinct `/api/employer/industries/`); sidebar mới: Nghỉ thứ 7 (badge AI), Kinh nghiệm checkbox 2 cột, Lĩnh vực công ty select, Cấp bậc 8 bậc, thanh dính đáy "Xóa lọc + Lưu bộ lọc" (localStorage); breadcrumb chuỗi danh mục cha→con click được; JobCard viền xanh nhạt.

</details>

<details>
<summary><b>1.14d</b> — Header tự ẩn, search sticky, URL bộ lọc rút gọn</summary>

Header tự ẩn khi cuộn xuống (hook `useHideOnScroll` dùng chung toàn site), thanh tìm kiếm xanh sticky né header (offset động theo header), sidebar lọc dính ngay dưới thanh tìm kiếm (CSS var `--sb-top`), gắn `SearchDropdown` (gợi ý từ khóa + lịch sử + "việc làm quan tâm" + tabs tìm-theo) như trang chủ; các bộ lọc lựa chọn chuyển sang chip bo tròn (`SingleChips`/`MultiChips`) tự xuống hàng gọn thay grid 2 cột bị vỡ; "Lưu bộ lọc" bắt đăng nhập bằng Modal tái dùng đúng component `Login` (Google/Facebook/LinkedIn + email; `Login` thêm prop `onSuccess` để nhúng không điều hướng), đăng nhập xong tự lưu và ở lại trang; URL bộ lọc rút gọn: key ngắn (`cat/wt/et/level/weekend/nganh/sort`), gộp nhiều giá trị bằng dấu phẩy (`cat=84,85`, `exp=1,2`), lương 1 param `salary=10-15|nego` (triệu) — lớp `toApiParams` khai triển lại thành param backend gốc nên API không đổi.

</details>

<details>
<summary><b>1.14e</b> — Tách model <code>Industry</code> + M2M</summary>

`EmployerProfile.industry` (CharField đơn) → model `Industry` riêng + `industries` M2M (1 công ty nhiều lĩnh vực), vì dữ liệu thật đã lộ nhu cầu này qua giá trị lách "Đa ngành"; migration 3 bước tách rõ ràng (tạo bảng + field mới → backfill dữ liệu cũ → xoá field cũ) để không mất dữ liệu; `IndustryListView` trả object `{id,name,slug}` (chỉ lĩnh vực đang có công ty); `EmployerProfileSerializer` nhận/trả `industries`/`industries_detail` theo khuôn `locations`/`locations_detail`; filter job `?industry=<id>` giữ **single-select** trên UI nhưng match theo M2M (`employer_profile__industries__id=`) nên job của công ty đa ngành vẫn lên đúng khi lọc theo bất kỳ ngành nào của công ty đó; `JobStatsView.featured_employers` dùng `StringAgg` gộp tên các lĩnh vực; Django admin `Industry` + `filter_horizontal` cho `EmployerProfile`.

</details>

<details>
<summary><b>1.14f</b> — Skeleton loading toàn diện</summary>

Sidebar (danh mục nghề, lĩnh vực công ty) có `sidebarLoading` riêng (`Promise.allSettled` cho 4 API song song) hiện `FilterSkeleton`/`Skeleton.Input` thay vì pop-in trống, heading đếm số việc làm dùng `Skeleton.Input` thay chữ "…"; danh sách job giữ `JobCardSkeleton` đã có (chạy cả lúc tải đầu và mỗi lần đổi filter) — quy ước áp dụng cho mọi danh sách sau này, đã ghi vào memory.

</details>

<details>
<summary><b>1.14g</b> — Dải "khám phá nhanh"</summary>

Hàng thẻ `ShortcutCard` cuộn ngang gồm lối tắt đặc biệt (Không cần kinh nghiệm→`exp=none`, Thực tập sinh→`level=intern`, Part-time→`et=part_time`) + tất cả nhóm ngành nghề (dùng `logo_url`, click set `cat`) + "Xem tất cả" (cuộn tới bộ lọc danh mục ở sidebar, `#cat-filter`); hàng pill lối tắt (Ưu tiên lương cao→`sort=salary_desc`, Làm từ xa→`wt=remote`, Nghỉ thứ 7→`weekend=off_saturday`) — đều toggle & sáng khi đang áp dụng, có skeleton khi đang tải; sửa điều hướng danh mục từ trang chủ (`CategoryMenu`, `FeaturedIndustriesEmployers`) dùng `?cat=` thay `?category=` cho khớp URL gọn mới.

</details>

<details>
<summary><b>1.14h</b> — Banner địa danh hành chính mới</summary>

Banner thông báo địa danh hành chính mới (sau sáp nhập 1/7/2025) trên trang việc làm: chỉ hiện khi lọc **đúng 1 tỉnh/thành** (`selectedLocationGroups.length===1`), đặt ngay trên lưới sidebar + "Tìm kiếm theo"; nền hổ phách, icon info, nội dung theo tên tỉnh đang chọn, nút Xem thêm/Thu gọn (`line-clamp-1`) và nút × đóng theo từng tỉnh (`dismissedNotice`); backend thêm filter `?education_level=` (field đã có sẵn trên `Job`) để phục vụ lối tắt "không yêu cầu bằng cấp" (education=none) sau này.

</details>

<details>
<summary><b>1.14i</b> — Dữ liệu sáp nhập tỉnh 2025</summary>

Dữ liệu sáp nhập tỉnh 2025 (63→34) vào `Location.merged_from` (JSONField, list tên tỉnh cũ hợp thành; rỗng = giữ nguyên); seed qua management command `seed_province_merges` (mapping đã đối chiếu nguồn chính phủ/thuvienphapluat, 23/23 tỉnh sáp nhập khớp), admin sửa được; `LocationSerializer` expose `merged_from`; banner ở trang việc làm dùng dữ liệu này: nếu có `merged_from` hiển thị đúng câu "…sau sáp nhập bao gồm phạm vi các tỉnh Bình Phước, Đồng Nai cũ…" (tên tỉnh viết thường giữa câu), nếu rỗng dùng câu fallback quận/huyện→phường/xã.

</details>

<details>
<summary><b>1.14j</b> — Sửa cuộn ngang dải "khám phá nhanh"</summary>

Bỏ hẳn cơ chế kéo chuột tự chế bằng `setPointerCapture` (nghi ngờ là nguyên nhân đôi khi nuốt mất click, khiến chọn được nhiều thẻ khó/không nhất quán) — thay bằng `overflow-x-auto` gốc của trình duyệt (đã hỗ trợ sẵn kéo cảm ứng/trackpad) + 2 nút mũi tên `ArrowButton` (tái dùng từ `CategoryMenu`) nổi 2 bên, tự ẩn khi đã cuộn hết; theo dõi vị trí cuộn qua state `canScrollShortcutsLeft/Right` cập nhật theo sự kiện `scroll`/`resize`. Việc chọn nhiều thẻ ngành nghề vốn đã đúng ở tầng dữ liệu (`cat=a,b`), lỗi chỉ nằm ở tầng tương tác chuột — nay loại bỏ.

</details>

<details>
<summary><b>1.14k</b> — Panel "Xem nhanh" job</summary>

Click card (ngoài tiêu đề) hoặc nút "Xem nhanh" → ẩn sidebar lọc, danh sách job chuyển sang cột trái (JobCard `compact` + `active` highlight card đang xem, pagination `simple`), cột phải hiện `JobQuickView` (component mới): header dính (tiêu đề, chip lương/địa điểm/kinh nghiệm, link Xem chi tiết, nút Ứng tuyển ngay + tim), bảng thông tin chung, các section Mô tả/Trách nhiệm/Yêu cầu/Ưu tiên/Quyền lợi/Địa điểm, thẻ công ty; fetch đầy đủ qua `getJobDetail` kèm **Skeleton**, hiệu ứng slide-in, panel sticky cuộn riêng như sidebar; nút × quay lại layout có bộ lọc; JobCard đổi root Link→div (tiêu đề vẫn là Link sang trang chi tiết), tách hook `useSavedJob` dùng chung lưu tim.

</details>

<details>
<summary><b>1.14l</b> — Header ứng viên sau đăng nhập</summary>

Khi `isAuthenticated && role==='candidate'` thay 2 nút cũ bằng `CandidateUserMenu` (chuông thông báo badge + icon chat, avatar; **chuông và avatar mở dropdown khi hover** qua AntD `popupRender` + `mouseLeaveDelay`) + cụm "Bạn là nhà tuyển dụng? Đăng tuyển ngay »" sang `EMPLOYER_PORTAL_URL`. Dropdown: khối profile (avatar, tên, trạng thái xác thực — chưa xác thực thì link `/tai-khoan/xac-thuc-email`, ID `public_id` + email), 5 section thu/mở với animation mượt (grid-rows `0fr↔1fr`): Quản lý tìm việc, Quản lý CV & Cover letter (mặc định mở, độc lập) + nhóm accordion Cài đặt email & thông báo / Cá nhân & Bảo mật / Nâng cấp tài khoản (**mở 1 đóng 2**), nút Đăng xuất bo tròn; màu lấy từ CSS var brand (`--brand-primary/-soft`), item chưa có trang → `message.info('Tính năng sẽ sớm ra mắt.')`. Role employer/admin vẫn giữ nút "Trang quản lý".

</details>

<details>
<summary><b>1.14m</b> — Responsive mobile toàn site chính</summary>

Header thêm nút hamburger `md:hidden` mở AntD `Drawer` chứa nav (accordion animation grid-rows) + hành động đăng nhập/đăng ký/đăng tuyển; logo co nhỏ theo `sm:`. JobList: sidebar lọc `hidden lg:block` trên desktop, mobile chuyển thành `Drawer` mở bằng nút "Lọc nâng cao" (kèm số bộ lọc), tách `filterSidebar` dùng chung 2 nơi; **xem nhanh** chỉ tách 2 cột trên desktop (`inlineQuickView = quickViewJob && isDesktop` qua `matchMedia(min-width:1024px)`) — mobile mở `JobQuickView` trong Drawer bottom-sheet toàn màn hình (danh sách giữ nguyên đầy đủ, không thu gọn/xếp chồng). JobDetail: padding/tiêu đề co theo `sm:`, thêm thanh "Ứng tuyển ngay" `fixed bottom md:hidden`. AuthLayout: bỏ padding cố định `3rem`, dùng padding responsive (`px-5 py-8 sm:px-10`). Các trang Home/BestJobs/FeaturedIndustries/Hotline/form auth vốn đã có grid responsive. Nguyên tắc từ nay: **mọi UI mới bắt buộc responsive**.

</details>

<details>
<summary><b>1.14n</b> — Tìm kiếm tiếng Việt không dấu</summary>

Bật extension Postgres `unaccent` (migration `0008_unaccent_extension` + `django.contrib.postgres` vào INSTALLED_APPS), helper `search_q(field, text)` tách từ khóa thành token AND từng từ với `__unaccent__icontains` (unaccent cả 2 phía) — nhập **không dấu** ("cham soc khach hang") hoặc **đảo thứ tự từ** ("khach hang cham soc") đều khớp "Chăm sóc khách hàng"; áp cho cả `JobListView` (title/company/both) lẫn `JobSuggestView` (autocomplete gợi ý được từ không dấu, dedupe + ưu tiên startswith so sánh bằng `fold_accents` phía Python — xử lý riêng đ→d vì NFD không tách được); từ khóa rác ("abcdsad") trả 0 kết quả → frontend `JobResults` empty-state mới kiểu TopCV: thông báo "Rất tiếc… thử thay đổi từ khóa hoặc bộ lọc" + nút "Xóa bộ lọc & từ khóa" (`clearAllCriteria` reset cả FILTER_KEYS lẫn search, chỉ hiện khi đang có tiêu chí). Đã test shell + API end-to-end 4 case.

</details>

<details>
<summary><b>1.14o</b> — Việc làm đã lưu + cụm nút nổi Góp ý/Hỗ trợ</summary>

**Việc làm đã lưu** giờ là **trang riêng** `/viec-lam-da-luu` (không phải Drawer): heading "Danh sách N việc làm đã lưu", danh sách `JobCard` đầy đủ, mục "Việc làm tương tự việc bạn đã lưu" (lấy job cùng danh mục hay gặp nhất trong các tin đã lưu, loại tin đã lưu, tối đa 6; fallback tin mới nhất khi tin lưu không có danh mục), cột phải banner quảng bá tạo CV; guard chỉ ứng viên (`Navigate` về `/login` nếu chưa đăng nhập/không phải candidate, chờ `authLoading` xong mới quyết định); vào từ menu **"Việc làm đã lưu"** trên header (bỏ placeholder "sắp ra mắt"). Backend saved job: model `SavedJob` (`candidate`+`job`, `UniqueConstraint` chống trùng, index `(candidate,-created_at)`); `SavedJobSerializer` ghi bằng `job` public_id (`SlugRelatedField`), đọc trả `job_detail` = **`JobSerializer` đầy đủ** (để `JobCard` render giống hệt trang danh sách + có `category` cho gợi ý tương tự), `validators=[]` vì `candidate` đến từ `perform_create` (tránh `UniqueTogetherValidator` tự sinh văng lỗi thiếu field — trùng do `get_or_create` lo, lưu 2 lần là no-op); endpoints `GET/POST /api/jobs/saved/` (`IsCandidate`, `pagination_class=None` để frontend có trọn bộ id tô tim mọi card + đếm badge; queryset prefetch `job__job_skills__skill`) và `DELETE /api/jobs/saved/<job_public_id>/`. **`useSavedJob` chuyển localStorage→API**: `SavedJobsProvider` + context dùng chung (optimistic: bỏ lưu xoá ngay rồi rollback nếu lỗi; lưu dùng `pending` Set để tim sáng tức thì), tim trên `JobCard`/`JobQuickView`, badge và trang đã lưu luôn khớp và **đồng bộ đa thiết bị** (hook cũ `pages/main/jobs/hooks/useSavedJob.js` xoá, chuyển lên `hooks/useSavedJobs.js`). **Cụm nút nổi = 3 nút** (`FloatingActions` trong `MainLayout`): **Việc làm đã lưu** (icon trái tim + `Badge` đếm số tin đã lưu → điều hướng `/viec-lam-da-luu`), **Góp ý** (mở **Modal giữa màn hình** "Bạn muốn?" — 2 thẻ lớn _Góp ý sản phẩm_ → form và _Chat Zalo_ → `contact_zalo_url`, kèm dải xanh "…Nhà tuyển dụng sẽ không đọc được góp ý này"), **Hỗ trợ** (panel "Trung tâm hỗ trợ ứng viên" neo cạnh nút: header gradient + "{sitename} thường phản hồi trong vòng 24h"; mục Hướng dẫn tìm việc an toàn \*, Các câu hỏi thường gặp, Hỗ trợ qua Zalo, Liên hệ {sitename}→`tel:hotline`). **Form góp ý** (UI chip, không dropdown): Chủ đề cần góp ý = 6 **chip chọn trực tiếp** (bắt buộc, validate thủ công vì ngoài AntD Form), Mô tả (TextArea, **bắt buộc**, ≥10 ký tự), "Bạn có hài lòng về {sitename} không?" (5 mức emoji chọn 1, không bắt buộc), **khi chưa đăng nhập** thêm SĐT + Email (đều không bắt buộc) + label "{sitename} sẽ phản hồi tới số điện thoại hoặc email bạn nhập trong vòng 24h (không kể Thứ 7, CN, ngày lễ)". Backend feedback: model `Feedback` mở rộng — `category` đổi thành 6 chủ đề sản phẩm, thêm `satisfaction` (5 mức) + `phone`, `user` nullable; `POST /api/site/feedback/` (`AllowAny`, throttle `feedback:5/min`, mô tả ≥10 ký tự, user đăng nhập bỏ trống email thì lấy email tài khoản); Django admin đọc-only + sửa `status`, chặn add. Kênh Zalo/hotline **đọc từ site settings** (nhóm "Liên hệ / hỗ trợ"), rỗng thì báo "chưa cấu hình". Verify: round-trip HTTP thật (POST 201 → idempotent 201 count=1 → GET 200 `job_detail` đầy đủ 34 field gồm `category`+`job_skills` → DELETE 204 → 404 → anon 401), feedback anon 201 với `satisfaction`+`phone`, mô tả ngắn 400; lint + `vite build` pass. **Chưa verify bằng mắt** (2 cổng dev do người dùng chạy, không chiếm cổng mở preview được).

</details>

<details>
<summary><b>1.14p</b> — Phân hạng tin + nhãn dịch vụ</summary>

Thiết kế 3 tầng, chốt với user qua mockup. **Tầng 1 — hạng tin** `Job.tier` (TextChoices `standard`/`featured`/`top`, single-choice, quyết định nền card): tin thường nền trắng viền xám, nổi bật/TOP nền `emerald-50` viền xanh (sửa lỗi cũ: JobCard tô nền xanh cho _mọi_ tin), TOP thêm nhãn đỏ trước tiêu đề. **Tầng 2 — nhãn dịch vụ** (gắn kèm nhiều cái): `is_hot` (HOT đỏ), `is_urgent` (GẤP cam), `has_flash_badge` (huy hiệu Sấm Chớp ⚡ góc logo — nối vào section FlashBadge trang chủ có sẵn, giờ fetch `?flash_badge=1` thật, fallback tin mới nhất khi chưa gán); nhãn ✓ xác thực **không lưu trên Job** — serializer expose `company_verified` suy từ `employer_profile.verified_at` có sẵn, hiện cạnh tiêu đề JobCard + JobQuickView. **Tầng 3 — trạng thái theo ngữ cảnh** (Mới/sắp hết hạn/đã xem/đã ứng tuyển) _tính toán không lưu_ — để dành các mục sau. Admin gán tier+nhãn qua Django admin (`list_editable` ngay trên danh sách; employer không ghi được qua API — 4 field nằm trong `read_only_fields`, sau này Giai đoạn 6 chuyển sang gán tự động theo gói dịch vụ). Sắp xếp danh sách mặc định: `annotate(tier_weight=Case(...))` TOP→nổi bật→thường rồi mới tới ngày đăng; riêng `?ordering=salary_desc` giữ thuần theo lương (lựa chọn chủ động của user, không chen tier). Chip trên card nhận prop `elevated` (card xanh dùng chip trắng, card trắng dùng chip xám cho tách nền). Seed `seed_demo_jobs` gán tỉ lệ 65/25/10 + hot/gấp 18% + flash 30% + `deadline`; **sửa luôn bug seed crash**: vẫn truyền `industry=` CharField đã bị 1.14e thay bằng M2M `industries` → chuyển sang `Industry.get_or_create` + `profile.industries.set`. Migration `0011`. Verify qua API thật: trang 1 xếp top→featured đúng, `?flash_badge=1` trả 9/9 tin có huy hiệu, `salary_desc` không chen tier, `company_verified` có mặt; lint + build + 4/4 test pass.

</details>

<details>
<summary><b>1.14q</b> — Chuẩn hóa schema tin tuyển dụng</summary>

Mở rộng model `jobs` theo thiết kế database mới (migration `0012`–`0013`), thay dữ liệu phẳng bằng các bảng quan hệ có cấu trúc: `JobCategoryAssignment` (danh mục theo vai trò — 1 vị trí chuyên môn chính `primary_specialization` unique/job + nhiều `domain_knowledge`, thay FK `category` đơn), `JobLocation` (địa điểm làm việc theo **phường/xã** + `address_detail`, ghi mới bắt buộc ward có tỉnh cha, dữ liệu tỉnh cũ giữ tương thích), `JobWorkSchedule` (khung giờ có cấu trúc weekday_from/to + start/end + `is_overnight` + note, kèm `Job.work_schedule_note` cho lịch tự do), `Benefit`/`JobBenefit` (quyền lợi chuẩn hóa có icon + note), `Language`/`JobLanguageRequirement` (ngoại ngữ: trình độ 5 mức, chứng chỉ, bắt buộc/ưu tiên), `JobApplicationContact`+`JobApplicationEmail` (người nhận hồ sơ 1-5 email — **nội bộ, không expose qua API public**, có test chống lộ). `Job` thêm `gender_requirement`, `age_min/age_max`, `number_of_vacancies`, `salary_type` 5 loại (thỏa thuận/khoảng/cố định/từ/đến) với CheckConstraint + validate serializer chéo theo loại. `JobSerializer` nhận nested writes cho cả 6 quan hệ (thay thế trọn gói mỗi lần update, validate trùng lặp); các field cũ frontend đang dùng (`category`, `locations_detail`, `short_description`, `is_salary_visible`) chuyển thành computed read-only — không còn cột trùng lặp. Filter `?category=` đổi sang match `category_assignments` (giữ mở rộng cấp con). Seed `seed_demo_jobs` viết lại theo schema mới.

</details>

<details>
<summary><b>1.14r</b> — Trang chi tiết việc làm bản mới</summary>

Làm lại theo bố cục 2 cột chốt với user (trái: breadcrumb → hero → chi tiết → việc làm liên quan; phải: công ty → thông tin chung → danh mục liên quan → lưu ý an toàn/promo). **API view-model** (không thêm cột DB): `JobDetailSerializer` trả thêm `primary_specialization`/`domain_knowledge` (`{id,name,slug}`), `workplace_groups` (địa điểm nhóm theo tỉnh/thành → dòng địa chỉ phường/xã có `display` ghép sẵn), `requirement_tags` (kinh nghiệm/tuổi/học vấn "Từ X trở lên"/giới tính/kỹ năng required — label sinh từ `get_FOO_display`), `benefit_tags`, `proficiency_label` trên `language_requirements` — frontend không phải tự suy luận từ dữ liệu thô nữa (xoá `buildJobTagGroups`); dữ liệu nested thô giữ nguyên cho form employer. **Content** theo thứ tự đọc: tag tóm tắt (Yêu cầu/Quyền lợi/Chuyên môn — chuyên môn chính tô emerald) → mô tả → yêu cầu → quyền lợi → **ngoại ngữ** ("Tiếng Hàn — Giao tiếp — TOPIK 2" + nhãn Ưu tiên khi không bắt buộc) → **địa điểm nhóm tỉnh** → **lịch làm việc render JSX** (component `WorkScheduleList` thay chuỗi HTML tự ghép — an toàn, hỗ trợ nhiều ca "Ca sáng/Ca chiều" + ghi chú) → cách thức ứng tuyển (câu cố định sản phẩm) → CTA cuối. Các khối tách vào `JobDetailBlocks.jsx` (`RequirementTags`/`BenefitTags`/`SpecialtyTags`/`LanguageRequirementList`/`WorkplaceGroups`/`WorkScheduleList`). **Sidebar**: "Thông tin chung" còn đúng 5 mục (bỏ Kinh nghiệm vì đã có ở Hero + tag); "Danh mục nghề liên quan" link theo **từng** `category_assignments.category` (`?cat=<id>` riêng) thay vì mọi tag về chung `job.category`. **Sticky bar**: 4 anchor (Chi tiết/Mô tả/Địa điểm/Việc làm liên quan), anchor Địa điểm + Việc làm liên quan **tự ẩn khi tin không có dữ liệu** (tin remote không văn phòng, tin không có việc liên quan). **Mobile**: tag Yêu cầu thu gọn tối đa ~3 dòng + nút Xem thêm/Thu gọn (đo `scrollHeight`, chỉ hiện khi tràn, `sm:` bỏ giới hạn); sidebar xếp sau nội dung; giữ thanh đáy Lưu/Ứng tuyển. Seed demo làm giàu: ~20% tin lương thỏa thuận, ~30% có tuổi, ~35% có 1-2 ngoại ngữ (chứng chỉ theo mã ngôn ngữ), 40% làm 2 ca, benefits 3-5 mục, skills 2-4, tin remote 0-1 địa điểm, domain knowledge gắn từ parent của chuyên môn. Verify: 7/7 test `apps.jobs` (2 test mới: view-model nhóm đúng 2 tỉnh + tag đúng thứ tự đọc, tin tối giản trả rỗng an toàn), 17/17 vitest, lint + build pass; browser thật 4 loại tin (nhiều địa điểm 2 tỉnh, remote không địa điểm, lương thỏa thuận, 2 ngoại ngữ + 2 ca) + mobile 375px (Xem thêm/Thu gọn hoạt động, đo container 96→120px).

</details>

<details>
<summary><b>1.16</b> — Rate limit + reCAPTCHA v3</summary>

Rate limit theo IP (DRF `ScopedRateThrottle`, 5 lần/phút mỗi endpoint) + Google reCAPTCHA v3 invisible (verify server-side qua `apps/accounts/captcha.py` — check `success` + `action` khớp (`login`/`register`) + `score >= RECAPTCHA_SCORE_THRESHOLD`, bỏ qua 2 field khi thiếu để tương thích test key; field `captcha_token` trên cả 2 serializer); frontend dùng `react-google-recaptcha-v3` (`GoogleReCaptchaProvider` bọc App, `useGoogleReCaptcha().executeRecaptcha(action)` lấy token ẩn lúc submit trên `Login`/`Register`), thông báo riêng khi bị 429.

</details>

<details>
<summary><b>1.17</b> — Social login OAuth</summary>

OAuth Authorization Code Flow qua backend callback: ứng viên Google/Facebook/LinkedIn, NTD chỉ Google, admin không có. Backend: model `SocialAccount` (unique `(provider, provider_user_id)`, migration 0002), `User.Provider` thêm facebook/linkedin; service `apps/accounts/oauth.py` (build auth URL, `state` Redis TTL 10ph chống CSRF + one-shot, exchange code, fetch + normalize profile OIDC/Graph, `one_time_code` Redis TTL 60s); endpoints `GET /auth/oauth/<provider>/start/?portal&next` (redirect provider; lỗi → redirect frontend `?error=<code>`), `GET .../callback/` (verify state → tạo/liên kết user → redirect frontend kèm code), `POST /auth/oauth/complete/` (đổi code lấy `{user, access, refresh}`, throttle 10/min). Luật liên kết: có SocialAccount → đăng nhập luôn; email trùng cùng role → tự liên kết (+set `email_verified=True`, giữ password cũ); khác role → chặn `wrong_portal`; user mới → role theo cổng, `email_verified=True`, password unusable; `next` chỉ nhận path nội bộ (chặn absolute/`//`). Env: `OAUTH_*_CLIENT_ID/SECRET` (trống → báo "chưa cấu hình", không crash), `OAUTH_MAIN/EMPLOYER_CALLBACK_URL`. Frontend: component chung `SocialLoginButtons` (gộp icon trùng lặp ở Login/Register, full-page redirect sang start URL, `next` = trang hiện tại trừ trang auth — giữ UX login modal ở trang việc làm), trang `OAuthCallback` dùng chung 2 cổng (`/oauth/callback` + `/tuyendung/app/oauth/callback`, guard StrictMode double-effect vì code chỉ dùng 1 lần), lưu token đúng portal key, lỗi → về trang login của cổng kèm `?oauth_error=` hiện trong Alert của `LoginForm` (map mã→tiếng Việt ở `errorMessage.js`); employer Login/Register thêm nút Google + divider. Test: 13 test OAuth backend (portal rules, tạo/liên kết/chặn role, state one-shot, code one-shot, chặn next absolute) — 18/18 pass; lint+build pass; verify browser: đủ 3 nút cổng main, 1 nút Google cổng NTD, click Google (chưa credential) → quay về form báo "chưa được cấu hình" đúng luồng.

OAuth hoàn tất qua provider bỏ qua email 2FA; email/mật khẩu vẫn yêu cầu mã khi người dùng đã bật 2FA.

</details>

<details>
<summary><b>1.18</b> — Ghi nhận <code>last_login</code></summary>

`User.last_login` (có sẵn từ `AbstractUser` nhưng JWT không tự set vì không đi qua `django.contrib.auth.login()`) nay được cập nhật ở cả 3 luồng phát token — đăng nhập email/mật khẩu (`RoleTokenObtainPairSerializer.validate`, chỉ set sau khi qua kiểm tra `portal`), đăng ký auto-login, social login (qua `_issue_tokens()`); expose field `last_login` trong `UserSerializer`. Test: 5 test (3 luồng + 2 case âm sai mật khẩu/sai cổng không set) — phát hiện & sửa 2 lỗi cô lập test: Django test runner luôn ép `DEBUG=False` (cần override tường minh để bypass captcha), `ScopedRateThrottle` dùng chung cache Redis thật nên override `CACHES` sang LocMemCache tránh cộng dồn 429 giữa các lần chạy.

</details>

<details>
<summary><b>1.19</b> — Đặt lại mật khẩu qua email + Redis</summary>

Cùng mô hình với 1.5b nhưng siết chặt hơn vì đây là luồng chiếm được tài khoản. Backend: module `apps/accounts/password_reset.py` (token `secrets.token_urlsafe(32)` trong Redis, TTL **30 phút**, cooldown 60s/user; khoá `latest:<user_id>` giữ token mới nhất → **xin link mới là link cũ chết ngay**; tiêu token một lần bằng `atomic_pop`), tách helper mail dùng chung `apps/accounts/mailing.py` (`site_setting`/`from_email`/`frontend_link`/`send_html_email`) và refactor `email_verification.py` dùng lại. Endpoints: `POST /auth/password-reset/` (captcha, **luôn trả cùng một `detail`** dù email tồn tại hay không → chống dò email; cooldown im lặng; đẩy mail qua outbox `AuthEmailJob` kind `password_reset`), `GET /auth/password-reset/validate/?token=` (kiểm tra link **không tiêu token** → hiện ngay màn hết hạn), `POST /auth/password-reset/confirm/` (validate mật khẩu **trước** khi tiêu token để mật khẩu yếu không đốt link; đổi xong `email_verified=True` vì nhận được mail = chứng minh sở hữu hòm thư, và blacklist toàn bộ refresh token cũ qua `token_blacklist` → đăng xuất mọi thiết bị). Rule mật khẩu tách thành `password_field()` dùng chung với `RegisterSerializer`. Frontend: `/forgot-password` + `/reset-password?token=` (lazy route, dùng lại `PasswordRequirements` realtime + rule "nhập lại không khớp"), confirm trả `role` để đưa về đúng cổng đăng nhập; `MAIN_FORGOT_PASSWORD_URL` trong `portals.js` (cổng NTD/admin ở subdomain riêng phải link tuyệt đối về host chính, `LoginForm` render `<a>` thay `<Link>` khi link absolute). Env mới: `PASSWORD_RESET_TTL=1800`, `PASSWORD_RESET_RESEND_COOLDOWN=60`. **Bug tự gây ra rồi sửa**: ban đầu gán chung `throttle_scope='password_reset'` cho cả 3 endpoint → gõ sai mật khẩu vài lần là hết quota, không confirm được nữa dù link còn hạn; tách bucket riêng `password_reset_confirm` (10/phút). Verify: 15 assertion qua HTTP client thật (chống dò email, cooldown im lặng, link cũ chết, token một lần, mật khẩu yếu không đốt token, refresh token bị blacklist) + kiểm chứng UI trên browser (submit thật, màn hết hạn, mobile 375px không tràn ngang).

Chính sách mật khẩu dùng chung cho đăng ký và đặt lại mật khẩu: 8–25 ký tự,
chặn mật khẩu phổ biến/thuần số/tương tự dữ liệu tài khoản bằng Django validator;
bắt buộc có chữ hoa, chữ thường và chữ số.

Email candidate được tách thành hai bước: địa chỉ email tự nhập chỉ nhận link
xác thực trước, và email chào mừng chỉ gửi một lần sau khi xác thực thành công.
Candidate tạo lần đầu qua OAuth nhận email chào mừng ngay vì email đã được
provider xác thực.

Form đăng ký candidate pre-check email sau **500ms** không gõ thêm, chỉ khi
đúng định dạng; request cũ được hủy và phản hồi cũ không thể ghi đè email mới.
API `POST /auth/register/email-availability/` chuẩn hóa email, so sánh không
phân biệt hoa/thường và giới hạn **12 lần/phút**. Đây chỉ là phản hồi UX;
`RegisterSerializer` vẫn kiểm tra trùng lặp ở lúc tạo tài khoản để chống race
condition.

</details>

<details>
<summary><b>1.19b</b> — Email không phân biệt hoa/thường</summary>

Sửa bất đối xứng phát hiện ở 1.19: `password-reset` tra user bằng `email__iexact` còn login đi qua `authenticate()` → `get_by_natural_key()` so sánh **chính xác** (Postgres phân biệt hoa/thường), và `normalize_email()` của Django chỉ hạ chữ phần domain → user đăng ký `Hau@gmail.com` đặt lại mật khẩu được nhưng login bằng `hau@gmail.com` thì 401. Sửa: `UserManager.normalize_email()` hạ chữ **toàn bộ** địa chỉ; `UserManager.get_by_natural_key()` dùng `iexact`; ràng buộc DB `UniqueConstraint(Lower('email'), name='uniq_users_email_lower')` (migration `0004`) bảo đảm `iexact` không bao giờ khớp >1 bản ghi — nếu không có nó, `authenticate()` sẽ ném `MultipleObjectsReturned` → 500 thay vì 401; `RegisterSerializer.validate_email()` chặn trùng theo `iexact` để trả 400 tử tế thay vì vỡ ở index DB (`UniqueValidator` mặc định của ModelSerializer phân biệt hoa/thường). Migration có bước `RunPython` hạ chữ dữ liệu cũ, **dừng kèm danh sách cụ thể** nếu môi trường nào đã lỡ có 2 tài khoản chỉ khác hoa/thường (gộp/xoá là quyết định của con người). Verify: rollback → tạo xung đột thật → migrate lại thấy đúng `RuntimeError`; qua HTTP: đăng ký `Hau.Test@Example.com` lưu thành `hau.test@example.com`, login được với cả 3 kiểu viết hoa/thường, đăng ký trùng khác case → 400, reset bằng email chữ hoa rồi login chữ thường → 200; 25/25 test `apps.accounts` pass.

</details>

<details>
<summary><b>1.20</b> — Trang thương hiệu (brand page)</summary>

`EmployerProfile.has_brand_page` (BooleanField, admin gán qua Django admin/`list_editable`, tương tự `Job.tier`; sau này gán theo gói dịch vụ ở Giai đoạn 6) — bật thì tin tuyển dụng của công ty mở dưới URL riêng `/brand/<company-slug>/tuyen-dung/<job-slug>` kèm header thương hiệu (banner cover + logo + tên công ty) thay vì `/viec-lam/<job-slug>` thường. `JobSerializer` thêm `brand_slug` (suy từ `employer_profile.has_brand_page`, null nếu tắt) + `company_cover_url`; frontend gom logic dựng URL job vào **một nơi duy nhất** `config/jobPaths.js` (`jobDetailPath(job)`, có test `jobPaths.test.js` — 4 case) và migrate toàn bộ điểm gọi cũ (`SearchDropdown`, `BestJobsResults`, `FlashBadge`, `MarketStats`, `JobCard`, `JobQuickView`) sang dùng hàm này thay vì tự ghép chuỗi `/viec-lam/${slug}`; `MainRoutes` thêm route `/brand/:companySlug/tuyen-dung/:slug` (cùng `JobDetailPage`), `JobDetail.jsx` tự redirect (`replace`) về đúng URL chuẩn nếu vào sai dạng, và render `BrandHeader` khi `job.brand_slug` có giá trị. Seed `seed_demo_jobs` bật brand page cho 3 công ty demo (FPT, VNG, Shopee), migration `0005_employerprofile_has_brand_page`. Verify: `manage.py test apps.jobs apps.employers` pass, `vitest run` 4/4 pass, `vite build` pass, kiểm chứng trên browser thật cả 2 luồng (tin công ty có brand → redirect đúng `/brand/...` + hiện header; tin công ty thường → giữ nguyên `/viec-lam/...`, không có header thừa).

</details>

<details>
<summary><b>1.22</b> — Khung layout 3 cột trang tài khoản ứng viên</summary>

Dựng khung + cấu trúc code cho cụm trang cài đặt candidate (theo tài liệu "Cài đặt trang candidate" 12/07/2026) — nội dung từng trang sẽ đào sâu sau. **Một nguồn dữ liệu duy nhất** `config/candidateMenu.jsx`: 5 nhóm menu (Quản lý tìm việc / CV & Cover letter / Email & thông báo / Cá nhân & Bảo mật / Nâng cấp tài khoản) với quy ước item `path` + `blank` (trang khác layout, mở tab mới: Việc làm đã lưu, NTD muốn kết nối, VIP, quà tặng) + `todo` (chưa xây → "Sắp có"); dropdown avatar header (`CandidateUserMenu`) refactor bỏ SECTIONS hard-code để dùng chung config này, và **route con cũng sinh từ config** (thêm trang mới = sửa 1 file). `CandidateAccountLayout` (3 cột 3/6/3, nền `#f7f9fc`): trái `AccountSidebar` — accordion **chỉ mở 1 nhóm/lần** (mở nhóm này nhóm kia tự đóng) animation `grid-template-rows`, hover + active (nền brand-soft + thanh dọc trái), tự mở nhóm chứa route hiện tại; giữa `<Outlet/>` (mỗi trang 1 file riêng khi xây thật, tạm thời `AccountPlaceholder`); phải `ProfileSidebar` — card chào (avatar + badge VERIFIED + trạng thái xác thực), hàng "Gợi ý việc làm" + nút bật, khối "Đang Tắt/Bật tìm việc" (Switch + 2 dòng lợi ích), "Cho phép NTD tìm kiếm hồ sơ" (đếm CV + Quản lý danh sách), banner tải app QR, card "CV của bạn đã đủ tốt?" (đếm lượt xem) — các toggle mới đổi state cục bộ, wiring API đánh dấu `TODO(candidate-settings)`. Routes: `/tai-khoan` redirect trang mặc định, 11 route con `/tai-khoan/<slug>` bọc `ProtectedRoute allowedRoles=['candidate']`, nằm trong `MainLayout` (header/footer chung); `document.title` theo trang. Mobile: sidebar thu vào Drawer (nút "Danh mục"), cột phải dồn xuống dưới. Verify: build + lint pass, đăng nhập candidate demo trên browser — redirect, accordion mở-1-đóng-kia, active state, Drawer mobile, title đổi theo trang, console sạch. Menu text để **màu đen** toàn bộ (yêu cầu người dùng 12/07); item là `<Link>` nên phải dùng `!text-slate-900` để không bị màu link mặc định của AntD đè.

</details>

<details>
<summary><b>1.23</b> — Trang "Cài đặt thông tin cá nhân"</summary>

Trang thật đầu tiên trong khung 1.22 (thay `AccountPlaceholder`). **Backend:** `MeView` nâng từ `RetrieveAPIView` → `RetrieveUpdateAPIView` (`http_method_names=['get','patch']`), thêm `ProfileUpdateSerializer` chỉ nhận `full_name` + `phone` (email KHÔNG đổi ở đây — đổi email đi qua luồng `ChangeEmailSerializer` có xác thực), validate SĐT VN `^(0|\+84)\d{9,10}$` + họ tên ≥2 ký tự; PATCH trả về `UserSerializer` đầy đủ để frontend cập nhật thẳng auth context. Sửa được **nhiều lần**. **Frontend:** `pages/main/candidate/pages/PersonalInfo.jsx` (AntD Form, validation client khớp backend, ô Email `disabled` + ghi chú, nút Lưu; lỗi 400 theo field gắn vào đúng ô qua `form.setFields`); `authService.updateProfile()` PATCH `/auth/me/`; sau lưu gọi `setAuthenticatedUser(updated)` → cột phải (ProfileSidebar) đổi tên **live**. Route map theo `item.key` (`ACCOUNT_PAGE_BY_KEY` trong MainRoutes) — key nào chưa có trang thật thì vẫn dùng placeholder. Verify: 6/6 test `ProfileUpdateTests` (sửa tên/SĐT, nhiều lần, email read-only, SĐT sai → 400, tên rỗng → 400, cần đăng nhập); build + lint pass; browser: đăng nhập candidate demo → sửa tên + SĐT hợp lệ lưu thành công (DB đổi, email giữ nguyên), SĐT sai hiện lỗi đỏ, cột phải cập nhật live, responsive mobile 375px, console sạch.

</details>

<details>
<summary><b>1.24</b> — Onboarding và cài đặt gợi ý việc làm</summary>

Hoàn tất R9 theo cấu trúc `app → pages → features → entities → shared`. Backend
giữ domain trong `apps/candidates`: preference và consent được thay thế trong
một transaction qua `PUT /api/candidate/job-preferences/`; lương kỳ vọng được
đồng bộ thành field bắt buộc ở serializer và có regression test cho payload
thiếu lương. Frontend dùng entity `candidate-preferences` cho preference và
entity `candidate-profile` cho giới tính; form workflow thuộc feature
`configure-job-preferences`, còn onboarding/account page chỉ compose và điều
phối điều hướng. Bộ chọn vị trí chuyển sang modal responsive có tìm kiếm, tab
nhóm nghề, giới hạn 1–5 lựa chọn và xác nhận rõ ràng. Trang settings có giới
tính, gửi lỗi field bằng tiếng Việt, toast chỉ hiện một thông báo hiện hành, và
cột hồ sơ bên phải sticky trên desktop. Đăng ký hoặc OAuth thành công của ứng
viên chưa cấu hình preference luôn chuyển vào `/onboard-user`, ưu tiên hơn URL
quay lại. Verify: backend candidate tests, frontend
lint/architecture/unit/build và E2E router desktop/mobile.

</details>

<details>
<summary><b>1.25</b> — Cookie consent và job view tracking</summary>

Hoàn tất theo hai lát cắt độc lập. `apps/privacy` là nguồn sự thật cho consent:
`GET/POST /api/privacy/consent/` dùng cookie ký số `HttpOnly`, policy version 1,
TTL 180 ngày, bắt buộc `necessary=true` và xóa viewer cookie khi rút Analytics.
Consent được throttle `20/hour` ở production; development tắt throttle để QA có
thể thay đổi lựa chọn liên tục mà không bị khóa modal.
Frontend đặt `ConsentProvider` ở app root, `CookieConsentLayer` ở cạnh router để
phủ mọi layout; banner/modal responsive theo mẫu, footer mở lại cài đặt và route
`/chinh-sach-cookie` công khai inventory. `color-scheme` và `search_history`
chỉ persist/đọc khi Preferences được đồng ý.

Job detail GET đã bỏ side effect. `POST /api/jobs/{slug}/views/` kiểm tra signed
consent ở backend, chỉ phát `procv_viewer_id` ngẫu nhiên/ký số khi Analytics
đúng, Redis Lua atomically dedupe key viewer/user trong 24 giờ rồi mới `F()` tăng
PostgreSQL. Redis lỗi fail closed. Tracking luôn hoạt động khi Analytics consent
hợp lệ; CORS vẫn allowlist origin và bật credential cho hai request cookie.
Verify: 16 backend tests (privacy + jobs), `check`,
`makemigrations --check`, 85 frontend tests, lint, architecture và production
build đều pass.

</details>

## Giai đoạn 2 — AI cơ bản

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 2.1 | Bảng `cv_analysis` | ⬜ |
| 2.2 | Bảng `match_results` | ⬜ |
| 2.3 | Bảng `ai_suggestions` | ⬜ |
| 2.4 | Bảng `ai_usage_logs` | ⬜ |
| 2.5 | `ai_core/cv_parser.py` — đọc CV PDF (PyMuPDF) | ⬜ |
| 2.6 | `ai_core/skill_extractor.py` — trích xuất kỹ năng | ⬜ |
| 2.7 | Dataset + train model phân loại nhóm kỹ năng (`skill_classifier.py`) | ⬜ |
| 2.8 | `ai_core/job_matcher.py` — công thức match_score thống nhất | ⬜ |

## Giai đoạn 3 — Tối ưu tìm kiếm / matching

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 3.1 | Bảng `embeddings` (pgvector) | ⬜ |
| 3.2 | Semantic matching CV-JD (Sentence Transformer) | ⬜ |

## Giai đoạn 4 — CV nâng cao

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 4.1 | `cv_versions` + draft/history/owner/share lifecycle | ✅ |
| 4.2 | `cv_exports` + immutable PDF export | ✅ |
| 4.3 | Template taxonomy/color many-to-many + preview asset theo màu | ✅ |
| 4.4 | Candidate “My CV” hoàn chỉnh (duplicate/hard-delete/default) | ✅ — V2 workflow, snapshot ứng tuyển retained detached, smoke desktop/mobile và CTA tới immutable PDF export hoàn tất |
| 4.4a | Candidate apply chọn CV/version bất biến | ✅ — V2 application contract, application snapshot, unit/regression và smoke desktop/mobile |
| 4.5 | Import PDF/DOCX/LinkedIn và AI-assisted authoring | 🟡 — PDF/DOCX đã parse AI thành canonical editable draft; còn LinkedIn, AI writer và review workflow nâng cao |

### Kế hoạch hoàn thiện CV Builder theo giai đoạn ([kế hoạch](./03-database/ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md))

<details>
<summary><b>CVB-0</b> — Stabilization (runtime + migration + tạo CV)</summary>

**Migration snapshot application (expand → backfill → contract):** tách `applications.0004` gộp thành `0004_application_snapshot_expand` (thêm cột nullable) + `0005_application_snapshot_backfill` (chỉ dữ liệu, `atomic=False`, **idempotent** — reuse `cvv-application-{pk}` thay vì tạo trùng) + `0006_application_snapshot_contract` (guard hết NULL rồi mới NOT NULL + index). Lỗi thật đã tái hiện trên PostgreSQL 16: bản gộp cũ crash `duplicate key cvv-application-1` khi reverse→re-apply (đúng kiểu "merge nhiều lần vẫn lỗi"); bản tách xử lý đúng. Thêm `apps/applications/tests_migrations.py` — test nâng cấp qua `MigrationExecutor` seed application legacy ở `0003` rồi migrate lên mới nhất, chạy trên Postgres thật (vào CI qua `manage.py test`). **Khóa Python 3.11:** `.python-version` (root + backend), CI 3.13→3.11, `scripts/bootstrap-backend.sh`, `docs/setup-development.md`. **Error mapping tạo CV:** `createCvErrorMessage` map cụ thể backend-down / template chưa publish / sample sai / email chưa xác thực / 401·403·404·409·5xx (trước đây lỗi field 400 của DRF rơi vào message chung), có unit test, nối vào `UseTemplateModal`. Verify: backend `check` + `makemigrations --check` + 141 test pass; frontend lint + architecture + 125 unit test + build pass; **không `--fake`, không reset DB**.

</details>

<details>
<summary><b>CVB-0.2</b> — 🟡 CV API V1→V2 cutover</summary>

V2 bổ sung `PATCH|DELETE /api/v2/cvs/{id}/` cho metadata/hard-delete, `POST /api/v2/cvs/imports/` cho PDF/DOCX và `POST …/duplicate/` cho builder CV. Hard-delete xóa library aggregate/artifacts; snapshot application bất biến được giữ detached để recruiter đọc đúng hồ sơ đã nộp. Trang “CV của tôi” gọi entity API V2, upload nhận phản hồi backend thật và không còn gọi V1. V1 vẫn chạy để client cũ không gãy, nhưng trả `Deprecation`, `Sunset`, successor `Link` và event telemetry tối thiểu không chứa PII. Không tạo `/api/v1/`, không redirect request ghi; chỉ chuyển sang `410` trong release riêng sau khi telemetry cho thấy usage V1 bằng 0.

</details>

<details>
<summary><b>CVB-4</b> — ✅ Candidate application chọn version</summary>

Job detail compose feature `apply-for-job`; feature đọc CV owner, buộc candidate
chọn một `CvVersion` bất biến và gửi `POST /api/v2/applications/`. Backend xác
thực job active, CV owner/active, version thuộc đúng CV và loại trừ internal
`application_snapshot`; transaction tạo snapshot từ đúng version được chọn mà
không làm đổi draft/latest/published pointer. V1 applications không bị đổi hoặc
redirect trong lát cắt này. Verify: 46 backend application/CV tests, 131
frontend unit tests và 22 smoke desktop/mobile.

</details>

<details>
<summary><b>CVB-0.1</b> — Hardening stabilization (idempotent migration + preflight + repair)</summary>

**bootstrap-backend.sh:** phát hiện `backend/venv` cũ sai phiên bản (đọc `venv/bin/python`) và **từ chối cài dependencies** vào venv đó (kèm hướng dẫn), thêm cờ `--recreate` để xóa+tạo lại, và chốt chặn cuối kiểm tra interpreter active đúng 3.11 trước khi `pip install`. **Migration idempotent (khôi phục DB partial-failure):** `0004` bọc trong `SeparateDatabaseAndState` — state vẫn là 4 `AddField` (nên `makemigrations --check` sạch + DB mới không đổi) nhưng DB-side là DDL có guard `IF NOT EXISTS`/kiểm tra cột nên chạy lại trên DB đã có sẵn cột (do migration cũ chạy dở, chưa ghi) là no-op thay vì crash "column already exists"; `0006` index tạo bằng `CREATE INDEX IF NOT EXISTS` + `SET NOT NULL` vốn idempotent; `0005` backfill khi **tái sử dụng** snapshot nay kiểm tra đúng `cv_id` và `version_kind='application_snapshot'`, sai thì raise loud thay vì mislink nhầm CV cho recruiter. **Preflight command** `manage.py cv_snapshot_preflight` (chỉ đọc): báo cáo migration state, cột/index tồn tại, số application thiếu snapshot, và inconsistency (snapshot sai cv_id/kind, orphan `cvv-application-{pk}`); exit 1 khi có vấn đề để CI/deploy chặn; cờ `--repair` chạy backfill idempotent có guard (không drop/reset/`--fake`). **Tests:** `tests_migrations.py` phủ 6 ca — clean / legacy / **partial migration** (cột tồn tại nhưng chưa ghi) / **snapshot đã tồn tại** (reuse không nhân đôi) / **repair hai lần** (idempotent) / **mismatch bị từ chối**; `tests_v2.py` thêm 2 test khẳng định tạo CV trắng + từ sample trả `201` và dựng đủ `UserCv` + `CvVersion` initial + `CvDraft`. Verify đầy đủ: `check` + `makemigrations --check` + `migrate` + **148 backend test**; frontend lint + architecture + **125 test (coverage 84.65%)** + build + **18 e2e smoke**; `git diff --check` sạch. DB local: healthy trước và sau (preflight OK, 0 thiếu snapshot, 0 inconsistency).

</details>

<details>
<summary><b>CVB-1</b> — ✅ Redesign trang mẫu CV + create flow</summary>

**Trang `/mau-cv`:** breadcrumb/tiêu đề theo locale, grid 3 cột, infinite scroll, filter category/tag từ API, card màu và related templates. `UseTemplateModal` cùng trang detail compose `CvSourcePanel`; preview dùng renderer thật, blank/sample map vào `POST /api/v2/cvs/`. Các nguồn previous CV/upload/restore vẫn được ghi rõ là chưa có backend và không được coi là hoàn tất. Verify hiện tại: lint + architecture, 127 unit tests, build và 18 smoke E2E desktop/mobile pass.

</details>

<details>
<summary><b>CVB-1.1</b> — ✅ URL theo ngôn ngữ + nội dung mẫu theo vị trí</summary>

**URL kho mẫu theo ngôn ngữ:** `/mau-cv`, `/mau-cv-tieng-anh|nhat|trung` cùng route detail/category; locale-paths là một nguồn ánh xạ. Position picker đọc 61 `JobCategory` specialization, chỉ hiển thị `name_vi` có tìm kiếm và giữ opaque `public_id`. Baseline localization có đủ 4 locale. Preview resolver dùng curated sample nếu có, nếu không dùng blueprint admin-configurable; một canonical document render trên mọi template, không nhân sample theo template.

</details>

<details>
<summary><b>CVB-1.2</b> — ✅ Category/color từ database và lưu màu vào CV</summary>

`CvTemplate` liên kết nhiều-nhiều với `CvCategory` và `CvColor` qua hai bảng link. Link màu giữ `thumbnail_url`, `preview_url`, `sort_order`, `is_default`; public API trả `colors[]`, card hover/focus đổi đúng asset URL. `POST /api/v2/cvs/` nhận `theme_color`, validate màu active thuộc template rồi ghi vào initial version/draft. Migration `cv_templates.0004` backfill JSON cũ, seed chuyển category legacy và tạo palette; admin quản lý registry + inline link. `theme_color`/`color_variants` vẫn được giữ tương thích trong giai đoạn dual-read, không còn là nguồn chuẩn của frontend mới. Chi tiết và backlog: [kế hoạch CV Builder](./03-database/ke-hoach-hoan-thien-cv-builder-theo-giai-doan.md).

</details>

## Giai đoạn 5 — Tuyển dụng nâng cao

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 5.1 | Bảng `saved_jobs` — xem chi tiết ở mục 1.14o (làm cùng đợt "Việc làm đã lưu") | ✅ |
| 5.2 | Bảng `application_status_history` | ⬜ |
| 5.3 | Bảng `notifications` | ⬜ |

## Giai đoạn 6 — Thương mại & quản trị

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 6.1 | Bảng `subscription_plans` | ⬜ |
| 6.2 | Bảng `user_subscriptions` (quota AI) | ⬜ |
| 6.3 | Bảng `audit_logs` | ⬜ |
| 6.4 | App `sitecontent`: `SiteSetting` + `LinkGroup`/`LinkItem` + admin + API public `/api/site/` | ✅ |
| 6.5 | `sitecontent.Banner` (carousel trang chủ cấu hình từ admin) + API `/api/site/banners/` | ✅ |
| 6.6 | `SiteSetting` schema-driven: 11 value_type, 15 nhóm, seed 96 keys, cache 1h | ✅ |
| 6.7 | API admin cấu hình: `GET/PATCH /api/site/admin/settings/` + upload ảnh + permission `IsAdmin` | ✅ |
| 6.8 | Trang React `/admin/settings`: tabs 15 nhóm, form tự sinh từ metadata | ✅ |
| 6.9 | Chuẩn hóa frontend 3 cổng (`pages/main/`) + migrate màu brand sang CSS var | ✅ |
| 6.10 | Tách `BestJobs.jsx` (643→478 dòng): `JobPreviewPanel` ra file riêng, dùng label chuẩn | ✅ |
| 6.11 | Tối ưu performance đợt 1: favicon 957KB→1.9KB, chặn upload favicon nặng, tách vendor chunk react | ✅ |
| 6.12 | Cẩm nang nghề nghiệp (blog): app `blog` + API public + trang `/blog` + phân quyền biên tập | ✅ |
| 6.13 | Redesign giao diện blog kiểu TopCV: magazine /blog, danh mục load-more, chi tiết nền xám card trắng | ✅ |

### Ghi chú chi tiết — Giai đoạn 6

<details>
<summary><b>6.4</b> — App <code>sitecontent</code></summary>

`SiteSetting` (config key-value JSON) + `LinkGroup`/`LinkItem` (cụm link có thứ tự, source manual/auto từ locations·categories) + Django admin + API public `/api/site/`; frontend `PopularSearches` (cụm link SEO trên footer) đọc từ API.

</details>

<details>
<summary><b>6.5</b> — Banner carousel trang chủ</summary>

`sitecontent.Banner` (slide carousel trang chủ: eyebrow/title/subtitle/theme gradient hoặc image_url/CTA, order, is_active) + admin + API `/api/site/banners/`; `Home.jsx` render banner IT/CV từ API thay vì hardcode (slide thống kê vẫn code cứng vì cần số liệu jobCount/categories realtime).

</details>

<details>
<summary><b>6.6</b> — <code>SiteSetting</code> schema-driven</summary>

Thêm `value_type` (text/textarea/number/boolean/select/color/image/email/url/json/env) + `options` + `order`, 15 nhóm cài đặt (chung, trang chủ, SEO, ứng viên, NTD, việc làm, CV, email, thanh toán, bảo mật, upload, footer, liên hệ, phân quyền, AI), seed 96 keys idempotent (không ghi đè value); cache public API 1h + signal invalidation. Secrets giữ trong `.env` (type `env` chỉ báo đã cấu hình hay chưa). Chi tiết: `docs/05-huong-dan/cau-hinh-site-settings.md`.

</details>

<details>
<summary><b>6.7</b> — API admin cấu hình</summary>

`GET/PATCH /api/site/admin/settings/` (trả theo nhóm + bulk update có validate theo value_type) + `POST /api/site/admin/settings/upload/` (upload ảnh) + permission `IsAdmin` mới trong `accounts/permissions.py`.

</details>

<details>
<summary><b>6.8</b> — Trang React <code>/admin/settings</code></summary>

Tabs 15 nhóm, form tự sinh từ metadata (`SettingField` map value_type → control AntD), dirty-tracking + lưu theo nhóm, upload ảnh, tag Public/env; fix nav DashboardLayout (bỏ menu chết users/skills, highlight theo route).

</details>

<details>
<summary><b>6.9</b> — Chuẩn hóa frontend 3 cổng</summary>

Gom cổng main vào `pages/main/` (Home, auth, jobs, candidate) cho đối xứng với `pages/employer` & `pages/admin`; đổi `PublicRoutes`→`MainRoutes` (`mainRoutes()`) cho khớp tên `EmployerRoutes`/`AdminRoutes`; migrate màu brand hardcode (`#00b14f/#008a3e/#f0fbf5` ở ~30 file) sang `var(--brand-primary/-hover/-soft)` để đổi màu qua site settings áp dụng toàn site; gỡ `settingText` trùng lặp trong `SiteSettingsProvider`; fix bug có sẵn nested `<a>` (Link bọc BrandLogo vốn đã tự render Link) ở `EmployerMarketingLayout`. Verify: lint + build pass, preview 3 cổng không lỗi.

</details>

<details>
<summary><b>6.10</b> — Tách <code>BestJobs.jsx</code></summary>

Đưa `JobPreviewPanel` + `PreviewSection` + helper `textLines` ra file riêng `JobPreviewPanel.jsx`, chuyển helper `formatDeadline` về `constants/jobOptions.js` (cùng nhà với `formatSalary/formatLocations`), và dùng `EXPERIENCE_LEVEL_LABELS` chuẩn thay `experienceLabel` cục bộ (bỏ mapping lạ `senior→"3 năm"`, đồng bộ với JobDetail/JobCard). BestJobs còn 478 dòng. Verify: lint + build pass.

</details>

<details>
<summary><b>6.11</b> — Tối ưu performance (đợt 1)</summary>

(1) favicon **957KB** (PNG 2000×2000, `logo_proCV_2000_2000.png`) tải mọi trang — sửa 2 lớp: **data** (`SiteSetting.brand_favicon_url` trong DB, ghi đè `<link rel="icon">` runtime qua `SiteSettingsProvider`, override cả static tag trong `index.html`) VÀ **code** (`seed_sitecontent.py` idempotent sẽ ép giá trị này về `PROCV_MARK_URL` cũ nếu để nguyên `/favicon.svg` — SVG đó lại là icon tím `#863bff` của brand cũ "aicareer", sai màu thương hiệu). Fix thật: dựng `favicon-32.png` (1.9KB) + `apple-touch-icon.png` (18.8KB) từ đúng logo ProCV bằng Pillow resize, set làm default mới ở seed script + `DEFAULT_SITE_SETTINGS` (`siteSettingsContext.js`) + `index.html`; (2) chặn tận gốc admin upload favicon nặng trong tương lai: `AdminSettingUploadView` nhận thêm `key`, `UPLOAD_MAX_DIMENSIONS = {'brand_favicon_url': (256,256)}` tự resize qua `save_image_upload(..., max_dimensions=...)` (`apps/common/media_storage.py`, dùng Pillow — thêm dependency `Pillow==11.3.0`), test thực nghiệm 957KB→30KB tự động; (3) tách vendor `react` (react/react-dom/react-router-dom/scheduler) thành chunk riêng qua `manualChunks` (dạng **function** vì Vite 8 dùng rolldown) để cache độc lập qua các lần deploy — **cố ý KHÔNG gom antd vào 1 chunk** vì sẽ kéo antd trang admin vào initial load (thử nghiệm cho chunk antd monolithic 344KB gz, đã bỏ); antd để Vite tự tách theo route (vd `Settings` 48KB gz chỉ tải ở route admin). Verify: backend test (`sitecontent`+`accounts`) pass, `manage.py check` pass, build+lint frontend pass, favicon-32.png/apple-touch-icon.png trả 200 đúng dung lượng nhỏ, API public settings trả `brand_favicon_url=/favicon-32.png`. Backlog còn lại (react-query cache API, brotli precompress, WebP/AVIF cho ảnh khác, bundle analyzer, cache-control CDN) ghi trong memory.

</details>

<details>
<summary><b>6.12</b> — Cẩm nang nghề nghiệp (blog)</summary>

App Django mới `apps/blog` (4 model: `PostCategory` taxonomy phẳng 1 cấp, `Post` với `public_id`/slug SEO/`content` HTML rich-text/`related_job_category` FK sang `jobs.JobCategory`/vòng đời `draft→pending→published→archived`, `Tag` M2M, `PinnedPost` ghim theo `placement` cho khối "Tài liệu hỗ trợ tìm việc"). Mở rộng `sitecontent.Banner` thêm placement `blog_sidebar` + cặp `cta_secondary_*` (banner 2 nút Tạo CV/Tìm việc) và group setting `blog` (`blog_page_title`/`blog_meta_description`/`blog_support_docs_title`). **API public read-only** `/api/blog/` (list lọc `category`/`tag`/`q` không dấu, chi tiết theo slug tăng view, `categories`, `pinned`) + endpoint upload ảnh nội dung cho editor (`/api/blog/admin/uploads/`, permission `CanEditBlog`). **Phân quyền** dùng Django Groups: `blog_editor` (soạn/sửa bài của mình, gửi duyệt) + `blog_manager` (duyệt/publish + quản lý danh mục/thẻ/ghim), custom permission `can_publish_post`; PostAdmin lọc queryset theo author và giới hạn choices status cho người không có quyền publish. **Frontend** `/blog`, `/blog/danh-muc/:slug`, `/blog/:slug` (breadcrumb, thanh danh mục ngang cuộn + next/prev, share rail dính copy/FB/in/Twitter + nút mở mục lục drawer, mục lục sinh từ heading h2/h3 với scroll-to + thu gọn, `BlogContent` sanitize HTML + gắn id heading, khối việc làm liên quan theo `related_job_category` + nút xem tất cả, thẻ, cột phải: widget tìm việc nhanh + tài liệu hỗ trợ ghim + banner) + nối menu header "Cẩm nang nghề nghiệp" vào route thật. Seed `seed_blog` (6 danh mục, setting, 2 group quyền) idempotent. Kế hoạch chi tiết: `docs/03-database/ke-hoach-database-cam-nang-nghe-nghiep-blog.md`. Verify: `manage.py check` + smoke test 7 endpoint API 200, preview browser list/filter/detail desktop+mobile không lỗi console.

</details>

<details>
<summary><b>6.13</b> — Redesign giao diện blog kiểu TopCV</summary>

**Backend:** `Banner` thêm placement `blog_inline` (banner "ảnh giả button" — cả khối là 1 link, chèn giữa các section); endpoint `GET /api/blog/home/` trả featured 4 bài + section theo danh mục (4 bài/danh mục) trong 1 request; seed thêm `blog_benefits` (JSON: 3 lợi ích + CTA cho khối "Lợi ích khi sử dụng &lt;site&gt;"). **Trang `/blog` kiểu magazine** (`BlogHome.jsx`): khối "Bài viết nổi bật" 2 cột 5/5 (1 bài lớn + 3 bài dọc), mỗi danh mục một section 4 bài với 3 biến thể bố cục xoay vòng + nút "Xem tất cả", dải nền full-bleed xen kẽ trắng/`--brand-primary-soft`, banner inline chèn sau mỗi 2 section. **Trang danh mục** (`BlogCategory.jsx`): featured 4 bài của danh mục + 2 banner cạnh nhau + "Danh sách bài viết" với skeleton loader và nút "Xem thêm" nạp nối tiếp (append, không paginate) + banner cuối trang. **Trang chi tiết**: nền `#f7f9fc` — mọi khối bọc card trắng; section đầu "Lợi ích khi sử dụng &lt;site&gt;" (3 item + CTA, đọc từ setting); share rail gom 2 nhóm khung bo tròn (chia sẻ / mục lục); mục lục đánh số `1.`/`1.1` + thu gọn mượt bằng `grid-template-rows` transition; input tìm việc có gợi ý (debounce 250ms qua `/jobs/suggest/`) + option "Tất cả tỉnh/thành phố" tường minh; nút banner sidebar kiểu solid/outline có icon. **Chung**: bỏ chip "Tất cả" (/blog là tất cả), thanh danh mục sticky `top-16` dưới header trên mọi trang blog + lăn chuột để lướt ngang + nền trắng, mọi item bài viết/banner mở `_blank`, hover = zoom ảnh (`scale-110`) + nổi khối (translate + shadow) + đổi màu tiêu đề, màu đều từ CSS var thương hiệu. Verify: 6/6 test backend pass, build + lint pass, preview desktop + mobile 3 trang không lỗi console, bấm "Xem thêm" nạp đúng trang kế (8→14 bài, nút tự ẩn khi hết).

</details>

## Giai đoạn 7 — Phỏng vấn AI

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 7.1 | Bảng `interview_question_bank` | ⬜ |
| 7.2 | Bảng `interview_sessions` | ⬜ |
| 7.3 | Bảng `interview_questions` | ⬜ |
| 7.4 | Bảng `interview_answers` + chấm điểm rule-based | ⬜ |

## Giai đoạn 8 — Deployment

| # | Công việc | Trạng thái |
| --- | --- | --- |
| 8.1 | Dockerfile backend + docker-compose (backend + PostgreSQL) | ⬜ |
| 8.2 | Deploy (Vercel + Render/Railway hoặc Docker tự host) | ⬜ |

---

Cập nhật lần cuối: 2026-07-15 (FE-P5 — TanStack Query: infra + saved-jobs + jobs pages + home data; request-deduplication thu hẹp phạm vi còn bootstrap context)
