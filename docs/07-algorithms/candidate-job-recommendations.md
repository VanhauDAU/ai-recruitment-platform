# Gợi ý việc làm cho ứng viên

## Phạm vi

Tài liệu này mô tả đúng phiên bản rule-based đang chạy cho:

- `GET /api/jobs/recommendations/for-me/`: feed “Việc làm phù hợp” trong tài khoản.
- `GET /api/jobs/recommendations/by-cv/{cv_public_id}/`: tối đa 6 việc làm sau khi lưu một CV.
- `GET /api/jobs/recommendations/inline/`: lane 0 hoặc 1–2 tin được chèn vào kết quả
  tìm việc.
- `POST/DELETE /api/jobs/recommendations/hidden/...`: ẩn và hoàn tác ẩn một tin
  trên các bề mặt cá nhân hóa.

Gợi ý riêng từ lịch sử lưu dùng contract và trọng số khác, xem
[`saved-job-recommendations.md`](./saved-job-recommendations.md).

TopCV được dùng để khảo sát nhu cầu sản phẩm, không phải nguồn cho công thức nội
bộ. [FAQ TopCV](https://www.topcv.vn/faqs/find-job-and-apply/cai-dat-thong-bao-viec-lam-cai-dat-goi-y-viec-lam-phu-hop-nhu-the-nao.html)
nêu ba nhóm tín hiệu: cài đặt gợi ý, từ khóa hồ sơ/CV và hành vi tìm kiếm. Sản
phẩm hiện chủ động giới hạn feed tài khoản, homepage, inline và email vào nhu cầu
công việc đã lưu. Vì vậy `sources.cv=false`, `source_cv=null` và
`sources.search_activity=false`. Cụm “Phù hợp với tìm kiếm của bạn” trong lý do
hiển thị là cách diễn đạt cho vị trí người dùng đã khai báo, không có nghĩa hệ
thống đọc lịch sử truy vấn.

## Nguồn dữ liệu

Feed ứng viên và email suitable chỉ dùng `CandidateJobPreference`:

1. Tối đa 5 vị trí taxonomy và tối đa 5 vị trí tự nhập, hai giới hạn độc lập.
2. Tối đa 20 kỹ năng taxonomy do ứng viên chọn.
3. Lương VND, kinh nghiệm, tỉnh/thành và khả năng chuyển nơi làm việc.

Không có truy vấn `UserCv` trong hai luồng này. Chưa cấu hình preference thì trả
`status=preferences_required`, không lấp bằng việc làm ngẫu nhiên. Giới tính,
việc đã lưu và lịch sử tìm kiếm không tham gia scoring. Tin đã ứng tuyển hoặc đã
bị chính ứng viên ẩn được loại trước giới hạn 500 và trước phân trang.

Endpoint `by-cv` là use case độc lập sau khi lưu CV, tiếp tục đọc đúng CV được
scope theo owner và dùng tín hiệu của CV như trước.

## Consent và phạm vi đọc

- `CandidateConsent.AI_RECOMMENDATION=granted` là điều kiện trước khi chạy
  ranking cá nhân hóa; riêng `by-cv` kiểm consent trước khi đọc nội dung CV.
- Feed `for-me` trả `status=consent_required` và danh sách rỗng khi thiếu hoặc đã
  rút consent.
- Endpoint `by-cv` kiểm ownership trước, sau đó trả `403` khi thiếu consent.
- Người dùng có thể bật/tắt lại consent tại
  `/tai-khoan/cai-dat-goi-y-viec-lam`; mỗi quyết định tiếp tục được ghi vào
  `CandidateConsentEvent`.

## Rule và trọng số

| Tín hiệu | Điểm tối đa | Điều kiện |
| --- | ---: | --- |
| Vị trí chuyên môn chính | 38 | Category trùng và title có token chuyên môn tương ứng |
| Tên vị trí | 24 | Title job chứa vị trí taxonomy hoặc vị trí tự nhập trong nhu cầu công việc |
| Kỹ năng | 24 | 6 điểm/kỹ năng trùng, tối đa 4 kỹ năng |
| Địa điểm | 10 | Tỉnh của job trùng tỉnh mong muốn |
| Sẵn sàng chuyển nơi | 3 | Job ngoài tỉnh mong muốn và candidate đã bật relocate |
| Kinh nghiệm | 6 | Kinh nghiệm candidate không thấp hơn yêu cầu |
| Lương | 8 | Job dùng VND và khoảng lương (kể cả `FROM`/`UP_TO`) giao với lương mong muốn theo biên 80–125% |

Tổng điểm được chặn ở 100. Job dưới `20` điểm bị loại. Tier trả phí không cộng
điểm; nó chỉ là tie-breaker sau compatibility, tiếp theo là thời gian đăng và
primary key để thứ tự ổn định.

Trước khi score, selector chỉ lấy tin đang active, chưa hết hạn và thuộc campaign
active. Query được prefilter bằng category, kỹ năng taxonomy hoặc title không
phân biệt dấu rồi giới hạn tối đa 500 ứng viên xếp hạng. Các quan hệ
category/location/skill được prefetch; regression query budget khóa số query
không tăng khi số job kết quả tăng.

`match_details` giữ chi tiết và điểm để giải thích/debug contract cũ.
`match_reasons` chỉ là câu trình bày:

- category hoặc position: `Phù hợp với tìm kiếm của bạn`;
- skill: `Phù hợp với kỹ năng của bạn`;
- nếu chỉ đủ điểm nhờ tín hiệu yếu như địa điểm, lương và kinh nghiệm thì mảng
  này rỗng và UI không dựng khối “Vì sao phù hợp”.

## Contract feed `for-me`

Query:

- `page`: số nguyên từ 1, mặc định 1.
- `page_size`: 1–20, mặc định 10.

Các field điều phối chính:

```json
{
  "status": "ready",
  "strategy": "candidate-preference-rule-v2",
  "preference_configured": true,
  "needs_setup": false,
  "consent_required": false,
  "sources": {
    "job_preferences": true,
    "cv": false,
    "search_activity": false
  },
  "source_cv": null,
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 12,
    "total_pages": 2,
    "next_page": 2,
    "previous_page": null
  }
}
```

Mỗi job giữ `PublicJobListSerializer` và thêm `match_score`,
`match_details[{code,label,points}]`, `match_reasons[]`, `is_high_match`.
Frontend chỉ giải thích từ các field này, không tự tính lại điểm.

`match_score` và `is_high_match` còn trong API để tương thích client; giao diện
mới không hiển thị phần trăm hoặc badge mức độ phù hợp.

## Lane inline và thao tác ẩn

`GET /api/jobs/recommendations/inline/` yêu cầu `ranking_seed` theo mẫu
`[A-Za-z0-9_-]` dài tối đa 64 ký tự và `excluded` là CSV tối đa 50 public ID của
trang canonical; `page>=1` và mặc định là 1. Sau khi kiểm setup/consent, hash SHA-256 của
`candidate + ranking_seed + page` quyết định xác suất hiển thị 40%. Nhánh
`not_shown` dừng trước truy vấn/scoring job. Nhánh hiển thị trả 1–2 job từ pool
xếp hạng đầu, cùng `after_result_index` zero-based trong khoảng 3–7. Kết quả ổn
định với cùng candidate/seed/page và không phụ thuộc filter/sort của lane public.

Inline loại các ID canonical client gửi, tin đã ứng tuyển và tin đã ẩn trước cap.
Job dùng nguyên `PublicJobListSerializer`, vì vậy presentation tài trợ vẫn được
giữ nguyên.

`POST /api/jobs/recommendations/hidden/` nhận `job_public_id` và `source` thuộc
`matching|homepage|inline`. Unique `(candidate, job)` làm POST idempotent.
`DELETE /api/jobs/recommendations/hidden/{job_public_id}/` chỉ xóa bản ghi của
actor hiện tại và cũng idempotent. Tin bị ẩn không còn ở `for-me`, homepage dùng
feed này, inline hoặc email suitable; public search, job detail và danh sách đã
lưu không bị ảnh hưởng. Hệ thống chưa suy rộng thao tác ẩn sang các tin liên quan.

## Giới hạn hiện tại

- Không có CV/search history theo candidate, time decay hoặc learning-to-rank
  trong feed preference.
- Feed `for-me` không dùng saved job làm điểm để tránh vòng phản hồi tự khuếch
  đại; endpoint `by-saved` độc lập mới được phép dùng hành động lưu tường minh.
  Việc đã ứng tuyển và việc đã ẩn tiếp tục bị loại.
- Chưa lưu snapshot score. Khi tin hoặc preference thay đổi, kết quả lần đọc sau
  có thể thay đổi.
- Nếu bổ sung hành vi tìm kiếm, cần event server riêng, consent, retention/xóa
  dữ liệu và tài liệu trọng số trước khi đổi `sources.search_activity`.
