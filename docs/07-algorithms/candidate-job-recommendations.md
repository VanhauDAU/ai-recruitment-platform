# Gợi ý việc làm cho ứng viên

## Phạm vi

Tài liệu này mô tả đúng phiên bản rule-based đang chạy cho:

- `GET /api/jobs/recommendations/for-me/`: feed “Việc làm phù hợp” trong tài khoản.
- `GET /api/jobs/recommendations/by-cv/{cv_public_id}/`: tối đa 6 việc làm sau khi lưu một CV.

TopCV được dùng để khảo sát nhu cầu sản phẩm, không phải nguồn cho công thức nội
bộ. [FAQ TopCV](https://www.topcv.vn/faqs/find-job-and-apply/cai-dat-thong-bao-viec-lam-cai-dat-goi-y-viec-lam-phu-hop-nhu-the-nao.html)
nêu ba nhóm tín hiệu: cài đặt gợi ý, từ khóa hồ sơ/CV và hành vi tìm kiếm.
Repository hiện chỉ có dữ liệu server đáng tin cậy cho hai nhóm đầu; lịch sử tìm
kiếm chỉ tồn tại ở local storage và view/impression là số liệu tổng hợp. Vì vậy
response công khai `sources.search_activity=false` và UI không được nói rằng
hành vi tìm kiếm đang ảnh hưởng kết quả.

## Nguồn dữ liệu

Feed ứng viên dùng theo thứ tự:

1. `CandidateJobPreference` làm nguồn chính: 1–5 vị trí chuyên môn, vị trí khác,
   lương VND, kinh nghiệm, tỉnh/thành và khả năng chuyển nơi làm việc.
2. CV mặc định còn sử dụng được; nếu chưa có mặc định thì dùng CV active cập
   nhật gần nhất. CV archived, import/processing failed và CV đã xóa không được
   chọn. CV bổ sung vị trí/headline/title và kỹ năng chuẩn hóa từ
   `cv_skills`/section kỹ năng.
3. Không có CV vẫn xếp hạng được bằng preference. Chưa cấu hình preference thì
   trả `status=preferences_required`, không lấp bằng việc làm ngẫu nhiên.

Giới tính không tham gia scoring. Tin đã ứng tuyển bị loại khỏi feed `for-me`;
endpoint sau lưu CV không loại để giữ đúng use case giải thích riêng cho CV vừa
lưu.

## Consent và phạm vi đọc

- `CandidateConsent.AI_RECOMMENDATION=granted` là điều kiện trước khi đọc nội
  dung CV hoặc chạy ranking.
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
| Tên vị trí/headline | 24 | Title job chứa vị trí mong muốn hoặc tín hiệu vị trí trên CV |
| Kỹ năng | 24 | 6 điểm/kỹ năng trùng, tối đa 4 kỹ năng |
| Địa điểm | 10 | Tỉnh của job trùng tỉnh mong muốn |
| Sẵn sàng chuyển nơi | 3 | Job ngoài tỉnh mong muốn và candidate đã bật relocate |
| Kinh nghiệm | 6 | Kinh nghiệm candidate không thấp hơn yêu cầu |
| Lương | 8 | Job dùng VND và khoảng lương (kể cả `FROM`/`UP_TO`) giao với lương mong muốn theo biên 80–125% |

Tổng điểm được chặn ở 100. Job dưới `20` điểm bị loại. Tier trả phí không cộng
điểm; nó chỉ là tie-breaker sau compatibility, tiếp theo là thời gian đăng và
primary key để thứ tự ổn định.

Trước khi score, selector chỉ lấy tin đang active, chưa hết hạn và thuộc campaign
active. Query được prefilter bằng category, kỹ năng hoặc title không phân biệt
dấu rồi giới hạn tối đa 500 ứng viên xếp hạng. Kỹ năng text chỉ có trong JSON CV
vẫn được đối chiếu với taxonomy job, không bắt buộc CV phải có relation
`cv_skills`. Các quan hệ category/location/skill được prefetch; regression query
budget khóa số query không tăng khi số job kết quả tăng.

## Contract feed `for-me`

Query:

- `page`: số nguyên từ 1, mặc định 1.
- `page_size`: 1–20, mặc định 10.

Các field điều phối chính:

```json
{
  "status": "ready",
  "strategy": "candidate-profile-rule-v1",
  "preference_configured": true,
  "needs_setup": false,
  "consent_required": false,
  "sources": {
    "job_preferences": true,
    "cv": true,
    "search_activity": false
  },
  "source_cv": {
    "public_id": "cv_...",
    "title": "CV Fullstack",
    "is_default": true
  },
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

## Giới hạn hiện tại

- Không có search history theo candidate, time decay hoặc learning-to-rank.
- Không dùng saved job làm điểm để tránh vòng phản hồi tự khuếch đại; việc đã
  ứng tuyển chỉ được loại.
- Chưa lưu snapshot score. Khi tin hoặc preference thay đổi, kết quả lần đọc sau
  có thể thay đổi.
- Nếu bổ sung hành vi tìm kiếm, cần event server riêng, consent, retention/xóa
  dữ liệu và tài liệu trọng số trước khi đổi `sources.search_activity`.
