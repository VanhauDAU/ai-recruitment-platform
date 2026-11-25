# ADR-0028: Thông báo thời gian thực qua WebSocket và cửa sổ hoàn tác 15 giây

**Trạng thái:** Đã chấp nhận
**Ngày:** 25/11/2026
**Owner:** Realtime (`apps.realtime`); nội dung thông báo vẫn do `apps.candidates`
và `apps.employers` sở hữu

## Bối cảnh

- Chuông thông báo của ứng viên và NTD, badge "CV chưa xem" chỉ có polling 60–120 giây.
  NTD thấy hồ sơ mới chậm tới 2 phút; mỗi tab mở gọi API liên tục dù không có gì mới.
- Quyết định của NTD (phù hợp, phỏng vấn, nhận, từ chối) báo cho ứng viên sau cửa sổ
  hoàn tác **5 phút**, rồi chờ thêm beat `dispatch_candidate_notifications` (60 giây).
  Toast "Hoàn tác" phía NTD chỉ hiện 10 giây nên phần lớn cửa sổ là thời gian ứng viên
  bị giữ thông tin chứ không phải thời gian NTD thực sự hoàn tác.
- Polling nền chạm `AuthSession.last_seen_at` mỗi phút, nên một tab bỏ mở không bao giờ
  chạm ngưỡng idle 30 phút: chính sách phiên bị vô hiệu hóa ngầm.
- Không có âm thanh khi có thông báo mới; người dùng ở tab khác không biết.

## Quyết định

1. **WebSocket một chiều, chỉ là tín hiệu.** `/ws/notifications/` (Django Channels,
   consumer `NotificationConsumer`) chỉ đẩy `notification.created` /
   `notification.read` kèm `public_id`, `event_type`, `title`, `action_path` của chính
   người nhận. Client luôn refetch qua REST; quyền và dữ liệu vẫn do REST quyết định.
   Client chỉ được gửi `ping`; mọi tin khác hoặc >256 byte bị bỏ.
2. **Xác thực bằng vé một lần.** `POST /api/shared/realtime/ticket/` (JWT như mọi API,
   throttle `realtime_ticket` 30/phút) trả vé ngẫu nhiên sống 30 giây, gắn đúng
   `user`/`sid`/`auth_rev`. Handshake tiêu vé bằng `atomic_pop` (Lua). JWT không bao giờ
   nằm trên URL hay log proxy.
3. **Cùng luật với HTTP, không kéo dài phiên.** Lúc kết nối và mỗi 60 giây, consumer kiểm
   tài khoản còn truy cập được, `auth_revision` không đổi và phiên còn sống bằng
   `is_session_live` (chỉ đọc, không chạm `last_seen_at`). Đăng xuất, khóa tài khoản,
   đổi mật khẩu hay hết idle đều đóng socket với mã `4401`.
4. **Chống mở socket từ site khác.** `SameOriginWebsocketGuard` chỉ nhận Origin cùng host
   hoặc thuộc `CORS_ALLOWED_ORIGINS`.
5. **Chỉ đẩy sau commit, đúng luật hiển thị.** `push_to_user` chạy trong
   `transaction.on_commit`; giao dịch rollback không lộ thông báo. Thông báo ứng viên chỉ
   đẩy lúc được *phát hành* (`delivered_at`), không lúc lên lịch, và chỉ khi
   `show_in_inbox` (ứng viên không tắt kênh website). Hoàn tác trong cửa sổ thắng nhờ cùng
   một UPDATE có điều kiện.
6. **Cửa sổ hoàn tác 15 giây, phát hành đúng giờ.** Key cấu hình mới
   `candidate_status_notify_delay_seconds` (mặc định 15, tối đa 60) thay
   `candidate_status_notify_delay_minutes`. Thông báo hẹn ≤10 phút được task
   `release_candidate_notification` phát hành đúng hạn rồi gửi email ngay; beat 60 giây
   vẫn chạy làm lưới an toàn và cho hạn dài (ân hạn tự từ chối). Toast và thanh quyết định
   đếm ngược đúng thời gian còn lại rồi tự ẩn nút "Hoàn tác".
7. **Polling chỉ còn là dự phòng.** Khi socket mở, chuông và badge tắt `refetchInterval`;
   socket đóng (mạng chặn WebSocket, process realtime bảo trì) thì quay về polling 60/120
   giây. Mỗi lần nối lại client refetch để bù sự kiện lỡ. Ping 25 giây (dưới idle 100 giây
   của Cloudflare), nối lại backoff lũy thừa có jitter tối đa 30 giây.
8. **Âm thanh.** Hiệu ứng `incoming` (cùng tiếng chuông, âm lượng 0,35) qua lớp
   `ToastSoundEffect` sẵn có. Chỉ một tab của tài khoản kêu cho mỗi thông báo (giành quyền
   qua `localStorage`, tab đang xem được ưu tiên). Người dùng tắt/bật chuông ở header panel
   thông báo; lựa chọn lưu trên trình duyệt và đồng bộ giữa các tab.

## Triển khai

- Process `realtime` riêng: `daphne config.asgi:application` cổng 8001; nginx chỉ chuyển
  đúng `location = /ws/notifications/` với header Upgrade. HTTP vẫn ở gunicorn để kết nối
  sống lâu không giữ worker.
- Channel layer Redis (`CHANNEL_LAYERS`, prefix `procv-realtime`, ghi đè được bằng
  `CHANNEL_LAYER_REDIS_URL`). Web, worker, beat đều đẩy sự kiện vào đó.
- Dev: `daphne` đứng đầu `INSTALLED_APPS` nên `runserver` phục vụ cả WebSocket; Vite proxy
  `/ws` với `ws: true`. Phải build lại image backend để có `channels`, `channels-redis`,
  `daphne`.

## Hệ quả

- Tab bỏ mở không còn giữ phiên sống mãi: hết 30 phút không thao tác thì phiên hết hạn như
  chính sách đã định.
- Email "Hồ sơ đã được tiếp nhận" và email quyết định gửi ngay khi phát hành thay vì chờ
  beat.
- Cổng quản trị dùng cùng socket cho hàng chờ (bổ sung 26/11/2026, xem dưới).

## Bổ sung 26/11/2026: hàng chờ quản trị realtime

- **Nhóm thứ hai chỉ cho admin.** Vé ghi `is_admin` lúc tiêu (đọc từ DB); socket của tài
  khoản admin vào thêm nhóm `role.admin`. Kiểm lại phiên mỗi 60 giây cũng so vai trò, đổi
  vai trò thì đóng `4401`.
- **Sự kiện chỉ nêu tên hàng chờ:** `{"type": "admin.queue.changed", "queue": "<khóa>"}`,
  khóa đúng như `/api/admin/dashboard/queues/` (mọi admin vốn đọc được số đếm đó), không
  kèm mã, tên hay nội dung bản ghi.
- **Phát ở một chỗ:** `apps/dashboard/signals/receivers.py` nghe `post_save`/`post_delete`
  của mọi model nuôi hàng chờ (hồ sơ xác thực, giấy tờ, tên miền, yêu cầu cập nhật/tham
  gia, thay đổi trang công ty, báo cáo tin/công ty, yêu cầu dữ liệu cá nhân, lời mời admin)
  và của `Job` khi trường kiểm duyệt đổi. Ai ghi cũng được báo: UV, NTD, worker, admin khác.
  Các chỗ `.update()` hàng loạt (không phát signal) gọi `notify_admin_queue` trực tiếp.
  Vẫn chỉ gửi sau commit.
- **Frontend:** `useAdminQueueRealtime` (layout admin) gom sự kiện 400 ms rồi invalidate số
  đếm, bảng điều khiển và query danh sách của hàng chờ đó; khi socket mở, badge (30 giây),
  bảng điều khiển (60 giây) và trang tên miền (10 giây) tắt polling, socket đóng thì polling
  quay lại.
