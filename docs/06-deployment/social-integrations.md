# Tự đăng bài chiến dịch lên mạng xã hội

Kênh chiến dịch có mạng tự đăng (Fanpage Facebook, Instagram) đăng bài lên tài
khoản mạng xã hội của nhà tuyển dụng (NTD) đúng giờ hẹn, rồi tự gỡ bài khi
chiến dịch kết thúc. Thiết kế nằm ở
[ADR-0021](../02-tong-quan/adr-0021-campaign-facebook-page.md) và
[ADR-0025](../02-tong-quan/adr-0025-campaign-social-networks.md).

## Thật hay giả lập, đặt theo từng mạng

`CAMPAIGN_SOCIAL_LIVE_NETWORKS` liệt kê các mạng gọi API thật, cách nhau dấu
phẩy. Mạng không có trong danh sách chạy bằng provider giả lập.

| Mạng (`key`) | Khi giả lập | Khi thật |
| --- | --- | --- |
| `facebook_page` | Kết nối trả một Fanpage giả lập; "đăng" và "gỡ" chỉ ghi vào cache. Giao diện gắn nhãn "Giả lập". | Gọi Graph API của Meta với quyền `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`. Hướng dẫn tạo app ở mục dưới. |
| `instagram` | Kết nối trả một tài khoản Instagram giả lập; ảnh vẫn được thêm viền thành JPEG như khi đăng thật. | Gọi Instagram Graph API qua Facebook Login với quyền `business_management`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_contents`. Xem mục Instagram. |

`CAMPAIGN_SOCIAL_PROVIDER=facebook` là cách bật cũ, được hiểu là
`CAMPAIGN_SOCIAL_LIVE_NETWORKS=facebook_page`. Test luôn chạy giả lập, bất kể
`.env` đặt gì.

## Fanpage Facebook

### Tạo Meta App để đăng thật (Development mode)

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
   CAMPAIGN_SOCIAL_LIVE_NETWORKS=facebook_page
   FACEBOOK_APP_ID=<App ID>
   FACEBOOK_APP_SECRET=<App secret>
   CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY=<Fernet key riêng>
   ```
   Sinh key bằng
   `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
   Key này không được trùng `SECRET_KEY`, khóa JWT hay khóa SMS. Production sẽ
   từ chối khởi động nếu thiếu hoặc trùng.
7. Restart `backend`, `worker`, `beat`.
8. **Thử.** Vào **Cài đặt tài khoản → Kết nối mạng xã hội**, ở thẻ "Fanpage
   Facebook" bấm "Kết nối Fanpage Facebook", đồng ý trên Facebook, rồi chọn
   Fanpage. Sau đó vào một chiến dịch đang chạy, thêm kênh "Fanpage Facebook",
   soạn nội dung, bấm "Hẹn đăng" và chọn "Đăng ngay". Beat sẽ đăng trong vòng 1
   phút.

Muốn người ngoài danh sách vai trò dùng được thì app phải qua **App Review** và
chuyển sang Live mode. Việc này nằm ngoài phạm vi đồ án.

### Ảnh trong bài

Bài có ảnh được đăng hai bước: từng ảnh tải lên `/{page}/photos` với
`published=false` (gửi thẳng tệp nên chạy được cả ở máy cục bộ), rồi một bài
`/{page}/feed` gắn các ảnh qua `attached_media`. Graph bỏ qua `link` khi bài có
ảnh, nên link theo dõi luôn nằm trong nội dung. Ảnh chỉ được lấy từ ảnh đã tải
lên cho chính chiến dịch hoặc ảnh bìa, logo hiện tại của công ty.

### Link trong bài khi chạy ở máy cục bộ

Facebook tự đọc link đính kèm để dựng thẻ xem trước; link `localhost` hay IP nội
bộ thì Graph trả lỗi 1500 ("URL không hợp lệ") và bài không đăng được. Provider
chỉ gửi trường `link` khi đó là địa chỉ công khai; ngược lại link được chèn vào
cuối nội dung bài (nếu nội dung chưa có), bài vẫn đăng được nhưng không có thẻ
xem trước. Muốn thấy thẻ xem trước khi demo, đặt `FRONTEND_URL` thành một địa
chỉ công khai (ví dụ đường hầm HTTPS) để link theo dõi của kênh là link công khai.

## Instagram doanh nghiệp

Instagram kết nối qua **Facebook Login**, dùng cùng Meta App với Fanpage
([ADR-0025](../02-tong-quan/adr-0025-campaign-social-networks.md)). Tài khoản
Instagram phải là tài khoản chuyên nghiệp (doanh nghiệp hoặc nhà sáng tạo) và
**đã liên kết với một Fanpage**. Fanpage nào chưa liên kết Instagram sẽ không
hiện trong danh sách chọn. ProCV lưu Page token của Fanpage đó. Token này không
hết hạn theo thời gian, nên không cần làm mới.

### Bật Instagram trong Meta App

Tên mục trong giao diện Meta có thể khác đôi chút theo thời điểm.

1. Mở app "ProCV Fanpage", vào **Trường hợp sử dụng → Thêm trường hợp sử
   dụng**, chọn "Quản lý tin nhắn và nội dung trên Instagram", rồi chọn bản
   thiết lập **dùng Facebook Login** (không chọn bản đăng nhập bằng Instagram).
2. Ở mục **Thiết lập API bằng thông tin đăng nhập trên Facebook**, bấm "Add
   required content permissions" (thêm `instagram_basic`,
   `instagram_content_publish`, `pages_read_engagement`, `business_management`,
   `pages_show_list`), rồi ở **Quyền và tính năng** thêm
   `instagram_manage_contents` để gỡ bài. Thiếu `business_management` thì Trang
   thuộc danh mục doanh nghiệp trả về không kèm tài khoản Instagram, và danh
   sách chọn sẽ rỗng.
   Với tài khoản bạn sở hữu hoặc quản lý và có vai trò trong app, Standard
   Access là đủ, không cần App Review.
3. Trong ứng dụng Instagram, chuyển tài khoản sang tài khoản chuyên nghiệp, rồi
   liên kết với Fanpage (Meta Business Suite → Cài đặt → Tài khoản Instagram).
4. **Địa chỉ quay về.** Ở Development mode Meta tự cho phép `http://localhost`.
   Production khai thêm `https://<miền>/api/employer/social/instagram/callback/`
   cạnh địa chỉ của Fanpage.
5. Trong `backend/.env`, thêm `instagram` vào danh sách mạng đăng thật:
   ```env
   CAMPAIGN_SOCIAL_LIVE_NETWORKS=facebook_page,instagram
   ```
   Restart `backend`, `worker`, `beat`.
6. **Thử.**
   - Vào **Cài đặt tài khoản → Kết nối mạng xã hội**, ở thẻ "Instagram doanh
     nghiệp" bấm kết nối và chọn tài khoản.
   - Thêm kênh "Instagram" vào một chiến dịch đang chạy, soạn bài có ít nhất
     một ảnh, rồi đăng.

### Ảnh và nội dung

- **Ảnh là bắt buộc.** Instagram tự tải ảnh qua URL, nên ảnh phải có địa chỉ
  công khai. Ảnh của ProCV nằm trên R2 công khai, nên chạy được cả ở máy cục bộ.
- **Định dạng và tỷ lệ.** Instagram chỉ nhận JPEG có tỷ lệ từ 4:5 đến 1.91:1.
  Lúc đăng, ProCV tạo một bản JPEG thêm viền trắng cho vừa tỷ lệ và rộng tối đa
  1440 px. Bản này lưu ở `campaigns/<mã>/social/fit/` và được dùng lại ở lần
  đăng sau; ảnh gốc giữ nguyên. Khung xem trước trong ngăn soạn bài hiện đúng
  phần viền đó.
- **Nhiều ảnh** được đăng thành một bài dạng carousel. ProCV cho tối đa 10 ảnh;
  Instagram cho tối đa 20.
- **Chú thích** dài tối đa 2.200 ký tự. Link trong chú thích không bấm được,
  nên link theo dõi được ghi ở cuối nếu nội dung chưa có.
- **Giới hạn số bài.** Instagram giới hạn số bài đăng qua API trong 24 giờ
  (tài liệu Meta ghi 50 hoặc 100). Vượt giới hạn thì Graph trả mã 9 và ProCV
  thử lại theo lịch thử lại thông thường.
- **Gỡ bài** gọi `DELETE /<media-id>`. Tài liệu Meta ghi thao tác này cần user
  token, còn ProCV dùng Page token. Nếu Meta từ chối, bài chuyển "Cần tự gỡ
  bài" và NTD nhận link để tự xóa. Cần kiểm lại khi thử với tài khoản thật.

## Vận hành (chung cho mọi mạng)

- **Token**:
  - chỉ lưu token của tài khoản được chọn (với Facebook là Page token), mã hóa
    Fernet (`SocialAccountConnection.token_ciphertext`);
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
  - trước khi đăng lại, hệ thống tìm bài cùng link trên tài khoản để không đăng
    trùng nếu lần trước thực ra đã thành công;
  - token hỏng (mã 190/102): kết nối chuyển "Hết hạn" và NTD được báo để kết nối
    lại.
- **Không gỡ được bài** khi kết thúc chiến dịch: bài chuyển `delete_failed` ("Cần
  tự gỡ bài") và NTD nhận thông báo kèm link để tự xóa. Mạng mà API không có
  thao tác gỡ bài (`supports_delete=False`) luôn đi đường này, với mã
  `delete_unsupported`.
- **Bàn giao chiến dịch** sang NTD khác: bài chưa đăng trên tài khoản của chủ cũ
  bị hủy (`owner_changed`).
- **Ghim phiên bản Graph API** bằng `FACEBOOK_GRAPH_API_VERSION`; nâng phiên bản
  trước khi Meta ngừng hỗ trợ.
