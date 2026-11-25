# ADR-0032: ProCV Connect — nhắn tin NTD ↔ ứng viên qua REST + WebSocket

**Trạng thái:** Đã chấp nhận (thiết kế; xây dựng theo GĐ1–GĐ5 ở đặc tả)
**Ngày:** 26/11/2026
**Owner:** Messaging (`apps.messaging`, app mới, gồm cả lịch hẹn phỏng vấn)
**Đặc tả:** [dac-ta-procv-connect.md](../01-phan-tich/dac-ta-procv-connect.md)
**Mở rộng:** [ADR-0028](adr-0028-realtime-notifications.md)

## Bối cảnh

- NTD và ứng viên chưa có kênh trao đổi trong hệ thống; ba nút "Nhắn tin" đang tắt
  (header ứng viên, Tìm CV, lời mời kết nối).
- Hồ sơ ứng tuyển chỉ người đăng tin (`job.posted_by`) xem được; chặn ứng viên tính
  theo công ty (`CandidateBlock`); bàn giao tin đổi `posted_by`.
- ADR-0028 cho socket chỉ đẩy tín hiệu một chiều rồi client refetch REST. Với chat, mỗi
  tin một lần refetch là thừa, và chat cần biết "đang soạn tin".

## Quyết định

1. **Một hội thoại cho mỗi cặp (tin tuyển dụng, ứng viên).** Phía NTD không lưu cố định
   mà luôn là người đang phụ trách tin (`job.posted_by`): bàn giao tin là hội thoại đi theo,
   không cần đồng bộ. Trạng thái đọc/chưa đọc lưu theo từng phía trên `Conversation`.
   Ràng buộc duy nhất `(job, candidate)`.
2. **Ai được mở:** ứng viên có hồ sơ hiện hành chưa rút vào tin; NTD phụ trách tin với
   ứng viên đã nộp vào tin đó hoặc đã chấp nhận lời mời kết nối gắn tin đó. NTD phải qua
   `ensure_recruiter_candidate_data_access`. Công ty chặn ứng viên thì mọi hội thoại với
   công ty bị khóa, ứng viên chỉ thấy câu trung lập.
3. **Gửi qua REST, nhận qua socket.** `POST …/messages/` đi qua quyền, throttle, validate,
   OpenAPI như mọi API. `client_id` (UUID do client sinh) duy nhất theo người gửi nên gửi
   lại không nhân đôi. Sau commit, `push_to_user` gửi **nguyên tin nhắn** (đúng serializer
   REST của người nhận) tới cả hai bên — ngoại lệ có chủ đích với quyết định 1 của
   ADR-0028: payload không vượt quá thứ REST đã cho phép người nhận đọc.
4. **Thứ tự và bù tin bằng `seq`.** `Conversation.last_seq` tăng dưới `select_for_update`;
   `(conversation, seq)` duy nhất. Client thấy hụt seq hoặc nhận `connected` thì gọi
   `GET …/messages/?after=<seq>`; socket đóng thì poll 60 giây như ADR-0028.
5. **Một socket mỗi tab, giữ đường dẫn cũ.** Vẫn `/ws/notifications/` với vé một lần; không
   đổi nginx/daphne. Consumer nhận thêm đúng một loại tin từ client:
   `{"type":"typing","conversation":"cnv_…"}` (vẫn ≤ 256 byte), kiểm thành viên (nhớ 60
   giây trong consumer), bỏ nếu cách lần trước < 3 giây, chuyển tới người còn lại; không
   lưu DB.
6. **Sự kiện:** `chat.message.created`, `chat.message.updated`, `chat.read`,
   `chat.conversation.updated`, `chat.typing`. Quyết định trạng thái hồ sơ **không** sinh
   tin hệ thống để không lộ quyết định trong cửa sổ hoàn tác 15 giây.
7. **Đính kèm tải thẳng lên API** (PDF, DOCX, PNG, JPG, WEBP), kiểm chữ ký tệp và cấu
   trúc bằng cùng bộ kiểm giấy tờ NTD (`validate_employer_document_file`: pypdf strict,
   giới hạn DOCX, mở ảnh có giới hạn), lưu kho riêng tư và chỉ tải qua API stream kiểm
   thành viên, `Cache-Control: private, no-store`. Không đi qua phiên quét virus vì pipeline
   ClamAV chưa bật ở production; khi bật sẽ chuyển sang upload session. Chia sẻ CV tạo
   `CvVersion` bản chụp và ghi `CvAccessLog` kênh `message`; CV dựng bằng trình tạo CV
   được NTD xuất PDF qua luồng export sẵn có.
8. **Quyền riêng tư:** admin không đọc hội thoại; email nhắc tin chưa đọc không chứa nội
   dung; xóa tài khoản xóa nội dung và tệp của người đó; hội thoại có trong bản xuất dữ
   liệu cá nhân.
9. **Phụ thuộc một chiều:** `messaging` dùng services/selectors của `applications`, `jobs`,
   `cvs`, `employers`, `realtime`; `applications` không import `messaging`. Khóa hội thoại
   tính lúc đọc/gửi (chặn theo công ty, hồ sơ đã rút, tài khoản không hoạt động, công tắc
   admin) nên không cần signal; xóa tài khoản gọi `erase_user_messages` từ `apps.privacy`.

## Phương án đã cân nhắc

- **Gửi tin trực tiếp trên WebSocket** (ack qua socket): độ trễ thấp hơn chút nhưng phải
  viết lại quyền, throttle, validate, tài liệu API cho kênh socket và khó kiểm thử. Bỏ.
- **Hội thoại theo cặp (NTD, ứng viên)** gộp nhiều tin: ít hội thoại hơn nhưng vênh với
  quyền xem hồ sơ theo người đăng và bàn giao từng tin. Bỏ.
- **Giữ tín hiệu thuần + refetch** cho chat: mỗi tin một request thừa, trễ thêm một vòng.
  Bỏ.

## Hệ quả

- Không thêm process hay location nginx; tải socket tăng theo số tin, vẫn trong
  `capacity` 200 của channel layer.
- Mất sự kiện (process realtime khởi động lại) không mất tin: tin đã lưu trước khi đẩy,
  client bù theo seq.
- Cấu hình mới (ADR-0026): `connect_enabled`, `connect_candidate_unanswered_limit` (3),
  `connect_attachment_max_mb` (10), `connect_unread_email_delay_minutes` (30).
