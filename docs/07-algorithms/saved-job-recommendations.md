# Gợi ý từ lịch sử việc làm đã lưu

## Phạm vi

Tài liệu này mô tả endpoint và giao diện tại `/viec-lam-da-luu`:

- `GET /api/jobs/saved/`: danh sách ứng viên đã lưu.
- `GET /api/jobs/recommendations/by-saved/?limit=12`: feed gợi ý theo lịch sử
  lưu, có fallback khi chưa đủ tín hiệu.

Luồng này độc lập với feed “Việc làm phù hợp” tại
`/api/jobs/recommendations/for-me/`. Nó không đọc CV hoặc
`CandidateJobPreference`, không thay đổi `sources` hay trọng số của feed
`for-me`.

## Kết quả khảo sát TopCV

Khảo sát trực tiếp ngày 24/07/2026 ở hai trạng thái:

1. Khi chưa lưu tin nào, trang vẫn hiện empty state, CTA tìm việc và khoảng 25
   card dưới tiêu đề “Việc làm tương tự việc bạn đã lưu”.
2. Tài khoản khảo sát đã cấu hình nhu cầu Software/Backend nhưng danh sách rỗng
   ban đầu trộn nhiều nhóm tuyển dụng, marketing, kỹ thuật, xây dựng và sales.
   Đây là bằng chứng giao diện cho một fallback rộng; không có bằng chứng để
   khẳng định fallback đó đọc nhu cầu công việc.
3. Sau khi lưu ba tin thuộc sales, kỹ thuật và tuyển dụng, nhóm gợi ý chuyển rõ
   sang các chủ đề tương ứng. Markup phân biệt card đã lưu (`SavedJob`) và card
   gợi ý (`SimilarSavedJob`), đồng thời dùng tracking source riêng.
4. TopCV vẫn có thể lặp lại tin vừa lưu trong nhóm tương tự. Sản phẩm này chủ
   động loại trùng để người dùng nhận thêm cơ hội mới.

TopCV không công khai công thức hoặc trọng số tại trang này. Vì vậy các nhận
định trên chỉ là hành vi quan sát được, không phải mô tả thuật toán nội bộ của
TopCV.

## Chiến lược của hệ thống

### Có lịch sử lưu

Selector đọc tối đa 20 tin lưu gần nhất. Mỗi job ứng viên được so độc lập với
từng tin nguồn, sau đó chỉ giữ cặp có điểm cao nhất. Cách pairwise này tránh tạo
một “hồ sơ giả” bằng cách trộn category của tin A, kỹ năng của tin B và địa điểm
của tin C.

| Tín hiệu của một cặp job | Điểm |
| --- | ---: |
| Cùng vị trí chuyên môn chính | 36 |
| Có token chuyên môn tương tự trong tiêu đề | 22 |
| Cùng nhóm ngành chính hoặc category phụ | 12 |
| Kỹ năng chung | 6/kỹ năng, tối đa 24 |
| Cùng tỉnh/thành | 10 |
| Kinh nghiệm bằng nhau / lệch một bậc | 6 / 3 |
| Cùng hình thức làm việc | 5 |
| Cùng loại hình công việc | 5 |

Điểm chặn ở 100; dưới 20 bị loại. Thứ tự tie-break là điểm, thời gian đăng và
primary key để ổn định. Candidate bắt buộc phải có anchor ở taxonomy chính
(trùng specialization hoặc cùng nhóm ngành gốc) hay token chuyên môn trong tiêu
đề; kỹ năng, category phụ, địa điểm, kinh nghiệm và hình thức không thể tự tạo
match. Cùng nhóm ngành chỉ có 12 điểm nên vẫn cần ít nhất một tín hiệu bổ trợ để
qua ngưỡng 20. Điều này ngăn dữ liệu kỹ năng/category phụ bị gắn sai làm một job
khác chuyên môn trở thành “tương tự”. Các từ chức danh/cấp bậc chung như
“trưởng”, “phòng”, “nhân viên”, `manager`, `senior` bị loại trước khi so token.
Khi hai tin thuộc hai nhóm ngành gốc khác nhau, token tiêu đề không được ghi đè
taxonomy; hai specialization khác nhau trong cùng nhóm ngành vẫn có thể khớp
bằng token domain mạnh. Với tin thiếu taxonomy, title-only cần ít nhất hai token
chung hoặc một token domain đủ mạnh (dài từ 5 ký tự hay nằm trong allowlist ngắn
như `AI`, `SEO`, `Java`). Tier trả phí không tạo điểm tương tự.

Candidate pool chỉ gồm tin đang active, chưa hết hạn và thuộc campaign active.
Tin đã lưu hoặc đã ứng tuyển bị loại. Category, địa điểm và kỹ năng đều được
prefetch; pool chấm điểm được chặn ở 500 tin.

### Chưa có tín hiệu

Khi chưa lưu tin nào hoặc không có job đạt ngưỡng, endpoint trả các tin active
mới nhất chưa lưu/chưa ứng tuyển:

```json
{
  "status": "ready",
  "strategy": "recent-active-fallback-v1",
  "source_saved_job_count": 0,
  "results": [
    {
      "public_id": "job_...",
      "similarity_score": 0,
      "similarity_reasons": [],
      "similarity_details": []
    }
  ]
}
```

Fallback không được gọi là “phù hợp” hoặc “cá nhân hóa”. UI dùng tiêu đề “Việc
làm bạn có thể quan tâm” và giải thích rằng kết quả sẽ sát hơn sau khi ứng viên
lưu tin. Khi có tín hiệu thật, `strategy=saved-job-similarity-v1` và UI đổi sang
“Việc làm tương tự việc bạn đã lưu”.

## Contract kết quả

Query `limit` nhận 1–20, mặc định 12. Mỗi phần tử dùng contract
`PublicJobListSerializer` và bổ sung:

```json
{
  "similarity_score": 46,
  "similarity_reasons": [
    "Cùng vị trí chuyên môn",
    "Cùng tỉnh/thành làm việc"
  ],
  "similarity_details": [
    {
      "code": "primary_category",
      "label": "Cùng vị trí chuyên môn",
      "points": 36
    },
    {
      "code": "province",
      "label": "Cùng tỉnh/thành làm việc",
      "points": 10
    }
  ]
}
```

Frontend không tự tính category phổ biến hoặc score. Lưu/bỏ lưu thành công sẽ
invalidate feed để server xếp hạng lại; lỗi feed chỉ ảnh hưởng khối gợi ý, không
che danh sách đã lưu.

## Privacy và giới hạn

- Endpoint candidate-only và scope toàn bộ nguồn theo `request.user`.
- `POST /api/jobs/saved/` dùng cùng predicate public-availability, nên không thể
  lưu tin nháp, chờ duyệt, bị từ chối, đã đóng/hết hạn hoặc thuộc campaign dừng
  chỉ bằng cách đoán `public_id`.
- Đây là similarity rule-based trên hành động lưu tường minh, không đọc CV,
  profile hoặc lịch sử tìm kiếm, nên không dùng consent `AI_RECOMMENDATION`.
- Không có learning-to-rank, impression/click signal, time-decay trọng số hoặc
  snapshot score.
- Fallback theo độ mới không phải recommendation cá nhân hóa.
