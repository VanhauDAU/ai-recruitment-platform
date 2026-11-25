# ADR-0030: Thứ tự và nhãn tin tuyển dụng công bằng, một mốc xếp hạng

**Trạng thái:** Đã chấp nhận
**Ngày:** 25/11/2026
**Owner:** Việc làm (`apps.jobs`)
**Thay thế:** ADR-0012 §2.5 (presentation và ranking); hoàn tất phần còn sót của [ADR-0015](adr-0015-remove-commercial-services.md)

## Bối cảnh

ADR-0015 đã xóa toàn bộ gói dịch vụ, nhưng `Job` vẫn giữ ba trường của mô hình cũ:

| Trường | Ai gán | Ảnh hưởng |
|---|---|---|
| `tier` (standard/featured/top) | admin sửa tay trong Django admin; seed gán ngẫu nhiên 65/25/10 | xếp đầu `/viec-lam` mặc định, nhãn "Tài trợ", thẻ màu xanh/cam, tie-break gợi ý, email |
| `is_hot` | admin / seed 18% | nhãn HOT, +2 điểm khối nổi bật trang chủ |
| `is_urgent` | admin / seed 18% | nhãn GẤP, +2 điểm trang chủ, sắp xếp "Cần tuyển gấp" |

Không ai mua gì nhưng một số tin vẫn được gắn "Tài trợ" và đẩy lên đầu, không công bằng với
các tin khác. Ngoài ra danh sách xếp theo lần duyệt đầu, còn trang chủ, gợi ý, email báo việc
và thống kê "mới nhất" lại đọc `published_at`, mà mở lại tin gán `published_at = now`. Đóng rồi
mở lại tin vì vậy thành một cách làm mới miễn phí ngầm, chỉ có tác dụng ở vài bề mặt.

## Quyết định

1. **Không có thứ hạng trả phí hay nhãn gán tay.** Xóa `tier`, `is_hot`, `is_urgent`
   (migration `jobs.0009`), nhãn "Tài trợ" và thẻ màu. Mọi thẻ tin cùng một kiểu.
2. **Chỉ có nhãn hệ thống tính từ dữ liệu thật** (`apps/jobs/domain/listing.py::job_presentation`),
   API trả `presentation = {labels: [{code, text, tone}]}`:
   - `closing_soon` "Sắp hết hạn": hạn nộp còn ≤ N ngày (lịch Việt Nam). N là cấu hình
     `job_closing_soon_days`, mặc định 7, kẹp 1–30.
   - `fast_response` "Phản hồi nhanh": huy hiệu Sấm Chớp (ADR-0027).
3. **Một mốc xếp hạng: lần đăng đầu.** `listing_recency() = Coalesce(first_approved_at,
   published_at, created_at)` (bản Python `Job.listing_recency_at`) dùng cho danh sách, gần
   bạn, điểm độ mới trang chủ, gợi ý (luật và theo tin đã lưu), email báo việc và theo dõi
   công ty, thống kê "mới nhất", công ty nổi bật và bộ chọn ghim. Sửa, đóng/mở lại, gia hạn,
   khôi phục sau kiểm duyệt đều không đổi thứ hạng; tin mở lại không bị gửi lại như tin mới.
4. **Tin cũ.** Tự rơi xuống và hết hạn sau tối đa 90 ngày. Vẫn có lượt ở khối "Việc làm nổi
   bật" trang chủ vì khối này xếp theo điểm chất lượng (lương công khai +3, Sấm Chớp +2, độ
   mới +2/+1, ≥5 hồ sơ +1) và xoay vòng theo seed. Muốn lên đầu lại thì nhân bản thành tin
   mới, tính vào hạn mức đăng tin. Không có nút "làm mới tin".
5. **Sắp xếp cho ứng viên:** mặc định = Mới đăng; thêm "Lương cao nhất" (`salary_desc`) và
   "Sắp hết hạn nộp" (`closing_soon`: `deadline ASC NULLS LAST`, rồi theo mốc). Bỏ `urgent`
   (API trả 400); frontend bỏ qua giá trị `sort` cũ trong URL.
6. **Ghim tin trên trang công ty giữ nguyên:** đó là trang riêng của nhà tuyển dụng, nhãn
   "Nổi bật" chỉ hiện ở đó.
7. **Dọn kèm:** bộ lọc `tier` của admin, các trường presentation không ai đọc
   (`sponsored`, `card_tone`, `display_reason`, `placement`, `active_until`), hàm dựng nhãn dự
   phòng ở frontend, `ranking_seed` gửi lên `/public/jobs/`, `JobListRankingSync`, pill "TOP"
   theo `brand_slug` ở khối nổi bật, chủ đề tư vấn "gói dịch vụ" (migration `employers.0011`
   gỡ khỏi dữ liệu cũ).

## Hệ quả

- Khách hàng của nền tảng có thứ tự giải thích được bằng một câu: "tin mới đăng trước".
- Mốc là biểu thức `Coalesce` nên không dùng được index `published_at`; quy mô hiện tại đủ
  nhanh. Cột `listing_recency` có index vẫn nằm trong kế hoạch chuẩn bị deploy.
- Danh sách tốn thêm một lượt đọc cấu hình mỗi request (production đọc từ cache).
