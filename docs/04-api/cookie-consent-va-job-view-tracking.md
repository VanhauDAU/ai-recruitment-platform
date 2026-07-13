# Cookie consent và ghi nhận lượt xem việc làm

Triển khai ngày 14/07/2026. Đây là tài liệu kỹ thuật; nội dung chính sách trước
khi production cần được bộ phận pháp lý xác nhận.

## Inventory browser storage

| Key | Nơi lưu | Mục đích | Nhóm | Thời hạn/cleanup | Owner |
| --- | --- | --- | --- | --- | --- |
| `procv_consent` | Signed HttpOnly cookie | Nguồn quyết định consent | Thiết yếu | 180 ngày | `apps.privacy` |
| `procv_consent_v1` | localStorage | Mirror không nhạy cảm để render UI | Thiết yếu | Xóa khi cookie không hợp lệ | `entities/consent` |
| `color-scheme` | localStorage | Ghi nhớ giao diện sáng/tối | Tùy chọn | Xóa khi tắt Preferences | `entities/consent` |
| `search_history` | localStorage | Lịch sử tìm việc | Tùy chọn | Không đọc/ghi và tự xóa khi tắt Preferences | `features/search-jobs` |
| `procv_viewer_id` | Signed HttpOnly cookie | Chống đếm trùng lượt xem | Analytics | 365 ngày; xóa khi rút Analytics | `apps.jobs` |
| Django session/CSRF | Cookie | Bảo mật và vận hành Django admin | Thiết yếu | Theo Django | Django |
| access/refresh token | localStorage | Phiên JWT hiện tại | Thiết yếu trong phạm vi auth hiện hữu | Theo luồng auth | `shared/api/token-store` |

Không tạo `procv_viewer_id`, không gọi endpoint tracking và không dùng dữ liệu
Analytics khi người dùng chưa chọn hoặc đã tắt Analytics.

## API consent

### `GET /api/privacy/consent/`

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

### `POST /api/privacy/consent/`

Public. Production throttle `20/hour`; development tắt throttle để QA có thể đổi
lựa chọn liên tục. Body chỉ nhận nhóm tùy chọn:

```json
{ "preferences": true, "analytics": true, "marketing": false }
```

Response trả consent chuẩn hóa và đặt `procv_consent` với `HttpOnly`,
`SameSite=Lax`, `Secure` ở production. `necessary` luôn là `true`. Khi
`analytics=false`, response xóa `procv_viewer_id` ngay.

## API job view

### `GET /api/jobs/{slug}/`

Chỉ đọc dữ liệu. Không làm thay đổi `view_count`.

### `POST /api/jobs/{slug}/views/`

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
