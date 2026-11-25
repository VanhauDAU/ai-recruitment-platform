# ADR-0025: Tự đăng bài chiến dịch lên nhiều mạng xã hội

**Trạng thái:** Đã chấp nhận
**Ngày:** 20/11/2026
**Owner:** Chiến dịch tuyển dụng (`apps.campaigns`)
**Mở rộng:** [ADR-0021](adr-0021-campaign-facebook-page.md)

## Bối cảnh

ADR-0021 đưa vào một tích hợp thật là Fanpage Facebook. Mã đi kèm gắn với
Facebook ở nhiều chỗ:

- `SocialAccountConnection.provider` lẫn hai ý: mạng nào (chỉ có Facebook) và
  kết nối thật hay giả lập (`fake`);
- các cột `page_id`, `page_name` chỉ có nghĩa với Fanpage;
- service, API (`/social/facebook/...`) và giao diện chỉ biết kênh `facebook_page`;
- giới hạn bài (5.000 ký tự, 4 ảnh) là hằng số rải ở backend và frontend.

NTD muốn tự đăng thêm Instagram Business, Threads, LinkedIn và Zalo Official
Account. Zalo OA sau đó đã bỏ, xem mục "Kết thúc đợt". Mỗi mạng có giới hạn và
năng lực khác nhau, chẳng hạn Instagram bắt buộc có ảnh.

## Quyết định

1. **Mạng là dữ liệu miền.** `apps/campaigns/domain/social_networks.py` khai báo
   mỗi mạng bằng một `SocialNetwork`:
   - `key`, ví dụ `facebook_page`;
   - tên nền tảng và nhãn hiển thị;
   - loại kênh `CampaignChannel.Kind` dùng mạng đó;
   - `Capabilities` gồm `max_chars`, `max_images`, `requires_image` và
     `supports_delete`.

   Thêm một mạng nghĩa là thêm một mục ở đây, một provider trong
   `services/social/`, `Kind` tương ứng nếu chưa có, và migration cho choices.
2. **Kết nối có `network` và `simulated`.** Hai cột này thay `provider`.
   - Các cột `page_*` đổi thành `account_id`, `account_name`,
     `account_picture_url`.
   - Unique theo `(owner, network, simulated, account_id)`, nên kết nối giả lập
     không đè kết nối thật.
   - Migration `0004`–`0006` chuyển dữ liệu: `facebook` thành `facebook_page` thật,
     `fake` thành `facebook_page` giả lập.
3. **Thật hay giả lập đặt theo từng mạng.** `CAMPAIGN_SOCIAL_LIVE_NETWORKS` liệt
   kê các mạng gọi API thật.
   - Mạng không có trong danh sách dùng `FakeProvider(network)`, chạy đủ luồng
     kết nối, hẹn giờ, đăng và gỡ.
   - `CAMPAIGN_SOCIAL_PROVIDER=facebook` vẫn được hiểu là
     `CAMPAIGN_SOCIAL_LIVE_NETWORKS=facebook_page`.
   - Test luôn ép mọi mạng về giả lập.
   - Production kiểm tra khóa của từng mạng có trong danh sách live, và bắt buộc
     khóa Fernet riêng khi có ít nhất một mạng live.
4. **Một luồng OAuth cho mọi mạng.** Các endpoint là
   `/api/employer/social/<network>/{authorize,callback,pending/<nonce>}/`.
   - `state` đã ký mang thêm `network`, nên không thể dùng `state` của mạng này
     để hoàn tất mạng khác.
   - `/social/facebook/callback/` giữ lại vì Redirect URI đó đã khai với Meta.
   - Callback quay về `...integrations?network=<n>&social_select=<nonce>` hoặc
     `&social_error=denied|expired|provider`.
5. **Giới hạn kiểm ở backend, frontend đọc từ API.**
   - `schedule_post` chỉ nhận kết nối cùng mạng với kênh, rồi kiểm số ký tự, số
     ảnh và ảnh bắt buộc theo `Capabilities`.
   - `GET /social/networks/` trả danh sách mạng, năng lực và cờ `simulated`.
     Trang Kết nối mạng xã hội và ngăn soạn bài dùng dữ liệu này, không gắn cứng.
6. **Mạng không gỡ được bài thì để NTD tự gỡ.** Khi chiến dịch Hoàn tất hoặc Hủy,
   bài trên mạng có `supports_delete=False` chuyển `delete_failed` với
   `last_error_code=delete_unsupported`. NTD nhận thông báo kèm link bài, giống
   trường hợp gỡ lỗi đã có từ ADR-0021. Nhãn trạng thái là "Cần tự gỡ bài".

## Hệ quả

- Mỗi mạng mới là một PR riêng: Instagram (#287), Threads (#289), LinkedIn
  (#290). PR đó không phải sửa luồng hẹn giờ, thử lại, đối soát hay giao diện
  chung.
- Hạn token và làm mới token chưa có trong khung, vì Facebook không cần. Mạng
  đầu tiên cần (Threads) thêm `token_expires_at` và task làm mới token trong PR
  của nó.
- Thông báo và nhãn hoạt động không còn nhắc "Fanpage" khi không đúng với mọi
  mạng. Mã lỗi `graph_*` vẫn là của Meta.
- Thêm mạng cần cập nhật danh sách mạng hợp lệ trong `config/settings/production.py`
  và mục hướng dẫn trong `docs/06-deployment/tich-hop-mang-xa-hoi.md`.

## Bổ sung: Instagram (PR2)

- **Cách kết nối.** Instagram kết nối qua Facebook Login, dùng chung Meta App và
  lớp `MetaGraphProvider` với Fanpage. Cách này cần tài khoản Instagram liên
  kết với một Fanpage, nhưng gỡ được bài qua API và Page token không cần làm
  mới. "Đăng nhập bằng Instagram" không cần Fanpage, nhưng token hết hạn sau
  60 ngày và không có API gỡ bài, nên không chọn.
- **`Capabilities.image_ratio`.** Mạng có khoảng tỷ lệ ảnh thì nhận bản JPEG thêm
  viền trắng, tạo lúc đăng. Mỗi `PostImage` mang cả bytes (Facebook tải tệp
  lên) lẫn URL công khai (Instagram tự tải về).

## Bổ sung: Threads (PR3)

- Threads dùng Threads Login, App ID/secret riêng và máy chủ
  `graph.threads.com`. `ThreadsProvider` vẫn kế thừa `MetaGraphProvider`, chỉ
  đổi máy chủ, bỏ `appsecret_proof` và đổi tên trường trạng thái container.
  Phần chờ container chuyển lên lớp chung.
- Token hết hạn sau 60 ngày nên `SocialAccountConnection` có thêm
  `token_expires_at`, `SocialNetwork` có `token_days`, provider có
  `refresh(token)`. Task `refresh_social_tokens` chạy mỗi ngày và làm mới token
  còn dưới 10 ngày. Token bị từ chối hoặc đã quá hạn thì kết nối hết hạn và NTD
  được báo. Threads làm mới bằng chính token dài hạn nên không cần cột
  `refresh_ciphertext`. Không mạng nào hiện có cần PKCE.
- Giới hạn ký tự tính cả link theo dõi, vì provider tự thêm link vào cuối khi
  nội dung chưa có.
- Task đăng bài được tới 3 phút, vì mỗi ảnh của carousel phải chờ container
  riêng; carousel 3 ảnh trên Instagram mất 40 giây.

## Bổ sung: LinkedIn (PR4)

- Đăng lên trang cá nhân qua "Share on LinkedIn" (`w_member_social`), kèm
  OpenID Connect (`openid profile`) để lấy `sub` làm person id. Dùng Posts API
  bản mới (`/rest/posts`, ghim phiên bản ở `LINKEDIN_API_VERSION`).
  `LinkedInProvider` không kế thừa lớp Meta.
- `SocialNetwork.token_refreshable=False`: token 60 ngày không làm mới được.
  Task `refresh_social_tokens` gửi `SOCIAL_CONNECTION_EXPIRING` một lần cho mỗi
  token, rồi đánh dấu hết hạn khi tới hạn.
- Không liệt kê được bài của thành viên, nên `find_recent_post` luôn trả
  `None`. Lệnh tạo bài bị quá thời gian chờ báo `post_result_unknown` (không tự
  thử lại), để tránh đăng trùng.
- Mạng có tự đăng nhưng NTD chưa kết nối thì kênh quay về chép để đăng tay.
  Trước đây kênh bị chặn. Đổi để kênh LinkedIn đăng tay hiện có không bị gián
  đoạn, và áp dụng cho mọi mạng.
- Nhãn thông báo của NTD bỏ chữ "Fanpage"; thêm loại "Kết nối mạng xã hội sắp
  hết hạn" (migration employers 0005).

## Kết thúc đợt (21/11/2026)

- Đợt này dừng ở bốn mạng: Fanpage Facebook, Instagram doanh nghiệp, Threads và
  trang cá nhân LinkedIn (#286–#290; #288 sửa lỗi phát hiện khi thử thật).
- **Bỏ Zalo Official Account** theo quyết định của chủ dự án. Code chưa có phần
  nào cho Zalo nên không phải gỡ gì. Muốn thêm lại thì làm như các mạng khác:
  thêm một mục mạng, một provider, `Kind` (kênh `zalo` hiện vẫn đăng tay), cùng
  PKCE và refresh token dùng một lần, nếu API Zalo còn yêu cầu.
- Kênh `zalo`, `facebook_group` và `tiktok` vẫn là kênh đăng tay: ProCV soạn
  nội dung để NTD chép và tự đăng.
