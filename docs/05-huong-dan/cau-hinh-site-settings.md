# Cấu hình hệ thống (SiteSetting)

Trang quản trị `/quan-tri/cau-hinh` (chỉ superuser) đọc và ghi các row `SiteSetting`
của app `sitecontent`. Hợp đồng của kho cấu hình nằm ở
[ADR-0026](../adr/adr-0026-settings-contract.md). Kế hoạch làm lại trang nằm ở
[ke-hoach-cau-hinh-he-thong.md](../archive/ke-hoach/ke-hoach-cau-hinh-he-thong.md).

## Nguyên tắc

- **Mỗi key phải có code đọc thật.** Test
  `apps/sitecontent/tests/test_settings_contract.py` quét mã nguồn backend và frontend.
  CI đỏ nếu seed có key mà không code nào đọc, hoặc code đọc một key không có trong seed.
  Key đang chờ nối vào code được đánh dấu `options.pending`, và mô tả của nó bắt đầu
  bằng "Chưa có hiệu lực".
- **Một nguồn mặc định.** `backend/apps/sitecontent/seed_data/settings.json` là nguồn
  duy nhất cho:
  - nhãn, nhóm, section, mô tả;
  - nội dung nút "?" (`help`);
  - kiểu, ràng buộc (`options`) và giá trị mặc định.

  Khi row chưa có trong DB, `get_setting()` trả giá trị mặc định của seed.
- **Văn bản pháp lý có phiên bản thì phiên bản nằm ở `.env`/mã nguồn.** Phiên bản
  chính sách cookie, điều khoản NTD, DPA (kèm mã băm), và phiên bản đồng ý của ứng
  viên đổi cùng lần triển khai sửa văn bản, nên không chỉnh qua trang cấu hình. Đường
  dẫn tới trang văn bản thì là setting (nhóm Pháp lý & đồng ý).
- **Email:** mọi email lấy tên người gửi, địa chỉ trả lời và màu chính từ cấu hình
  (`email_sender()`, `email_brand_color()`). Công tắc `email_notifications_enabled` chỉ
  chặn email nghiệp vụ, không chặn email bảo mật/tài khoản; email bị bỏ qua lúc tắt
  không được gửi bù.
- **AI:** `ai_enabled` là công tắc chung cho AI sinh nội dung (import CV, viết tin,
  viết bài chiến dịch), luôn nằm dưới `AI_RUNTIME_ENABLED`. Import CV dùng chung runtime
  với tạo tin (model `AI_CV_IMPORT_MODEL`); AI không khả dụng thì đọc CV bằng quy tắc.
  Danh sách model tạo tin lấy từ `AI_JOB_GENERATION_MODEL_ALLOWLIST`
  (`SiteSetting.SERVER_CHOICES`).
- **Công tắc tính năng chỉ thu hẹp được máy chủ:** Trung tâm trợ giúp và nơi hiện
  thông báo đa cổng có hiệu lực = cờ `.env` VÀ công tắc admin.
- **Nghiệp vụ tuyển dụng chỉnh trong khung an toàn:**
  - Giá trị lạ trong DB bị kẹp vào khoảng cho phép thay vì làm hỏng luồng
    (`apps/applications/services/policy.py`, `apps/jobs/services/policy.py`).
  - Hạn nhận hồ sơ và thời gian hiển thị tin không vượt trần 90 ngày trong mã nguồn
    (`apps.jobs.domain.MAX_LISTING_DAYS`).
  - Thời gian lưu trữ chỉ rút ngắn được, có mức sàn (`retention_days()`).
  - Bắt buộc duyệt xác thực NTD = cờ `.env` HOẶC công tắc admin: admin chỉ siết thêm.
  - Đăng nhập mạng xã hội: admin chỉ tắt bớt nhà cung cấp mà cổng đó hỗ trợ.
  - Tắt chia sẻ CV vô hiệu mọi link đang có; link cũ không đặt hạn cũng hết hiệu lực
    khi quá hạn tối đa hiện hành.
- **Secret và giới hạn hạ tầng nằm ở `.env`.** Mật khẩu, timeout phiên, rate limit, dung
  lượng upload... không phải SiteSetting. Trang quản trị hiển thị giá trị đang áp dụng
  ở bảng **Thông số hệ thống** (`GET /api/admin/site/system-parameters/`). Bảng này chỉ
  đọc và không bao giờ trả secret.

## Cách hoạt động

- **Đọc ở backend:** dùng `apps.sitecontent.selectors`: `get_setting`, `get_string_setting`,
  `get_int_setting`, `get_bool_setting`, `get_settings_map`, `email_branding`.
  - Toàn bộ map key → value được cache trong Redis và bị xoá sau mỗi commit có đổi
    `SiteSetting`.
  - Code chạy trong transaction đọc thẳng DB, để thấy được thay đổi chưa commit của
    chính nó.
- **Đọc ở frontend:** `useSiteSettings()` / `useSiteSetting(key, fallback)` chỉ nhận các
  key có `is_public=true`, qua `/api/public/site/settings/`. Kết quả cache 1 giờ và bị
  xoá khi admin lưu.
- **Ghi:** chỉ qua `PATCH /api/admin/site/settings/` (service `update_site_settings`).
  - Kiểm tra kiểu và `options`: min/max/integer, max_length, URL http(s) hoặc đường dẫn
    `/...`, email, `schema` cho JSON.
  - Ghi audit `site_setting_update`, kể cả khi upload ảnh.
  - Django admin chỉ để tra cứu, không sửa được.
- **Seed:** `python manage.py seed_sitecontent` chạy lại nhiều lần vẫn cho cùng kết quả.
  Lệnh đồng bộ metadata nhưng không ghi đè `value` admin đã chỉnh. Ngoại lệ duy nhất là
  đường dẫn logo cũ đã bị xoá khỏi `frontend/public`.

## Trang quản trị

- **Thanh bên:** chia 3 khu (Giao diện & nội dung, Nghiệp vụ tuyển dụng, Tuân thủ &
  vận hành). Trên mobile, thanh bên thành dải chip cuộn ngang. Link `?group=` của nhóm
  cũ (`general`, `security`...) vẫn mở đúng nhóm mới.
- **Tìm kiếm:** lọc theo nhãn, mô tả, section và key trên mọi nhóm.
- **Mỗi dòng cấu hình:**
  - nút **"?"** hiện `help`, nơi áp dụng (`options.applies_to`), giá trị mặc định (có
    nút "Đặt về mặc định"), trạng thái công khai, key, thời điểm cập nhật cuối và
    lịch sử thay đổi;
  - nút hoàn tác riêng cho dòng;
  - ô phụ thuộc (`options.depends_on`) bị khoá khi công tắc cha đang tắt;
  - key `pending` có thẻ "Chưa có hiệu lực".
- **Lưu một lần cho mọi nhóm.**
  - Thay đổi nguy hiểm (`options.risky`: `on` = bật mới nguy hiểm, `off` = tắt mới
    nguy hiểm) phải xác nhận trước khi lưu, kèm danh sách "trước → sau".
  - Lỗi hiện ngay dưới từng ô, và trang tự nhảy tới ô lỗi đầu tiên.
  - Rời trang khi còn thay đổi chưa lưu sẽ bị trình duyệt hỏi lại.
- **Editor theo `options.schema`:** danh sách object (số liệu, đối tác) thay cho ô
  JSON; danh sách chuỗi (allowlist) dùng ô nhập dạng thẻ. Ô có `max_length` hiện bộ
  đếm ký tự.
- **Xem trước:**
  - Thương hiệu: logo, nút màu chính, độ tương phản WCAG của chữ trắng.
  - SEO: kết quả Google.
  - Chân trang: dòng bản quyền.
- **Thông tin thêm theo nhóm:** nhóm AI có tổng quan AI runtime; nhóm Vận hành có
  bảng **Thông số hệ thống** chỉ đọc.

## Thêm, đổi, gỡ một key

1. **Thêm key:**
   - Viết code đọc key (qua selector hoặc `useSiteSetting`) trong cùng PR.
   - Thêm object vào `settings.json`, đặt cạnh các key cùng nhóm (vị trí quyết định
     `order`).
   - Điền `section`, `description`, `help` và `options` phù hợp.
   - Key mới để `is_public: false`, trừ khi frontend công khai cần đọc.
2. **Đổi metadata:** sửa `settings.json` rồi chạy seed.
3. **Gỡ key:**
   - Xoá consumer và xoá key khỏi `settings.json`.
   - Thêm data migration xoá row.
   - Đưa key vào danh sách gỡ của migration đó. Test hợp đồng sẽ chặn key quay lại.
4. **Chuyển một giá trị từ `.env` sang SiteSetting:** data migration khởi tạo `value`
   bằng giá trị env đang áp dụng. Nếu có trần an toàn thì env/code vẫn giữ trần đó
   (mẫu `apps/jobs/domain/ai_policy.py`).

## Danh mục key

Cột "Mặc định" là giá trị trong seed. Dấu ✓ nghĩa là key được trả qua API công khai.





### Thương hiệu (`brand`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Nhận diện | `site_name` | Tên site | text | "ProCV" | ✓ |
| Nhận diện | `site_tagline` | Slogan | text | "Nền tảng việc làm & AI Career Coach" | ✓ |
| Logo & biểu tượng | `brand_logo_url` | Logo đầy đủ | image | "/images/logo/logo-full.webp" | ✓ |
| Logo & biểu tượng | `brand_logo_mark_url` | Logo biểu tượng | image | "/images/logo/logo-mark.webp" | ✓ |
| Logo & biểu tượng | `brand_favicon_url` | Favicon | image | "/favicon-32.png" | ✓ |
| Màu sắc | `brand_primary_color` | Màu thương hiệu chính | color | "#00b14f" | ✓ |

### Banner quảng bá (trang quản trị `/quan-tri/banner`)

Banner không phải site setting; công tắc `home_show_banner` chỉ ẩn/hiện cả carousel.
Nội dung nhập ở trang **Banner quảng bá**, chạy xoay vòng theo thứ tự, mỗi banner có
lịch bắt đầu/kết thúc tùy chọn. Khi không có banner nào đang chạy, trang chủ hiện slide
số liệu dự phòng.

| Loại slide | Nội dung | Đích khi bấm |
|---|---|---|
| Ảnh + link (`image`) | Ảnh thiết kế sẵn (nút nằm trong ảnh), ví dụ banner tuyển dụng thương hiệu, ngày hội việc làm | Link nhập tay; bỏ trống thì mở trang công ty gắn kèm |
| Gợi ý việc làm AI (`ai`) | Khách: nội dung admin nhập (vd "Tải CV lên – AI gợi ý việc làm hợp với bạn"). Ứng viên: "Có N việc làm hợp với CV của bạn" hoặc lời mời thiết lập tiêu chí | `/tai-cv-len` hoặc `/tai-khoan/viec-lam-phu-hop` |
| Nhà tuyển dụng nổi bật (`company`) | Ảnh bìa, logo, tên, số tin đang tuyển, trụ sở, ngành lấy từ dữ liệu thật | Tab việc làm và trang công ty |
| Bố cục chữ (`promo`) | Nhãn nhỏ, tiêu đề, mô tả, nút, ảnh minh họa tùy chọn (sự kiện, công cụ CV) | Link nút |

Quy tắc nội dung:

- Nên có 3–5 slide; slide đầu tiên tải ảnh ngay, các slide sau tải lười.
- Tiêu đề dưới 40 ký tự, mô tả dưới 90 ký tự, mỗi slide một nút bắt đầu bằng động từ.
- Ảnh `image` khung 8:3: khuyến nghị 1600×600, tối thiểu 960×360, tối đa 1,5 MB. Sau khi
  chọn ảnh, trang quản trị mở hộp cắt khóa tỉ lệ để kéo và phóng to căn đúng khung (xuất
  WebP, không phóng to quá ảnh gốc). Điện thoại hiển thị khung 2:1 nên cắt bớt hai bên:
  đặt chữ và nút trong khoảng 70% giữa ảnh.
- Ảnh minh họa `promo` khung 4:3, cũng cắt trước khi tải; chỉ hiện từ máy tính bảng.
- Slide công ty nên chọn công ty có ảnh bìa và đang có tin; công ty bị giữ nội dung tự ẩn.
- Tông màu (slide chữ, AI, công ty không có ảnh bìa và banner ở trang việc làm/cẩm nang):
  8 gradient `green`, `blue`, `orange`, `violet`, `teal`, `rose`, `aurora`, `midnight`, khai
  báo ở `entities/content/banner` bằng inline style nên không làm tăng CSS khởi tạo.
- Link trong trang bắt đầu bằng `/`; link ngoài phải là `https://` và mở tab mới.

### Trang chủ & điều hướng (`homepage`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Khối trang chủ | `home_show_banner` | Hiện carousel banner | boolean | true | ✓ |
| Khối trang chủ | `home_show_stats` | Hiện khối thống kê thị trường | boolean | true | ✓ |
| Khối trang chủ | `home_show_categories` | Hiện menu ngành nghề | boolean | true | ✓ |
| Khối trang chủ | `home_show_featured_jobs` | Hiện khối Việc làm nổi bật | boolean | true | ✓ |
| Khối trang chủ | `home_featured_jobs_count` | Số tin ở khối Việc làm nổi bật | number | 12 | ✓ |
| Khối trang chủ | `home_show_cv_templates` | Hiện khối mẫu CV | boolean | true | ✓ |
| Điều hướng | `home_show_popular_searches` | Hiện khối Tra cứu phổ biến | boolean | true | ✓ |

### SEO & chia sẻ (`seo`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Mặc định | `seo_default_title` | Tiêu đề trang chủ | text | "ProCV - Việc làm & Tạo CV cùng AI" | ✓ |
| Mặc định | `seo_default_description` | Mô tả mặc định | textarea | "ProCV - Nền tảng tìm việc làm, tạo C… | ✓ |
| Chia sẻ mạng xã hội | `seo_og_image` | Ảnh OG mặc định | image | "" | ✓ |
| Lập chỉ mục | `seo_robots_index` | Cho phép index | boolean | true | ✓ |
| Lập chỉ mục | `seo_google_site_verification` | Google Search Console verification | text | "" | ✓ |

### Liên hệ & mạng xã hội (`contact`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Kênh hỗ trợ | `hotline` | Hotline hỗ trợ | text | "1900 1234" | ✓ |
| Kênh hỗ trợ | `support_email` | Email hỗ trợ | email | "support@procv.site" | ✓ |
| Kênh hỗ trợ | `contact_address` | Địa chỉ | textarea | "" | ✓ |
| Kênh hỗ trợ | `contact_working_hours` | Giờ làm việc | text | "8:00 - 17:30, Thứ 2 - Thứ 6" | ✓ |
| Kênh hỗ trợ | `contact_zalo_url` | Zalo | url | "" | ✓ |
| Kênh hỗ trợ | `contact_messenger_url` | Facebook Messenger | url | "" | ✓ |
| Kênh hỗ trợ | `contact_map_embed_url` | Google Maps embed | url | "" | ✓ |
| Hotline nhà tuyển dụng | `employer_hotline_north` | Hotline tư vấn miền Bắc | text | "" | ✓ |
| Hotline nhà tuyển dụng | `employer_hotline_south` | Hotline tư vấn miền Nam | text | "" | ✓ |
| Mạng xã hội | `footer_facebook_url` | Facebook | url | "" | ✓ |
| Mạng xã hội | `footer_linkedin_url` | LinkedIn | url | "" | ✓ |
| Mạng xã hội | `footer_youtube_url` | YouTube | url | "" | ✓ |
| Mạng xã hội | `footer_tiktok_url` | TikTok | url | "" | ✓ |

### Chân trang (`footer`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Nội dung | `footer_logo_url` | Logo riêng cho footer | image | "" | ✓ |
| Nội dung | `footer_description` | Mô tả ngắn ở footer | textarea | "ProCV - Nền tảng việc làm và phát tr… | ✓ |
| Nội dung | `footer_copyright` | Dòng bản quyền | text | "© {year} {site_name}. All rights res… | ✓ |
| Pháp lý doanh nghiệp | `footer_company_name` | Tên pháp lý doanh nghiệp | text | "" | ✓ |
| Pháp lý doanh nghiệp | `footer_business_license` | Thông tin giấy phép / mã số thuế | textarea | "" | ✓ |
| Ứng dụng di động | `footer_app_store_url` | Link tải trên App Store | url | "" | ✓ |
| Ứng dụng di động | `footer_google_play_url` | Link tải trên Google Play | url | "" | ✓ |
| Ứng dụng di động | `footer_qr_code_url` | Mã QR | image | "" | ✓ |
| Ứng dụng di động | `footer_qr_label` | Nhãn dưới mã QR | text | "" | ✓ |
| Hiển thị | `footer_show_link_groups` | Hiện menu điều hướng | boolean | true | ✓ |
| Hiển thị | `footer_show_contact` | Hiện thông tin liên hệ | boolean | true | ✓ |
| Hiển thị | `footer_show_apps` | Hiện liên kết tải ứng dụng | boolean | true | ✓ |
| Hiển thị | `footer_show_socials` | Hiện mạng xã hội | boolean | true | ✓ |

### Cẩm nang (`blog`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Trang cẩm nang | `blog_page_title` | Tiêu đề trang Cẩm nang | text | "Cẩm nang nghề nghiệp" | ✓ |
| Trang cẩm nang | `blog_support_docs_title` | Tiêu đề khối Tài liệu hỗ trợ | text | "Tài liệu hỗ trợ tìm việc" | ✓ |

### Tài khoản & đăng nhập (`accounts`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Đăng ký | `candidate_allow_registration` | Cho phép đăng ký ứng viên | boolean | true | ✓ |
| Đăng ký | `employer_allow_registration` | Cho phép đăng ký nhà tuyển dụng | boolean | true | ✓ |
| Đăng nhập mạng xã hội | `oauth_providers_candidate` | Đăng nhập mạng xã hội (ứng viên) | multiselect | ["google", "facebook", "linkedin"] | ✓ |
| Đăng nhập mạng xã hội | `oauth_providers_employer` | Đăng nhập mạng xã hội (nhà tuyển dụng) | multiselect | ["google"] | ✓ |
| Quản trị viên | `admin_invitation_ttl_hours` | Hạn lời mời quản trị viên (giờ) | number | 72 |  |

### Nhà tuyển dụng & xác thực (`employer`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Hạn mức đăng tin | `employer_free_job_quota` | Lượt đăng tin khi chưa đạt Cấp 3 | number | 3 |  |
| Hạn mức đăng tin | `employer_verified_level_three_job_quota` | Lượt đăng tin sau xác thực Cấp 3 | number | 100 |  |
| Uy tín | `employer_badge_min_account_months` | Tuổi tài khoản tối thiểu cho dấu tick (tháng) | number | 6 |  |
| Trang giới thiệu nhà tuyển dụng | `employer_stats` | Số liệu trang NTD | json | [{"value": "60.000+", "label_vi": "vi… | ✓ |
| Trang giới thiệu nhà tuyển dụng | `employer_partners` | Khách hàng tiêu biểu (trang NTD) | json | [] | ✓ |
| Xác thực & uy tín | `employer_require_approved_verification` | Checklist: tính xác thực theo hồ sơ đã duyệt | boolean | false |  |
| Xác thực & uy tín | `employer_badge_policy_mode` | Chế độ dấu tick xác thực | select | "" |  |
| Xác thực & uy tín | `employer_verification_max_rejections` | Số lần từ chối tối đa | number | 3 |  |
| Xác thực & uy tín | `employer_trust_report_reasons` | Lý do báo cáo làm mất dấu tick | multiselect | ["fake_company", "scam", "wrong_info"] |  |
| Xác thực & uy tín | `company_description_min_length` | Độ dài tối thiểu mô tả công ty | number | 500 | ✓ |
| Hạn xử lý của quản trị viên | `moderation_sla_hours` | Hạn xử lý hồ sơ xác thực (giờ) | number | 72 |  |
| Hạn xử lý của quản trị viên | `report_sla_hours` | Hạn xử lý báo cáo vi phạm (giờ) | number | 48 |  |

### Tin tuyển dụng (`jobs`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Hạn tin | `job_default_deadline_days` | Hạn nhận hồ sơ gợi ý (ngày) | number | 30 |  |
| Hạn tin | `job_max_deadline_days` | Hạn nhận hồ sơ tối đa (ngày) | number | 90 |  |
| Hạn tin | `job_max_public_lifetime_days` | Thời gian hiển thị tối đa (ngày) | number | 90 |  |
| Hạn tin | `job_renewal_grace_days` | Thời gian cho gia hạn tin hết hạn (ngày) | number | 30 |  |
| Hạn tin | `job_closing_soon_days` | Nhãn "Sắp hết hạn" (ngày, 1–30) | number | 7 |  |
| Thống kê | `job_view_dedup_hours` | Gộp lượt xem trùng (giờ) | number | 24 |  |
| Việc làm gần bạn | `nearby_jobs_default_radius_km` | Bán kính mặc định (km) | number | 10 | ✓ |
| Việc làm gần bạn | `nearby_jobs_max_radius_km` | Bán kính tối đa (km) | number | 50 | ✓ |
| Việc làm gần bạn | `nearby_jobs_max_markers` | Số điểm tối đa trên bản đồ | number | 300 |  |
| Bản đồ | `map_style_url` | Style bản đồ (MapLibre) | url | "" (dev: OpenFreeMap) | ✓ |
| Bản đồ | `map_attribution` | Ghi công bản đồ | text | © VIETMAP | ✓ |

`map_style_url` dùng **key tile công khai** của VietMap (giới hạn domain trong console),
khác key geocoding bí mật `GEOCODING_API_KEY` ở `backend/.env` (ADR-0029).

### Ứng tuyển & SLA (`applications`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Nộp hồ sơ | `application_max_per_job` | Số lần nộp tối đa mỗi tin | number | 3 | ✓ |
| Nộp hồ sơ | `application_reapply_cooldown_minutes` | Thời gian chờ giữa hai lần nộp (phút) | number | 5 |  |
| Tự động từ chối | `auto_reject_default_days` | Thời hạn tự từ chối gợi ý | select | 21 |  |
| Tự động từ chối | `auto_reject_min_notice_days` | Nhắc trước khi tự từ chối (ngày) | number | 3 |  |
| Tự động từ chối | `auto_reject_email_grace_days` | Chờ trước khi báo ứng viên (ngày) | number | 3 |  |
| Thông báo cho ứng viên | `candidate_status_notify_delay_seconds` | Thời gian hoàn tác quyết định (giây) | number | 15 |  |
| Nhắc nhà tuyển dụng | `recruiter_reminder_days` | Mốc nhắc nhà tuyển dụng (ngày) | json | [3, 7] |  |
| Ứng viên nhắc nhà tuyển dụng | `candidate_reminder_after_days` | Ứng viên được nhắc sau (ngày) | number | 3 | ✓ |
| Ứng viên nhắc nhà tuyển dụng | `candidate_reminder_interval_days` | Khoảng cách giữa hai lần nhắc (ngày) | number | 3 | ✓ |
| Ứng viên nhắc nhà tuyển dụng | `candidate_reminder_max` | Số lần nhắc tối đa | number | 2 | ✓ |
| Chia sẻ hồ sơ ứng tuyển | `review_link_max_days` | Hạn link xem hồ sơ cho đồng nghiệp (ngày) | number | 30 |  |
| Huy hiệu Sấm Chớp | `flash_badge_enabled` | Bật Huy hiệu Sấm Chớp | boolean | true | ✓ |
| Huy hiệu Sấm Chớp | `flash_badge_window_days` | Cửa sổ xét (ngày) | number | 30 | ✓ |
| Huy hiệu Sấm Chớp | `flash_badge_response_hours` | Hạn phản hồi (giờ) | number | 72 | ✓ |
| Huy hiệu Sấm Chớp | `flash_badge_min_applications` | Số hồ sơ tối thiểu | number | 5 | ✓ |
| Huy hiệu Sấm Chớp | `flash_badge_min_response_rate` | Tỷ lệ phản hồi đúng hạn tối thiểu (%) | number | 80 | ✓ |
| Huy hiệu Sấm Chớp | `flash_badge_active_days` | Hoạt động gần đây (ngày) | number | 7 |  |

### Hồ sơ & CV (`cv`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Hồ sơ | `candidate_max_cvs` | Số CV tối đa mỗi ứng viên | number | 6 | ✓ |
| Tính năng thử nghiệm | `cv_builder_wysiwyg_enabled` | Trình chỉnh sửa CV trực quan (WYSIWYG) | boolean | true | ✓ |
| Chia sẻ CV | `cv_share_enabled` | Cho phép chia sẻ CV bằng link | boolean | true |  |
| Chia sẻ CV | `cv_share_default_days` | Hạn link chia sẻ mặc định (ngày) | number | 30 |  |
| Chia sẻ CV | `cv_share_max_days` | Hạn link chia sẻ tối đa (ngày) | number | 180 |  |

### Email & thông báo (`email`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Chung | `email_notifications_enabled` | Bật gửi email | boolean | true |  |
| Loại email | `email_notify_new_application` | Báo NTD khi có ứng tuyển mới | boolean | true |  |
| Loại email | `email_welcome_enabled` | Email chào mừng khi đăng ký | boolean | true |  |
| Nhận diện email | `email_from_name` | Tên người gửi | text | "ProCV" |  |
| Nhận diện email | `email_footer_text` | Chân email | textarea | "ProCV - Nền tảng việc làm & AI Caree… |  |
| Gợi ý việc làm qua email | `job_alert_enabled` | Bật email gợi ý việc làm | boolean | true |  |
| Gợi ý việc làm qua email | `job_alert_delivery_hour` | Giờ gửi email gợi ý việc làm | number | 8 |  |
| Gợi ý việc làm qua email | `job_alert_max_jobs` | Số việc làm tối đa mỗi email | number | 10 |  |
| Gợi ý việc làm qua email | `job_alert_limit_per_candidate` | Số thông báo việc làm mỗi ứng viên | number | 5 | ✓ |
| Nhắc nhà tuyển dụng | `recruiter_reminders_enabled` | Nhắc nhà tuyển dụng hồ sơ chưa phản hồi | boolean | true |  |

### AI (`ai`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Công tắc chung | `ai_enabled` | Bật AI sinh nội dung | boolean | true | ✓ |
| Đối sánh CV–JD (mô hình nội bộ) | `ai_job_match_enabled` | AI xem độ phù hợp CV với tin | boolean | true | ✓ |
| Đối sánh CV–JD (mô hình nội bộ) | `ai_job_recommendation_semantic_enabled` | AI gợi ý việc làm theo nội dung CV | boolean | true |  |
| Đối sánh CV–JD (mô hình nội bộ) | `ai_data_policy_url` | Chính sách xử lý dữ liệu bằng AI | url | "" | ✓ |
| AI viết tin tuyển dụng | `ai_job_generation_enabled` | Bật AI tạo tin tuyển dụng | boolean | false | ✓ |
| AI viết tin tuyển dụng | `ai_job_generation_model` | Model tạo tin tuyển dụng | select | "gemini-3.5-flash-lite" |  |
| AI viết tin tuyển dụng | `ai_job_generation_model_allowlist` | Model allowlist cho tạo tin | json | ["gemini-3.5-flash-lite"] |  |
| AI viết tin tuyển dụng | `ai_job_generation_daily_limit` | Lượt tạo tin/ngày/nhà tuyển dụng | number | 10 |  |
| AI viết tin tuyển dụng | `ai_job_generation_rollout_percent` | Tỷ lệ rollout tạo tin AI (%) | number | 0 |  |
| AI viết tin tuyển dụng | `ai_job_generation_company_allowlist` | Công ty allowlist tạo tin AI | json | [] |  |
| AI viết bài chiến dịch | `ai_campaign_content_enabled` | Cho AI viết bài chiến dịch | boolean | true |  |
| AI viết bài chiến dịch | `ai_campaign_daily_quota` | Lượt AI viết bài mỗi ngày (mỗi nhà tuyển dụng) | number | 20 |  |

### Pháp lý & đồng ý (`legal`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Văn bản pháp lý | `legal_terms_url` | Điều khoản sử dụng (ứng viên) | url | "" | ✓ |
| Văn bản pháp lý | `legal_privacy_url` | Chính sách bảo mật (ứng viên) | url | "" | ✓ |
| Văn bản pháp lý | `employer_dpa_guide_url` | Hướng dẫn thỏa thuận xử lý dữ liệu ứng viên | url | "" | ✓ |

### Lưu trữ dữ liệu (`retention`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Thời gian lưu trữ | `talent_pool_retention_days` | Lưu ứng viên trong kho (ngày) | number | 365 |  |
| Thời gian lưu trữ | `candidate_notification_retention_days` | Lưu thông báo của ứng viên (ngày) | number | 730 |  |
| Thời gian lưu trữ | `cv_import_source_retention_days` | Lưu tệp CV gốc khi nhập (ngày) | number | 30 |  |
| Thời gian lưu trữ | `digest_history_retention_days` | Lưu lịch sử email gợi ý việc làm (ngày) | number | 90 |  |

### Tính năng (`features`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Trung tâm trợ giúp | `knowledgebase_public_enabled` | Mở Trung tâm trợ giúp công khai | boolean | true |  |
| Trung tâm trợ giúp | `knowledgebase_search_index_enabled` | Cho Google lập chỉ mục Trung tâm trợ giúp | boolean | true |  |
| Việc làm gần bạn | `nearby_jobs_enabled` | Bật Việc làm gần bạn | boolean | true | ✓ |
| Thông báo đa cổng | `announcement_surfaces` | Nơi hiển thị thông báo đa cổng | multiselect | ["candidate", "employer_marketing", "… |  |

### Vận hành (`operations`)

| Section | Key | Tên | Kiểu | Mặc định | Public |
|---|---|---|---|---|---|
| Bảo trì | `maintenance_mode` | Chế độ bảo trì | boolean | false | ✓ |
| Bảo trì | `maintenance_message` | Thông báo bảo trì | textarea | "Hệ thống đang bảo trì, vui lòng quay… | ✓ |
