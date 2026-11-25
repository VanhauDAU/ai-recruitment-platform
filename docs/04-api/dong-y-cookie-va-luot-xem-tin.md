# Cookie consent và ghi nhận lượt xem việc làm

Triển khai ngày 14/07/2026. Đây là tài liệu kỹ thuật; nội dung chính sách trước
khi production cần được bộ phận pháp lý xác nhận.

## Inventory browser storage

| Key | Nơi lưu | Mục đích | Nhóm | Thời hạn/cleanup | Owner |
| --- | --- | --- | --- | --- | --- |
| `procv_consent` | Signed HttpOnly cookie | Nguồn quyết định consent | Thiết yếu | 180 ngày | `apps.privacy` |
| `procv_consent_v1` | localStorage | Mirror không nhạy cảm để render UI | Thiết yếu | Xóa khi cookie không hợp lệ hoặc gọi API consent lỗi | `entities/system/consent` |
| `procv_refresh_<portal>` | HttpOnly cookie, path `/api/` | Refresh JWT; access token chỉ nằm trong bộ nhớ | Thiết yếu | Theo hạn phiên | `apps.accounts` |
| `procv_auth_logout_<portal>`, `auth_logout_marker_<portal>` | Cookie + localStorage | Đồng bộ đăng xuất giữa tab/subdomain | Thiết yếu | 1 năm | `shared/api/token-store` |
| `procv_oauth_browser` | HttpOnly cookie | Gắn state OAuth với trình duyệt (chống CSRF) | Thiết yếu | `OAUTH_STATE_TTL` (10 phút) | `apps.accounts` |
| `procv_lang` | localStorage | Ngôn ngữ người dùng chọn | Thiết yếu (chức năng người dùng yêu cầu) | Đến khi đổi | `shared/config/i18n` |
| `announcement-strip:*` | localStorage | Nhớ thông báo đã đóng | Thiết yếu (người dùng yêu cầu) | Theo phiên bản thông báo | `widgets/common/announcement-strip` |
| `procv:notification-sound`, `procv:notice-claim:*` | localStorage | Tắt âm báo; một tab báo mỗi sự kiện | Thiết yếu | Đến khi bật lại / 60 giây | `shared/lib/incoming-notice` |
| `job-quality-feedback:*` | localStorage | Nhớ đã đánh giá tin | Thiết yếu (người dùng yêu cầu) | Đến khi xóa dữ liệu | `pages/main/jobs` |
| `procv.nearby_origin`, `employer_registration_consent` | sessionStorage | Vị trí "Việc làm gần tôi"; bước đăng ký NTD | Thiết yếu | Đóng tab | `entities/system/location`, `pages/employer/auth` |
| Django session/CSRF | Cookie | Bảo mật và vận hành Django admin | Thiết yếu | Theo Django | Django |
| `color-scheme` | localStorage | Ghi nhớ giao diện sáng/tối | Tùy chọn | Xóa khi tắt Preferences | `entities/system/consent` |
| `search_history` | localStorage | Lịch sử tìm việc | Tùy chọn | Không đọc/ghi khi tắt Preferences | `features/main/job/search-jobs` |
| `saved_job_filter` | localStorage | Bộ lọc việc làm bấm lưu | Tùy chọn | Không ghi khi tắt Preferences | `pages/main/jobs` |
| `procv_job_comparison_v1` | localStorage | Danh sách so sánh việc làm | Tùy chọn | Chỉ giữ trong bộ nhớ khi tắt Preferences | `features/main/job/compare-jobs` |
| `procv_employer_cv_ordering`, `procv_admin_sidebar_collapsed`, `procv_admin_nav_open` | localStorage | Sắp xếp hồ sơ NTD; thanh bên admin | Tùy chọn | Không ghi khi tắt Preferences | `pages/employer/jobs`, `app/layouts` |
| `procv_viewer_id` | Signed HttpOnly cookie | Chống đếm trùng lượt xem tin và sự kiện thông báo | Analytics | 365 ngày; xóa khi rút Analytics | `apps.jobs`, `apps.sitecontent` |
| `procv_campaign_ref_v1` | localStorage | Nhớ kênh chiến dịch đã đưa ứng viên tới (`?ref=` có ký) để ghi nguồn khi ứng tuyển, lần bấm cuối thắng | Analytics | 30 ngày; xóa khi rút Analytics. Không có consent thì chỉ giữ trong bộ nhớ của phiên SPA | `entities/campaign/campaign`, `features/main/job/track-campaign-ref` |

`ConsentProvider` gọi `purgeWithdrawnStorage` ngay khi biết lựa chọn (tải từ máy
chủ, lưu mới hoặc API lỗi) để xóa mọi khóa Tùy chọn/Analytics của nhóm chưa
đồng ý, kể cả khi màn hình sở hữu khóa chưa mở. Thêm khóa tùy chọn mới thì phải
thêm vào `OPTIONAL_STORAGE_KEYS` (`entities/system/consent/lib/consent-storage.js`)
và bảng ở trang `/chinh-sach-cookie`. Khi consent còn `loading`, không quyết định
lưu lâu dài theo mirror localStorage (mirror có thể đã cũ).

Bên thứ ba: reCAPTCHA v3 chỉ nạp trong `AuthLayout`, `EmployerAuthLayout` và
modal đăng nhập (bảo mật, thiết yếu). Video công ty và bản đồ trang Liên hệ NTD
là mặt tiền nhấp-để-tải; YouTube dùng `youtube-nocookie.com`. Sentry không gửi
cookie/body/query. Nhóm Marketing chưa có tích hợp nào.

Không tạo `procv_viewer_id`, không gọi endpoint tracking và không dùng dữ liệu
Analytics khi người dùng chưa chọn hoặc đã tắt Analytics.

**Lượt bấm link theo dõi của chiến dịch (`/r/<code>`)** là đo lường tổng hợp,
không lưu gì trên thiết bị:
- không đặt cookie, không lưu IP;
- chỉ cộng số đếm theo kênh và ngày (`CampaignChannelClickDaily`);
- "người bấm" được khử trùng trong ngày bằng hash của salt ngẫu nhiên theo ngày,
  IP và User-Agent; hash chỉ nằm trong Redis tới hết ngày, salt không ghi DB;
- crawler xem trước link (facebookexternalhit, Zalo...) được đếm riêng.

Cần bộ phận pháp lý xác nhận cách đếm này trước khi lên production.

## API consent

### `GET /api/public/privacy/consent/`

Public. Đọc signed cookie hiện hành. Cookie hỏng, bị sửa hoặc policy version
khác trả về trạng thái chưa quyết định.

```json
{ "consent": null }
```

hoặc:

```json
{
  "consent": {
    "version": 1,
    "necessary": true,
    "preferences": true,
    "analytics": false,
    "marketing": false
  }
}
```

### `POST /api/public/privacy/consent/`

Public. Production throttle `20/hour`; development tắt throttle để QA có thể đổi
lựa chọn liên tục. Body chỉ nhận nhóm tùy chọn:

```json
{ "preferences": true, "analytics": true, "marketing": false }
```

Response trả consent chuẩn hóa và đặt `procv_consent` với `HttpOnly`,
`SameSite=Lax`, `Secure` ở production. `necessary` luôn là `true`. Khi
`analytics=false`, response xóa `procv_viewer_id` ngay.

## API job view

### `GET /api/public/jobs/{slug}/`

Chỉ đọc dữ liệu. Không làm thay đổi `view_count`.

### `POST /api/public/jobs/{slug}/views/`

Public, throttle `120/hour`, chỉ ghi nhận khi signed consent có
`analytics=true`.

```json
{ "counted": true, "view_count": 101 }
```

Các response không đếm gồm `consent_required`, `duplicate` và `redis_error`.
Redis lỗi thì fail closed: không tăng PostgreSQL và trang chi tiết vẫn hiển thị
bình thường.

Redis dùng Lua atomic check-and-set trong 24 giờ với key:

```text
job-view:{job_id}:viewer:{sha256(viewer_id)}
job-view:{job_id}:user:{user_id}  # khi đã đăng nhập
```

Viewer ID là UUID ngẫu nhiên, signed HttpOnly, không chứa user ID/email/IP hay
nội dung hồ sơ. Raw ID không được log.

## Cấu hình vận hành

| Biến môi trường | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VITE_COOKIE_CONSENT_ENABLED` | `true` | Hiển thị consent layer ở frontend |
| `JOB_VIEW_DEDUP_TTL_SECONDS` | `86400` | TTL chống trùng lượt xem |

Frontend và API khác origin chỉ dùng credential cho consent/tracking; CORS giữ
allowlist cụ thể và `CORS_ALLOW_CREDENTIALS=True`. Không bật wildcard origin
khi gửi cookie.

Rollout: deploy consent trước, kiểm thử banner/cài đặt/rút Analytics, rồi deploy
tracking và theo dõi số `counted`, `duplicate`, `consent_required`,
`redis_error`.
