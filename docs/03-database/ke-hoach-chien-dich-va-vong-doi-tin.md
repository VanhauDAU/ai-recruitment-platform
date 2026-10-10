# Chiến dịch tuyển dụng, vòng đời tin và pipeline ứng viên

Tài liệu này là source of truth cho module workspace nhà tuyển dụng. Nó thay
thế giả định cũ rằng công ty là ranh giới phân quyền hoặc tin tuyển dụng được
xuất bản ngay.

Định hướng mở rộng (đánh giá mô hình 1:1, khác biệt sản phẩm, dịch vụ trả phí
tương lai, roadmap CAMP-M1…M5) ở
[ke-hoach-chien-dich-tuyen-dung-mo-rong.md](./ke-hoach-chien-dich-tuyen-dung-mo-rong.md);
tài liệu đó không thay đổi hành vi nào mô tả tại đây.

## Quyết định sản phẩm

- Mỗi chiến dịch, tin tuyển dụng và hồ sơ ứng tuyển thuộc **một recruiter cụ
  thể**. Chỉ người đã tạo tin được xem, sửa, đóng, gia hạn, sao chép tin và xử
  lý các hồ sơ của tin đó. Cùng công ty không tạo quyền xem chung.
- Kho lượt dịch vụ được cấp cho công ty, nhưng mọi activation, lịch sử và action
  dịch vụ đều theo owner của tin. Recruiter không thấy hoặc sử dụng activation
  trên tin do đồng nghiệp cùng công ty đăng.
- Công ty vẫn là thực thể pháp lý/công khai của tin, nhưng không phải tenant
  nghiệp vụ cho module này.
- Mọi tin gửi mới phải qua duyệt của admin: `draft → pending → active` hoặc
  `draft → pending → rejected`. Admin bắt buộc nhập lý do khi từ chối; người tạo
  tin luôn xem được lý do đó và có thể sửa, gửi lại.
- Một recruiter có mặc định **3 lượt gửi duyệt đầu tiên miễn phí trọn đời**.
  Lần gửi duyệt đầu của một tin mới tiêu một lượt; gửi lại tin bị từ chối, cập
  nhật tin đang chờ duyệt, đóng/mở lại hoặc xóa nháp không hoàn hay tiêu thêm
  lượt. Giá trị mặc định quản trị được qua `employer_free_job_quota`.
- Chiến dịch là workspace tùy chọn cho **một tin tuyển dụng**: một tin có thể
  không thuộc chiến dịch, còn mỗi chiến dịch chỉ liên kết tối đa một tin. Chiến
  dịch giúp theo dõi mục tiêu và phễu, không làm thay đổi quyền truy cập tin.
  Nhà tuyển dụng tạo chiến dịch chỉ cần tên, không cần
  liên kết công ty hoặc hoàn tất bất kỳ bước xác thực nào; các điều kiện đó chỉ
  được kiểm tra khi gửi tin tuyển dụng để duyệt.
- Chiến dịch tạo nhanh được mở ngay. Dừng chiến dịch chỉ thay đổi trạng thái
  workspace, **không tự đóng tin tuyển dụng**; vòng đời và kiểm duyệt của từng
  tin vẫn độc lập. Dịch vụ đã kích hoạt tiếp tục chạy theo clock, không được hoàn
  lượt hoặc cộng lại thời gian vì chiến dịch tạm dừng. UI phải hiển thị tác động
  này trước khi xác nhận. Chiến dịch đã hủy là trạng thái cuối, không được mở
  lại.

## Phạm vi sản phẩm sau khi đối chiếu TopCV

TopCV xem chiến dịch là workspace tập trung các hoạt động cho một vị trí: tin
tuyển dụng, nguồn CV, tiến độ xử lý và dữ liệu đo lường. Website áp dụng nguyên
lý đó nhưng chỉ hiển thị chức năng đã có domain và dữ liệu thật.

### Ưu tiên triển khai hiện tại

1. Tạo nhanh chỉ bằng tên, nhấn Enter được; sau khi tạo chọn đăng tin hoặc mở
   workspace chiến dịch.
2. Danh sách có tìm kiếm, lọc theo tín hiệu cần hành động: chiến dịch đang mở,
   CV mới, tin đang hiển thị, tin chờ duyệt và tin hết hạn.
3. Mỗi chiến dịch hiển thị tổng/CV mới, chi tiết trạng thái của tin tuyển dụng,
   số offer trên mục
   tiêu và thao tác xem, đăng tin, dừng/mở lại.
4. Chi tiết gồm Tổng quan, CV ứng tuyển và Tin tuyển dụng. Tổng quan dùng phễu
   hồ sơ, lượt xem, tiến độ mục tiêu và số CV bảy ngày từ dữ liệu hiện có.
5. Tab Dịch vụ trong chiến dịch và tin hiển thị activation còn hiệu lực, quyền
   lợi còn lại, thời gian chạy và số liệu quy thuộc; dashboard “Dịch vụ của tôi”
   bổ sung kho lượt và lịch sử của recruiter.
6. Mobile dùng card theo chiến dịch; desktop dùng bảng. Không bắt người dùng
   cuộn ngang chỉ để thực hiện các thao tác chính trên màn hình nhỏ.

### Chưa triển khai

- `CV đề xuất`, `CV tìm kiếm`, ứng viên đã xem tin và CV đang theo dõi: chờ
  workflow kết nối ứng viên/kho CV và contract quyền riêng tư hoàn chỉnh.
- Thanh toán/checkout, hóa đơn và credit mở liên hệ: chờ billing contract hoàn
  chỉnh. Kho lượt, activation và lịch sử dịch vụ đã dùng service entitlement
  thật; không tạo số dư hoặc giao dịch giả.
- Điểm tối ưu/AI recommendation: chỉ làm khi có bộ tiêu chí giải thích được và
  dữ liệu đo lường; không tự tạo phần trăm mang tính trang trí.
- Nhãn CV theo chiến dịch và báo cáo chuyển đổi hiển thị→xem→ứng tuyển: chờ
  event tracking và module nhãn CV thật.

Tham khảo: [khái niệm chiến dịch](https://tuyendung.topcv.vn/help/dinh-nghia/chien-dich-tuyen-dung/),
[tạo chiến dịch](https://tuyendung.topcv.vn/help/huong-dan-su-dung/tao-chien-dich-tuyen-dung/)
và [chi tiết chiến dịch](https://tuyendung.topcv.vn/help/dinh-nghia/chi-tiet-chien-dich-tuyen-dung/).

## Mô hình dữ liệu

| Bảng | Chủ sở hữu | Vai trò |
| --- | --- | --- |
| `recruitment_campaigns` | `RecruiterProfile` | Kế hoạch tuyển: vị trí, cấp bậc, headcount, ngân sách, hạn/mode tuyển liên tục và trạng thái chiến dịch. `company` có thể rỗng khi tạo nhanh; có thể truy ngược `source_need`. |
| `jobs.campaign_id` | `Job.posted_by` | Liên kết tùy chọn, duy nhất từ tin sang chiến dịch cùng chủ sở hữu; mỗi chiến dịch tối đa một tin. |
| `job_status_history` | `Job` | Audit chuyển trạng thái tin, actor (`employer`/`admin`) và ghi chú/lý do từ chối. |
| `applications.employer_rating` | `Application` | Điểm nội bộ 1–5, không trả cho ứng viên. |
| `application_status_history` | `Application` | Audit trạng thái, actor, ghi chú nội bộ; được dùng làm timeline ứng viên với DTO đã lọc. |
| `services_serviceentitlementunit` | `Company` | Một lượt dịch vụ có thể dùng đúng một lần, có nguồn cấp, snapshot phiên bản và hạn bắt đầu `activate_by`. |
| `services_jobserviceactivation` | `Job.posted_by` qua `Job` | Bản ghi bất biến gắn một unit đã consume với một tin, lưu `starts_at`, `ends_at`, trạng thái và lý do dừng. |
| `services_jobserviceactivationitem` | `JobServiceActivation` | Snapshot từng capability, tổng số lượng, số còn lại và cửa sổ hiệu lực riêng. |
| `services_jobpromotionmetricdaily` | `JobServiceActivation` | Aggregate theo ngày cho impression, view, save và apply được quy thuộc vào activation tài trợ. |
| `services_serviceauditevent` | Nghiệp vụ service | Audit grant/consume/activation/action/terminate; giữ actor, công ty và subject liên quan. |

Các migration liên quan: `employers.0016`–`0018`, `jobs.0020`–`0023`,
`applications.0010`, `services.0001`–`0010`.

## Vòng đời tin

```text
nháp ── gửi duyệt ──> chờ duyệt ── admin duyệt ──> đang tuyển ── đóng ──> đã đóng
                         │                │                              │
                         │                └── admin từ chối ──> từ chối  └── mở lại → chờ duyệt
                         └── cập nhật vẫn ở hàng chờ

đang tuyển ── chỉnh sửa và gửi lại ──> chờ duyệt
từ chối ── chỉnh sửa và gửi lại ──> chờ duyệt
```

- Nháp có thể thiếu dữ liệu; chỉ nháp được xóa.
- Khi gửi duyệt, backend kiểm tra 5 bước xác thực employer, quota của tin mới,
  toàn bộ trường bắt buộc của form thủ công: tiêu đề, mô tả/yêu cầu/quyền lợi,
  cấp bậc, loại và hình thức làm việc, học vấn, kinh nghiệm, ít nhất một vị trí
  chuyên môn, địa điểm phường/xã + địa chỉ, lịch làm việc có cấu trúc, số lượng,
  hạn nộp và người nhận hồ sơ có ít nhất một email.
- `pending` và `rejected` không hiện ở API public. `rejected_reason` chỉ hiện
  cho chủ tin; không lộ cho ứng viên hoặc recruiter khác.
- Tin `active` có deadline qua ngày hiện tại bị ẩn trên mọi API public và hiển
  thị là “Hết hạn” trong workspace. Nó không nhận thêm ứng tuyển.
- Chỉnh sửa tin `active` đưa tin về `pending`, nên bản sửa chỉ hiện sau lần
  duyệt tiếp theo. Chỉnh sửa tin `pending` giữ nguyên hàng chờ.

## Vòng đời dịch vụ trên tin và chiến dịch

Ba clock độc lập, không được suy một clock từ clock khác:

| Clock | Mốc canonical | Ý nghĩa runtime |
| --- | --- | --- |
| Nhận hồ sơ | `Job.deadline` / projection `application_deadline` | Ngày cuối nhận ứng tuyển theo `Asia/Ho_Chi_Minh`. |
| Công khai tin | `visibility_starts_at`, `visibility_ends_at`, `max_visibility_ends_at` | Mặc định gợi ý 30 ngày; các lần gia hạn vẫn không vượt tổng public cycle 90 ngày. |
| Dịch vụ | `ServiceEntitlementUnit.activate_by`, `JobServiceActivation.starts_at`, `ends_at` | Unit phải bắt đầu đúng hạn; activation đã bắt đầu chạy liên tục đến `ends_at`. |

`status=active` trong DB là trạng thái ledger, không đủ để kết luận dịch vụ đang
chạy. Selector và UI dùng điều kiện `starts_at <= now < ends_at`; vì vậy dữ liệu
chưa được worker chuyển sang `expired` vẫn được trình bày đúng là đã kết thúc.
Tương tự, unit có `status=available` nhưng đã qua `activate_by` không thể consume.

Kích hoạt chỉ hợp lệ khi tin thuộc recruiter đang đăng nhập, đang công khai,
không bị hold, cùng công ty với unit và đủ thời gian cho toàn bộ capability.
Preview cho biết hạn nhận hồ sơ/thời gian công khai cần tăng; confirm revalidate
dưới lock và chỉ gia hạn khi recruiter xác nhận. Mọi gia hạn vẫn bị chặn bởi
public lifetime 90 ngày và `campaign.target_date` nếu tin thuộc chiến dịch.

Dừng/tạm dừng chiến dịch, đóng tin hoặc sửa tin khiến tin tạm ẩn không pause
activation. Thời gian không được cộng lại và unit đã consume không tự hoàn. Nếu
gián đoạn do nền tảng cần bù, admin cấp unit mới với source `compensation`; không
sửa ngược ledger cũ.

Metrics quảng bá được aggregate theo activation và ngày. Các số impression,
view, save, apply là số event được **quy thuộc vào activation**, không chứng minh
mức tăng thuần so với organic. Khi chưa có hàng metrics, API trả
`metrics.available=false` và UI hiển thị `—`, không hiển thị số 0 giả.

## Pipeline nội bộ và trải nghiệm ứng viên

| Mã nội bộ | Nhãn recruiter | Nhãn ứng viên |
| --- | --- | --- |
| `submitted` | Tiếp nhận | Tiếp nhận |
| `viewed` | Đã xem | Nhà tuyển dụng đã xem hồ sơ |
| `considering` | Cân nhắc | Hồ sơ đang được xem xét |
| `shortlisted` | Phù hợp | Hồ sơ đang được xem xét |
| `interviewed` | Phỏng vấn | Phỏng vấn |
| `accepted` | Đã nhận offer | Đã nhận offer |
| `rejected` | Từ chối | Chưa phù hợp |

Mở snapshot CV lần đầu tự chuyển `submitted` sang `viewed`. `accepted` và
`rejected` là trạng thái cuối; backend chặn mở lại hoặc lùi trạng thái. Ứng viên
chỉ nhận timeline đã map nhãn: không thấy điểm, ghi chú nội bộ hoặc khác biệt
giữa `considering`/`shortlisted`.

## API và giao diện

### Tạo tin tuyển dụng thủ công

Giai đoạn hiện tại chỉ triển khai cách **Tạo tin thủ công**. Hai hướng tạo tin
bằng AI hoặc nhập dữ liệu từ tài liệu/mẫu ngoài chưa có workflow backend nên
không xuất hiện như hành động khả dụng trên giao diện.

Form thủ công được tổ chức thành năm nhóm, tham khảo luồng đăng tin của TopCV
nhưng sử dụng đúng domain hiện có của hệ thống:

1. **Thông tin chung:** tiêu đề; vị trí chuyên môn chọn đúng một mục qua taxonomy
   ba cấp Nhóm nghề → Nghề → Vị trí chuyên môn; kiến thức chuyên ngành được chọn
   nhiều; cấp bậc, loại công việc, hình thức làm việc và mức lương.
2. **Mô tả công việc:** ba trình soạn thảo nội dung lớn cho mô tả, yêu cầu và
   quyền lợi; quyền lợi bổ sung; nhiều khu vực tỉnh/thành, mỗi khu vực có nhiều
   phường/xã kèm địa điểm chi tiết; nhiều khung thứ/giờ và một mô tả thời gian
   làm việc tự do.
3. **Kỳ vọng ứng viên:** học vấn, kinh nghiệm, giới tính, khoảng tuổi tùy chọn,
   kỹ năng bắt buộc/ưu tiên và nhiều ngoại ngữ tùy chọn.
4. **Thông tin nhận hồ sơ:** hạn nhận hồ sơ, số lượng tuyển, họ tên, điện thoại,
   tối đa năm email nhận thông báo và chiến dịch tùy chọn.
5. **Dịch vụ và gia tăng hiệu quả:** trong lúc tạo chỉ xác nhận tin cơ bản không
   phát sinh chi phí. Sau khi tin được duyệt và đang công khai, recruiter kích
   hoạt unit thật tại tab `Dịch vụ & hiệu quả`; không chọn gói trả phí giả trong
   form tạo tin.

Desktop rộng hiển thị tiến độ theo nhóm và bản xem trước cạnh form; màn hình
hẹp hơn đưa tiến độ lên trên hoặc dùng hai cột, ẩn preview bên cạnh và không
tạo cuộn ngang. `Lưu nháp`
không validate toàn bộ và không tiêu quota; `Gửi duyệt` validate dữ liệu bắt
buộc rồi đưa tin vào `pending`. Các tin sửa từ `active` cũng quay lại hàng chờ
duyệt.

- Campaign: `/api/employer/campaigns/` cùng `options/`, `suggestions/`,
  `from-need/{public_id}/`, `{public_id}/status/`, `{public_id}/report/`.
  Modal tạo nhanh chỉ nhận `name` và có thể submit bằng Enter. Backend yêu cầu
  `job_workspace_ready=true` cho cả read workspace và mutation; direct API
  không thể bỏ qua frontend guard. Sau khi tạo, UI yêu cầu chọn hoạt động “Đăng
  tin tuyển dụng” hoặc mở workspace; không hiển thị CTA tìm CV cho đến khi có
  workflow kho CV thật.
- Job workspace: `/api/jobs/mine/`, `posting-context/`, `submit/`, `close/`,
  `reopen/`, `extend/`, `duplicate/`.
- Admin moderation: `/api/jobs/admin/moderation/` và
  `/api/jobs/admin/moderation/{public_id}/review/` (`approve` hoặc `reject`
  kèm `reason`).
- Candidate: `GET/POST /api/v2/applications/` trả nhãn/timeline công khai.
- Recruiter: `/api/v2/recruiter/applications/`, detail update, `cv/` snapshot
  và `history/`. Tất cả truy vấn luôn lọc `job__posted_by=request.user` và yêu
  cầu `candidate_data_access=true`.
- Employer services: `/api/services/mine/inventory/`, `mine/activations/`,
  `mine/activation-history/`, `activations/preview/`, `activations/` cùng action
  `refresh/` và `job-alerts/`. Activation/history/action luôn lọc owner của tin;
  active list lọc thêm hiệu lực theo clock.
- Admin services: `/api/services/admin/activations/`, `activations/summary/` và
  `activations/{public_id}/terminate/`. Admin có thể lọc theo công ty, trạng thái,
  mã tin hoặc mã chiến dịch; terminate bắt buộc lý do, ghi audit và không tự hoàn
  unit.

`GET /api/jobs/mine/posting-context/` là endpoint compliance duy nhất của
workspace vẫn đọc được khi chưa ready; response trả blocker/action để client
điều hướng khắc phục. Job/campaign list/detail/options/report/performance/
activity bị chặn authoritative với `EMPLOYER_WORKSPACE_BLOCKED` khi workspace
không sẵn sàng. Verification chưa approved không tự khóa workspace; nó khóa
candidate data và admin approval. Candidate preview/activity metadata chỉ có
PII/deep-link khi candidate access hợp lệ.

Write transaction theo lock order `User → Recruiter → Verification → Campaign
→ Job → Application`. Nếu campaign đổi hoặc bị xóa giữa scope read và row lock,
service fail closed bằng stale/resource-changed error thay vì tiếp tục trên row
không được khóa.

ER-5 bổ sung verification compliance hold theo recruiter và liên kết tường minh
tới campaign/job. Hold không đổi business status, không ghi đè `policy_hold` hay
`moderation_hold`; public job filter loại job có verification hold active. Khi
reapprove, service chỉ release hold cùng source và giữ nguyên mọi DPA/account/
moderation hold khác. Cả approve job và revoke/expire dùng cùng lock prefix
`User → Recruiter → Verification`, sau đó khóa campaign/job theo PK để kết quả
commit trước luôn được đường còn lại đọc và recheck.

Frontend đặt route-level composition ở `pages/employer` và `pages/main`; action
tạo chiến dịch/đăng tin ở `features`; API/domain dùng lại ở `entities`. Xem
`frontend/ARCHITECTURE.md` để biết quy tắc import/layer.

Employer có route `/tuyendung/app/services` với ba tab `Đang chạy`, `Chưa sử
dụng`, `Lịch sử`. Cùng projection được compose trong tab `Dịch vụ & hiệu quả`
của chi tiết tin và tab `Dịch vụ` của chiến dịch. Admin quản lý danh sách,
thống kê, filter và dừng activation tại tab `Dịch vụ đang chạy`; cấp/thu hồi
unit và audit ở `Kho lượt & lịch sử`.

Sidebar “Quản lý CV” là submenu gồm “Quản lý nhãn CV” và “Quản lý yêu cầu kết
nối CV”. Hai mục được hiển thị disabled rõ ràng khi workflow chưa tồn tại; không
tạo route hoặc thông báo thành công giả.

## Kiểm thử tối thiểu

- Quyền owner-only cho campaign, job, ứng tuyển và snapshot CV.
- Quota lifetime, hàng chờ duyệt, duyệt/từ chối có lý do, gửi lại, đóng/mở lại,
  hết hạn và sao chép recipient.
- Candidate không nộp được tin hết hạn; public list/detail không lộ tin hết hạn.
- Chuyển pipeline hợp lệ/không hợp lệ, timeline đã lọc cho ứng viên và query
  budget danh sách ứng tuyển.
- Direct GET job/campaign: account mới và DPA hold trả 403; verification
  pending/changes-requested với DPA current vẫn đọc được workspace.
- Candidate list/export/history/CV asset: thiếu candidate access trả 403;
  recruiter khác nhận 404 và token asset recheck quyền live.
- Inventory cùng công ty không làm mất owner boundary: recruiter khác không
  preview/activate/xem history hoặc dùng action trên activation của tin.
- Active service list dùng clock thay vì chỉ dùng status; pause chiến dịch không
  hoàn unit/thời gian; admin terminate bắt buộc lý do, audit và không hoàn tự
  động.
- Metrics chưa có dữ liệu giữ `available=false`; số liệu có dữ liệu được
  aggregate đúng theo activation và không được trình bày như uplift organic.
- Query budget employer job list là 5 query và campaign list là 4 query, đều
  phẳng theo số row; activation list/history cũng phải giữ query count phẳng theo
  số activation và số item.
