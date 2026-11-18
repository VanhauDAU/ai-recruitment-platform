# ADR-0021: Đăng bài chiến dịch lên Facebook Page qua provider adapter

**Trạng thái:** Đã chấp nhận
**Ngày:** 18/11/2026
**Owner:** Campaigns

## Bối cảnh

GĐ2 cho NTD link theo dõi và nội dung soạn sẵn để tự đăng tay lên từng kênh.
Kế hoạch đã chốt một tích hợp đăng tự động thật: Fanpage Facebook của chính
NTD, có hẹn giờ và tự gỡ bài khi chiến dịch kết thúc. Meta chỉ cho đăng khi app
có quyền `pages_manage_posts`, nên CI và máy dev không có Meta App vẫn phải chạy
được toàn bộ luồng.

## Quyết định

1. **Provider adapter** (`apps/campaigns/services/social/`):
   - `FacebookPageProvider` gọi Graph API thật;
   - `FakePageProvider` giả lập đầy đủ: kết nối, liệt kê Fanpage, đăng, tìm bài,
     gỡ;
   - chọn bằng `CAMPAIGN_SOCIAL_PROVIDER`; kết nối giả lập gắn nhãn
     `simulated` trên giao diện.
2. **OAuth không dùng JWT ở callback**: trình duyệt quay về từ Facebook không mang
   access token của SPA. `state` là dữ liệu ký (`signing.dumps`) chứa user và một
   nonce dùng một lần lưu cache 10 phút. Sau khi đổi mã, danh sách Fanpage (token
   đã mã hóa) nằm trong cache 10 phút để NTD chọn.
3. **Chỉ lưu Page token, mã hóa Fernet** bằng khóa riêng
   `CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY`; production kiểm tra key hợp lệ và không
   dùng lại secret khác.
4. **Đăng bằng Celery, không đăng trong request**:
   - mỗi bài là một `ScheduledSocialPost` có máy trạng thái riêng;
   - `_claim` khóa dòng rồi chuyển sang `publishing` trước khi gọi Meta, nên hai
     worker không đăng trùng;
   - lần thử lại trước tiên tìm bài cùng link, vì Graph API không có khóa
     idempotency.
5. **Đối soát thay cho hook**: trạng thái chiến dịch đổi (dừng, kết thúc, khóa
   tài khoản, bàn giao) không gọi trực tiếp vào code Facebook.
   `reconcile_social_posts` chạy định kỳ và được đánh thức bằng signal
   `campaign_status_changed` qua `transaction.on_commit`. Nhờ vậy `employers`
   không phụ thuộc `campaigns`.
6. **Bài đăng đi kèm link theo dõi của kênh** (`/r/<code>`), nên hồ sơ đến từ
   Fanpage được ghi nguồn như mọi kênh khác.

## Hệ quả

- Demo và CI không cần Meta App. Đăng thật cần app ở Development mode và người
  bấm kết nối phải có vai trò trong app (xem
  `docs/06-deployment/facebook-page-integration.md`).
- Thêm mạng xã hội khác chỉ cần một provider mới cùng hợp đồng.
- Bài đã đăng không bị gỡ khi chiến dịch tạm dừng (quyết định 18/11). Link trong
  bài dẫn tới trang tuyển dụng ở trạng thái tạm dừng.
