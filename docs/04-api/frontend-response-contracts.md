# Frontend response contracts

Tài liệu này ghi lại kết quả đối chiếu các API với consumer thực tế trong
`frontend/src`. Mục tiêu là response theo use case, không phản chiếu nguyên model
hoặc cấu trúc database.

## Nguyên tắc

- DTO đọc danh sách, đọc chi tiết và ghi form là các serializer riêng.
- Field không được giao diện đọc không thuộc public contract.
- Quan hệ chỉ trả view-model nhỏ; dữ liệu ghi nested chỉ xuất hiện trong API form
  được bảo vệ tương ứng.
- `password`, quyền nội bộ và định danh database của user không xuất hiện trong
  resource response. `access`/`refresh` chỉ được trả ở endpoint xác thực có mục
  đích phát token (`register`, `login`, `oauth/complete`, `refresh`).
- Test contract so sánh tập key chính xác để một field model mới không tự động bị
  lộ ra API.

## Contract đã đối chiếu

| Màn hình / use case | Endpoint | DTO đọc | Field chính frontend sử dụng |
|---|---|---|---|
| Header, guard, tài khoản | `GET /api/auth/me/` | `SessionUserSerializer` | `public_id`, `email`, `role`, `full_name`, `phone`, `avatar_url`, `email_verified`, `two_factor_enabled`, `job_preferences_configured` |
| Sửa thông tin tài khoản | `PATCH /api/auth/me/` | `ProfileUpdateSerializer` → session DTO | request `full_name`, `phone`; response thống nhất như `/me` |
| Onboarding / cài đặt gợi ý | `GET/PATCH /api/candidate/profile/` | `CandidateProfileReadSerializer` / `CandidateProfileUpdateSerializer` | `gender` |
| Onboarding / cài đặt gợi ý | `GET/PUT /api/candidate/job-preferences/` | `CandidateJobPreferenceSerializer` | vị trí chuyên môn, vị trí khác, lương, kinh nghiệm, tỉnh, relocate và hai consent |
| Cài đặt email candidate | `GET/PATCH /api/candidate/email-notification-settings/` | `CandidateEmailNotificationSettingsSerializer` | 12 boolean preference mặc định bật; PATCH chỉ gửi field vừa đổi, không có field email giao dịch bảo mật |
| Việc làm phù hợp | `GET /api/jobs/recommendations/for-me/` | `CandidateJobRecommendationResponseSerializer` (job nền là `PublicJobListSerializer`) | `status`, `sources`, `source_cv`, `pagination`; mỗi job thêm score/details/reasons/high-match |
| Việc làm sau lưu CV | `GET /api/jobs/recommendations/by-cv/{public_id}/` | `CvJobRecommendationResponseSerializer` (job nền là `PublicJobListSerializer`) | `focus_keyword`, related positions và tối đa 6 job giải thích được; `403` khi chưa có consent |
| Gợi ý từ việc đã lưu | `GET /api/jobs/recommendations/by-saved/?limit=` | `SavedJobRecommendationResponseSerializer` (job nền là `PublicJobListSerializer`) | `status`, `strategy`, `source_saved_job_count`; mỗi job thêm similarity score/details/reasons, fallback có score 0 |
| Picker địa điểm | `GET /api/locations/` | `LocationLookupSerializer` | `id`, `name`, `level`, `parent`, `merged_from` |
| Picker vị trí chuyên môn | `GET /api/jobs/categories/` | `JobCategoryListSerializer` | `id`, `name`, `logo_url`, `parent`, `category_type` |
| Job card / kết quả tìm kiếm / việc đã lưu | `GET /api/jobs/` | `PublicJobListSerializer` | định danh public, tiêu đề/công ty, địa điểm, skill, loại việc, kinh nghiệm/cấp bậc/học vấn/tuổi, lương, badge/tier, thời gian đăng |
| Hover preview trang chủ | `GET /api/jobs/?view=preview` | `PublicJobPreviewSerializer` | list DTO + mô tả/yêu cầu/quyền lợi, lịch, địa chỉ, số lượng và hạn nộp |
| Chi tiết / quick view việc làm | `GET /api/jobs/{slug}/` | `JobDetailSerializer` | nội dung chi tiết, thông tin công ty tối thiểu, salary/deadline/view, location/schedule/language và các nhóm view-model |
| Bảng quản lý tin NTD | `GET /api/jobs/mine/` | `EmployerJobListSerializer` | `public_id`, `title`, `company_name`, `locations_detail`, `employment_type`, `deadline`, `status`, `application_count`, timestamps cần hiển thị |
| Form tin NTD | `POST/PATCH /api/jobs/mine/...` | `EmployerJobWriteSerializer`; response `EmployerJobDetailSerializer` | dữ liệu form và nested relation, gồm liên hệ nhận hồ sơ; endpoint có `IsEmployer` |
| Admin duyệt tin | `GET /api/jobs/admin/moderation/{public_id}/`, `POST .../decisions/` | `AdminJobDetailSerializer` / `AdminJobDecisionSerializer` | `review_token`, `state_actions`, `blocked_reasons`, `approve_blockers`, `approve_requirements`; eligibility do backend tính |
| Card blog / blog home | `GET /api/blog/`, `/api/blog/home/` | `PostListSerializer` | `public_id`, `title`, `slug`, `excerpt`, `thumbnail_url`, category link, `published_at` |
| Chi tiết blog | `GET /api/blog/{slug}/` | `PostDetailSerializer` | list identity + `content`, tags, related job category, `seo_title` |

Các catalog nhỏ (industry, benefit, language, skill), site settings/banner/link và
consent vốn đã dùng explicit field. Admin site settings cố ý trả metadata form
(`value_type`, `options`, `order`, `is_public`, `env_configured`) nhưng chỉ qua
permission admin.

### Contract blocker duyệt tin

`approve` chỉ xuất hiện trong `state_actions` khi `approve_blockers=[]`. Tối
thiểu có hai blocker employer fail-closed:

- `verification_required`: verification case chưa `approved`, không thuộc đúng
  recruiter hoặc không khớp company của tin;
- `dpa_outdated`: recruiter chưa có DPA hợp lệ theo nguồn trạng thái hiện hành.

Khi blocker xuất hiện giữa preview và submit, backend trả HTTP 400 với
`code=JOB_APPROVAL_BLOCKED` và `blocked_reasons[]`; frontend phải invalidate
detail và không hiển thị toast thành công. `review_token` bảo vệ revision của
job nhưng không thay thế việc backend đọc lại verification/DPA/campaign trong
transaction.

## Query strategy

- Job list defer các cột rich text; chỉ prefetch location/skill, và chỉ thêm
  benefit/schedule khi `view=preview`.
- Job detail prefetch đúng các relation được DTO chi tiết và view-model sử dụng.
- Recommendation prefilter không dấu theo category/title/skill, chấm tối đa 500
  job đã prefetch; query-budget regression bảo đảm số query phẳng theo số kết quả.
- Recommendation theo saved job so pairwise tối đa 20 nguồn gần nhất, loại tin
  đã lưu/đã ứng tuyển; không có tín hiệu thì fallback tin active mới nhất.
- Employer list dùng query riêng, không tải nội dung rich text hoặc toàn bộ nested
  form; detail/write dùng query đầy đủ riêng.
- Blog list dùng `select_related(category)` + `only()` các cột card; detail mới
  prefetch tags và related category.
- Location/category lookup dùng `only()` đúng các cột picker.

Khi thêm field frontend mới, cập nhật đồng thời serializer, selector/query,
contract test và bảng này. Không dùng `fields = '__all__'` trong API serializer.

## Contract thông báo chạy đa cổng

Contract này được chốt ở AN-P0 và chỉ có hiệu lực sau khi backend foundation
AN-P1 được merge. Public feed không phản chiếu model/revision nội bộ.

### Active feed

`GET /api/site/announcements/active/?surface=candidate&path=/viec-lam&locale=vi`

```json
{
  "items": [
    {
      "public_id": "ann_...",
      "revision": 3,
      "kind": "info",
      "priority_tier": 6,
      "priority": 50,
      "message": "Khám phá cơ hội việc làm mới.",
      "badge": "Mới",
      "icon": "sparkles",
      "cta": {
        "label": "Xem ngay",
        "url": "/viec-lam",
        "external": false
      },
      "animation": "slide",
      "display_seconds": 6,
      "dismiss": {
        "mode": "close",
        "snooze_seconds": null,
        "version": 1
      },
      "starts_at": "2026-07-29T03:00:00Z",
      "ends_at": "2026-08-05T03:00:00Z"
    }
  ],
  "next_transition_at": "2026-08-05T03:00:00Z",
  "remote_enabled": true
}
```

Rules:

- `items` chỉ chứa tier cao nhất đã qua targeting và dismiss; thứ tự đã
  deterministic từ backend.
- `message`/`badge`/`cta.label` đã resolve locale, fallback từng field về
  tiếng Việt.
- `cta` là `null` khi không cấu hình; client không tự suy ra external từ text.
- `next_transition_at` là boundary sớm nhất có thể đổi feed, hoặc `null`.
- `remote_enabled` là kill switch authoritative theo surface. Frontend bỏ mọi
  remote item nếu field thiếu hoặc false; system label resolve độc lập.
- `internal_name`, creator, publisher, target rule và raw translations không
  xuất hiện trong public DTO.

### Functional state

`PUT /api/site/announcements/{public_id}/state/`

```json
{
  "revision": 3,
  "dismissal_version": 1,
  "action": "snooze"
}
```

Response `200` trả state canonical gồm `dismissed_at` hoặc `snoozed_until`.
Gửi lại cùng action là idempotent. Guest không gọi endpoint này.
Endpoint yêu cầu authenticated session. Revision hoặc dismissal version cũ trả
`409 announcement_state_stale`; `locked` hoặc action không khớp cấu hình trả
`400` và không tạo user state.

### Event batch

`POST /api/site/announcements/events/`

```json
{
  "events": [
    {
      "public_id": "ann_...",
      "revision": 3,
      "surface": "candidate",
      "event": "impression"
    }
  ]
}
```

Response `202 {"accepted": true}` không cam kết event được cộng khi thiếu
analytics consent hoặc Redis đang lỗi. Client không retry vô hạn.
Batch nhận 1–50 event, loại trùng trong cùng payload và throttle độc lập
240 request/giờ. Backend chỉ nhận revision đã publish và surface thuộc revision;
không lưu path, IP hoặc user-agent. CTA không chờ response tracking.

### Runtime operational event

`POST /api/site/announcements/runtime-events/`

```json
{
  "surface": "candidate",
  "event": "feed_error",
  "reason": "http_5xx"
}
```

Endpoint AllowAny, throttle 60 request/giờ và chỉ nhận enum. Event:
`feed_error`, `contract_error`, `render_error`; reason: `network`, `timeout`,
`http_4xx`, `http_5xx`, `contract`, `render`, `unknown`. Không gửi path, error
message, stack, user/cookie identifier hoặc payload API.

### Admin metrics

`GET /api/site/admin/announcements/{public_id}/metrics/?date_from=2026-07-01&date_to=2026-07-29`

- yêu cầu `announcement.view`;
- mặc định 30 ngày, tối đa 93 ngày, ngày báo cáo theo `Asia/Ho_Chi_Minh`;
- `summary` trả `impressions`, `unique_impressions`, `clicks`,
  `unique_clicks`, `dismisses`, `ctr`, `dismiss_rate`;
- `daily[]` aggregate theo ngày và surface trên toàn bộ revision;
- `consent_notice` bắt buộc để tránh diễn giải số liệu như toàn bộ traffic.

### Admin list/detail

Admin list trả paginated DTO phục vụ bảng:

- `public_id`, `internal_name`, `lifecycle_state`, `presentation_status`;
- `kind`, `surfaces`, `starts_at`, `ends_at`, `priority`;
- active/draft revision numbers, creator/publisher summary và timestamps;
- aggregate `impressions`, `clicks`, `ctr`, `dismisses`.

Detail mới trả raw nội dung Việt/Anh, target rules, dismiss/animation config,
revision token và revision history. Mutation phải gửi revision token; stale
token trả `409` với code `announcement_revision_stale`.
