# ADR-0027: Huy hiệu Sấm Chớp tính từ mức phản hồi thật của nhà tuyển dụng

**Trạng thái:** Đã chấp nhận
**Ngày:** 25/11/2026
**Owner:** Ứng tuyển (`apps.applications`)
**Đặc tả thuật toán:** [huy-hieu-sam-chop.md](../07-algorithms/huy-hieu-sam-chop.md)

## Bối cảnh

- `Job.has_flash_badge` là cờ admin tick tay trong Django admin (ADR-0012, ADR-0015).
  Seed demo bật ngẫu nhiên 30% số tin. Không có số liệu nào đứng sau cờ này.
- Banner "Huy hiệu Sấm Chớp" ở trang chủ ghi "tin đăng được NTD tương tác trong 24 giờ
  qua", nhưng con số thật là tổng số tin đang có cờ. Đồng hồ "Tự động cập nhật sau"
  chỉ là bộ đếm 4 giờ chạy trên trình duyệt, không có gì cập nhật.
- ADR-0012 mục 2.4 đã ghi hướng đi: "huy hiệu phản hồi nhanh do SLA thực tế".

Ứng viên ngại nộp vào tin không ai trả lời. Một huy hiệu có ý nghĩa thật vừa giúp ứng
viên chọn tin, vừa là đòn bẩy để NTD trả lời hồ sơ nhanh hơn.

## Quyết định

1. **Hệ thống tự cấp và tự gỡ, không ai sửa tay.** Admin chỉ chỉnh ngưỡng trong Cấu hình
   hệ thống, gồm 6 key `flash_badge_*` trong nhóm "Ứng tuyển & SLA". Django admin để
   `has_flash_badge` ở chế độ chỉ xem.
2. **Đơn vị tính là người đăng tin.** Mỗi cặp (công ty, `Job.posted_by`) được tính
   riêng, giống dấu tick xác thực. Tin mới của một người đã đạt được thừa hưởng huy
   hiệu ngay.
3. **"Phản hồi" là quyết định của NTD.** Chỉ tính khi NTD tự chuyển hồ sơ sang phù hợp,
   phỏng vấn, nhận hoặc từ chối, và ứng viên đã được báo mà NTD không hoàn tác
   (`ApplicationStatusHistory.objects.published()`, `changed_by` khác rỗng). Mở xem CV
   hay hệ thống tự từ chối không tính.
4. **Ba tiêu chí cho người đăng, thêm một tiêu chí cho từng tin.**
   - Người đăng cần:
     - đủ số hồ sơ đến hạn;
     - đủ tỷ lệ quyết định đúng hạn;
     - có quyết định trong vài ngày gần nhất.
   - Từng tin còn phải không có hồ sơ nào chờ quá hạn.

   Chi tiết công thức nằm ở tài liệu thuật toán.
5. **Tính lại mỗi giờ.** Celery beat chạy `refresh-flash-badges`.
   - Kết quả ghi vào ảnh chụp `RecruiterResponsiveness`.
   - Sau đó chiếu xuống `Job.has_flash_badge` bằng `QuerySet.update()`, nên không đổi
     `updated_at` của tin. `updated_at` là mốc khóa lạc quan của các luồng sửa tin.
   - Trên tin, mọi chỗ đọc cũ giữ nguyên: nhãn `fast_response`, bộ lọc `?flash_badge=1`,
     email gợi ý việc.
6. **Có hệ quả với ứng viên và NTD.**
   - Phía ứng viên:
     - tin có huy hiệu được cộng 2 điểm trong "Việc làm tốt nhất";
     - trang tìm việc có bộ lọc "Nhà tuyển dụng phản hồi nhanh";
     - trang chi tiết tin hiện số thật, ví dụ "phản hồi 92% hồ sơ, trung bình 1,5 ngày".
   - Phía NTD:
     - dashboard có thẻ tiến độ theo từng tiêu chí;
     - có ba thông báo `flash_badge_granted`, `flash_badge_lost` và
       `flash_badge_at_risk`. Thông báo "sắp mất" gửi khi có hồ sơ sẽ quá hạn trong
       24 giờ tới, mỗi ngày tối đa một lần.

## Hệ quả

- Huy hiệu không mua được và không gán tay được. ADR-0012 và ADR-0015 không còn coi
  `has_flash_badge` là nhãn admin gán.
- Seed demo không còn bật huy hiệu ngẫu nhiên. Muốn thấy huy hiệu trên dữ liệu demo,
  NTD phải ra quyết định thật cho hồ sơ. Khi chưa có tin nào đạt, banner trang chủ tự
  ẩn.
- Số "hồ sơ quá hạn" trên thẻ NTD được đo ngay lúc mở trang. Tiêu chí tỷ lệ và hoạt
  động thì theo ảnh chụp gần nhất, chậm tối đa một giờ.
- Hạn phản hồi mặc định là 72 giờ, trùng mốc nhắc NTD đầu tiên (`recruiter_reminder_days`
  = 3). Hai cấu hình vẫn độc lập.
