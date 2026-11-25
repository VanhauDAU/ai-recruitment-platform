# ADR-0019: Một trạng thái hiệu lực cho mỗi tin tuyển dụng

**Trạng thái:** Đã chấp nhận
**Ngày:** 15/11/2026
**Owner:** Jobs

## Bối cảnh

"Đang tuyển / Hết hạn" của cùng một tin được tính ở tám chỗ theo hai múi giờ:
danh sách tin của NTD dùng giờ Việt Nam và có xét cửa sổ hiển thị, còn thống kê
chiến dịch, `campaign_pause_impact`, tổng hợp admin dùng `timezone.localdate()`
(UTC, lệch từ 0h đến 7h sáng) và chỉ xét `deadline`. Dashboard NTD đếm cả tin đã
hết hạn và tin đang bị giữ. Bộ lọc công khai cho hiện tin của NTD chưa duyệt
xác thực hoặc DPA đã cũ, trong khi `candidate_data_access` chặn NTD đó mở hồ sơ,
nên ứng viên nộp được vào tin mà NTD không được xem. Màn NTD chỉ giải thích hai
trong mười lý do một tin bị ẩn. Luật cửa sổ hiển thị chỉ chạy khi cờ
`JOB_LIFECYCLE_V2_MODE=enforce`.

## Quyết định

1. `apps/jobs/models/querysets.py` là nguồn duy nhất:
   - `_visibility_requirements()` liệt kê theo thứ tự mọi điều kiện để tin được
     công khai, mỗi điều kiện có mã, nhãn và hành động khắc phục;
     `_time_requirements()` thêm hạn nộp và cửa sổ hiển thị.
   - `publicly_available_job_filter()` là AND của tất cả, dùng cho mọi đường
     phía ứng viên.
   - `job_effective_state_expression()` trả `JobState`: `draft`, `active`,
     `hidden`, `expired`, `closed`. Bị ẩn được ưu tiên hơn hết hạn vì gia hạn
     không làm tin hiện lại.
   - `with_job_visibility()` annotate trạng thái cùng một cờ cho từng lý do, để
     danh sách giải thích được mọi tin trong cùng một truy vấn.
     `job_visibility_issues()` đọc các cờ đó; `job_state_counts()` và
     `job_state_count_subquery()` đếm theo trạng thái.
2. Điều kiện về người đăng khớp `candidate_data_access`: xác thực đã duyệt cho
   đúng công ty, DPA hiện hành, không compliance hold. Bằng chứng workspace
   (điện thoại, giấy tờ) đã là cổng khi đăng tin nên không lặp lại theo từng
   dòng. `create_application_record` kiểm tra lại bằng readiness gốc dưới khóa,
   cùng với việc chặn ứng viên, nên không có hồ sơ nào nộp vào tin mà NTD không
   mở được.
3. Trang công ty bị `content_policy_hold`, mất DPA hoặc dính compliance hold
   thì tin tự ẩn và tự hiện lại khi khắc phục, không tốn lượt; thời gian vẫn
   chạy theo trần 90 ngày.
4. Mọi mốc ngày nghiệp vụ dùng `common.vietnam_time` (`vietnam_today`,
   `vietnam_day_start`, `TruncDate(..., tzinfo=VIETNAM_TZ)`); `TIME_ZONE` vẫn là
   UTC.
5. Gỡ `JOB_LIFECYCLE_V2_MODE`: cửa sổ hiển thị luôn áp dụng. Migration
   `jobs.0052` điền cửa sổ cho tin còn thiếu mốc.
6. API NTD trả `effective_state` và `visibility_issues`; `visibility_hold` chỉ
   còn mô tả hold của admin hoặc tài khoản, là loại duy nhất chặn sửa tin. Danh
   sách tin có thêm tab "Bị ẩn", dashboard có `jobs_hidden`, chiến dịch có
   `hidden_job_count`, admin lọc được `scope=active|expired|hidden`.

## Hệ quả

- Cùng một tin hiện cùng một trạng thái ở danh sách NTD, chiến dịch, dashboard
  và admin.
- Nhập tin hàng loạt và seed demo chỉ đăng dưới NTD đã xác thực và còn DPA; tin
  cũ của NTD demo chưa xác thực sẽ bị ẩn cho tới khi NTD đó được duyệt.
- Thêm điều kiện hay lý do ẩn mới chỉ cần sửa một danh sách trong
  `querysets.py`.
