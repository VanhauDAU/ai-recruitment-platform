# Kế hoạch làm lại trang Cấu hình hệ thống (admin)

> Trạng thái: **đã duyệt 21/11/2026**. GĐ1–GĐ4 đã gộp (#294–#298); GĐ5 trên nhánh
> `feat/settings-recruiting`.
> Lộ trình 5 giai đoạn, mỗi giai đoạn một PR.
>
> Điều chỉnh khi làm GĐ1:
> - **Không đổi tên key trong GĐ1.** Hai key cũ `employer_require_approval` và
>   `cv_allow_public_share` bị xoá. GĐ5 tạo key mới cùng với code đọc chúng, khởi tạo
>   từ giá trị env/hằng số hiện hành.
> - **Kiểu `multiselect`/`number_list`/`duration`, option `monotonic` và khoá công khai
>   `upload_limits`** chỉ được thêm ở giai đoạn có key hoặc code dùng tới, để không để
>   lại code chưa ai dùng.
> - **Seed không có cơ chế prune.** Key bị gỡ được xoá bằng data migration
>   (`sitecontent.0004`).
>
> Điều chỉnh khi làm GĐ3:
> - **Phiên bản chính sách giữ ở `.env`/mã nguồn, không chuyển vào DB.** Gồm cookie,
>   điều khoản NTD, DPA kèm mã băm và đồng ý ứng viên. Văn bản nằm trong mã nguồn hoặc
>   gắn mã băm, nên phiên bản phải đổi cùng lần triển khai sửa văn bản. Cho admin tăng
>   số mà không đổi văn bản sẽ làm bản ghi đồng ý mất giá trị chứng cứ. Admin chỉ chỉnh
>   **đường dẫn** văn bản (`legal_terms_url`, `legal_privacy_url`,
>   `employer_dpa_guide_url`). Không cần `legal_cookie_url` vì đã có trang
>   `/chinh-sach-cookie` nội bộ.
> - **Favicon trong SEO shell server không làm;** trình duyệt áp favicon sau khi tải trang.
> - **Đồng bộ giới hạn upload phía frontend dời lại:** phải sửa chuỗi "5MB" trong i18n ở
>   nhiều vùng.
>
> Điều chỉnh khi làm GĐ4:
> - **Email kết quả xác thực nhà tuyển dụng không theo công tắc email nghiệp vụ.** Đây là
>   email về trạng thái tài khoản, xếp cùng nhóm email bảo mật.
> - **`email_footer_text` chỉ áp cho email thông báo** (ứng viên, nhà tuyển dụng). Email
>   xác thực, chào mừng, đặt lại mật khẩu có phần chân riêng; nội dung đã ghi trong "?".
> - **`ai_enabled` không chặn sinh mẫu CV của admin**, vì đây là công cụ nội bộ, không
>   phải tính năng người dùng.
> - **Hạn mức AI viết bài chiến dịch không có trần env** vì trước đây chỉ là hằng số
>   trong code; admin chỉnh trong khoảng 0–200.
>
> Điều chỉnh khi làm GĐ5:
> - **Không có data migration env → DB.** Key mới lấy mặc định từ seed, và mặc định
>   seed bằng đúng giá trị env/hằng số đang chạy (`JOB_POSTING_*`, hạn xem tin 24 giờ,
>   các hằng số ứng tuyển). Các biến `JOB_POSTING_*`, `JOB_VIEW_DEDUP_TTL_SECONDS`,
>   `CANDIDATE_STATUS_NOTIFICATION_DELAY` được gỡ khỏi `.env.example` và mã nguồn.
> - **`employer_require_approved_verification` chỉ siết được.** Hiệu lực = cờ máy chủ
>   `REQUIRE_APPROVED_EMPLOYER_VERIFICATION` HOẶC công tắc admin, nên admin không tắt
>   được yêu cầu mà production đặt.
> - **Chưa làm modal đếm số công ty mất dấu tick** trước khi chuyển `enforce`. Ô chọn chế
>   độ được đánh dấu thao tác nguy hiểm, có hỏi lại; số liệu shadow vẫn xem ở log.
> - **Không thêm `ai_content_retention_days`.** Mức 90 ngày của nội dung AI là quy tắc
>   bắt buộc ở production, giữ ở `.env`.
> - **Một SLA kiểm duyệt cho mọi hàng chờ xác thực/cập nhật công ty**
>   (`moderation_sla_hours`) và một SLA riêng cho báo cáo vi phạm (`report_sla_hours`).
> - **`FALLBACK_MAX_DEADLINE_DAYS` ở form đăng tin vẫn giữ** làm giá trị dự phòng khi
>   chưa tải xong posting-context; giá trị bằng trần cứng 90 ngày.
> - **Hằng số trần và mặc định tự từ chối thuộc app jobs** (`apps.jobs.domain.MAX_LISTING_DAYS`,
>   `apps.jobs.services.auto_reject_default_days`), để app khác không import module nội bộ.

## Context

Trang `/admin/app/settings` ([Settings.jsx](../../frontend/src/pages/admin/settings/Settings.jsx)) đang hiển thị **120 key / 15 tab** (DB local; seed có 115). Rà soát từng key cho thấy trang **nói sai về hệ thống**:

| Tình trạng | Số key | Ví dụ |
|---|---|---|
| Chạy đúng | ~30 | `candidate_max_cvs`, quota đăng tin, `seo_robots_index`, `ai_job_generation_*` |
| Có đọc nhưng sai / chạy thiếu | ~25 | `employer_stats`/`employer_partners` không bao giờ hiện (bug `settingText`); logo seed trỏ `.png` không tồn tại; og:image upload bị vỡ URL; màu thương hiệu bị hardcode ở layout NTD và email; EmployerFooter bỏ qua các công tắc footer; `ai_provider` chỉ áp cho import CV |
| Không có chỗ nào đọc | ~60 | `maintenance_mode`, 6/7 công tắc trang chủ, toàn bộ `payment_*` (ADR-0015 đã gỡ), 7 key `security_*`, 5 key `upload_*`, `job_*`, phần lớn `cv_*` |
| Giá trị seed ghi ngược với code | 8 | `candidate_require_email_verification=false` (code luôn bắt), `security_require_strong_password=false` (code luôn bắt), `upload_max_cv_size_mb=10` (code giới hạn 5MB), `upload_allowed_cv_types` có `doc`, `security_session_timeout_minutes=60` (thực tế idle 30 phút), `cv_default_template=modern` (slug thật: `thanh-lich`…) |

Hạ tầng cũng hở:
- Default trong code lệch default trong seed.
- Có 3 helper đọc setting trùng nhau, và mỗi lần đọc đều truy vấn DB.
- Server không kiểm tra json/url/email.
- Upload ảnh không ghi audit; sửa qua Django admin bỏ qua cả kiểm tra lẫn audit.
- `seed_sitecontent` không xoá được key cũ.
- Key blog và `cv_builder_wysiwyg_enabled` nằm ngoài seed.

**Mục tiêu:** chỉ còn những key thật sự điều khiển hệ thống (72 key giữ/sửa, thêm khoảng 52 key mới ở §1b), và mỗi key chạy đúng ở mọi nơi mà nhãn hứa hẹn. Thông số do `.env`/Django quyết định thì hiển thị ở dạng chỉ đọc với giá trị đang áp dụng. Giao diện chia nhóm theo công việc của admin, mỗi dòng có nút "?" giải thích. Một bài test hợp đồng chặn việc sinh lại key chết.

**Quyết định đã chốt với user (21/11):**
1. Bảo trì: làm thật.
2. Công tắc đăng ký / trang chủ / email chào mừng: nối vào code.
3. Thông số bảo mật/upload: chuyển sang bảng chỉ đọc lấy từ env.
4. AI: hợp nhất theo runtime env, gỡ `ai_provider`/`ai_model`.
5. Nhận **toàn bộ 10 bộ setting mới** ở §1b, khoảng 52 key. Riêng hạn tin không còn nằm trong bảng chỉ đọc mà chuyển thành setting thật (bộ "Tin tuyển dụng").

**Kết quả cuối:** khoảng **124 key** (72 key giữ/sửa + 52 key mới) trong 17 nhóm, xếp thành 3 khu trên thanh bên. Nhờ có tìm kiếm và section, số key nhiều vẫn dễ dùng.

**Quy tắc chuyển env → DB** (áp cho mọi key trước đây lấy từ env):
- Data migration khởi tạo `value` bằng **giá trị env đang áp dụng** lúc migrate (đọc `django.conf.settings`), nên deploy xong hành vi không đổi.
- Nếu có trần an toàn thì env/code giữ trần, admin chỉ chỉnh trong trần (mẫu `ai_policy.py`).
- Biến env không còn tác dụng thì gỡ khỏi `.env.example` và docs.

---

## 1. Danh mục key sau khi làm lại (72 key, 11 nhóm)

Ký hiệu hành động: **Giữ** = đang chạy đúng · **Sửa** = có đọc nhưng sai hoặc thiếu · **Nối** = chưa ai đọc, sẽ nối vào code · **Mới** = đưa vào seed.

| Nhóm mới (key) | Section | Key | Hành động / việc cụ thể |
|---|---|---|---|
| **Thương hiệu** `brand` | Nhận diện | `site_name`, `site_tagline` | Giữ. Sửa mô tả tagline cho đúng: hiện chỉ dùng trong email. |
| | Logo & biểu tượng | `brand_logo_url`, `brand_logo_mark_url`, `brand_favicon_url` | Sửa: seed đổi sang `.webp`; seed_sitecontent tự đổi giá trị `.png` cũ (legacy); trang SEO server render thêm `<link rel=icon>` theo favicon. |
| | Màu sắc | `brand_primary_color` | Sửa: bỏ `#00b14f` hardcode ở `EmployerAuthLayout.jsx:67`, `EmployerSetupLayout.jsx:13`, email welcome/xác thực/đặt lại mật khẩu/digest; fallback email `#1FA65A` → lấy default từ registry. |
| **Trang chủ & điều hướng** `homepage` | Khối trang chủ | `home_show_banner`, `home_show_stats`, `home_show_categories`, `home_show_featured_jobs`, `home_show_cv_templates` | Nối: `Home.jsx` render có điều kiện. |
| | | `home_featured_jobs_count` | Nối: thay `BEST_JOBS_PAGE_SIZE` ở `best-jobs-config.js:3`; thêm options integer + min/max theo lưới. |
| | Điều hướng | `home_show_popular_searches` | Sửa nhãn: "Khối Tra cứu phổ biến (cuối mọi trang ứng viên)". |
| **SEO & chia sẻ** `seo` | Mặc định | `seo_default_title`, `seo_default_description` | Sửa: trang chủ dùng 2 key này ở cả FE (`route-metadata.js`) lẫn BE (`sitecontent/seo/views.py:17-54`) thay cho chuỗi hardcode; FE và BE ghép hậu tố tiêu đề theo cùng một quy tắc. |
| | Chia sẻ MXH | `seo_og_image` | Sửa: SEO views chuyển storage key thành URL media (`media_url_from_value`); khi trống thì fallback sang logo; FE không xoá thẻ og của server. |
| | Lập chỉ mục | `seo_robots_index`, `seo_google_site_verification` | Giữ. |
| **Liên hệ & MXH** `contact` | Kênh hỗ trợ | `hotline`, `support_email`, `contact_address`, `contact_working_hours`, `contact_zalo_url`, `contact_messenger_url`, `contact_map_embed_url` | Sửa: `HotlineConsultation.jsx` bỏ số điện thoại/email hardcode; thống nhất một fallback `support_email` (registry/`DEFAULT_SITE_SETTINGS`) thay cho 4 bản đang lệch nhau. |
| | Hotline NTD | `employer_hotline_north`, `employer_hotline_south` | Giữ. "?" ghi rõ: khi trống sẽ fallback sang `hotline`. |
| | Mạng xã hội | `footer_facebook_url`, `footer_linkedin_url`, `footer_youtube_url`, `footer_tiktok_url` | Giữ (đang dùng ở 2 footer và email). |
| **Chân trang** `footer` | Nội dung | `footer_logo_url`, `footer_description`, `footer_copyright` | Sửa: thống nhất fallback copyright FE theo placeholder `{year}` `{site_name}`; `EmployerAuthLayout.jsx:78` dùng key này. |
| | Pháp lý | `footer_company_name`, `footer_business_license` | Giữ. |
| | Ứng dụng | `footer_app_store_url`, `footer_google_play_url`, `footer_qr_code_url`, `footer_qr_label` | Giữ. Nhãn phạm vi: "Footer cổng ứng viên". |
| | Hiển thị | `footer_show_link_groups`, `footer_show_contact`, `footer_show_apps`, `footer_show_socials` | Sửa: `EmployerFooter.jsx` tôn trọng `show_socials` và `show_contact`; các công tắc còn lại ghi rõ phạm vi. |
| **Ứng viên & CV** `candidate` | Đăng ký | `candidate_allow_registration` | Nối: chặn ở `RegisterView` (`accounts/api/views/auth.py:37`) và OAuth tạo tài khoản mới (`accounts/services/oauth.py:274`); FE ẩn CTA và hiện trạng thái "đang tạm đóng". |
| | Hồ sơ | `candidate_max_cvs` | Giữ. |
| | Tính năng thử nghiệm | `cv_builder_wysiwyg_enabled` | Mới (đưa từ `reference_data.json` vào seed). |
| **Nhà tuyển dụng** `employer` | Đăng ký | `employer_allow_registration` | Nối: chặn ở `EmployerRegisterView` (`employers/api/views/registration.py:24`) và OAuth phía NTD. Lời mời admin không bị ảnh hưởng. |
| | Hạn mức đăng tin | `employer_free_job_quota`, `employer_verified_level_three_job_quota` | Sửa: thông báo ở `jobs/services/posting/quota.py:41` dùng giá trị thật thay cho chữ "100". |
| | Uy tín | `employer_badge_min_account_months` | Giữ; chuyển sang đọc qua selector chung (`trust_badge.py:28`). |
| | Trang giới thiệu NTD | `employer_stats`, `employer_partners` | Sửa bug: `useSiteSetting` chỉ trả chuỗi → đọc thẳng `settings.employer_stats`; dùng editor dạng danh sách thay JSON; server kiểm tra schema. |
| **Email & thông báo** `email` | Chung | `email_notifications_enabled` | Sửa phạm vi: chặn mọi email nghiệp vụ (thêm auto-reject `automatic_rejection.py:121,210`, kết quả xác thực NTD `verification_notification.py:67`, digest); KHÔNG chặn email bảo mật (xác thực, đặt lại mật khẩu, lời mời). "?" nói rõ điều này. |
| | Loại email | `email_notify_new_application` | Giữ. |
| | | `email_welcome_enabled` | Nối: `accounts/services/welcome.py` kiểm tra trước khi gửi. |
| | Nhận diện email | `email_from_name`, `email_footer_text` | Sửa: mọi nơi gửi email (digest, auto-reject, auth) đều lấy from/footer/màu qua một helper `email_branding()`. |
| **AI** `ai` | Công tắc chung | `ai_enabled` | Sửa: thành công tắc mềm cho mọi AI sinh nội dung (import CV và tạo JD), nằm dưới env `AI_RUNTIME_ENABLED`; đọc bằng `get_bool_setting` (bỏ `is False`). |
| | Đối sánh (ML local) | `ai_job_match_enabled`, `ai_job_recommendation_semantic_enabled` | Giữ; thống nhất default code với seed. |
| | Chính sách | `ai_data_policy_url` | Giữ. |
| | Tạo JD bằng AI | `ai_job_generation_enabled`, `_model`, `_model_allowlist`, `_daily_limit`, `_rollout_percent`, `_company_allowlist` | Giữ. Sửa: choices của `_model` lấy động từ env allowlist; `_rollout_percent` thêm integer 0–100; `_company_allowlist` dùng ô chọn công ty; các ô con mờ đi khi tắt `_enabled`. |
| **Cẩm nang** `blog` | Trang blog | `blog_page_title`, `blog_support_docs_title` | Mới: đưa vào `settings.json` có section/order; `seed_blog` thôi tạo setting. |
| **Vận hành** `operations` | Bảo trì | `maintenance_mode`, `maintenance_message` | Nối (xem §3.3). Thuộc nhóm thao tác nguy hiểm, phải xác nhận trước khi lưu. |
| | Thông số hệ thống | _(chỉ đọc, không phải key)_ | Bảng giá trị đang áp dụng (§3.4). |

**Đổi tên trong migration** (giữ row, đổi key cho đúng nghĩa và nối vào code; xem §1b):

| Key cũ | Key mới |
|---|---|
| `employer_require_approval` | `employer_require_approved_verification` |
| `cv_allow_public_share` | `cv_share_enabled` |

Hai key `candidate_max_applications_per_day` và `job_expiry_days` bị xoá, thay bằng `application_max_per_job` và `job_default_deadline_days` (khác nghĩa, khởi tạo từ hằng số hoặc env hiện hành).

**Gỡ 48 key** (xoá consumer, seed và DB bằng data migration; `pg_dump` trước). Danh sách dưới đây đã gồm cả 4 key cũ nói trên:

| Loại | Key |
|---|---|
| Thanh toán (đã gỡ theo ADR-0015) | `payment_*` (7) |
| SEO chết | `seo_default_keywords`, `seo_google_analytics_id` (cần cookie consent + chính sách riêng, ngoài phạm vi) |
| Trùng với luồng xác thực Cấp 1–3 / luật cứng | `candidate_require_email_verification`, `candidate_max_applications_per_day`, `candidate_allow_avatar_upload`, `candidate_profile_completion_required`, `employer_require_approval`, `employer_require_company_info`, `employer_max_active_jobs`, `employer_allow_logo_upload` |
| Tin & CV | `job_expiry_days`, `jobs_per_page`, `job_allow_salary_negotiable`, `job_require_salary_range`, `job_allow_urgent_tag`, `cv_allow_pdf_export`, `cv_default_template`, `cv_allow_public_share`, `cv_watermark_enabled`, `cv_ai_review_free_limit` |
| Chuyển sang bảng chỉ đọc | `security_*` (7), `upload_*` (5), `email_smtp_configured` |
| Email / AI / blog | `email_notify_job_approved`, `ai_provider`, `ai_model`, `ai_api_key_configured`, `ai_cv_review_enabled`, `ai_daily_request_limit`, `blog_meta_description`, `blog_benefits` |

---

## 1b. Đề xuất setting mới (nghiên cứu + rà soát code)

**Cách làm:**
- Đối chiếu trang cấu hình của các nền tảng tuyển dụng: WP Job Manager, JBoard, SmartJobBoard (duyệt tin, thời hạn tin, giới hạn đăng tin, thông báo cho admin) và Workable, Greenhouse (thời hạn lưu dữ liệu ứng viên, tự xoá).
- Đối chiếu khung pháp lý VN: Luật BVDLCN 2025 và Nghị định 356/2025, hiệu lực 01/01/2026, thay NĐ 13/2023. Nguyên tắc: chỉ lưu dữ liệu trong thời gian phù hợp mục đích; sự đồng ý phải kiểm chứng được về thời điểm và nội dung.
- Lọc lại bằng **tham số nghiệp vụ đang hardcode/env trong code**. Chỉ đề xuất setting gắn vào tính năng **đã tồn tại**, không bịa tính năng.

**Nguyên tắc thiết kế cho mọi key mới:**
- `is_public=false` mặc định.
- Có `min`/`max`.
- Theo mẫu `jobs/domain/ai_policy.py`: env/code giữ **trần cứng**, admin chỉ chỉnh **trong trần**.
- Giá trị FE cần biết thì phát qua API sẵn có (`application_rules()`, posting-context) để FE và BE không lệch nhau.

| Ưu tiên | Nhóm | Key đề xuất (giá trị hiện tại) | Nguồn hiện tại | Lý do |
|---|---|---|---|---|
| **P0** | **Pháp lý & đồng ý** (nhóm mới) | `legal_terms_url`, `legal_privacy_url`, `legal_cookie_url`, `employer_dpa_document_url`, `employer_dpa_guide_url` | **Đang trỏ sang topcv.vn**: `pages/main/auth/Register.jsx:344,353`, `EmployerDataProtectionForm.jsx:27-28`, env default `integrations.py:104` | Rủi ro pháp lý: căn cứ đồng ý khi đăng ký là văn bản của bên thứ ba. Có thể trỏ về trang nội bộ (`/chinh-sach-cookie`, trang Legal NTD) hoặc bài trong Knowledgebase. |
| P0 | Pháp lý & đồng ý | `consent_policy_version`, `employer_terms_policy_version`, `employer_dpa_policy_version` (chỉ được tăng, có audit), `employer_dpa_grace_days` (30) | env `CONSENT_POLICY_VERSION`, `EMPLOYER_*_POLICY_VERSION`; version đồng ý của UV do **client gửi lên** (`candidates/api/serializers/profile.py:83`) | Đổi văn bản không cần deploy. Server tự gán version thay vì tin client. |
| **P0** | **Xác thực & uy tín NTD** | `employer_require_approved_verification` (**thay cho** `employer_require_approval`) | env `REQUIRE_APPROVED_EMPLOYER_VERIFICATION` (`employers/services/profiles.py:121`, `verification/cases.py:214`, `selectors/onboarding.py:182`) | Công tắc trust & safety quan trọng nhất. Key cũ không ai đọc nhưng mô tả đúng ý này → nối vào thay vì xoá. |
| P1 | Xác thực & uy tín NTD | `employer_badge_policy_mode` (legacy/shadow/enforce), `employer_verification_max_rejections` (3), `employer_trust_report_reasons` (multi-select), `company_description_min_length` (500, phát cho FE), `moderation_sla_hours` (72, đang lặp ≥3 nơi) | `product.py:45`, `verification/cases.py:28`, `trust_badge.py:33`, `companies.py:37` + FE copy, `recruiter_next_action.py:9` / `admin_dashboard.py:64` / `admin_verification.py:145` | Chế độ tick xanh là quyết định rollout: UI phải hiện số công ty bị ảnh hưởng (số liệu shadow) trước khi cho bật enforce. Gom một bảng SLA duy nhất. |
| **P1** | **Ứng tuyển & SLA** (nhóm mới) | `application_max_per_job` (3, **thay** `candidate_max_applications_per_day`), `application_reapply_cooldown_minutes` (5), `auto_reject_default_days` (21), `auto_reject_email_grace_days` (3), `auto_reject_min_notice_days` (3), `candidate_status_notify_delay_minutes` (5), `recruiter_reminder_days` ([3,7]), `candidate_reminder_after_days`/`_interval_days`/`_max` (3/3/2), `review_link_max_days` (30) | `applications/services/applications.py:25-26`, `status.py:31,33`, `reminders.py:27-32`, `reviews.py:25`, `tasks.py:55`, `jobs/models/core.py:234` | SLA trải nghiệm ứng viên là lõi của hệ thống tuyển dụng. `application_rules()` đã phát các giá trị này cho FE nên chỉ phải đổi ở một chỗ. |
| P1 | **Tin tuyển dụng** | `job_default_deadline_days` (30), `job_max_deadline_days` (90), `job_max_public_lifetime_days` (90), `job_renewal_grace_days` (30), `job_view_dedup_hours` (24) | env `JOB_POSTING_*` (`product.py:37-43`), `posting/rules.py:21`, `product.py:28` | Thay `job_expiry_days` (key chết). Trần cứng 90 ngày giữ trong code (`lifecycle.py:7`); FE `FALLBACK_MAX_DEADLINE_DAYS` đọc từ posting-context. |
| P1 | **Email & job alert** | `job_alert_enabled`, `job_alert_delivery_hour` (8), `job_alert_max_jobs` (10), `job_alert_limit_per_candidate` (5), `recruiter_reminders_enabled` | `jobs/services/alerts.py:27,29`, `digests/preparation.py:30` | Hiện chỉ tắt được bằng công tắc email tổng. Giờ gửi và độ dài email ảnh hưởng uy tín email. |
| P1 | **CV & chia sẻ** | `cv_share_enabled` (**nối lại** `cv_allow_public_share`), `cv_share_default_days`, `cv_share_max_days` | `cvs/services/sharing.py:52-75`: link **không có hạn tối đa** | Link chứa dữ liệu cá nhân hiện có thể sống vĩnh viễn. |
| P1 | **Lưu trữ dữ liệu** (nhóm mới) | `talent_pool_retention_days` (365), `candidate_notification_retention_days` (730), `cv_import_source_retention_days` (30), `digest_history_retention_days` (90), `ai_content_retention_days` (90) | `talent_pool.py:10`, `tasks.py:50`, `integrations.py:208`, `digests/retention.py:12`, `ai.py:42-51` | Nguyên tắc "lưu vừa đủ mục đích" (Luật BVDLCN 2025). Mức sàn tuân thủ giữ ở env, theo mẫu `uploads/domain/configuration.py:88`. |
| P2 | **Đăng nhập** | `oauth_providers_candidate` / `oauth_providers_employer` (multi-select google/facebook/linkedin, chỉ thu hẹp env), `admin_invitation_ttl_hours` (72) | `accounts/services/oauth.py:30-33`; FE fallback `SocialLoginButtons.jsx:67` hiện cả 3 nút; `admin_invitations.py:27` | Tắt một nhà cung cấp mà không cần xoá secret; FE đọc danh sách nhà cung cấp từ server. |
| P2 | **AI & chi phí** | `ai_campaign_content_enabled`, `ai_campaign_daily_quota` (20, trần env) | `campaigns/services/content.py:29,193` | AI viết bài MXH đang bỏ qua chính sách AI của admin. Dùng lại `ai_policy`. |
| P2 | **Tính năng** | `knowledgebase_public_enabled` / `_search_index_enabled` (thu hẹp env), `announcement_surfaces` (multi-select) | `integrations.py:81-90`, `product.py:18-26` | Env tự mô tả đây là "runtime kill switch" của sản phẩm → hợp làm công tắc admin. |

**Không đề xuất** (giữ env/code, ghi vào bảng chỉ đọc §3.4):
- TTL OTP/OAuth/JWT, rate limit đăng nhập, ngưỡng reCAPTCHA (bảo mật).
- Trọng số chấm điểm matching và ngưỡng semantic: đã đo offline và có `SCORING_VERSION`, sửa tay sẽ làm lệch cache điểm.
- Lịch Celery beat và kích thước batch (vận hành).

**Khoảng trống tính năng phát hiện thêm** (ngoài phạm vi trang này, ghi vào backlog):
- Ứng viên chưa tự xoá được tài khoản.
- Ứng viên bật `recruiter_searchable` (đồng ý cho NTD tìm) nhưng **không có API tìm ứng viên phía NTD**, tức đang thu đồng ý cho tính năng chưa có.
- Chưa có bộ lọc cảnh báo từ ngữ phân biệt giới tính/độ tuổi khi đăng tin (NĐ 12/2022 Điều 8).
- Admin chưa chọn được ai nhận email khi có hồ sơ xác thực hoặc báo cáo mới.

---

## 2. Thiết kế UI/UX

**Bố cục** (theo memory: admin gọn, responsive, Skeleton, lazy):
- Header gọn: tiêu đề, ô tìm kiếm, nút "Lịch sử thay đổi".
- Desktop (`lg+`): cột trái là danh sách nhóm (icon, tên, chấm cam khi có thay đổi chưa lưu, chấm đỏ khi có lỗi), cột phải là nội dung nhóm. Danh sách nhóm chia 3 khu:

  | Khu | Nhóm |
  |---|---|
  | Giao diện & nội dung | Thương hiệu · Trang chủ & điều hướng · SEO & chia sẻ · Liên hệ & MXH · Chân trang · Cẩm nang |
  | Nghiệp vụ tuyển dụng | Tài khoản & đăng nhập (công tắc đăng ký, MXH theo cổng, lời mời admin) · Nhà tuyển dụng & xác thực · Tin tuyển dụng · Ứng tuyển & SLA · Hồ sơ & CV (số CV, chia sẻ, wysiwyg) · Email & thông báo (gồm job alert) · AI (gồm AI chiến dịch) |
  | Tuân thủ & vận hành | Pháp lý & đồng ý · Lưu trữ dữ liệu · Tính năng · Vận hành (bảo trì + thông số chỉ đọc) |
- Mobile: nhóm thành thanh chip cuộn ngang, dính trên đầu.
- URL `?group=` giữ nguyên; map nhóm cũ sang nhóm mới (`general`→`brand`, `security`/`upload`/`payment`→`operations`…) để link cũ không gãy.

**Mỗi nhóm gồm các card section** (tiêu đề + một câu mô tả). Mỗi dòng setting có:
- Nhãn và mô tả ngắn một dòng.
- Control phù hợp với kiểu giá trị.
- Chấm "đã sửa" kèm nút ↺ hoàn tác riêng từng ô.
- Nút **"?"** mở Popover, chứa:
  - **Tác dụng:** giải thích dài từ `help`.
  - **Áp dụng ở:** chip từ `options.applies_to`, vd "Cổng ứng viên", "Email", "Trang SEO".
  - **Giá trị mặc định** kèm nút "Đặt về mặc định".
  - **Hiển thị công khai** có/không. Tag Public chuyển vào đây, không còn nằm ở dòng chính.
  - Key kỹ thuật (bấm để copy), thời điểm cập nhật cuối, link "Xem lịch sử" mở Drawer.
- Phụ thuộc: ô có `options.depends_on` sẽ mờ đi kèm câu "Bật X để dùng".

**Lưu một lần cho cả trang:**
- Thanh lưu dính đáy: "3 thay đổi chưa lưu · Hoàn tác tất cả · Lưu".
- Có thể sửa nhiều nhóm rồi lưu cùng lúc, không còn hỏi xác nhận khi chuyển tab.
- `useBlocker` và `beforeunload` chặn rời trang khi còn thay đổi chưa lưu.
- **Key nguy hiểm** (`options.risky`: bật bảo trì, tắt đăng ký, tắt index, tắt AI, tắt email) → Modal xác nhận liệt kê "trước → sau".
- Lỗi theo key hiện ngay dưới ô (không gộp vào toast), tự nhảy đến nhóm có lỗi đầu tiên.
- Sau khi lưu, nếu có key public thay đổi thì refresh site settings (hiện chỉ refresh khi đổi màu).

**Tìm kiếm:** lọc theo nhãn, mô tả và key trên mọi nhóm; kết quả hiện kèm badge nhóm, bấm vào thì nhảy đến ô và highlight.

**Editor chuyên dụng thay cho ô JSON thô:**
- `employer_stats`: danh sách các dòng (value, label_vi, label_en), thêm/xoá/kéo sắp xếp.
- `employer_partners`: danh sách tên + logo + url (xác minh shape hiện tại ở `LandingSections.jsx:139`).
- Hai allowlist: `Select mode=tags`; danh sách công ty dùng tìm kiếm từ xa.
- Kiểu mới:
  - `multiselect`: nhà cung cấp OAuth, lý do báo cáo, bề mặt thông báo.
  - `number_list`: `recruiter_reminder_days`.
  - `duration`: ô số kèm đơn vị cố định phút/giờ/ngày.
- Version chính sách có option `monotonic` (chỉ được tăng), hiện cảnh báo "Mọi người dùng sẽ phải đồng ý lại".
- `employer_badge_policy_mode = enforce` → Modal xác nhận hiện số công ty sẽ mất tick xanh, lấy từ số liệu shadow.

**Xem trước:**
- Thương hiệu: mock header (logo + nút màu chính), favicon, và kiểm tra tương phản WCAG chữ trắng trên màu chính.
- SEO: snippet Google kèm bộ đếm 60/160 ký tự, và card chia sẻ MXH.
- Footer: copyright với placeholder đã thay giá trị.

**Nhóm Vận hành:**
- Card "Chế độ bảo trì" viền đỏ, có trạng thái hiện hành.
- Bảng **Thông số hệ thống** chỉ đọc, gồm cột: Thông số · Giá trị đang áp dụng · Nguồn (`ENV_VAR`) · "?". Ghi chú "Đổi trong .env, cần khởi động lại dịch vụ".
- Nhóm AI giữ `AiRuntimeOverview` ở đầu; trạng thái credential lấy từ đó.

**Lịch sử thay đổi:** Drawer liệt kê audit `site_setting_update` (người sửa, thời điểm, trước → sau), lọc theo key; nút "Dùng lại giá trị này" chỉ điền vào form, không lưu ngay.

---

## 3. Thay đổi kiến trúc (backend)

### 3.1 Hợp đồng cấu hình: một nguồn sự thật
- Mở rộng `seed_data/settings.json`: `section`, `help`, `options.applies_to`, `options.depends_on`, `options.risky`, `options.schema` (json), `options.max_length`.
- Model `SiteSetting`: thêm field `section`, `help`; thay `Group` bằng 11 nhóm mới (migration AddField + cập nhật choices).
- `selectors/settings.py`:
  - Thêm registry (đọc `settings.json` một lần qua `lru_cache`) cung cấp **default** cho mọi key.
  - `get_*_setting(key)` lấy default từ registry. Bỏ default truyền tay, hoặc test khẳng định chúng bằng nhau.
  - Cache **toàn bộ map** trong Django cache (Redis), receiver hiện có xoá cache sau commit → hết N+1.
  - Gộp 3 helper trùng: `accounts/services/mailing.site_setting`, `ai_core/services/cv_import._setting_value`, truy vấn trực tiếp ở `employers/services/trust_badge.py`.
- `services/site_settings.py::_validate_value`: thêm kiểm tra url (http/https hoặc đường dẫn tương đối), email, `max_length`, json theo `options.schema` (list các object với field bắt buộc / list chuỗi). Thêm **audit cho upload ảnh**.
- `sitecontent/admin.py`: `value`/`is_public` chỉ đọc trong Django admin (bỏ `list_editable`), để mọi chỉnh sửa đi qua service có kiểm tra và audit.
- `seed_sitecontent`:
  - Thêm danh sách `REMOVED_KEYS`; xoá các key đó kèm log.
  - Map giá trị legacy `.png` → `.webp`.
  - Chỉ đồng bộ metadata, vẫn không ghi đè `value`.
- Data migration xoá 48 key; viết `reverse` no-op có chú thích. Kiểm tra lại graph migration sau khi rebase (memory).

### 3.2 Bài test hợp đồng chặn key chết (`sitecontent/tests/test_settings_contract.py`)
- Mỗi key trong seed phải xuất hiện ít nhất một lần trong source (`backend/apps`, `frontend/src`), không tính seed/tests/migrations.
- Mỗi key được gọi qua `get_*_setting('…')`, `get_settings_map`, `useSiteSetting('…')` phải có trong seed.
- Mỗi key: `group` hợp lệ, có `section` và `help`, default qua được `_validate_value`, `min ≤ default ≤ max`.
- Không còn key nào thuộc `REMOVED_KEYS`.

### 3.3 Chế độ bảo trì
- `MaintenanceModeMiddleware` (đặt cạnh hạ tầng HTTP của sitecontent, thêm vào `config/settings/components/core.py:64` MIDDLEWARE).
- Khi bật: trả **503** `{code:'maintenance', message}` kèm `Retry-After` cho `/api/*` và các trang SEO server render.
- Miễn trừ: `/api/admin/*`, các endpoint đăng nhập/refresh của admin, `GET` public settings (để FE biết mà hiện màn bảo trì), health check, static/media, Django `/admin/`. Xác minh đúng prefix khi làm.
- FE:
  - `SiteSettingsProvider` đọc `maintenance_mode` và render `MaintenanceScreen` cho cổng ứng viên và NTD; cổng admin không bị ảnh hưởng.
  - Interceptor HTTP bắt 503 `code=maintenance` để xử lý trường hợp cache settings đã cũ.
- Celery vẫn chạy; ghi chú trong "?" là email định kỳ không dừng.

### 3.4 Bảng thông số chỉ đọc
- `selectors/system_parameters.py` cùng `GET /api/admin/site/system-parameters/` (superuser).
- Trả về các thông số theo nhóm, **không bao giờ trả secret**:

| Nhóm | Thông số |
|---|---|
| Mật khẩu | 8–25 ký tự, bắt buộc mật khẩu mạnh |
| Đăng nhập | `LOGIN_BACKOFF_FREE_ATTEMPTS/MAX_SECONDS/WINDOW` |
| Phiên | `AUTH_SESSION_IDLE_TIMEOUT_SECONDS`; JWT access/refresh; access của admin |
| reCAPTCHA | đã cấu hình chưa, có bắt buộc ở production không |
| Upload | `IMAGE_UPLOAD_MAX_SIZE`, `MAX_IMPORT_BYTES`, định dạng CV, `UPLOAD_MAX_BYTES` |
| Trần cứng | trần 90 ngày của hạn tin, trần dung lượng/số phiên upload, các mức sàn lưu trữ, trần quota AI (để admin thấy giới hạn của các setting ở §1b) |
| Phân trang | `PAGE_SIZE`/max |
| Knowledgebase | `KNOWLEDGEBASE_*` |
| Email | email backend, đã có host/user chưa, `DEFAULT_FROM_EMAIL` |

- **Đồng bộ giới hạn upload với FE:** public settings trả thêm `upload_limits` (dạng key tổng hợp, giống `knowledgebase_public_enabled`). Hook `useUploadLimits()` thay khoảng 7 hằng 5MB/accept hardcode, gồm: `avatar-crop.js`, `cv-upload-standards.js`, `PostImagePicker.jsx`, `company-form.js`, `CompanyForm.jsx`, `AvatarUploadModal.jsx`.

### 3.5 AI
- `ai_core/services/cv_import.py` gọi qua runtime provider chung (`ai_core/services/providers`, `AiRuntimeConfig.from_django_settings(model=settings.AI_CV_IMPORT_MODEL or AI_JOB_GENERATION_MODEL)`):
  - Bỏ đường gọi thẳng OpenAI/Anthropic bằng `requests`.
  - Giữ fallback heuristic khi AI tắt hoặc lỗi.
- Ghi usage vào `ai_core/services/usage.py` (nếu luồng hiện có hỗ trợ) để `AiRuntimeOverview` thấy được cả import CV.
- Serializer admin bơm choices cho `ai_job_generation_model` từ `settings.AI_JOB_GENERATION_MODEL_ALLOWLIST`.

---

## 4. Lộ trình (mỗi giai đoạn một PR, nhánh tạo từ `dev`)

Lưu ý: checkout hiện tại đang ở `feat/ai-training` và có thay đổi chưa commit ở `AdminNavigation.jsx`, `admin-dashboard.css` (việc khác của user). Làm trong worktree hoặc `git checkout -b <nhánh> dev`, không đụng các file đó. Kiểm tra PR còn mở trước khi push.

| GĐ | Nhánh | Phạm vi | File chính |
|---|---|---|---|
| **1. Hợp đồng & dọn key** | `feat/settings-contract` | §3.1, §3.2, §3.4 (endpoint + `upload_limits`), gỡ 46 key chết (trừ `ai_provider`/`ai_model`), đổi tên 2 key, 17 nhóm/section/help mới trong seed, đưa key blog + wysiwyg vào seed, kiểu `multiselect`/`number_list`/`duration`, option `monotonic`, audit ảnh, Django admin chỉ đọc, ADR-0026 "Hợp đồng cấu hình hệ thống" (gồm quy tắc env→DB) | `sitecontent/models/settings.py`, `seed_data/settings.json`, `selectors/settings.py`, `services/site_settings.py`, `management/commands/seed_sitecontent.py`, `blog/management/commands/seed_blog.py`, migration mới, `admin.py`, `api/views/settings.py` |
| **2. Giao diện mới** | `feat/settings-ui` | §2 toàn bộ (render theo metadata nên các key ở GĐ sau tự hiện ra), endpoint lịch sử `GET /api/admin/site/settings/<key>/history/`, nhãn audit `site_setting_update` | `pages/admin/settings/Settings.jsx`; `features/admin/system/manage-site-settings/` gồm `model/use-settings-form.js`, `ui/SettingRow.jsx` (gồm cả HelpPopover), `ui/SettingsGroupNav.jsx`, `ui/SettingsSaveBar.jsx`, `ui/SettingListEditor.jsx`, `ui/SettingPreviews.jsx`, `ui/SystemParametersPanel.jsx`, `ui/SettingHistoryDrawer.jsx`, `SettingField.jsx` (mở rộng) |
| **3. Cổng, hiển thị & pháp lý** | `feat/settings-portals` | Bảo trì (§3.3), gate đăng ký (3 đường + FE), công tắc và số lượng ở trang chủ, bug stats/partners, logo webp, SEO (og/title/description/favicon), màu thương hiệu, EmployerFooter, hotline/email hardcode, `useUploadLimits`. **Bộ Pháp lý & đồng ý (P0):** thay link topcv.vn bằng setting, version chính sách chuyển từ env sang DB, server tự gán version đồng ý của UV. **Bộ Tính năng:** knowledgebase, announcement surfaces | `Home.jsx`, `best-jobs-config.js`, `use-site-settings.js`, `StatsBand.jsx`, `LandingSections.jsx`, `EmployerFooter.jsx`, `HotlineConsultation.jsx`, `Employer*Layout.jsx`, `route-metadata.js`, `sitecontent/seo/views.py`, `pages/main/auth/Register.jsx`, `EmployerDataProtectionForm.jsx`, `privacy/services/consent.py`, `employers/services/dpa.py`, `candidates/api/serializers/profile.py`, `config/settings/components/{product,integrations}.py`, middleware mới |
| **4. Email, AI & job alert** | `feat/settings-email-ai` | Phạm vi `email_notifications_enabled`, `email_welcome_enabled`, branding email chung, §3.5, gỡ `ai_provider`/`ai_model`, `ai_enabled` làm công tắc chung, options rollout, default match/semantic. **Bộ Job alert**, **bộ AI chiến dịch** (dùng lại `ai_policy`) | `accounts/services/{mailing,welcome,email_verification,password_reset}.py`, `applications/services/automatic_rejection.py`, `employers/tasks/verification_notification.py`, `jobs/services/{alerts.py,digests/*}`, `ai_core/services/cv_import.py`, `jobs/domain/ai_policy.py`, `campaigns/services/content.py` |
| **5. Nghiệp vụ tuyển dụng & lưu trữ** | `feat/settings-recruiting` | **Bộ Xác thực & uy tín NTD** (công tắc duyệt xác thực, chế độ tick xanh có số liệu shadow, số lần bị từ chối tối đa, lý do báo cáo, độ dài mô tả công ty, bảng SLA kiểm duyệt duy nhất), **bộ Ứng tuyển & SLA** (qua `application_rules()`), **bộ Tin tuyển dụng** (posting-context, FE bỏ `FALLBACK_MAX_DEADLINE_DAYS`), **bộ CV chia sẻ** (hạn mặc định/tối đa, tắt chia sẻ thì vô hiệu link đang có), **bộ Lưu trữ dữ liệu** (task dọn đọc setting, có mức sàn env), **bộ Đăng nhập MXH theo cổng** + TTL lời mời admin | `employers/services/{profiles,trust_badge,companies}.py`, `employers/services/verification/cases.py`, `employers/selectors/{onboarding,admin_verification}.py`, `accounts/domain/recruiter_next_action.py`, `dashboard/selectors/admin_dashboard.py`, `applications/services/{applications,status,reminders,reviews,rules}.py`, `applications/models/talent_pool.py`, `jobs/services/posting/rules.py`, `jobs/services/lifecycle.py`, `cvs/services/sharing.py`, `accounts/services/{oauth,admin_invitations}.py`, `SocialLoginButtons.jsx`, `ApplicationInfoFields.jsx`, `company-form.js` |
| (cuối) Tài liệu | gộp vào từng PR | Viết lại `docs/05-huong-dan/cau-hinh-site-settings.md` (danh mục key, sửa ghi chú LocMemCache), gỡ biến env không còn dùng khỏi `.env.example`, cập nhật `docs/TIEN-DO-DU-AN.md` sau mỗi GĐ | |

Sau khi GĐ1 và GĐ2 đã gộp, các GĐ 3, 4, 5 sửa những file khác nhau nên có thể chạy song song. Mỗi GĐ chỉ thêm metadata vào seed, phần giao diện tự hiển thị.

Tuân thủ thêm:
- Ranh giới lớp trong `frontend/ARCHITECTURE.md` (`npm run check:architecture`).
- Mọi `dangerouslySetInnerHTML` (nếu có, vd preview) đi qua `@/shared/lib/sanitize-html`.
- CSS riêng của trang đặt ở file CSS lazy để không vượt ngân sách CSS khởi tạo 38,5 KiB.

---

## 5. Kế hoạch kiểm thử

| Lớp | Nội dung | Ở GĐ |
|---|---|---|
| Hợp đồng (pytest) | §3.2: không key chết, không key thiếu trong seed, metadata hợp lệ, `REMOVED_KEYS` đã xoá | 1 |
| Service/API (pytest) | Kiểm tra url/email/json-schema/max_length/select/color; upload ảnh có ghi audit; non-superuser bị 403; endpoint thông số không lộ secret; seed xoá được key cũ và giữ value; cache map được xoá sau commit | 1, 4 |
| Hành vi theo key (pytest, parametrize) | Mỗi key giữ lại có ít nhất một test "đổi giá trị → hành vi đổi": đăng ký đóng → 403 ở cả 3 đường; bảo trì → 503 ở API công khai, 200 ở `/api/admin`; tắt welcome → không có mail; tắt notifications → auto-reject/digest không gửi nhưng email đặt lại mật khẩu vẫn gửi; `email_from_name` xuất hiện ở mọi email; og:image upload có `/media/`; `ai_enabled=false` → import CV dùng heuristic, tạo JD bị từ chối | 2, 3 |
| FE unit (vitest) | Trang chủ ẩn/hiện từng khối và đúng số tin; `StatsBand`/partners render từ mảng; EmployerFooter tôn trọng công tắc; `MaintenanceScreen` và interceptor 503; trang đăng ký đóng; `useUploadLimits` | 2 |
| Bộ setting mới (pytest) | Mỗi key mới có test "đổi giá trị → hành vi đổi", ví dụ: `application_max_per_job=1` → lần nộp thứ 2 bị từ chối; `auto_reject_default_days` là default khi tạo tin; `job_max_deadline_days` vượt trần 90 bị từ chối; tắt `cv_share_enabled` → link đang có trả 404; tắt Google ở cổng NTD → OAuth bị từ chối và posting/auth-context không còn Google; bump `consent_policy_version` → banner hiện lại, không giảm được; server bỏ qua version đồng ý do client gửi; migration env→DB khởi tạo đúng giá trị env | 3, 4, 5 |
| FE unit trang admin | Tìm kiếm; dirty/hoàn tác từng ô và toàn trang; đặt về mặc định; ô phụ thuộc bị khoá; Modal xác nhận key nguy hiểm; lỗi hiện đúng ô và nhảy nhóm; editor danh sách; chặn rời trang; map `?group=` cũ; bảng thông số; Drawer lịch sử. Tránh `getByRole` chậm trên antd (memory) | 4 |
| E2E smoke (Playwright) | Admin đổi `site_name` → header công khai đổi; bật bảo trì → trang ứng viên hiện màn bảo trì, admin vẫn dùng được; tắt đăng ký UV → `/register` báo đóng | 2, 4 |
| QA thủ công | Màn 375px và 1440px; bàn phím/focus cho Popover "?"; DB local (qua `docker exec`) sau migration còn đúng 72 key; seed chạy lại idempotent; restart backend để áp migration (memory) | mỗi GĐ |

## 6. Kiểm tra trước mỗi PR

- **Backend** (qua docker exec hoặc venv; pytest cần `--ds=config.settings.test`):

  ```bash
  ruff check . && ruff format --check .
  ```

  ```bash
  lint-imports
  ```

  ```bash
  pytest --cov --cov-fail-under=84
  ```

- **Frontend:**

  ```bash
  npm run lint
  ```

  ```bash
  npm run check:architecture
  ```

  ```bash
  npm run test:coverage
  ```

  ```bash
  npm run build
  ```

  ```bash
  npm run test:e2e:smoke
  ```

  Khi chạy e2e smoke cục bộ, đặt `PLAYWRIGHT_PORT=5180` và `VITE_API_BASE_URL` theo memory. Trong lúc sửa thì chỉ chạy `npm run test:related <file>`.
- **DB local:** `pg_dump` trước khi chạy migration xoá key. Sau migration, đối chiếu DB với seed bằng script so sánh đã dùng khi rà soát.
- **Xác minh trên trình duyệt:** dùng preview của dev server: trang settings ở cả desktop và mobile, trang chủ khi tắt khối, màn bảo trì, trang NTD hiện số liệu. Gửi ảnh chụp làm bằng chứng.

## 7. Rủi ro & lưu ý

- Gỡ 48 key là thao tác phá dữ liệu: backup trước; reverse của migration là no-op.
- Middleware bảo trì có thể khoá luôn admin nếu allowlist sai → test bắt buộc cho `/api/admin` và đăng nhập admin. Có cách thoát khẩn cấp: Django admin hoặc `manage.py shell` tắt cờ, ghi trong docs.
- Đổi `cv_import` sang runtime provider làm thay đổi hành vi import CV: so sánh output trên vài CV mẫu trước và sau.
- Bật `employer_require_approved_verification` hoặc `employer_badge_policy_mode=enforce` có thể chặn hoặc gỡ tick xanh hàng loạt NTD → bắt buộc Modal số liệu và audit. Soi cả quyền đọc lẫn quyền ghi đè ở cuối chuỗi (memory: kiểm tra chuỗi enforcement).
- Tắt `cv_share_enabled` hoặc rút ngắn thời gian lưu trữ là thao tác phá dữ liệu khi task dọn chạy → "?" và Modal phải nói rõ "không hoàn tác".
- Các trang pháp lý nội bộ cho ứng viên (điều khoản, bảo mật) **chưa có nội dung**: setting chỉ trỏ URL. Nội dung văn bản cần user cung cấp, hoặc tạo bài Knowledgebase làm tạm.
- Đổi Group choices sẽ làm `?group=` cũ trong bookmark và test (`admin-destination.test.js` dùng `?tab=security`) phải map lại.
