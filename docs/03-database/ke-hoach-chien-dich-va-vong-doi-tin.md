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
- Chiến dịch là nhóm tùy chọn: một tin có thể không thuộc chiến dịch, một chiến
  dịch có nhiều tin. Chiến dịch giúp theo dõi mục tiêu và phễu, không làm thay
  đổi quyền truy cập tin. Nhà tuyển dụng tạo chiến dịch chỉ cần tên, không cần
  liên kết công ty hoặc hoàn tất bất kỳ bước xác thực nào; các điều kiện đó chỉ
  được kiểm tra khi gửi tin tuyển dụng để duyệt.

## Mô hình dữ liệu

| Bảng | Chủ sở hữu | Vai trò |
| --- | --- | --- |
| `recruitment_campaigns` | `RecruiterProfile` | Kế hoạch tuyển: vị trí, cấp bậc, headcount, ngân sách, hạn/mode tuyển liên tục và trạng thái chiến dịch. `company` có thể rỗng khi tạo nhanh; có thể truy ngược `source_need`. |
| `jobs.campaign_id` | `Job.posted_by` | Liên kết tùy chọn từ tin sang chiến dịch cùng chủ sở hữu. |
| `job_status_history` | `Job` | Audit chuyển trạng thái tin, actor (`employer`/`admin`) và ghi chú/lý do từ chối. |
| `applications.employer_rating` | `Application` | Điểm nội bộ 1–5, không trả cho ứng viên. |
| `application_status_history` | `Application` | Audit trạng thái, actor, ghi chú nội bộ; được dùng làm timeline ứng viên với DTO đã lọc. |

Các migration liên quan: `employers.0016`–`0018`, `jobs.0020`–`0022`, `applications.0010`.

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
  tiêu đề, mô tả, ít nhất một vị trí chuyên môn, ít nhất một địa điểm phường/xã + địa chỉ, số lượng
  và hạn nộp không ở quá khứ.
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

- Campaign: `/api/employer/campaigns/` cùng `options/`, `suggestions/`,
  `from-need/{public_id}/`, `{public_id}/status/`, `{public_id}/report/`.
  Modal tạo nhanh chỉ nhận `name` và có thể submit bằng Enter; không kiểm tra
  công ty/xác thực. Sau khi tạo, UI yêu cầu chọn hoạt động. Hiện có “Đăng tin
  tuyển dụng”; “Chủ động tìm kiếm ứng viên” được hiển thị disabled cho đến khi
  có workflow kho CV.
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
