# Đăng bài chiến dịch lên Facebook Page

Kênh "Fanpage Facebook" của chiến dịch có thể tự đăng bài lên Fanpage của nhà
tuyển dụng (NTD) đúng giờ hẹn và tự gỡ bài khi chiến dịch kết thúc. Thiết kế ở
[ADR-0021](../02-tong-quan/adr-0021-campaign-facebook-page.md).

## Hai chế độ

| `CAMPAIGN_SOCIAL_PROVIDER` | Dùng khi | Hành vi |
| --- | --- | --- |
| `fake` (mặc định) | Dev, CI, demo không có Meta App | Kết nối trả một Fanpage giả lập; "đăng" và "gỡ" chỉ ghi vào cache. Giao diện gắn nhãn "Chế độ giả lập". |
| `facebook` | Đăng thật | Gọi Graph API của Meta với quyền `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`. |

## Tạo Meta App để đăng thật (Development mode)

Giao diện Meta (11/2026) dùng "trường hợp sử dụng" thay cho chọn loại app. App
dùng cho đăng nhập bằng Facebook **không thêm được** quyền Trang, nên cần một app
riêng cho việc đăng Fanpage.

1. **Tạo app.** Vào <https://developers.facebook.com/apps>, chọn **Tạo ứng dụng**,
   đặt tên (ví dụ "ProCV Fanpage"), ở bước **Trường hợp sử dụng** lọc "Quản lý
   nội dung" rồi chọn **Quản lý mọi thứ trên Trang**. Bước **Doanh nghiệp** có
   thể chọn "Tôi chưa muốn kết nối hồ sơ doanh nghiệp" khi chỉ chạy Development
   mode. Meta hỏi lại mật khẩu Facebook trước khi tạo.
2. **Thêm quyền.** **Trường hợp sử dụng → Quản lý mọi thứ trên Trang → Tùy
   chỉnh**, bấm **Thêm** cho `pages_manage_posts` và `pages_read_engagement`
   (`pages_show_list` có sẵn). Ở Development mode các quyền này "Sẵn sàng thử
   nghiệm" ngay cho người có vai trò trong app, không cần App Review.
3. **Địa chỉ quay về.** Ở Development mode Meta tự cho phép chuyển hướng về
   `http://localhost`, không cần khai. Production khai
   `https://<miền>/api/employer/social/facebook/callback/` trong **Đăng nhập bằng
   Facebook cho doanh nghiệp → Cài đặt → URI chuyển hướng OAuth hợp lệ**. Code
   gửi `scope` trong hộp cấp quyền; không cần tạo "cấu hình" (`config_id`).
4. **Thêm người dùng thử.** Trong **App roles → Roles**, thêm tài khoản
   Facebook sẽ bấm "Kết nối Fanpage" làm Administrator, Developer hoặc Tester.
   Tài khoản đó phải là quản trị viên của Fanpage dùng để thử.
5. **Lấy khóa.** **App settings → Basic** cho **App ID** và **App secret**.
6. **Điền `backend/.env`:**
   ```env
   CAMPAIGN_SOCIAL_PROVIDER=facebook
   FACEBOOK_APP_ID=<App ID>
   FACEBOOK_APP_SECRET=<App secret>
   CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY=<Fernet key riêng>
   ```
   Sinh key bằng
   `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
   Key này không được trùng `SECRET_KEY`, khóa JWT hay khóa SMS. Production sẽ
   từ chối khởi động nếu thiếu hoặc trùng.
7. Restart `backend`, `worker`, `beat`.
8. **Thử.** Vào **Cài đặt tài khoản → Kết nối mạng xã hội**, bấm "Kết nối Fanpage
   Facebook", đồng ý trên Facebook, rồi chọn Fanpage. Sau đó vào một chiến dịch
   đang chạy, thêm kênh "Fanpage Facebook", soạn nội dung, bấm "Hẹn đăng" và chọn
   "Đăng ngay". Beat sẽ đăng trong vòng 1 phút.

Muốn người ngoài danh sách vai trò dùng được thì app phải qua **App Review** và
chuyển sang Live mode. Việc này nằm ngoài phạm vi đồ án.

## Link trong bài khi chạy ở máy cục bộ

Facebook tự đọc link đính kèm để dựng thẻ xem trước; link `localhost` hay IP nội
bộ thì Graph trả lỗi 1500 ("URL không hợp lệ") và bài không đăng được. Provider
chỉ gửi trường `link` khi đó là địa chỉ công khai; ngược lại link được chèn vào
cuối nội dung bài (nếu nội dung chưa có), bài vẫn đăng được nhưng không có thẻ
xem trước. Muốn thấy thẻ xem trước khi demo, đặt `FRONTEND_URL` thành một địa
chỉ công khai (ví dụ đường hầm HTTPS) để link theo dõi của kênh là link công khai.

## Vận hành

- **Token**:
  - chỉ lưu Page token của Fanpage được chọn, mã hóa Fernet
    (`SocialAccountConnection.token_ciphertext`);
  - user token chỉ dùng trong lúc đổi mã OAuth, không lưu;
  - mọi lệnh gọi Graph API kèm `appsecret_proof`.
- **Task** (queue `default`):

  | Task | Lịch | Việc |
  | --- | --- | --- |
  | `dispatch_due_social_posts` | 60 giây | Gom bài đến hạn của chiến dịch đang chạy, mỗi bài một task `publish_social_post`. |
  | `reconcile_social_posts` | 300 giây, và ngay sau khi chiến dịch đổi trạng thái | Chiến dịch kết thúc thì gỡ bài đã đăng và hủy bài chưa đăng. Tạm dừng thì hoãn bài hẹn. Mở lại thì đưa bài hoãn còn hạn về hẹn giờ. Cứu bài kẹt ở "đang đăng" quá 10 phút. |

- **Lỗi khi đăng**:
  - lỗi tạm thời (mạng, timeout, 5xx, mã 1/2/4/17/32/341/613): thử lại sau 1, 5,
    15, 60 phút; quá 5 lần thì báo lỗi;
  - trước khi đăng lại, hệ thống tìm bài cùng link trên Fanpage để không đăng
    trùng nếu lần trước thực ra đã thành công;
  - token hỏng (mã 190/102): kết nối chuyển "Hết hạn" và NTD được báo để kết nối
    lại.
- **Không gỡ được bài** khi kết thúc chiến dịch: bài chuyển `delete_failed` và
  NTD nhận thông báo kèm link để tự xóa.
- **Bàn giao chiến dịch** sang NTD khác: bài chưa đăng trên Fanpage của chủ cũ
  bị hủy (`owner_changed`).
- **Ghim phiên bản Graph API** bằng `FACEBOOK_GRAPH_API_VERSION`; nâng phiên bản
  trước khi Meta ngừng hỗ trợ.
