# Đặc tả thông báo đa cổng

Hệ thống hiển thị **đúng một dải thông báo** sticky ngay dưới header trên mỗi
cổng. Dải hợp nhất hai nguồn:

1. **Thông báo hệ thống** do frontend tự sinh theo trạng thái tài khoản (xác
   thực email, thỏa thuận xử lý dữ liệu của NTD, nhắc nhu cầu việc làm).
2. **Thông báo do quản trị viên phát hành** (remote), có target, lịch, revision,
   CTA, animation, dismiss, theme màu/ảnh nền và số liệu hiệu quả.

Backend do app `apps.sitecontent` sở hữu (`models/announcements.py`,
`services/announcements.py`, `services/announcement_media.py`,
`selectors/announcements.py`). Tài liệu liên quan:

- runtime frontend (ownership slice, priority resolver, rollout flag build-time,
  rotation, a11y, refetch, điểm tích hợp layout):
  [`dai-thong-bao-da-cong.md`](../08-frontend/dai-thong-bao-da-cong.md);
- thao tác quản trị (editor năm bước, simulator, catalogue route, "hiện lại cho
  người đã đóng", tab Hiệu quả):
  [`quan-tri-thong-bao-da-cong.md`](../05-huong-dan/quan-tri-thong-bao-da-cong.md);
- field DTO đã khóa:
  [`frontend-response-contracts.md`](../04-api/frontend-response-contracts.md).

Ngoài phạm vi: hộp thư/notification center theo user, email/push/WebSocket,
HTML/rich text, video, marquee ngang, regex route, URL `javascript:`.

## 1. Surface

| Surface | Cổng | Ai nhận remote item |
| --- | --- | --- |
| `candidate` | Cổng ứng viên (`MainLayout`) | Khách hoặc đã đăng nhập theo target |
| `employer_marketing` | Landing NTD | Khách hoặc đã đăng nhập theo target |
| `employer_workspace` | Workspace NTD | Chỉ user employer đã đăng nhập |
| `admin_workspace` | Workspace quản trị | Chỉ user admin đã đăng nhập |

## 2. Thứ tự ưu tiên

| Tier | Nguồn | Dismiss |
| ---: | --- | --- |
| 1 | `critical` | Không (bắt buộc `locked`) |
| 2 | `security`, hệ thống xác thực email | Không |
| 3 | `compliance`, hệ thống DPA của NTD | Không |
| 4 | `warning`, `maintenance` | Theo cấu hình |
| 5 | Hệ thống nhắc nhu cầu việc làm ứng viên | Snooze 7 ngày |
| 6 | `info`, `success`, `event`, `feature` | Theo cấu hình |

Chỉ tier cao nhất còn hợp lệ được hiển thị; trong cùng tier xếp `priority` giảm
dần, `starts_at` tăng dần, rồi `public_id`. Vì vậy chỉ critical vượt được cảnh
báo xác thực email. Backend (`PRIORITY_TIER_BY_KIND`) chỉ trả các remote item
thuộc tier cao nhất; frontend gộp với system item theo quy tắc trong tài liệu
runtime.

## 3. Mô hình dữ liệu

| Model | Vai trò và ràng buộc chính |
| --- | --- |
| `Announcement` | `public_id` prefix `ann`, `internal_name` (không ra public feed), `lifecycle_state`, `active_revision` (`PROTECT`), `revision_token`, `dismissal_version` ≥1, actor/timestamp publish/pause/archive |
| `AnnouncementRevision` | `number` unique theo announcement; nội dung, target, lịch, hành vi, visual (bảng dưới) |
| `AnnouncementUserState` | Unique `(user, announcement, dismissal_version)`; chỉ một trong `dismissed_at` hoặc `snoozed_until` |
| `AnnouncementDailyMetric` | Unique `(announcement_revision, date, surface)`; `impressions`, `unique_impressions`, `clicks`, `unique_clicks`, `dismisses` |

Trường của revision:

| Nhóm | Trường | Quy tắc |
| --- | --- | --- |
| Nội dung | `message_vi` (bắt buộc, ≤500), `message_en`, `badge_vi/en` ≤80, `icon`, `cta_label_vi/en` ≤100, `cta_url` ≤1000 | Plain text. Thiếu bản `en` thì fallback nguyên trường sang `vi`. Icon thuộc allowlist code-owned. CTA label `vi` và URL phải có cùng nhau |
| Loại | `kind` | Một trong chín giá trị ở §2 |
| Target | `surfaces` (≥1), `auth_audiences` (`guest`/`authenticated`, ≥1), `roles` (`candidate`/`employer`/`admin`, rỗng = mọi role), `include_path_prefixes`, `exclude_path_prefixes` | Lưu JSON, service chuẩn hóa và loại trùng |
| Lịch | `starts_at`, `ends_at`, `priority` 0–1000 (mặc định 50) | `starts_at < ends_at` khi có cả hai; `critical` bắt buộc `ends_at` |
| Hành vi | `animation` `slide`/`fade`/`static`, `display_seconds` 4–15 (mặc định 6), `dismiss_mode` `locked`/`close`/`snooze`, `snooze_seconds` | `snooze` cần `snooze_seconds` ≥60; mode khác không được có |
| Visual | xem §6 | |

**URL CTA:** nội bộ phải bắt đầu bằng một dấu `/`; ngoài chỉ `https://`, có
host, không credential. Từ chối protocol-relative, `javascript:`, `data:`.

## 4. Vòng đời

```text
draft ──publish──▶ published ──pause──▶ paused
  │                  │  ▲                 │
  │                  │  └────resume───────┘
  └──archive──▶ archived ◀──archive──(published | paused)
```

- Database chỉ lưu `draft`/`published`/`paused`/`archived`. Trạng thái hiển thị
  `scheduled`/`live`/`ended` được suy ra từ lịch của active revision
  (`presentation_status`).
- Tạo announcement sinh revision 1. **Không có endpoint sửa revision**: mọi chỉnh
  sửa tạo revision số mới; revision tạo trên announcement đang published không
  ảnh hưởng runtime cho tới khi publish.
- Publish nhận số `revision` tường minh, chạy `full_clean`, đặt
  `active_revision` và `lifecycle_state=published`. Publish được từ draft,
  published (đổi sang revision khác, kể cả revision cũ) hoặc paused; không từ
  archived.
- Archive là trạng thái cuối; không tạo revision hay publish lại. Muốn tái sử
  dụng thì **duplicate** (copy revision mới nhất thành announcement draft mới).
- **Reset dismissals** (chỉ khi published) tăng `dismissal_version`, làm mọi
  close/snooze cũ hết hiệu lực ở cả server lẫn trình duyệt. Publish revision mới
  không tự tăng version.
- Đổi `internal_name` không ảnh hưởng runtime.

Mọi mutation chạy trong `transaction.atomic()`, khóa `Announcement` bằng
`select_for_update()`, nhận `revision_token` và tăng token. Token cũ trả `409`
`announcement_revision_stale` kèm `current_revision_token`; client không tự
retry. Chuyển trạng thái sai hoặc validation lỗi trả `400`. Thời gian lưu UTC;
admin nhập/xem theo `Asia/Ho_Chi_Minh`.

## 5. Targeting

Public request chỉ gửi `surface`, `path`, `locale`; backend tự suy ra user, role
và trạng thái đăng nhập, không nhận user ID hay role từ client.
`revision_targets_request` lần lượt kiểm:

1. `surface` thuộc `surfaces`;
2. audience (`guest`/`authenticated`) thuộc `auth_audiences`;
3. nếu có `roles`: user đã đăng nhập và role khớp;
4. `admin_workspace` chỉ cho admin, `employer_workspace` chỉ cho employer;
5. path (bỏ query/hash, tối đa 500 ký tự, bỏ `/` cuối) khớp prefix theo ranh
   giới segment: `/viec-lam` khớp `/viec-lam` và `/viec-lam/...`, không khớp
   `/viec-lam-moi`. **Exclude luôn thắng include**; include rỗng = toàn surface.

Sau đó loại item chưa tới `starts_at` hoặc đã qua `ends_at`, và item user đã
dismiss/còn snooze ở `dismissal_version` hiện tại. Feed trả
`next_transition_at` (mốc bắt đầu/kết thúc gần nhất) để client refetch đúng lúc.

## 6. Visual theme và ảnh nền

| Trường | Giá trị | Ghi chú |
| --- | --- | --- |
| `theme_mode` | `kind` (mặc định) · `preset` · `custom` | `kind` dùng palette theo loại |
| `theme_preset` | `brand`, `emerald`, `amber`, `rose`, `violet`, `slate`, `ocean` | Bắt buộc khi `preset` |
| `color_accent`, `color_bg_from`, `color_bg_to`, `color_fg` | `#RRGGBB` | Chỉ giữ khi `custom`, cần ít nhất một màu; màu thiếu fallback theo palette của `kind` |
| `background_image` | storage key nội bộ | Không nhận URL, đường dẫn tuyệt đối hay `..` |
| `background_fit` | `cover` (mặc định) · `repeat-x` · `contain` | |
| `background_position` | `center` (mặc định) · `top` · `bottom` | |
| `background_overlay` | `none` (mặc định) · `light` · `dark` | Giữ đúng lựa chọn của admin, không tự đổi |

`normalize_theme_and_background` xóa field không dùng theo mode, nên dữ liệu
lưu luôn nhất quán. Client không bao giờ gửi chuỗi CSS hay gradient tự do. Token
màu của preset/kind thuộc code frontend
(`entities/announcement/model/announcement.presentation.js`), dùng chung cho
strip runtime và preview admin.

Upload ảnh nền: `POST /api/site/admin/announcements/backgrounds/`
(`announcement.manage`), lưu vào `site/announcements/backgrounds/`. Chỉ JPEG,
PNG, WebP (không SVG/GIF), ≤1 MB, rộng 640–2400 px, cao 24–120 px; khuyến nghị
khoảng 980×31 đến 1920×48. Trả `path`, `url`, `width`, `height`. Public feed trả
`background.image_url` đã resolve.

Bất biến hiển thị: ảnh chỉ là decorative; message, icon, badge, CTA giữ nguyên
cấu trúc. Chiều cao dải theo nội dung, không bao giờ khóa theo chiều cao ảnh.
Ảnh lỗi thì bỏ lớp ảnh, giữ màu. System item không nhận theme/ảnh tùy chỉnh.
Chi tiết render ở tài liệu runtime frontend.

## 7. API

Tiền tố `/api/site/`.

| Method | Endpoint | Quyền | Ghi chú |
| --- | --- | --- | --- |
| `GET` | `announcements/active/?surface=&path=&locale=` | AllowAny | `{items, next_transition_at, remote_enabled}`; luôn `200`, `private, no-store` |
| `PUT` | `announcements/{public_id}/state/` | Đã đăng nhập | Dismiss/snooze idempotent; gửi `revision`, `dismissal_version`, `action` |
| `POST` | `announcements/events/` | AllowAny, `240/hour` | Batch impression/click/dismiss ≤50, trả `202` |
| `POST` | `announcements/runtime-events/` | AllowAny, `60/hour` | Lỗi runtime PII-free, trả `202` |
| `GET/POST` | `admin/announcements/` | view / manage | List (filter `q`, `lifecycle_state`, `kind`, `surface`, `ordering`, `page`) và tạo |
| `GET/PATCH` | `admin/announcements/{public_id}/` | view / manage | Detail kèm revision, audit; PATCH đổi `internal_name` |
| `POST` | `admin/announcements/{public_id}/revisions/` | manage | Tạo revision mới |
| `POST` | `admin/announcements/{public_id}/duplicate/` | manage | |
| `POST` | `admin/announcements/{public_id}/{publish,pause,resume,archive,reset-dismissals}/` | publish | |
| `POST` | `admin/announcements/backgrounds/` | manage | Upload ảnh nền |
| `GET` | `admin/announcements/{public_id}/metrics/` | view | `date_from`/`date_to`, mặc định 30 ngày, tối đa 93 ngày |

State API: action phải khớp `dismiss_mode` (`close` → `dismiss`, `snooze` →
`snooze`); `locked` hoặc action sai trả `400`; revision/version lệch trả `409`
`announcement_state_stale`. Khách không gọi API này; trạng thái lưu ở
`localStorage` theo `public_id:dismissal_version`.

## 8. Quyền và audit

| Permission | Khả năng |
| --- | --- |
| `announcement.view` | List, detail, preview, revision, audit, metrics |
| `announcement.manage` | Tạo announcement/revision, đổi tên, duplicate, upload ảnh nền |
| `announcement.publish` | Publish/schedule, pause, resume, archive, reset dismissals |

`manage` và `publish` phụ thuộc `view`. Role mặc định department `content-cv`:
staff có `view` + `manage`; manager có cả ba. Backend là nguồn kiểm quyền cuối.
Mọi mutation ghi `record_admin_action` (action `announcement_*`) chỉ với public
ID, số revision và metadata lifecycle; không ghi cookie, token hay nội dung
nhạy cảm.

## 9. Analytics và consent

- Event batch chỉ được đếm khi signed consent cookie có Analytics bật; thiếu
  consent vẫn trả `202` nhưng không ghi gì. Functional dismiss/snooze không phụ
  thuộc consent.
- Event chỉ nhận cho revision đã từng publish và surface thuộc target; trùng
  trong batch bị gộp.
- Unique event dedupe trong cache (Redis) theo revision–surface–event–ngày–danh
  tính (user ID, hoặc hash của viewer cookie first-party). TTL kết thúc 5 phút
  sau nửa đêm `Asia/Ho_Chi_Minh`. Redis lỗi thì **bỏ** event (không đếm), không
  chặn UI; throttle vẫn fail-open.
- Daily metric không chứa path, IP, user-agent hay viewer ID. Số liệu chỉ đại
  diện người đã bật Analytics. Xem thêm
  [consent và tracking](../04-api/cookie-consent-va-job-view-tracking.md).
- Metric vận hành PII-free: `announcement_feed_latency_ms`,
  `announcement_analytics` (reason `counted`/`duplicate`/`redis_error`/
  `consent_required`/`invalid_event`), `announcement_event_batch_size`,
  `announcement_throttle`, và runtime event `feed_error`/`contract_error`/
  `render_error` với reason enum (`network`, `timeout`, `http_4xx`, `http_5xx`,
  `contract`, `render`, `unknown`).

## 10. Kill switch và rollout

Có hai cờ độc lập:

| Cờ | Lớp | Tác dụng |
| --- | --- | --- |
| `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES` | Backend, runtime | Danh sách surface được phục vụ remote item; mặc định rỗng (fail-closed). Surface tắt: feed trả `remote_enabled=false`, `items=[]`, không query DB |
| `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES` | Frontend, build-time | Bật unified strip theo surface; surface tắt dùng banner cũ. Xem tài liệu runtime |

Frontend chỉ nhận remote item khi `remote_enabled === true`; system message về
xác thực/tuân thủ và banner fallback vẫn chạy khi remote tắt hoặc lỗi.

Trước khi bật một surface, chạy preflight read-only:

```bash
python manage.py announcement_rollout_preflight --require-live-surface candidate --json
```

Lệnh fail khi kill switch chứa surface không hợp lệ, có announcement published
thiếu active revision, critical thiếu `ends_at`, hoặc surface yêu cầu không có
item live. Thứ tự bật và ngưỡng dừng nằm ở
[vận hành và kill switch](../06-deployment/van-hanh-va-kill-switch.md).

Rollback ưu tiên tắt kill switch hoặc quay code; không reverse migration, không
archive/xóa announcement, revision, user state, metric, permission hay audit để
tắt giao diện.

## 11. Failure modes

| Tình huống | Hành vi |
| --- | --- |
| Feed timeout/5xx | Giữ system message, ẩn remote item; header không hỏng |
| Item payload sai | Bỏ riêng item đó |
| URL CTA không an toàn ở client | Bỏ CTA, giữ thông báo |
| Redis lỗi | Bỏ analytics event, không chặn UI |
| Event `429`/5xx | Không retry vô hạn, không chặn CTA |
| `revision_token` cũ | `409`, admin tải lại trước khi thao tác |
| Đổi quyền giữa phiên | Backend trả `403` |
| Qua mốc lịch | Refetch tại `next_transition_at`, khi focus và fallback 60 giây |

## 12. Việc còn mở

- **Retention:** chưa có job xóa `AnnouncementDailyMetric` (chính sách dự kiến
  giữ 25 tháng) hay dọn `AnnouncementUserState`; v1 chỉ archive, không
  hard-delete announcement.
- **Ảnh nền:** chưa có asset riêng cho mobile và chưa dọn ảnh nền không còn
  revision nào dùng.
- **Contrast:** chưa có cảnh báo tương phản chữ/nền cho màu custom; admin tự
  kiểm bằng preview và lớp phủ `light`/`dark`.
