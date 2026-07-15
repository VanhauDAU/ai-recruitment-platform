# 04 - API

Phạm vi:
- Danh sách endpoint theo module (auth, candidate, employer, cv, jobs, applications, ai, interviews)
- Request/response mẫu, mã lỗi

Contract field theo từng màn hình: [frontend-response-contracts.md](frontend-response-contracts.md).

## Tài liệu API tương tác (Swagger / OpenAPI)

Dùng `drf-spectacular` (OpenAPI 3). Chạy backend rồi mở:

| URL | Mô tả |
|---|---|
| `/api/docs/` | **Swagger UI** — xem + thử API trực tiếp trên trình duyệt |
| `/api/redoc/` | ReDoc — tài liệu dạng đọc |
| `/api/schema/` | File schema OpenAPI 3 (YAML) để import vào Postman/Insomnia |

Xác thực trong Swagger UI: gọi `POST /api/auth/login/` lấy `access`, bấm **Authorize**, nhập `Bearer <access_token>`. Xuất schema ra file: `python manage.py spectacular --file schema.yml`.

## Đã triển khai

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/register/` | Đăng ký tài khoản (candidate/employer) |
| POST | `/api/auth/register/email-availability/` | Kiểm tra email đã được dùng chưa cho UX form đăng ký candidate; body `{email}`, trả `{available}`; public, throttle 12/phút. Đây chỉ là pre-check — endpoint đăng ký vẫn xác thực lại để tránh race condition. |
| POST | `/api/auth/login/` | Đăng nhập, nhận access/refresh JWT (kèm `portal` để chặn sai vai trò theo cổng) |
| POST | `/api/auth/refresh/` | Làm mới access token |
| GET | `/api/auth/me/` | Thông tin tài khoản hiện tại |
| POST | `/api/auth/verify/send/` | Gửi lại email xác thực (429 kèm `retry_after` khi còn cooldown) |
| POST | `/api/auth/verify/confirm/` | Xác nhận email bằng `token` trong link (public) |
| POST | `/api/auth/change-email/` | Đổi email → reset xác thực + gửi lại link |
| POST | `/api/auth/password-reset/` | Gửi email chứa link đặt lại mật khẩu (public, cần `captcha_token`). **Luôn trả 200 kèm cùng một `detail`** dù email có tồn tại hay không — chống dò danh sách email. Cooldown 60s/tài khoản (im lặng), throttle 5/phút theo IP |
| GET | `/api/auth/password-reset/validate/?token=` | Kiểm tra link còn hiệu lực, **không tiêu token**; 200 → `{email, role}`, 400 → link sai/hết hạn. Dùng để hiện ngay màn "hết hạn" thay vì bắt user gõ xong mật khẩu mới báo lỗi |
| POST | `/api/auth/password-reset/confirm/` | Đổi `token` + `password` lấy mật khẩu mới (public — token là bằng chứng, không cần captcha). Token dùng **một lần**, TTL 30 phút. Trả `{detail, role}` để frontend điều hướng về đúng cổng đăng nhập. Throttle riêng 10/phút (`password_reset_confirm`) |
| POST | `/api/auth/avatar/` | Upload avatar vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`; DB lưu storage key) |
| GET | `/api/auth/oauth/{provider}/start/?portal=main\|employer&next=/...` | Bắt đầu social login (`provider` = google/facebook/linkedin), redirect sang provider. Cổng `employer` chỉ chấp nhận google |
| GET | `/api/auth/oauth/{provider}/callback/` | Provider gọi lại; verify state, tạo/liên kết user, redirect về trang callback frontend kèm `one_time_code` (hoặc `?error=`) |
| POST | `/api/auth/oauth/complete/` | Đổi `one_time_code` (1 lần dùng, TTL 60s) lấy `{user, access, refresh}` |
| GET/PATCH | `/api/candidate/profile/` | Đọc/cập nhật `gender` cho onboarding và cài đặt gợi ý việc làm (tự tạo profile legacy khi cần) |
| GET/PUT | `/api/candidate/job-preferences/` | Candidate: đọc/lưu nhu cầu việc làm chuẩn hóa. PUT yêu cầu 1–5 `desired_specialization_ids`, ít nhất một `preferred_province_ids`, `experience_level` và `desired_salary_vnd` > 0; đồng thời lưu hai quyết định consent. |
| GET/PATCH | `/api/employer/me/` | Hồ sơ nhà tuyển dụng của tôi + trạng thái onboarding 5 bước (chỉ `position_title` sửa được) |
| POST | `/api/employer/phone/send-otp/` | Gửi mã OTP xác thực SĐT (gửi qua email tài khoản; cooldown 60s, hết hạn 10 phút) |
| POST | `/api/employer/phone/verify/` | Xác thực OTP — thành công thì `verified_phone` unique giữa các NTD |
| POST | `/api/employer/dpa/accept/` | Chấp nhận thỏa thuận xử lý dữ liệu cá nhân với ứng viên |
| GET | `/api/employer/company/` | Công ty của tôi (chỉ đọc — thay đổi thông tin qua update-requests) |
| POST | `/api/employer/company/create/` | Tạo hồ sơ công ty mới (cần đã xác thực SĐT; người tạo là owner, hiệu lực ngay, trạng thái `unverified`) |
| GET | `/api/employer/company/search/?q=` | Tìm công ty có sẵn theo tên / tên thương mại / MST (không dấu) |
| POST | `/api/employer/company/join/` | Join công ty có sẵn: multipart `company` + `proof_type` (`business_registration` hoặc `authorization_and_id`) + file giấy tờ; membership `pending` chờ admin duyệt |
| POST | `/api/employer/company/logo/` \| `cover/` \| `images/` | Upload logo/cover/ảnh giới thiệu công ty (owner; JPG/PNG/GIF/WebP, multipart `file`) |
| DELETE | `/api/employer/company/images/{id}/` | Xóa ảnh giới thiệu (owner) |
| GET/POST | `/api/employer/company/documents/` | Giấy tờ công ty (ĐKDN, ủy quyền, định danh, DLCN...); POST multipart `doc_type` + `file` (jpeg/png/pdf) |
| GET/POST | `/api/employer/company/update-requests/` | Yêu cầu cập nhật thông tin công ty (owner; tối đa 1 pending; đổi MST/tên bắt buộc `reason` + `proof_type`) |
| GET | `/api/employer/industries/all/` | Toàn bộ lĩnh vực cho dropdown tạo hồ sơ công ty |
| GET | `/api/locations/?level=&parent=&search=` | Tra cứu địa điểm (cascading tỉnh -> xã/phường), public — không phân trang (trả tối đa 500 bản ghi/lần) |
| GET | `/api/jobs/categories/` | Danh sách ngành nghề (taxonomy 3 cấp: nhóm nghề/nghề/vị trí chuyên môn), public, có phân trang mặc định |
| GET | `/api/jobs/benefits/` | Danh mục quyền lợi chuẩn hóa (đang active), public, không phân trang |
| GET | `/api/jobs/languages/` | Danh mục ngoại ngữ (đang active), public, không phân trang |
| GET | `/api/jobs/stats/` | Thống kê thị trường việc làm cho dashboard trang chủ (số job/công ty, job mới 24h, tăng trưởng 7 ngày, nhu cầu theo ngành, job mới nhất), public |
| GET | `/api/cv-templates/` | **Legacy V1** public catalogue; chuyển sang `/api/v2/cv-templates/` |
| GET | `/api/cv-templates/{slug}/` | **Legacy V1** template detail; chuyển sang `/api/v2/cv-templates/{slug}/` |
| GET/POST | `/api/cvs/` | **Legacy V1** candidate CV; không dùng cho client mới |
| GET/PUT/PATCH/DELETE | `/api/cvs/{public_id}/` | **Legacy V1** CV detail; chuyển sang V2 metadata/draft endpoints |
| POST | `/api/cvs/upload/` | **Legacy V1** upload; chuyển sang `/api/v2/cvs/imports/` |
| GET | `/api/v2/cv-templates/?locale=&category=&tag=&page=` | Public catalogue V2. Card DTO gồm localization, category/tag và `colors[]`; không lộ layout/style JSON hoặc renderer config. |
| GET | `/api/v2/cv-templates/{slug}/` | Public template detail V2: card fields + preview metadata, renderer contract an toàn và section list. |
| GET | `/api/v2/cv-templates/{slug}/related/` | Template published liên quan theo category, cùng locale. |
| GET | `/api/v2/cv-categories/?type=` | Taxonomy template active (`style`, `feature`, `position`, `audience`). |
| GET | `/api/v2/cv-position-options/?locale=&experience_level=&q=` | Vị trí chuyên môn active có localization và content resolve được; response gồm `public_id`, `display_name`, `name_vi`, có ordering quản trị được. |
| GET | `/api/v2/cv-position-preview/?position_public_id=&locale=&experience_level=&template_public_id=&theme_color=` | Resolve curated→blueprint; khi có template trả thêm canonical `document`, `renderer`, `revision`. `source=blank` compose document trống. Contract content-only cũ vẫn hoạt động nếu thiếu template. |
| GET | `/api/site/locales/` | Danh sách locale active theo `sort_order`; public, không phân trang. |
| GET/POST | `/api/site/admin/locales/` | Admin list/create locale. `code` bất biến sau khi tạo; đổi default demote default cũ trong transaction. |
| GET/PATCH/PUT | `/api/site/admin/locales/{code}/` | Admin đọc/cập nhật locale; không có DELETE. Locale default không thể inactive. |

`locale` trên catalogue/position preview và `language` khi tạo CV phải thuộc
registry active. API tiếp tục nhận/trả locale code để giữ tương thích; FK
`locale_ref` là chi tiết migration nội bộ, không làm đổi public payload.

### CV catalogue admin (admin-only)

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| CRUD | `/api/v2/admin/cv-templates/` | Metadata template và danh sách version/localization. |
| POST | `/api/v2/admin/cv-templates/{public_id}/versions/` | Tạo draft version; body rỗng clone contract published hiện tại. |
| POST | `/api/v2/admin/cv-templates/{public_id}/versions/{id}/publish/` | Validate và publish immutable template version. |
| POST | `/api/v2/admin/cv-templates/{public_id}/versions/{id}/retire/` | Retire version không còn là current pointer. |
| POST | `/api/v2/admin/cv-templates/{public_id}/snapshots/regenerate/` | Queue snapshot cho mọi màu của template. |
| CRUD | `/api/v2/admin/cv-template-localizations/` | Localization của template. |
| CRUD | `/api/v2/admin/cv-categories/` | Taxonomy catalogue. |
| CRUD | `/api/v2/admin/cv-colors/` | Registry màu. |
| CRUD | `/api/v2/admin/cv-sample-contents/` | Nội dung canonical draft. |
| POST | `/api/v2/admin/cv-sample-contents/{public_id}/preview/` | Preview bằng canonical composer. |
| POST | `/api/v2/admin/cv-sample-contents/{public_id}/publish\|archive/` | Lifecycle curated content. |
| CRUD | `/api/v2/admin/cv-content-blueprints/` | Blueprint canonical/compatibility fields. |
| POST | `/api/v2/admin/cv-content-blueprints/{public_id}/preview\|activate/` | Preview/activate blueprint. |

Các action sinh snapshot trả `202 queued`; asset không được tạo trong request
web. Public card chỉ thấy storage URL mới sau khi worker đã render và swap đủ
thumbnail + preview.

### AI CV import

`POST /api/v2/cvs/imports/` multipart giữ `file`, `title` cũ và nhận thêm
`template_public_id`, `language`, `theme_color`. Khi có template, client nên gửi
`Idempotency-Key`; response `202` chứa `processing_status=queued` và
`import_job`. Gửi lại cùng key/user trả cùng CV với `200`, không tạo job/file mới.

`GET /api/v2/cvs/{public_id}/` dùng để poll: `queued|processing|analyzed|failed`.
Khi failed, `import_job.failure_code` chỉ là mã an toàn, không chứa raw text.
`POST /api/v2/cvs/{public_id}/imports/retry/` trả `202`, owner-only và chỉ dùng
cho job failed chưa vượt ba attempt. Bucket throttle là `cv_import=10/hour`.

V1 chỉ nhận `.pdf/.docx`, 5 MB, PDF tối đa 20 trang. `scanned_pdf_ocr_unavailable`
nghĩa là PDF scan chưa có text layer; OCR không được giả lập trong release này.
| GET | `/api/v2/cv-sample-contents/?locale=&experience_level=` | Compatibility catalogue cho client cũ; frontend mới không dùng endpoint này làm nguồn dropdown. |
| GET | `/api/v2/cv-sample-contents/{public_id}/` | Compatibility detail cho client cũ dùng `sample_content_public_id`. |
| GET/POST | `/api/v2/cvs/` | Candidate lifecycle V2. POST nhận template, language, optional sample/position/`source_cv_public_id` và optional màu; các source loại trừ nhau. |
| GET | `/api/v2/cvs/latest-recoverable-draft/` | Trả đúng một server draft dirty mới nhất của candidate hoặc `204`; dirty xác định bằng document hash so với base version. |
| GET/PATCH/DELETE | `/api/v2/cvs/{public_id}/` | Candidate metadata/detail: PATCH chỉ nhận `title`, `is_default`; DELETE xóa vĩnh viễn CV và library artifacts. Snapshot của application đã nộp được giữ detached cho recruiter. |
| POST | `/api/v2/cvs/imports/` | Candidate import PDF/DOCX (`multipart file`, optional `title`). Response không có storage key/URL, chỉ có `file_name`, `file_type`, `source=imported`. |
| POST | `/api/v2/cvs/{public_id}/duplicate/` | Clone builder CV từ latest immutable version thành CV/draft/version độc lập. Optional `title`; không hỗ trợ uploaded CV để tránh dùng chung file storage. |
| GET/PUT | `/api/v2/cvs/{public_id}/draft/` | Đọc/autosave canonical draft; PUT bắt buộc `If-Match: "lock-version-N"`. |
| PUT | `/api/v2/cvs/{public_id}/template/` | Đổi template của mutable draft, giữ canonical content và optimistic lock. |
| GET | `/api/v2/cvs/{public_id}/template-preview/?template_public_id=` | Project draft owner lên template mới để preview, không mutation aggregate. |
| POST | `/api/v2/cvs/{public_id}/save-version/` | Tạo immutable manual version từ draft hợp lệ. |
| POST | `/api/v2/cvs/{public_id}/publish/` | Tạo immutable published version. |
| GET | `/api/v2/cvs/{public_id}/versions/` | History version của owner. |
| GET | `/api/v2/cvs/{public_id}/view/` | Owner read-only view từ immutable version, không đọc draft. |
| GET/POST | `/api/v2/cvs/{public_id}/shared-links/` | Quản lý bearer share link theo owner/version. |
| GET/POST | `/api/v2/cvs/{public_id}/exports/` | Danh sách/yêu cầu PDF export từ immutable version. |
| GET | `/api/jobs/?category=&location=&work_type=&employment_type=&experience_level=&search=` | Danh sách job đang active, public. `category`/`location` nhận **nhiều giá trị**; response là card DTO, không gồm description/requirements/benefits/deadline và dữ liệu quản trị. Dùng `?view=preview` khi UI thực sự cần nội dung hover. |
| GET | `/api/jobs/{slug}/` | Chi tiết job, public và **chỉ đọc** (không tăng `view_count`). Trả relation tối thiểu cùng view-model nhóm sẵn: `primary_specialization`, `domain_knowledge`, `workplace_groups`, `requirement_tags`, `benefit_tags`, `language_requirements[].proficiency_label`; không trả contact nhận hồ sơ hoặc trạng thái quản trị. |
| POST | `/api/jobs/{slug}/views/` | Ghi nhận lượt xem riêng, chỉ khi Analytics consent hợp lệ; Redis dedupe 24 giờ, response `{counted, view_count, reason?}`. |
| GET/POST | `/api/privacy/consent/` | Đọc/lưu lựa chọn cookie ký số (`preferences`, `analytics`, `marketing`); necessary luôn bật, rút Analytics sẽ xóa viewer cookie. |
| GET/POST | `/api/jobs/mine/` | Employer: GET dùng management-list DTO gọn; POST dùng write DTO nested cho `job_skills`, `category_assignments`, `job_locations`, `work_schedules`, `job_benefits`, `language_requirements`, `application_contact` và trả detail form DTO. |
| GET/PUT/PATCH/DELETE | `/api/jobs/mine/{public_id}/` | Employer: sửa/xóa tin của mình |
| GET/POST | `/api/applications/` | Candidate: xem danh sách/ứng tuyển (job + cv theo `public_id`, chặn ứng tuyển trùng) |
| GET/POST | `/api/v2/applications/` | Candidate application V2. POST bắt buộc `job_public_id`, `cv_public_id`, `version_public_id` và tùy chọn `cover_letter`; backend tạo `application_snapshot` từ đúng version đã chọn, không dùng draft hoặc tự chọn latest. |
| GET | `/api/applications/employer/?job=` | Employer: xem hồ sơ ứng tuyển vào job của mình |
| PATCH | `/api/applications/employer/{public_id}/` | Employer: cập nhật `status`/`employer_note` (tự set mốc thời gian tương ứng) |
| GET | `/api/site/settings/` | Cấu hình site công khai dạng `{key: value}` (chỉ key `is_public=true`), public. **Cache 1h**, tự invalidate khi admin sửa qua API/Django admin |
| GET | `/api/site/link-groups/?placement=footer_seo` | Cụm link SEO đang bật kèm items đã resolve, public |
| GET | `/api/site/link-groups/?placement=footer_nav` | Các cột menu điều hướng footer, public |
| GET | `/api/site/banners/?placement=home_hero` | Banner đang bật theo order, public |
| GET | `/api/site/admin/settings/` | **Admin**: toàn bộ cấu hình gộp theo 15 nhóm `{groups: [{key, label, settings: [...]}]}`, mỗi setting kèm metadata (`value_type`, `options`, `order`, `is_public`, `env_configured`) để frontend tự render form |
| PATCH | `/api/site/admin/settings/` | **Admin**: bulk update, body `{"values": {key: value}}`, validate theo `value_type` (boolean/number/color hex/select choices), từ chối key kiểu `env` → `{"updated": [...], "errors": {...}}` |
| POST | `/api/site/admin/settings/upload/` | **Admin**: upload ảnh cho setting kiểu image (multipart `file` + `key`) → `{"key", "value", "url"}`; ảnh favicon tự resize về tối đa 256×256 |

**Quy ước ảnh (media):** DB lưu **storage key** (vd `site/settings/logo.png`), không lưu URL tuyệt đối; API resolve ra URL công khai theo domain/CDN hiện tại tại thời điểm trả về. Đổi domain hoặc bật `MEDIA_PUBLIC_BASE_URL` không cần sửa dữ liệu. Chuyển dữ liệu URL cũ sang key bằng `python manage.py normalize_media_references --apply`.

## Cutover CV API: V1 → V2

Không tạo alias `/api/v1/` và không redirect HTTP các request ghi: hai hành vi đó
làm client lỗi khó chẩn đoán hoặc vô tình đổi method/body. `/api/cvs/` và
`/api/cv-templates/` là contract legacy hiện hữu; `/api/v2/cvs/` và
`/api/v2/cv-templates/` là contract chuẩn cho client mới.

Trong cửa sổ cutover, mọi response V1 có ba header: `Deprecation` (structured
date), `Sunset` và `Link` với `rel="successor-version"`. Backend phát event log
`deprecated_api_request` theo contract/method/status/authenticated; event không
ghi raw path, user-agent hoặc user ID. Ngày header được cấu hình bằng
`LEGACY_CV_API_DEPRECATION_AT` và `LEGACY_CV_API_SUNSET_AT` (ISO-8601) trong
environment. Sau khi metric V1 bằng 0 trong thời hạn vận hành đã chốt, mới có
release riêng trả `410 Gone`, rồi mới xóa view/serializer/field legacy.

## Contract CV Template V2

Một phần tử `colors` trong card/detail:

```json
{
  "public_id": "cvcolor_...",
  "name": "Xanh thương hiệu",
  "slug": "brand-green",
  "hex_code": "#00A66A",
  "thumbnail_url": "/media/cv-templates/modern/green-thumb.webp",
  "preview_url": "/media/cv-templates/modern/green-preview.webp",
  "is_default": true
}
```

`theme_color` và `color_variants` vẫn có trong response trong cửa sổ tương
thích. Client mới phải dùng `colors[]`; URL ảnh thuộc quan hệ template–color,
không suy ra từ hex hoặc hard-code trên frontend.

Position picker trả contract tối thiểu, không lộ hai cấp taxonomy trên UI:

```json
{
  "public_id": "jobcat_...",
  "name_vi": "Nhân viên CSKH"
}
```

Frontend dùng `public_id` làm value và chỉ hiển thị `name_vi`. Sau khi chọn,
frontend gọi position-preview với locale. Resolver ưu tiên curated sample; nếu
không có, nó kết hợp `JobCategoryLocalization` và `CvContentBlueprint` để tạo
`content_json` deterministic. Không fallback tên tiếng Việt vào preview locale khác.

Payload tạo CV V2:

```json
{
  "title": "CV Modern",
  "template_public_id": "tpl_...",
  "language": "vi-VN",
  "position_public_id": "jobcat_...",
  "theme_color": "#2255AA"
}
```

`position_public_id` và `theme_color` đều optional. `sample_content_public_id`
vẫn được nhận cho client cũ nhưng không được gửi cùng `position_public_id`. Nếu gửi màu không
active hoặc không được gán cho template, API trả `400 theme_color`. Màu hợp lệ
được copy vào `style_json.theme_color` của initial version và draft.
