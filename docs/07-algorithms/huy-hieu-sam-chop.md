# Huy hiệu Sấm Chớp: thuật toán

Quyết định kiến trúc nằm ở [ADR-0027](../02-tong-quan/adr-0027-flash-badge-responsiveness.md).
Mã nguồn:
- `backend/apps/applications/domain/flash_badge.py`: luật thuần;
- `services/flash_badge.py`: tính và ghi;
- `selectors/flash_badge.py`: đọc.

## Ký hiệu và cấu hình

| Ký hiệu | Key SiteSetting | Mặc định | Khoảng |
| --- | --- | --- | --- |
| bật/tắt | `flash_badge_enabled` | bật | |
| W: cửa sổ xét | `flash_badge_window_days` | 30 ngày | 7–180 |
| S: hạn phản hồi | `flash_badge_response_hours` | 72 giờ | 4–336 |
| N: số hồ sơ tối thiểu | `flash_badge_min_applications` | 5 | 1–100 |
| R: tỷ lệ tối thiểu | `flash_badge_min_response_rate` | 80% | 1–100 |
| A: hoạt động gần đây | `flash_badge_active_days` | 7 ngày | 1–60 |

Giá trị lạ trong DB được kẹp vào khoảng trên, hoặc lấy mặc định. Cách này theo
`parse_policy`.

## Đo một người đăng tin

Người đăng tin là cặp (công ty, `Job.posted_by`). Gọi `t` là thời điểm tính.

1. **Hồ sơ đến hạn.** Một hồ sơ được xét khi thỏa cả ba điều kiện:
   - `is_current`;
   - thuộc tin của cặp đó;
   - `t − W ≤ applied_at ≤ t − S`.

   Hồ sơ còn trong hạn S thì chưa bị tính là trễ. Hồ sơ bị **loại** khỏi phép tính khi
   ứng viên rút trước hạn (`withdrawn_at < applied_at + S`) mà lúc đó chưa có quyết
   định.
2. **Quyết định đầu tiên.** Đây là dòng lịch sử trạng thái sớm nhất thỏa:
   - ứng viên đã được báo và NTD không hoàn tác (`published()`);
   - có `changed_by`;
   - `to_status` thuộc {phù hợp, phỏng vấn, nhận, từ chối}.
3. Từ hai bước trên, tính các số đo sau:
   - `matured` là số hồ sơ đến hạn;
   - `on_time` là số hồ sơ có quyết định đầu tiên trước `applied_at + S`;
   - `rate = ⌊on_time × 100 / matured⌋`;
   - `avg_response_hours` là trung bình từ lúc nộp đến quyết định đầu tiên, tính trên
     các hồ sơ đã có quyết định, kể cả quyết định trễ;
   - `last_decision_at` là thời điểm quyết định gần nhất của cặp.

**Đạt** khi thỏa cả ba điều kiện:
- `matured ≥ N`;
- `rate ≥ R`;
- `last_decision_at ≥ t − A`.

## Chiếu xuống tin

`has_flash_badge = true` khi thỏa cả ba điều kiện:
- cặp đăng tin đang đạt;
- tin công khai (`publicly_available_job_filter`);
- tin **không có hồ sơ quá hạn**, tức không có hồ sơ `submitted`/`viewed` nào có
  `applied_at ≤ t − S`.

## Ví dụ

Cấu hình mặc định. NTD nhận 6 hồ sơ trong 30 ngày qua, đều đã nộp quá 72 giờ.

| Hồ sơ | Diễn biến | Đúng hạn? |
| --- | --- | --- |
| 1–4 | Phù hợp hoặc từ chối sau 1 ngày | có |
| 5 | Phỏng vấn sau 4 ngày | không (trễ) |
| 6 | Hệ thống tự từ chối sau 21 ngày | không |

Kết quả:
- `matured = 6`, `on_time = 4`, nên `rate = 66%`, dưới mức 80%. NTD **chưa đạt**.
- Thẻ tiến độ trên dashboard ghi "Phản hồi trong 72 giờ: 66% (cần từ 80%)".

Nếu hồ sơ 5 được quyết định trong 72 giờ thì `rate = 83%`. Khi đó NTD đạt, với điều
kiện có quyết định trong 7 ngày gần nhất. Mọi tin công khai không có hồ sơ chờ quá hạn
của NTD đều mang huy hiệu.

## Tình huống biên

| Tình huống | Xử lý |
| --- | --- |
| NTD chỉ mở xem CV | Không tính là phản hồi |
| NTD quyết định rồi hoàn tác | Dòng hoàn tác bị loại; tính lại theo quyết định kế tiếp |
| Quyết định đang trong 5 phút chờ hoàn tác | Chưa tính, lần chạy sau sẽ tính |
| Ứng viên rút hồ sơ trong hạn, chưa có quyết định | Loại khỏi phép tính |
| Hồ sơ cũ bị thay bằng lần nộp lại (`is_current = false`) | Không tính; tính lần nộp mới |
| Một tin để hồ sơ chờ quá hạn | Riêng tin đó mất huy hiệu; tin khác vẫn giữ |
| NTD ngừng hoạt động hơn A ngày | Mất huy hiệu và nhận thông báo lý do |
| Người đăng đã rời công ty | Vẫn tính cho tin cũ; không gửi thông báo |
| Admin tắt `flash_badge_enabled` | Gỡ hết ở lần chạy kế tiếp, không gửi thông báo |

## Thông báo NTD

| Sự kiện | Khi nào | Chống trùng |
| --- | --- | --- |
| `flash_badge_granted` | Chuyển từ chưa đạt sang đạt | cặp + `qualified_since` |
| `flash_badge_lost` | Chuyển từ đạt sang chưa đạt, kèm tiêu chí đầu tiên trượt | cặp + thời điểm tính |
| `flash_badge_at_risk` | Đang đạt, có hồ sơ sẽ quá hạn trong 24 giờ tới | cặp + ngày |

## Độ phức tạp

Mỗi lần chạy dùng một số truy vấn gom nhóm cố định:
- hồ sơ đến hạn, với subquery tìm quyết định đầu tiên;
- quyết định gần nhất;
- hồ sơ quá hạn;
- ảnh chụp cũ;
- một lệnh upsert;
- hai lệnh `UPDATE` trên bảng tin;
- truy vấn hồ sơ sắp quá hạn.

Không có truy vấn nào lặp theo từng tin hay từng hồ sơ, nên số truy vấn không có N+1.
