# Cấu hình site settings (15 nhóm)

Hệ thống cài đặt schema-driven: mỗi setting là một row `SiteSetting` (app `sitecontent`) gồm `key`, `value` (JSON), và metadata (`group`, `value_type`, `options`, `order`, `is_public`) để trang quản trị **tự render form** — thêm setting mới chỉ cần thêm vào seed, không phải sửa UI.

## Cách hoạt động

- **Trang quản trị chính**: React `/admin/settings` (role admin) — tabs 15 nhóm, lưu theo nhóm. Django admin là fallback.
- **API**: xem `docs/04-api/tai-lieu-api.md` (mục `/api/site/`).
- **Frontend đọc cấu hình**: hook `useSiteSettings()` / `useSiteSetting(key, fallback)` — chỉ nhận key có `is_public=true` qua `/api/site/settings/` (cache 1h, tự invalidate khi admin lưu).
- **Kiểu `env`**: giá trị nhạy cảm (API key AI, mật khẩu SMTP, khoá thanh toán) KHÔNG lưu DB — chỉ khai báo `options.env_var`; UI hiển thị trạng thái "đã/chưa cấu hình qua .env". Muốn đổi giá trị: sửa file `.env` backend.
- **Seed**: `python manage.py seed_sitecontent` — idempotent, **chỉ đồng bộ metadata, không bao giờ ghi đè `value`** admin đã chỉnh. Muốn về mặc định: xoá row rồi seed lại.

## Quy ước thêm setting mới

1. Thêm tuple vào `SETTINGS` trong `backend/apps/sitecontent/management/commands/seed_sitecontent.py` đúng nhóm.
2. Chạy `python manage.py seed_sitecontent`.
3. Nếu frontend công khai cần dùng ngay cả khi API lỗi → thêm fallback vào `DEFAULT_SITE_SETTINGS` (`frontend/src/contexts/siteSettingsContext.js`).
4. Lưu ý: các setting nhóm payment/admin_roles... hiện là **khung cấu hình** — logic nghiệp vụ sẽ đọc chúng khi tính năng tương ứng được xây (Giai đoạn 6.1–6.3, 7).

## Biến môi trường liên quan (kiểu `env`)

| Setting key | Biến .env |
|---|---|
| `email_smtp_configured` | `EMAIL_HOST_PASSWORD` |
| `payment_vnpay_configured` | `VNPAY_HASH_SECRET` |
| `ai_api_key_configured` | `GEMINI_API_KEY` |

> Lưu ý cache: dùng LocMemCache (per-process) — đủ cho dev/đồ án single-worker. Nếu deploy nhiều worker cần chuyển Redis. Sửa value trực tiếp qua `manage.py shell` sẽ không invalidate cache của process runserver (sửa qua API/Django admin thì có).

## Danh sách keys theo nhóm

(Giá trị "Mặc định" là giá trị hiện tại trong DB lúc sinh tài liệu; ✓ Public = trả về qua API công khai.)

### Cài đặt chung (`general`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `site_name` | Tên site | text | "ProCV" | ✓ |
| `site_tagline` | Slogan | text | "Nền tảng việc làm & AI Career Coach" | ✓ |
| `brand_logo_url` | Logo đầy đủ | image | "/images/logo/logo_proCV_2000_600.png" | ✓ |
| `brand_logo_mark_url` | Logo biểu tượng | image | "/images/logo/logo_proCV_2000_2000.png" | ✓ |
| `brand_favicon_url` | Favicon | image | "/images/logo/logo_proCV_2000_2000.png" | ✓ |
| `brand_primary_color` | Màu thương hiệu chính | color | "#1FA65A" | ✓ |
| `maintenance_mode` | Chế độ bảo trì | boolean | false | ✓ |
| `maintenance_message` | Thông báo bảo trì | textarea | "Hệ thống đang bảo trì, vui lòng quay lại ... | ✓ |

### Giao diện trang chủ (`homepage`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `home_show_banner` | Hiện carousel banner | boolean | true | ✓ |
| `home_show_stats` | Hiện khối thống kê | boolean | true | ✓ |
| `home_show_categories` | Hiện ngành nghề nổi bật | boolean | true | ✓ |
| `home_show_featured_jobs` | Hiện việc làm nổi bật | boolean | true | ✓ |
| `home_featured_jobs_count` | Số việc làm nổi bật | number | 12 | ✓ |
| `home_show_cv_templates` | Hiện khối mẫu CV | boolean | true | ✓ |
| `home_show_popular_searches` | Hiện cụm link SEO | boolean | true | ✓ |

### SEO (`seo`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `seo_default_title` | Tiêu đề mặc định | text | "ProCV - Việc làm & Tạo CV cùng AI" | ✓ |
| `seo_default_description` | Mô tả mặc định | textarea | "ProCV - Nền tảng tìm việc làm, tạo CV chu... | ✓ |
| `seo_default_keywords` | Từ khoá mặc định | text | "việc làm, tuyển dụng, tạo cv, ai" | ✓ |
| `seo_og_image` | Ảnh OG mặc định | image | "" | ✓ |
| `seo_robots_index` | Cho phép index | boolean | true | ✓ |
| `seo_google_analytics_id` | Google Analytics ID | text | "" | ✓ |
| `seo_google_site_verification` | Google Search Console verification | text | "" | ✓ |

### Tài khoản ứng viên (`candidate`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `candidate_allow_registration` | Cho phép đăng ký ứng viên | boolean | true | ✓ |
| `candidate_require_email_verification` | Bắt buộc xác thực email | boolean | false | ✓ |
| `candidate_max_cvs` | Số CV tối đa mỗi người | number | 10 | ✓ |
| `candidate_max_applications_per_day` | Giới hạn ứng tuyển mỗi ngày | number | 20 |  |
| `candidate_allow_avatar_upload` | Cho phép upload avatar | boolean | true | ✓ |
| `candidate_profile_completion_required` | Bắt buộc hoàn thiện hồ sơ để ứng tuyển | boolean | false | ✓ |

### Nhà tuyển dụng (`employer`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `employer_allow_registration` | Cho phép đăng ký NTD | boolean | true | ✓ |
| `employer_require_approval` | Duyệt tài khoản NTD trước khi hoạt động | boolean | true |  |
| `employer_require_company_info` | Bắt buộc thông tin công ty | boolean | true |  |
| `employer_max_active_jobs` | Số tin đang đăng tối đa | number | 10 |  |
| `employer_free_job_quota` | Lượt đăng tin miễn phí trọn đời | number | 3 |  |
| `employer_allow_logo_upload` | Cho phép upload logo công ty | boolean | true | ✓ |

### Việc làm (`jobs`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `job_expiry_days` | Số ngày hết hạn tin | number | 30 |  |
| `jobs_per_page` | Số tin mỗi trang | number | 20 | ✓ |
| `job_auto_approve` | Tự động duyệt tin (legacy, không còn dùng) | boolean | false |  |
| `job_allow_salary_negotiable` | Cho phép lương thoả thuận | boolean | true | ✓ |
| `job_require_salary_range` | Bắt buộc khoảng lương | boolean | false |  |
| `job_allow_urgent_tag` | Cho phép tag tuyển gấp | boolean | true | ✓ |

### Hồ sơ / CV (`cv`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `cv_allow_pdf_export` | Cho phép xuất PDF | boolean | true | ✓ |
| `cv_default_template` | Mẫu CV mặc định | select | "modern" | ✓ |
| `cv_allow_public_share` | Cho phép chia sẻ CV công khai | boolean | true | ✓ |
| `cv_watermark_enabled` | Đóng watermark bản miễn phí | boolean | false | ✓ |
| `cv_ai_review_free_limit` | Lượt AI review miễn phí | number | 3 |  |

### Email & thông báo (`email`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `email_notifications_enabled` | Bật gửi email | boolean | true |  |
| `email_from_name` | Tên người gửi | text | "ProCV" |  |
| `email_smtp_configured` | Mật khẩu SMTP | env | env: `EMAIL_HOST_PASSWORD` |  |
| `email_notify_new_application` | Báo NTD khi có ứng tuyển mới | boolean | true |  |
| `email_notify_job_approved` | Báo NTD khi tin được duyệt | boolean | true |  |
| `email_welcome_enabled` | Email chào mừng khi đăng ký | boolean | true |  |
| `email_footer_text` | Chân email | textarea | "ProCV - Nền tảng việc làm & AI Career Coach" |  |

### Thanh toán / gói dịch vụ (`payment`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `payment_enabled` | Bật thanh toán/gói dịch vụ | boolean | false | ✓ |
| `payment_currency` | Tiền tệ | select | "VND" | ✓ |
| `payment_vnpay_enabled` | Bật VNPay | boolean | false |  |
| `payment_vnpay_configured` | Khoá VNPay | env | env: `VNPAY_HASH_SECRET` |  |
| `payment_momo_enabled` | Bật MoMo | boolean | false |  |
| `payment_bank_transfer_info` | Thông tin chuyển khoản | textarea | "" | ✓ |
| `payment_trial_days` | Số ngày dùng thử | number | 7 |  |

### Bảo mật (`security`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `security_min_password_length` | Độ dài mật khẩu tối thiểu | number | 8 | ✓ |
| `security_require_strong_password` | Bắt buộc mật khẩu mạnh | boolean | false | ✓ |
| `security_max_login_attempts` | Số lần đăng nhập sai tối đa | number | 5 |  |
| `security_lockout_minutes` | Số phút khoá tạm | number | 15 |  |
| `security_session_timeout_minutes` | Số phút hết hạn phiên | number | 60 |  |
| `security_recaptcha_enabled` | Bật reCAPTCHA | boolean | false | ✓ |
| `security_recaptcha_site_key` | reCAPTCHA site key | text | "" | ✓ |

### Upload file / media (`upload`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `upload_max_image_size_mb` | Ảnh tối đa (MB) | number | 5 | ✓ |
| `upload_avatar_max_size_mb` | Avatar tối đa (MB) | number | 2 | ✓ |
| `upload_max_cv_size_mb` | File CV tối đa (MB) | number | 10 | ✓ |
| `upload_allowed_image_types` | Định dạng ảnh cho phép | json | ["jpg", "png", "webp", "gif"] | ✓ |
| `upload_allowed_cv_types` | Định dạng CV cho phép | json | ["pdf", "doc", "docx"] | ✓ |

### Footer (`footer`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `footer_logo_url` | Logo riêng cho footer | image | "" (dùng logo chung) | ✓ |
| `footer_description` | Mô tả ngắn ở footer | textarea | "ProCV - Nền tảng việc làm và phát triển s... | ✓ |
| `footer_copyright` | Dòng bản quyền | text | "© {year} {site_name}. All rights reserved." | ✓ |
| `footer_show_link_groups` | Hiện menu điều hướng | boolean | true | ✓ |
| `footer_show_contact` | Hiện thông tin liên hệ | boolean | true | ✓ |
| `footer_show_apps` | Hiện liên kết tải ứng dụng | boolean | true | ✓ |
| `footer_show_socials` | Hiện mạng xã hội | boolean | true | ✓ |
| `footer_company_name` | Tên pháp lý doanh nghiệp | text | "" | ✓ |
| `footer_business_license` | Thông tin giấy phép / mã số thuế | textarea | "" | ✓ |
| `footer_app_store_url` | Link tải trên App Store | url | "" | ✓ |
| `footer_google_play_url` | Link tải trên Google Play | url | "" | ✓ |
| `footer_qr_code_url` | Mã QR | image | "" | ✓ |
| `footer_qr_label` | Nhãn dưới mã QR | text | "" | ✓ |
| `footer_facebook_url` | Facebook | url | "" | ✓ |
| `footer_linkedin_url` | LinkedIn | url | "" | ✓ |
| `footer_youtube_url` | YouTube | url | "" | ✓ |
| `footer_tiktok_url` | TikTok | url | "" | ✓ |

Menu cột của footer quản lý tại **Django Admin → Cụm link**, chọn placement
`Menu điều hướng footer`. Các mục URL rỗng vẫn hiển thị ở trạng thái đang cập nhật;
URL bắt đầu bằng `/` được điều hướng nội bộ, URL đầy đủ mở ở tab mới.

### Liên hệ / hỗ trợ (`contact`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `hotline` | Hotline hỗ trợ | text | "1900 1234" | ✓ |
| `support_email` | Email hỗ trợ | email | "support@proCV.vn" | ✓ |
| `contact_address` | Địa chỉ | textarea | "55 610B Hà An, xã Gò Nổi, thành phố Đà Nẵng" | ✓ |
| `contact_working_hours` | Giờ làm việc | text | "8:00 - 17:30, Thứ 2 - Thứ 6" | ✓ |
| `contact_zalo_url` | Zalo | url | "" | ✓ |
| `contact_messenger_url` | Facebook Messenger | url | "" | ✓ |
| `contact_map_embed_url` | Google Maps embed | url | "" | ✓ |

### Phân quyền admin (`admin_roles`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `admin_roles_enabled` | Bật phân quyền chi tiết | boolean | false |  |
| `admin_allow_staff_creation` | Cho phép tạo tài khoản quản trị phụ | boolean | false |  |
| `admin_default_role` | Vai trò mặc định | select | "moderator" |  |
| `admin_action_log_enabled` | Ghi log thao tác admin | boolean | false |  |

### Cài đặt AI (`ai`)

| Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|
| `ai_enabled` | Bật tính năng AI | boolean | true | ✓ |
| `ai_provider` | Nhà cung cấp | select | "gemini" |  |
| `ai_model` | Model | text | "gemini-2.0-flash" |  |
| `ai_api_key_configured` | API key | env | env: `GEMINI_API_KEY` |  |
| `ai_cv_review_enabled` | AI chấm/review CV | boolean | true | ✓ |
| `ai_job_match_enabled` | AI gợi ý việc phù hợp | boolean | true | ✓ |
| `ai_interview_enabled` | AI luyện phỏng vấn | boolean | false | ✓ |
| `ai_daily_request_limit` | Giới hạn request AI/ngày/người | number | 50 |  |
