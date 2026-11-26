# Quyết định kiến trúc (ADR)

Mỗi ADR ghi một quyết định có tác động lâu dài, gồm bối cảnh, lựa chọn đã cân nhắc
và hệ quả. ADR không sửa nội dung sau khi chấp nhận. Khi quyết định thay đổi,
viết ADR mới và cập nhật cột "Thay thế bởi" ở bảng dưới.

## Danh sách

| Số | Quyết định | Trạng thái | Thay thế bởi |
| --- | --- | --- | --- |
| [0012](adr-0012-job-services-architecture.md) | Vòng đời tin và dịch vụ gia tăng tuyển dụng | Thay thế một phần | 0014 (duyệt tin), 0015 (dịch vụ), 0030 (§2.5 thứ tự và nhãn) |
| [0013](adr-0013-public-companies-api.md) | API công khai cho danh bạ công ty | Chấp nhận | |
| [0014](adr-0014-job-post-moderation.md) | Hậu kiểm tin tuyển dụng thay cho duyệt trước | Chấp nhận | |
| [0015](adr-0015-remove-commercial-services.md) | Gỡ dịch vụ thương mại và yêu cầu tư vấn | Chấp nhận | |
| [0016](adr-0016-remove-two-factor-auth.md) | Gỡ xác thực hai bước (2FA/MFA) | Chấp nhận | |
| [0017](adr-0017-company-page.md) | Trang công ty công khai và quyền biên tập trang | Chấp nhận | |
| [0018](adr-0018-remove-admin-rbac.md) | Gỡ phân quyền theo phòng ban/chức danh, còn hai cấp quản trị | Chấp nhận | |
| [0019](adr-0019-job-effective-state.md) | Một trạng thái hiệu lực cho mỗi tin tuyển dụng | Chấp nhận | |
| [0020](adr-0020-campaign-lifecycle-and-distribution.md) | Vòng đời chiến dịch mở rộng và app `campaigns` | Chấp nhận | |
| [0021](adr-0021-campaign-facebook-page.md) | Đăng bài chiến dịch lên Facebook Page qua provider adapter | Chấp nhận | 0025 mở rộng sang nhiều mạng |
| [0022](adr-0022-backend-structure.md) | Cấu trúc backend: bố cục app, luật phụ thuộc, URL theo cổng | Chấp nhận | |
| [0023](adr-0023-i18n-vi-en.md) | Song ngữ vi/en cho cả ba cổng | Chấp nhận | |
| [0024](adr-0024-content-publish-without-review.md) | Nội dung admin tự soạn đi thẳng Nháp → Xuất bản | Chấp nhận | |
| [0025](adr-0025-campaign-social-networks.md) | Tự đăng bài chiến dịch lên nhiều mạng xã hội | Chấp nhận | |
| [0026](adr-0026-settings-contract.md) | Hợp đồng cấu hình hệ thống (SiteSetting) | Chấp nhận | |
| [0027](adr-0027-flash-badge-responsiveness.md) | Huy hiệu Sấm Chớp tính từ mức phản hồi thật | Chấp nhận | |
| [0028](adr-0028-realtime-notifications.md) | Thông báo thời gian thực qua WebSocket, hoàn tác 15 giây | Chấp nhận | |
| [0029](adr-0029-nearby-jobs-geo.md) | Việc làm gần bạn: tọa độ không PostGIS, geocoding qua adapter (Geoapify) | Chấp nhận | |
| [0030](adr-0030-fair-job-listing.md) | Thứ tự và nhãn tin tuyển dụng công bằng | Chấp nhận | |
| [0031](adr-0031-account-write-throttle.md) | Trần ghi theo tài khoản cho mọi API ghi | Chấp nhận | |
| [0032](adr-0032-procv-connect-messaging.md) | ProCV Connect: nhắn tin NTD ↔ ứng viên qua REST + WebSocket | Chấp nhận | |
| [0033](adr-0033-portal-session-policy.md) | Hạn phiên đăng nhập riêng theo cổng | Chấp nhận | |

## Vì sao không có 0001–0011

ADR-0001 đến ADR-0010 thuộc đợt đại tu 07/2026, nằm ở `docs/adr/` cũ. Commit
`327ae807` (24/07/2026) gỡ chúng cùng tài liệu refactor đã xong; file vẫn còn trong
lịch sử git. Hai quyết định còn hiệu lực đã được viết lại thành luật kiểm tự động:
ADR-0002 (mọi HTTP qua `shared/api`) nằm trong `npm run check:architecture`, còn
ADR-0010 (layout Django app) được [ADR-0022](adr-0022-backend-structure.md) thay thế.
Số 0011 không được dùng. Số thứ tự không dùng lại, để tham chiếu cũ trong commit và
CHANGELOG không trỏ nhầm sang quyết định khác.

## Viết ADR mới

1. Lấy số kế tiếp (hiện là 0034). Tên file `adr-NNNN-<slug-ngắn>.md`.
2. Bắt đầu bằng các dòng `**Trạng thái:**`, `**Ngày:**`, và `**Thay thế:**` nếu có.
3. Thêm một dòng vào bảng trên và link từ đặc tả hoặc tài liệu kiến trúc liên quan.
