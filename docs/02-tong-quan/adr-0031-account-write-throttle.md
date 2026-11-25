# ADR-0031: Trần ghi theo tài khoản cho mọi API ghi

**Trạng thái:** Đã chấp nhận
**Ngày:** 25/11/2026
**Owner:** Hạ tầng API dùng chung (`common/api/throttling.py`)

## Bối cảnh

Trước ADR này DRF chỉ có một throttle mặc định: `PublicApiAnonRateThrottle` cho khách gọi
`/api/public/*`. Khoảng 90 endpoint ghi dữ liệu của người đã đăng nhập không có giới hạn
tần suất nào. Một tài khoản (hoặc một token bị lộ) có thể chạy script tạo kỹ năng vào
catalog công khai ngay lập tức, tạo hàng loạt công ty, nộp đơn và nhắc NTD liên tục, mời
ứng viên, đăng mạng xã hội, tạo link chia sẻ CV hay xuất file tốn CPU.

DRF có một cái bẫy: view tự khai `throttle_classes` (hoặc `get_throttles`) THAY THẾ hẳn
`DEFAULT_THROTTLE_CLASSES` chứ không cộng thêm. Thêm trần vào danh sách mặc định thôi thì
khoảng 40 view đã có throttle riêng (đăng nhập, OTP, upload…) vẫn lọt.

## Quyết định

1. **Trần mặc định cho mọi request ghi của người đã đăng nhập.**
   `AccountWriteRateThrottle(SimpleRateThrottle)` bỏ qua GET/HEAD/OPTIONS và khách, khóa
   theo `user.pk` (văn phòng chung IP không chặn lẫn nhau). Hai lớp chạy song song:
   `AccountWriteBurstThrottle` chặn vòng lặp ngắn, `AccountWriteSustainedThrottle` chặn
   nhịp ghi đều nhưng quá nhiều trong một giờ. Tài khoản quản trị dùng scope `<scope>_admin`
   vì thao tác hàng loạt là chuyện thường. Khi chặn, log WARNING chỉ gồm scope và `user.pk`
   (không email/IP) để chỉnh mức trong rehearsal.
   - Kế thừa `SimpleRateThrottle`, không phải `ScopedRateThrottle`: trần không đọc
     `view.throttle_scope` nên đứng cạnh scope riêng của view mà không giành rate.
2. **`DEFAULT_THROTTLE_CLASSES = (PublicApiAnon, AccountWriteBurst, AccountWriteSustained)`.**
   View đã tự khai throttle bọc `with_account_write_cap(...)` để giữ throttle cũ và gắn lại
   trần; view dùng scope mới dùng `with_default_throttles(...)`.
3. **Scope riêng cho nhóm rủi ro cao** qua `WriteScopedRateThrottle`: chỉ tính request
   ghi, view có thể giới hạn theo `throttle_scope_methods` (ví dụ chỉ tính POST phát hành
   chiến dịch, không tính PUT chọn tin). Người đã đăng nhập khóa theo tài khoản, khách
   theo IP đã kiểm chứng.
4. **Miễn trần** (giữ scope riêng) cho tín hiệu nền trình duyệt tự gửi: lượt xem/hiển thị
   tin, sự kiện và lỗi runtime của thông báo, vé WebSocket. Tính các request này vào trần sẽ
   làm thao tác thật của người dùng bị 429 oan.
5. **Test quét route** (`common/tests/test_throttle_coverage.py`) dựng từng view như lúc
   nhận request và đọc `get_throttles()` thật cho từng method ghi. Route ghi nào thiếu trần
   mà không nằm trong danh sách miễn (có lý do) thì CI đỏ. Test cũng kiểm view rủi ro cao
   dùng đúng scope và mọi scope đang dùng đều có rate cấu hình.

### Mức đã chốt

| Scope | Mức | Ghi chú |
|---|---|---|
| `account_write_burst` | 90/phút | trần chung, mọi tài khoản |
| `account_write_sustained` | 3000/giờ | trần chung, mọi tài khoản |
| `account_write_burst_admin` | 300/phút | tài khoản quản trị |
| `account_write_sustained_admin` | 10000/giờ | tài khoản quản trị |
| `skill_create` | 20/giờ | kỹ năng NTD tạo vào catalog công khai ngay |
| `company_create` | 5/ngày | tạo công ty |
| `company_media_upload` | 30/giờ | logo, ảnh bìa, thư viện ảnh (chỉ POST) |
| `company_update_request` | 10/giờ | yêu cầu cập nhật thông tin công ty |
| `company_join` | 10/giờ | xin gia nhập công ty |
| `company_document_upload` | 20/giờ | giấy tờ xác thực |
| `job_submit` | 30/giờ | gửi duyệt + gửi duyệt lại tin |
| `application_create` | 30/giờ | nộp đơn |
| `application_remind` | 10/giờ | nhắc NTD |
| `review_link_create` | 30/giờ | link mời đánh giá hồ sơ |
| `talent_pool_invite` | 40/giờ | mời ứng viên từ kho ứng viên |
| `application_cv_export` | 30/giờ | NTD xuất CV hồ sơ |
| `campaign_launch` | 10/giờ | phát hành chiến dịch (chỉ POST) |
| `campaign_social_post` | 30/giờ | lên lịch bài đăng mạng xã hội |
| `campaign_ai_content` | 20/giờ | AI viết nội dung kênh |
| `cv_share_link` | 30/giờ | link chia sẻ CV |
| `cv_publish` | 30/giờ | công bố CV |
| `cv_export` | 20/giờ | xuất PDF CV + thử lại |
| `cv_asset_upload` | 60/giờ | ảnh trong CV |
| `avatar_upload` | 20/giờ | avatar (chỉ POST) |
| `privacy_data_request` | 5/ngày | yêu cầu dữ liệu cá nhân |

Hotfix trên production không cần deploy lại: `THROTTLE_RATE_OVERRIDES=scope=mức,...`.
Kiểm thử tải nới hai scope trần chung trong `scripts/loadtest/docker-compose.loadtest.yml`.

## Hệ quả

- Mọi API ghi có giới hạn, kể cả view thêm sau này: quên bọc trần là test quét route đỏ.
- Mỗi request ghi tốn thêm hai lượt đọc/ghi cache (Redis) cho hai bucket.
- Mức quá chặt có thể làm thao tác hợp lệ bị 429 (autosave CV, kéo thả bố cục trang công
  ty). Giảm thiểu: mức trần rộng hơn nhịp người thật nhiều lần, scope admin riêng, log
  WARNING khi chặn để đo trong rehearsal GĐ6, `THROTTLE_RATE_OVERRIDES` để nới nóng.
- View chỉ cho khách (`authentication_classes = []`) không cần trần: `request.user` luôn
  là khách, view đó tự giới hạn theo IP.
- Hai throttle `UserRateThrottle` của chiến dịch (ảnh bài đăng, xuất báo cáo) trước đây dùng
  chung bucket `throttle_user_<pk>`; nay mỗi lớp có scope riêng.
