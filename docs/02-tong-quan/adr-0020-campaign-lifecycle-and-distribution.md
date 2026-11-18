# ADR-0020: Vòng đời chiến dịch mở rộng và app `campaigns`

**Trạng thái:** Đã chấp nhận
**Ngày:** 18/11/2026
**Owner:** Employers / Campaigns

## Bối cảnh

Chiến dịch tuyển dụng đã có máy trạng thái, nhật ký và phễu theo tin, nhưng
còn mỏng ở nhiều chỗ:
- API chỉ cho ghi `name`;
- chiến dịch chạy ngay khi tạo;
- hoàn tất/hủy chỉ ẩn tin (tin vẫn `active`, dễ hiểu nhầm);
- không có khái niệm lên lịch hay thời gian chạy thật.

Hạng mục nâng cấp (phân phối đa kênh, ghi nhận nguồn, Facebook Page, sức khỏe
chiến dịch) cần một vòng đời rõ ràng và chỗ đặt mã không làm `employers` phình
thêm.

## Quyết định

1. **Trạng thái `scheduled`** giữa `draft` và `active`. Kích hoạt chỉ đi qua
   một đường là `launch_campaign`, sau một checklist dùng chung điều kiện với
   `publish_job`. `POST status/` từ chối `draft|scheduled → active`
   (`CAMPAIGN_LAUNCH_REQUIRED`). Chuyển trạng thái do hệ thống thực hiện đi qua
   `apply_system_campaign_status` với bảng transition riêng.
2. **Kích hoạt tất cả hoặc không gì cả.** Mỗi tin đăng hoặc gắn trong một
   savepoint, gom lỗi rồi rollback cả giao dịch nếu có tin lỗi. Tin đang hiển
   thị chỉ được gắn lúc kích hoạt để không bị ẩn khi chiến dịch còn nháp.
3. **Kích hoạt theo lịch dùng cam kết đã lưu.** `CampaignLaunchPlan` giữ phiên
   bản cam kết đã chấp nhận khi lên lịch. Nếu phiên bản đổi hoặc có blocker thì
   không kích hoạt, giữ `scheduled`, ghi `last_error` và báo NTD một lần cho mỗi
   loại lỗi (fingerprint).
4. **Kết thúc thì đóng tin.** `completed`/`cancelled` chuyển mọi tin `active`
   sang `closed`, ghi lịch sử, áp luật tin ngừng tuyển.
5. **Thời gian chạy thật**: `active_seconds_accumulated` cộng dồn mỗi lần rời
   `active`, cùng `first_activated_at` và `activated_at`, để chỉ số sức khỏe
   chia theo số ngày thực sự chạy.
6. **App `apps.campaigns`** chứa việc thiết lập, lịch chạy và sau này là phân
   phối, đo lường, OAuth, sức khỏe, báo cáo. Model `RecruitmentCampaign`,
   `CampaignActivity` và máy trạng thái ở lại `employers`. Chiều phụ thuộc là
   `campaigns → employers/jobs`.
7. **Hiệu ứng chéo app đi qua signal.** `employers.signals.campaign_status_changed`
   được gửi trong cùng giao dịch, sau khi lưu trạng thái. `jobs/signals.py` đóng
   tin. Nhờ vậy `employers.services` không import `jobs.services`; contract
   layers của import-linter cấm đường vòng
   `jobs.selectors → employers.services → jobs.services`.
8. **Tầng service của `campaigns` không import selectors** (hai tầng ngang
   hàng trong contract layers). Phần đọc phục vụ kích hoạt (`launch_check`) vì
   thế nằm trong `services`.

## Hệ quả

- Tạo nhanh ra nháp. Riêng tạo trong form đăng tin gửi `activate=true` để tin
  sắp đăng có chiến dịch đang chạy.
- Mọi nơi liệt kê trạng thái chưa kết thúc dùng `NON_TERMINAL_STATUSES`, nên
  khóa hoặc cấm tài khoản cũng giữ chiến dịch `scheduled`.
- Beat chạy theo interval nên mọi bước phải idempotent theo ngày giờ Việt Nam.
  Thông báo có dedupe key.
- Các giai đoạn sau thêm bước vào pipeline kích hoạt (phát link, hẹn bài
  Facebook) và receiver cho `campaign_status_changed` (gỡ bài, vô hiệu link) mà
  không phải sửa `employers`.
