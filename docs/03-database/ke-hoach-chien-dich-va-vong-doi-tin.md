# Chiến dịch tuyển dụng, vòng đời tin và pipeline ứng viên

Tài liệu này là source of truth cho module workspace nhà tuyển dụng. Nó thay
thế giả định cũ rằng công ty là ranh giới phân quyền hoặc tin tuyển dụng được
xuất bản ngay.

## Quyết định sản phẩm

- Mỗi chiến dịch, tin tuyển dụng và hồ sơ ứng tuyển thuộc **một recruiter cụ
  thể**. Chỉ người đã tạo tin được xem, sửa, đóng, gia hạn, sao chép tin và xử
  lý các hồ sơ của tin đó. Cùng công ty không tạo quyền xem chung.
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
  tin vẫn độc lập. Chiến dịch đã hủy là trạng thái cuối, không được mở lại.

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
5. Mobile dùng card theo chiến dịch; desktop dùng bảng. Không bắt người dùng
   cuộn ngang chỉ để thực hiện các thao tác chính trên màn hình nhỏ.

### Chưa triển khai

- `CV đề xuất`, `CV tìm kiếm`, ứng viên đã xem tin và CV đang theo dõi: chờ
  workflow kết nối ứng viên/kho CV và contract quyền riêng tư hoàn chỉnh.
- Credit, lượt mở liên hệ, gói dịch vụ đang chạy và kích hoạt dịch vụ: chờ
  billing/service entitlement, không hiển thị số 0 giả.
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

Các migration liên quan: `employers.0016`–`0018`, `jobs.0020`–`0023`, `applications.0010`.

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
5. **Dịch vụ và gia tăng hiệu quả:** xác nhận tin cơ bản không phát sinh chi
   phí. Gói trả phí chưa triển khai và không tạo dữ liệu/dịch vụ giả.

Desktop rộng hiển thị tiến độ theo nhóm và bản xem trước cạnh form; màn hình
hẹp hơn đưa tiến độ lên trên hoặc dùng hai cột, ẩn preview bên cạnh và không
tạo cuộn ngang. `Lưu nháp`
không validate toàn bộ và không tiêu quota; `Gửi duyệt` validate dữ liệu bắt
buộc rồi đưa tin vào `pending`. Các tin sửa từ `active` cũng quay lại hàng chờ
duyệt.

- Campaign: `/api/employer/campaigns/` cùng `options/`, `suggestions/`,
  `from-need/{public_id}/`, `{public_id}/status/`, `{public_id}/report/`.
  Modal tạo nhanh chỉ nhận `name` và có thể submit bằng Enter; không kiểm tra
  công ty/xác thực. Sau khi tạo, UI yêu cầu chọn hoạt động “Đăng tin tuyển
  dụng” hoặc mở workspace; không hiển thị CTA tìm CV cho đến khi có workflow
  kho CV thật.
- Job workspace: `/api/jobs/mine/`, `posting-context/`, `submit/`, `close/`,
  `reopen/`, `extend/`, `duplicate/`.
- Admin moderation: `/api/jobs/admin/moderation/` và
  `/api/jobs/admin/moderation/{public_id}/review/` (`approve` hoặc `reject`
  kèm `reason`).
- Candidate: `GET/POST /api/v2/applications/` trả nhãn/timeline công khai.
- Recruiter: `/api/v2/recruiter/applications/`, detail update, `cv/` snapshot
  và `history/`. Tất cả truy vấn luôn lọc `job__posted_by=request.user`.

Frontend đặt route-level composition ở `pages/employer` và `pages/main`; action
tạo chiến dịch/đăng tin ở `features`; API/domain dùng lại ở `entities`. Xem
`frontend/ARCHITECTURE.md` để biết quy tắc import/layer.

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
