# ADR-0015: Gỡ dịch vụ thương mại và yêu cầu tư vấn

**Trạng thái:** Đã chấp nhận  
**Ngày:** 13/11/2026  
**Owner:** Jobs, Candidate Discovery

## Bối cảnh

App `services` hiện thực catalogue gói dịch vụ, phiên bản gói, quyền lợi
(entitlement), kích hoạt dịch vụ cho tin, số liệu quảng bá, thông báo việc
làm trả phí, remarketing việc đã lưu và tiếp nhận yêu cầu tư vấn. Mảng này
nằm ngoài phạm vi cốt lõi của đồ án (tuyển dụng tích hợp AI phân tích CV và
đối sánh CV–JD), chưa có thanh toán thật và làm tăng đáng kể chi phí bảo trì
của danh sách việc làm, trang chủ và luồng ứng tuyển.

## Quyết định

1. Xóa toàn bộ app `services`: model, API `/api/services/`, tác vụ Celery,
   lệnh quản trị, quyền admin và giao diện ở cả ba cổng.
2. Danh sách việc làm, trang chủ và gợi ý việc đã lưu chỉ còn thứ tự tự
   nhiên; không còn vị trí tài trợ, làm mới tin trả phí hay remarketing.
3. Các nhãn `tier`, `is_hot`, `is_urgent`, `has_flash_badge` trên tin được
   giữ lại. Đây là nhãn do quản trị viên gán tay, không phụ thuộc gói.
4. Vòng đời hiển thị của tin (`requested_visibility_days`,
   `visibility_starts_at`, `visibility_ends_at`) trong ADR-0012 được giữ.

## Trình tự gỡ

1. Gỡ mọi chỗ gọi vào `services` ở `jobs`, `applications`, `employers`,
   cấu hình Celery và frontend.
2. Migration xóa toàn bộ model của `services` và các quyền admin liên quan.
3. Sau khi migration đã chạy ở mọi môi trường, xóa thư mục app và bỏ khỏi
   `INSTALLED_APPS`.

## Hệ quả

- Dữ liệu gói, quyền lợi, kích hoạt và yêu cầu tư vấn bị xóa vĩnh viễn; cần
  sao lưu cơ sở dữ liệu trước khi chạy migration.
- ADR-0012 hết hiệu lực ở các phần catalogue, entitlement, activation và
  presentation tài trợ. Hợp đồng API, runbook rollout dịch vụ tin và chính
  sách phân phối tin tài trợ bị xóa khỏi docs.
