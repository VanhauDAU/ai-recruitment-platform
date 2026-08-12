# Policy phân phối và trình bày tin tuyển dụng

**Trạng thái:** Contract cho Giai đoạn 2 và 6  
**ADR:** [ADR-0012](../02-tong-quan/adr-0012-job-services-architecture.md)

## 1. Nguyên tắc

1. Availability và relevance là điều kiện bắt buộc trước monetization.
2. Tin trả phí luôn có disclosure “Tài trợ”.
3. Không dùng màu làm tín hiệu duy nhất.
4. Không bảo đảm vị trí hoặc số CV trong pilot.
5. Sort người dùng chọn không bị giả mạo bởi tier trả phí.
6. Ranking và slotting do server quyết định; frontend chỉ render projection.

## 2. Eligibility pipeline

```text
canonical availability
  -> hard relevance floor
  -> active capability resolution
  -> company diversity
  -> sponsored slot allocation
  -> stable pagination
  -> presentation projection
```

Tin bị loại trước ranking nếu closed/expired/held, campaign không active, recruiter
không hợp lệ, đã apply ở lane remarketing hoặc không đạt hard relevance floor.

## 3. Slot policy

- Tối đa 2 sponsored item trong mỗi cửa sổ 10 kết quả.
- Không quá một item của cùng company trong một cửa sổ.
- Thiếu sponsored eligible thì slot trở về organic, không dùng tin kém phù hợp.
- Stable cursor/pagination phải mang policy version hoặc seed ổn định; refresh
  cùng cursor không được đảo item ngẫu nhiên.
- Paid weight chỉ xếp giữa các tin đã đạt relevance floor.
- Ties dùng business score rồi stable `job_id`; không thiếu deterministic key.

Explicit sort:

| Sort | Chính sách |
| --- | --- |
| Phù hợp | Sponsored interleave tối đa 2/10 |
| Mới nhất | Organic sort giữ nguyên; sponsored nằm trong module tách biệt |
| Lương cao nhất | Organic sort giữ nguyên; sponsored nằm trong module tách biệt |
| GẤP | Sort theo active urgent label, không dùng flash badge |

## 4. Ma trận candidate surface

| Surface | Presentation | Sponsored slot | Disclosure | Ghi chú |
| --- | --- | --- | --- | --- |
| Trang chủ / Việc làm tốt nhất | Có | Eligibility pool riêng | Có | Trả phí chỉ là điều kiện tham gia |
| Trang chủ / Tin mới | Có | Không | Có nếu item tự có activation | Giữ chronological order |
| Danh sách việc làm | Có | 2/10 | Có | Relevance-first |
| Kết quả tìm kiếm | Có | 2/10 | Có | Theo query relevance |
| Saved Jobs | Có | Không trong danh sách đã lưu | Có | Không đổi thứ tự lưu |
| Lane “Đã quan tâm” | Có | Có khi remarketing active | Có + lý do | Có frequency cap |
| Matching Jobs | Có | Tie-break sau match score | Có | Không cộng paid vào compatibility |
| Related Jobs | Có | Tối đa 1 module riêng | Có | Không chen vào explicit related order |
| Job detail | Có | Không | Có | Không quảng cáo đối thủ trong brand epic riêng |
| Quick preview | Có | Không | Có | Dùng cùng projection |
| Blog related jobs | Có | Không ở pilot | Có | Không deep-copy style |
| Email/notification | Text projection | Theo entitlement alert | Có | Tôn trọng opt-out |

## 5. Card tone và label semantics

| Giá trị | Cách dùng |
| --- | --- |
| `default` | Nền thường |
| `amber` | Gói Ưu tiên |
| `green` | Gói Nổi bật/Tăng tốc |

Label semantic:

- `sponsored`: disclosure bắt buộc, không phải social proof;
- `urgent`: add-on có expiry và employer attestation;
- `hot`: chỉ do thuật toán earned phát sau khi có policy riêng;
- `fast_response`: earned từ SLA phản hồi, không bán.

Không triển khai RED. Không map package slug trực tiếp sang CSS.

## 6. Capability merge

Khi nhiều activation overlap:

- sponsored là OR trong khoảng active;
- card tone lấy mức mạnh nhất theo registry, không theo giá nhập tay;
- labels là union theo semantic code;
- `active_until` của mỗi effect lấy expiry tương ứng; projection tổng không được
  kéo dài một effect ngắn chỉ vì effect khác còn hạn;
- refresh và alert là quantity ledger, consume riêng;
- activation expired được selector loại ngay theo clock, không chờ cleanup task.

## 7. Remarketing tin đã lưu

- Chỉ candidate đăng nhập, có consent phù hợp và còn lưu tin.
- Loại applied/closed/expired/held và campaign không active.
- Tối đa 1 impression/ngày và 3/tuần cho một candidate-job.
- Có company diversity trong lane.
- `display_reason` nói rõ “Bạn đã lưu tin này”.
- Bỏ lưu hoặc withdraw consent làm tin mất eligibility ngay.
- Không dùng view aggregate hoặc cookie anonymous để dựng hồ sơ target.

## 8. Metrics và fairness guardrail

Metrics tối thiểu theo `surface`, `policy_version`, `activation_id`:

- eligible, selected, impression, detail view, save, apply;
- sponsored share, company concentration, empty paid slot;
- P50/P95 latency và query count;
- unavailable-after-selection và duplicate-across-page.

Không ghi raw query, CV content hoặc PII vào metric labels.

Ngưỡng dừng rollout:

- sponsored share vượt 20%;
- unavailable/held item có impression;
- pagination duplicate hoặc missing tăng;
- P95 list tăng trên 20% so baseline;
- một company chiếm hơn policy cho phép;
- presentation khác nhau giữa các surface cho cùng effective state.

## 9. Test contract

- availability trước paid weight;
- 0/1/2/>2 sponsored eligible trong cửa sổ;
- company diversity và deterministic tie;
- explicit sort không bị đổi nghĩa;
- activation expiry boundary;
- overlap capability merge;
- candidate consent/frequency cap;
- cross-surface presentation snapshot và accessibility.
