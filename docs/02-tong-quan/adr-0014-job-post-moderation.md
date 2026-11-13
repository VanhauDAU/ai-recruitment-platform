# ADR-0014: Hậu kiểm tin tuyển dụng thay cho duyệt trước

**Trạng thái:** Đã chấp nhận  
**Ngày:** 13/11/2026  
**Owner:** Jobs, Employers, Trust & Safety

## Bối cảnh

Mọi tin tuyển dụng phải qua hàng chờ `pending` và chỉ công khai khi quản trị
viên duyệt. Sửa tin đang tuyển, mở lại tin đã đóng hoặc gia hạn tin hết hạn
cũng đưa tin về hàng chờ. Cách làm này tạo độ trễ cho nhà tuyển dụng, phụ
thuộc vào nhân lực quản trị và không tương xứng với phạm vi đồ án, trong khi
hệ thống đã có ba lớp kiểm soát độc lập: xác thực doanh nghiệp, báo cáo tin
từ ứng viên và tạm ẩn tin theo quyết định quản trị.

## Quyết định

1. Nhà tuyển dụng đăng tin là tin công khai ngay. Không còn trạng thái
   `pending` và `rejected`; vòng đời tin là `draft → active → closed`.
2. Nhà tuyển dụng chịu trách nhiệm về nội dung tin đã đăng. Mỗi lần đưa tin
   lên công khai (đăng tin nháp, mở lại tin đã đóng), nhà tuyển dụng phải xác
   nhận bản cam kết đang có hiệu lực. Backend giữ nội dung và mã phiên bản
   của cam kết, từ chối yêu cầu thiếu hoặc sai phiên bản bằng
   `JOB_RESPONSIBILITY_REQUIRED`, và lưu trên tin thời điểm xác nhận cùng
   phiên bản đã xác nhận. Cam kết bao gồm cả các lần sửa sau đó, nên lưu thay
   đổi trên tin đang tuyển không hỏi lại.
3. Các điều kiện trước đây được kiểm tra khi duyệt nay được kiểm tra khi
   đăng: hồ sơ xác thực của nhà tuyển dụng đã được chấp nhận cho đúng công
   ty, DPA còn hiệu lực, không có compliance hold, tin và chiến dịch không
   bị hold, hạn nhận hồ sơ hợp lệ và vòng đời hiển thị chưa hết. Không đạt
   thì tin vẫn là bản nháp và API trả `JOB_PUBLICATION_BLOCKED` kèm lý do.
4. Sửa tin đang tuyển có hiệu lực ngay và không đổi `published_at`, để việc
   sửa không đẩy tin lên đầu danh sách. Snapshot nội dung được chụp tại lần
   đăng gần nhất; quản trị viên xem được phần đã thay đổi so với snapshot đó.
5. Ứng viên báo cáo tin vi phạm. Tin vẫn hiển thị cho tới khi quản trị viên
   quyết định tạm ẩn (`moderation_hold`) có ghi lý do. Chỉ quản trị viên
   khôi phục được tin đã tạm ẩn. Nhà tuyển dụng thấy tin của mình đang bị tạm
   ẩn, thời điểm và nhóm lý do; ghi chú của quản trị viên không được trả về vì
   có thể trích lời người báo cáo. Trong lúc tạm ẩn, nhà tuyển dụng không sửa,
   gia hạn, mở lại hay sao chép được tin.
6. Quyền admin `job_moderation.approve` và `job_moderation.reject` bị xóa.
   `job_moderation.enforce_visibility` và `job_moderation.resolve_report`
   là hai quyền hậu kiểm.

## Chuyển đổi dữ liệu

- Migration chuyển mọi tin `pending` và `rejected` về `draft`, ghi một dòng
  lịch sử trạng thái có ghi chú chuyển đổi.
- Lệnh `publish_converted_pending_jobs` đăng lại các tin từng ở `pending`
  qua đúng luồng đăng tin, nên chỉ tin đạt điều kiện ở mục 3 mới công khai.
  Tin không đạt vẫn là bản nháp để nhà tuyển dụng tự xử lý. Các tin này được
  gửi duyệt trước khi có cam kết ở mục 2 nên công khai mà không có bản ghi
  xác nhận; tin đã công khai từ trước ADR này cũng vậy.
- Lý do từ chối cũ còn trong lịch sử trạng thái; cột `rejected_reason` bị xóa.
- `JobModerationEvent` là lịch sử bất biến. Hai hành động `approve` và
  `reject` được giữ trong enum để đọc bản ghi cũ, không còn được ghi mới.

## Tên giữ lại có chủ đích

Các cột `approved_at`, `first_approved_at`, `approved_snapshot` và
`approved_snapshot_at` giữ nguyên tên vì đã nằm trong hợp đồng API công khai
và trong mốc neo vòng đời hiển thị. Từ ADR này chúng mang nghĩa "thời điểm
và nội dung của lần đăng công khai".

Capability `job_approval` trong readiness của nhà tuyển dụng cũng giữ nguyên
khóa vì đã được lưu trong các snapshot kiểm toán của hồ sơ xác thực. Từ ADR
này nó mang nghĩa "được phép đưa tin lên công khai".

## Hệ quả

- Nhà tuyển dụng đã xác thực không còn phải chờ; hàng chờ và SLA duyệt tin
  của quản trị viên bị gỡ.
- Rủi ro tin xấu lọt lên công khai tăng. Biện pháp bù: chốt xác thực doanh
  nghiệp tại lúc đăng, quota đăng tin, báo cáo từ ứng viên, tạm ẩn tin và
  khóa tài khoản vi phạm bằng `policy_hold`.
- Thay thế các phần về duyệt tin trong
  [`ke-hoach-chien-dich-va-vong-doi-tin.md`](../03-database/ke-hoach-chien-dich-va-vong-doi-tin.md)
  và [`admin-job-management-plan.md`](../08-frontend/admin-job-management-plan.md).
