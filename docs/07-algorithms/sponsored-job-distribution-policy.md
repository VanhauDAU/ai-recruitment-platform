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
  -> per-job refresh recency
  -> active capability resolution
  -> commercial tier resolution
  -> paid-tier-first ranking
  -> offset pagination
  -> presentation projection
```

Tin bị loại trước ranking nếu closed/expired/held, campaign không active, recruiter
không hợp lệ, đã apply ở lane remarketing hoặc không đạt hard relevance floor.

## 3. Refresh recency, commercial tier và phân trang

### 3.1. Refresh recency theo từng tin

Tại một snapshot đọc, mỗi tin tự resolve đúng một `latest_eligible_refresh` từ
`JobServiceUsageEvent` của chính tin đó. Selector lấy event `refresh` mới nhất
theo `occurred_at DESC`, rồi `usage_event.id DESC`; ID của usage event là
tie-break bắt buộc khi hai event có cùng timestamp. Eligibility của event được
đánh giá theo clock, feature flag và cửa sổ activation/item hiện hành; quyền
`sponsored_placement` không phải điều kiện để refresh có tác dụng.
Một request list capture clock đúng một lần và truyền cùng giá trị qua
availability, refresh, commercial tier và presentation. Composite index
`(job_id, event_type, occurred_at DESC, id DESC)` phục vụ lookup mới nhất mà
không quét toàn bộ ledger của từng job.

Trong stream mặc định, sau availability, filter và hard relevance floor,
thứ tự canonical là:

```text
commercial_tier DESC
  -> latest_refresh.occurred_at DESC NULLS LAST
  -> latest_refresh.usage_event_id DESC
  -> MD5(ranking_seed || ':' || job_id) ASC
  -> lifecycle_recency DESC
  -> created_at DESC
  -> job_id DESC
```

Vì mốc này được resolve độc lập theo job, nếu A được refresh rồi B được refresh
sau thì B đứng trên A trong cùng commercial tier, nhưng A vẫn giữ mốc boost của
mình. Các tin có refresh còn hiệu lực đứng trước phần luân phiên chưa refresh
trong cùng tầng. Refresh không nâng commercial tier. Refresh-only package có tác
dụng trong tầng tin thường dù tin không sponsored.

Refresh chỉ append usage event và consume quantity. Nó không sửa
`published_at`, `first_approved_at`, `visibility_starts_at`,
`visibility_ends_at`, application deadline, status hoặc public-cycle anchor;
do đó refresh không phải là đăng lại, duyệt lại hay gia hạn vòng đời tin.

### 3.2. Commercial tier paid-first

- Tư cách paid được resolve từ active `sponsored_placement`, độc lập với việc tin
  có refresh hay không. Refresh không tạo sponsored eligibility và không nâng
  tầng.
- Tầng Premium gồm `best_jobs_eligible` và legacy `Job.Tier.TOP`; tầng trả phí
  tiêu chuẩn gồm `search_sponsored` và legacy `Job.Tier.FEATURED`; tầng thường
  gồm các tin còn lại.
- Tất cả tin trong tầng Premium được hiển thị trước tầng trả phí tiêu chuẩn; tất
  cả tin trả phí tiêu chuẩn được hiển thị trước tin thường. Không còn xen kẽ 2
  slot/10 và không chọn một representative duy nhất theo company.
- Mỗi tin cùng company có rank độc lập. Refresh B sau A tạo B → A trong cùng
  tầng; A không rơi về thứ tự lifecycle cũ.
- Paid weight chỉ áp dụng sau availability, filter và hard relevance floor;
  không đưa một tin không liên quan vào kết quả chỉ vì đã mua gói.
- Mọi card thuộc tầng trả phí phải mang disclosure “Tài trợ”; analytics dùng
  commercial tier đã resolve, không suy ngược package từ màu nền hoặc nhãn phụ.
- Mọi tầng phải có deterministic tail keys; không được kết thúc ordering ở một
  timestamp hoặc business score có thể trùng.

Explicit sort:

| Sort | Chính sách |
| --- | --- |
| Mặc định (`ordering` rỗng) | Paid-tier-first; refresh trước, sau đó seeded rotation trong mỗi tầng |
| Mới nhất (`ordering=newest`) | Dùng lifecycle recency; refresh và paid tier không được override thứ tự đã chọn |
| Lương cao nhất (`ordering=salary_desc`) | Dùng lương giảm dần; refresh và paid tier không được override thứ tự đã chọn |
| GẤP (`ordering=urgent`) | Sort theo active urgent label, không dùng flash badge; refresh không override |

Sponsored disclosure vẫn xuất hiện trên card nếu capability đang hiệu lực, kể
cả khi explicit sort không áp dụng paid-tier-first. Surface có module sponsored
riêng phải giữ module tách khỏi thứ tự organic mà người dùng đã chọn.

### 3.3. Ổn định của offset pagination

Runtime dùng offset pagination (`page`, `page_size`) kèm `ranking_seed`, chưa có
database snapshot token. Frontend sinh một seed mới khi ứng dụng được tải, giữ
nguyên seed xuyên filter và page; F5 tải lại ứng dụng nên sinh seed khác. Server
dùng hash của seed và job ID để tạo hoán vị deterministic trong từng commercial
tier. Cùng seed và cùng ranking state cho kết quả lặp lại ổn định; seed mới tạo
một lượt luân phiên mới nhưng không phá paid-tier-first hoặc thứ tự refresh.

Default API trả lại `ranking_seed`; URL `next`/`previous` mang cùng seed. Seed
chỉ nhận `[A-Za-z0-9_-]{1,64}` và là giá trị opaque, không chứa candidate ID,
query hay PII. Explicit sort không dùng rotation seed.

Nếu giữa hai request có job được refresh, publish, đóng/mở, hết hạn hoặc đổi
capability thì offset có thể dịch chuyển, dẫn tới item lặp hoặc bị bỏ qua; seed
không phải database snapshot.

Khi filter, sort hoặc ranking-relevant state thay đổi, client phải reset về
page 1 và refetch danh sách. Sau action refresh/activation do chính client thực
hiện, client phải invalidate các page đã cache thay vì nối kết quả mới vào
snapshot cũ. Reload chỉ đổi seed luân phiên, không tạo refresh usage event.
Không mô tả offset hiện tại như cursor hoặc database snapshot ổn định.

### 3.4. Box “Việc làm tốt nhất” ở trang chủ

Box trang chủ là một surface độc lập, không gọi lại ranking của danh sách việc
làm. “Tốt nhất” ở đây là tên quyền lợi hiển thị, không phải điểm chất lượng do
AI chấm và cũng không có nghĩa lương cao nhất/mới nhất.

Một tin được vào eligibility pool khi đồng thời:

1. đạt canonical public availability: đang active, còn thời hạn, không hold,
   recruiter/company/campaign hợp lệ;
2. khớp filter người dùng đang chọn trên box;
3. có active `sponsored_placement=best_jobs_eligible`, hoặc còn là legacy
   `Job.Tier.TOP` trong giai đoạn tương thích.

Sau khi lọc, server sắp bằng
`MD5(rotation_seed || ':' || job_id) ASC, job_id ASC`. Refresh timestamp,
commercial tier của danh sách chính, ngày đăng và package price không tham gia
thứ tự trong box này. Cùng seed giữ pagination ổn định và không lặp; frontend
giữ seed khi carousel chuyển trang, sinh seed mới khi F5 để có lượt luân phiên
mới. Mỗi job là một entry độc lập; box không áp company representative quota.

Card vẫn dùng presentation projection và disclosure “Tài trợ”. Capability chỉ
là điều kiện tham gia, không phải tuyên bố rằng nền tảng đã đánh giá doanh
nghiệp/công việc tốt hơn về chuyên môn.

## 4. Ma trận candidate surface

| Surface | Presentation | Sponsored slot | Disclosure | Ghi chú |
| --- | --- | --- | --- | --- |
| Trang chủ / Việc làm tốt nhất | Có | Eligibility pool riêng | Có | Trả phí chỉ là điều kiện tham gia |
| Trang chủ / Tin mới | Có | Không | Có nếu item tự có activation | Giữ chronological order |
| Danh sách việc làm | Có | Paid-tier-first | Có | Filter trước ranking |
| Kết quả tìm kiếm | Có | Paid-tier-first | Có | Theo query filter |
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
| `amber` | Gói Ưu tiên; nền trắng pha amber rất nhẹ, viền dịu |
| `green` | Gói Nổi bật/Tăng tốc; nền trắng pha xanh nhẹ, mức mạnh hơn chỉ tăng nhẹ sắc độ |

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
- sponsored share theo commercial tier và company concentration;
- P50/P95 latency và query count;
- unavailable-after-selection và duplicate-across-page.

Không ghi raw query, CV content hoặc PII vào metric labels.

Ngưỡng dừng rollout:

- sponsored share hoặc company concentration lệch mạnh khỏi baseline đã duyệt;
- unavailable/held item có impression;
- pagination duplicate hoặc missing tăng;
- P95 list tăng trên 20% so baseline;
- một company chiếm tỷ lệ bất thường trong cùng commercial tier;
- presentation khác nhau giữa các surface cho cùng effective state.

## 9. Test contract

- availability trước paid weight;
- 0/1/n tin ở mỗi commercial tier; toàn bộ Premium đứng trước trả phí tiêu
  chuẩn và toàn bộ trả phí đứng trước tin thường;
- nhiều tin cùng company giữ rank và refresh recency độc lập, không có cơ chế
  winner-takes-all làm A rơi về lifecycle cũ sau khi refresh B;
- A refresh, rồi B refresh: B trên A, A vẫn giữ boost và cả hai đứng trước phần
  chưa refresh trong cùng tầng; refresh-only job được boost trong tầng thường;
- cùng seed cho cùng thứ tự và không duplicate xuyên page; seed mới đổi thứ tự
  phần chưa refresh nhưng giữ nguyên membership và commercial tier boundary;
- box Việc làm tốt nhất chỉ nhận active `best_jobs_eligible`/legacy TOP, dùng
  rotation seed riêng và không bị main-feed refresh/tier recency chi phối;
- latest refresh dùng `occurred_at`, rồi usage event ID để deterministic tie;
- refresh không sửa posted/lifecycle timestamp hoặc lifecycle state;
- explicit newest/salary/urgent không bị refresh hoặc paid tier đổi
  nghĩa;
- offset ổn định khi seed/ranking state không đổi và client reset/refetch sau mutation;
- activation expiry boundary;
- overlap capability merge;
- candidate consent/frequency cap;
- cross-surface presentation snapshot và accessibility.
