# Module quản lý tin tuyển dụng tại Admin

Màn hình vận hành để quản trị viên hậu kiểm tin tuyển dụng: tìm kiếm, lọc, xem
đầy đủ nội dung và thay đổi sau khi đăng, xử lý báo cáo vi phạm, tạm ẩn và khôi
phục hiển thị. Tin công khai ngay khi nhà tuyển dụng đăng
([ADR-0014](../02-tong-quan/adr-0014-job-post-moderation.md)); module **không**
có thao tác duyệt/từ chối. Quy tắc nghiệp vụ đầy đủ ở
[dac-ta-chien-dich-va-tin-tuyen-dung.md](../01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md).

## Route và quyền

| Route | Page | Quyền |
| --- | --- | --- |
| `/admin/app/job-moderation` | `pages/admin/app/JobModeration.jsx` | `job_moderation.view` |
| `/admin/app/job-moderation/:publicId` | `pages/admin/app/JobModerationDetail.jsx` | `job_moderation.view` |

Route đăng ký ở `app/router/admin/admin-routes.config.js`, loader lazy ở
`app/router/lazy/admin.pages.jsx`. Mục menu "Quản lý tin tuyển dụng".

Quyền thao tác:

| Quyền | Cho phép |
| --- | --- |
| `job_moderation.view` | Xem danh sách, chi tiết, hàng chờ báo cáo. |
| `job_moderation.enforce_visibility` | Tạm ẩn / khôi phục hiển thị tin. |
| `job_moderation.resolve_report` | Xác nhận, bác hoặc gỡ kết luận báo cáo. |
| `job_moderation.view_sensitive_contact` | Xem thông tin nhận hồ sơ và các thay đổi trên trường nhạy cảm. |

Frontend ẩn nút khi thiếu quyền; backend vẫn kiểm tra độc lập. Liên kết sang hồ
sơ nhà tuyển dụng chỉ hiện khi admin có một trong các quyền
`account.employer.view`, `account.view`, `employer_verification.view`,
`company_update.view`.

## Kiến trúc

```text
pages/admin/app/JobModeration*.jsx
  -> widgets/admin-job-management      (AdminJobManagement, AdminJobDetail)
      -> features/enforce-job-visibility (JobVisibilityActions)
      -> features/review-job-reports     (JobReportQueue, JobReportDecisionModal)
      -> entities/admin-job, entities/job-report, entities/admin-access
      -> shared/ui/admin
```

Backend (`backend/apps/jobs`): read model ở `selectors/moderation.py` và
`selectors/reports.py`; ghi ở `services/moderation.py` và `services/reports.py`;
HTTP ở `api/views/moderation.py`, `api/views/reports.py`; đối chiếu nội dung ở
`services/content_snapshot.py`.

## Trang danh sách

`AdminJobManagement` có hai tab, lưu trong query `tab`:

### Tab "Quản lý tin" (`AdminJobList`)

- Dải thẻ tổng quan bấm được: Tất cả tin, Đang tuyển (kèm số quá hạn), Báo cáo
  chờ, Đang tạm giữ, Bản nháp — số liệu từ `summary/`.
- Bộ chọn phạm vi (`JOB_SCOPE_OPTIONS`, query `job_scope`) ánh xạ sang tham số
  API:

| Phạm vi | Tham số gửi lên |
| --- | --- |
| Tất cả tin | — |
| Đang tuyển / Đã đóng / Nháp | `status=active` / `closed` / `draft` |
| Có báo cáo chờ | `has_reports=true` (có báo cáo `pending`) |
| Quá hạn | `scope=expired` (tin `active` đã qua hạn nhận hồ sơ) |
| Đang tạm giữ | `scope=held` (`policy_hold` hoặc `moderation_hold`) |

- Tìm kiếm debounce 400 ms (`job_q`) theo tiêu đề, công ty, tên/email người
  đăng, mã tin. Sắp xếp phía server (`job_ordering`), phân trang 20 dòng
  (`job_page`). Mọi trạng thái lọc nằm trên URL nên quay lại từ chi tiết giữ
  nguyên ngữ cảnh.
- Cột: tin (kèm mã và link trang công khai), công ty, nhà tuyển dụng, trạng
  thái (tag Quá hạn, Tạm giữ), tín hiệu (số báo cáo chờ, số tin đã đăng của
  người đăng), hạn nhận hồ sơ, tạo lúc, đăng lần đầu lúc, số ứng tuyển.
- Bảng không có nút quyết định; admin mở chi tiết trước khi xử lý. Có xuất CSV
  trang hiện tại và làm mới.
- Link trang công khai chỉ bật khi `is_publicly_visible=true` (cùng predicate
  với bề mặt ứng viên), tránh mở trang sẽ 404.

### Tab "Báo cáo vi phạm" (`JobReportQueue`)

- Lọc trạng thái (mặc định `pending`, có "Tất cả trạng thái"), lý do, khoảng
  ngày báo cáo, tìm kiếm; sắp xếp và phân trang phía server. Query dùng tiền tố
  `report_`.
- Báo cáo `pending`: "Xác nhận vi phạm" hoặc "Bác bỏ báo cáo". Báo cáo
  `upheld`: "Gỡ kết luận". Cả ba mở `JobReportDecisionModal` yêu cầu ghi chú;
  modal nêu tác động lên huy hiệu xác thực của người đăng.
- Xác nhận báo cáo có lý do tin cậy (`fake_company`, `scam`, `wrong_info`) tự
  tạm ẩn tin với mức `confirmed_violation`. Gỡ kết luận không tự hiện lại tin.

## Trang chi tiết (`AdminJobDetail`)

- Thanh trên: nút quay lại nhỏ căn trái (về đúng URL danh sách đã mở, mặc định
  danh sách gốc) và link trang công khai.
- `AdminJobOverview`: tiêu đề, trạng thái, hold, thu nhập, hạn nộp, đăng lần
  đầu, số báo cáo chờ, cảnh báo "Chặn công khai" khi có `blocked_reasons`, và
  tag cam kết chịu trách nhiệm (phiên bản đã xác nhận, hoặc "đăng trước khi áp
  dụng cam kết").
- Thanh dính (`AdminJobDecisionDock`): trạng thái, lý do bị chặn công khai,
  link "Mở hồ sơ xác thực" khi blocker là `verification_required`/
  `dpa_outdated` và admin có `employer_verification.view`, cùng nút quyết định.
- Cột phải `AdminJobReviewSummary`: số tín hiệu tín nhiệm cần chú ý, báo cáo
  chờ, số tin đã đăng, cấp tài khoản.

Các tab (tablist điều hướng bằng phím mũi tên/Home/End):

| Tab | Nội dung |
| --- | --- |
| Thay đổi | `AdminJobChangeReview`: đối chiếu nội dung hiện tại với `approved_snapshot` của lần đăng gần nhất, theo từng trường (text, ngày, rich text đã sanitize, danh sách thêm/bớt). Badge đếm số thay đổi. Trường nhạy cảm bị ẩn và chỉ đếm khi thiếu quyền `view_sensitive_contact`. Tin chưa có snapshot hiển thị thông báo "Chưa có bản đã đăng để so sánh". |
| Nội dung | Mô tả, yêu cầu, quyền lợi. |
| Điều kiện | Thu nhập, hạn nộp, hình thức và loại hợp đồng, kinh nghiệm, cấp bậc, học vấn, giới tính, độ tuổi, số lượng, chuyên môn, kỹ năng, quyền lợi chuẩn hóa, ngoại ngữ. |
| Địa điểm | Địa điểm và lịch làm việc. |
| Nhà tuyển dụng | Tín hiệu xác thực (hồ sơ, email, điện thoại, cấp tài khoản), người đăng, vai trò công ty, tình trạng tài khoản. |
| Nhận hồ sơ | Người nhận, điện thoại, email; chỉ hiện khi có `view_sensitive_contact`. |
| Báo cáo | Báo cáo của tin, lý do, trạng thái, mô tả/ghi chú kết luận. Badge đếm báo cáo chờ. |
| Lịch sử | Hai luồng: sự kiện kiểm duyệt (`JobModerationEvent`, gồm cả `approve`/`reject` cũ chỉ để đọc) và lịch sử trạng thái (`JobStatusHistory`). |

Khi mở trang, tab mặc định là "Thay đổi" nếu có thay đổi so với bản đã đăng,
ngược lại là "Nội dung".

### Tạm ẩn và khôi phục (`JobVisibilityActions`)

- Nút hiện theo `state_actions` do backend tính: `hide` khi tin `active` chưa bị
  giữ, `restore` khi có `moderation_hold`; và chỉ khi admin có
  `job_moderation.enforce_visibility`.
- Tạm ẩn: chọn mức giữ (`manual_review` "Tạm giữ để kiểm tra thêm" hoặc
  `confirmed_violation` "Vi phạm đã xác nhận"), căn cứ (`JOB_DECISION_REASONS`)
  và ghi chú bắt buộc. Khôi phục: lý do bắt buộc.
- Mỗi request gửi `review_token` lấy từ chi tiết. API trả `409` khi tin đã thay
  đổi; frontend báo lỗi và tải lại chi tiết. Thành công thì cập nhật cache chi
  tiết, làm mới danh sách và tổng quan.
- Tạm ẩn không đổi `status`, chỉ loại tin khỏi mọi bề mặt công khai. Nhà tuyển
  dụng thấy tin bị tạm ẩn và nhóm lý do, không thấy ghi chú của admin.

## Hợp đồng API

| Endpoint | Mục đích |
| --- | --- |
| `GET /api/jobs/admin/moderation/` | Danh sách (`q`, `scope`, `status`, `has_reports`, `company`, `employer`, `tier`, `policy_hold`, `moderation_hold`, khoảng `submitted_*`/`deadline_*`, `ordering`). |
| `GET /api/jobs/admin/moderation/summary/` | `total`, `draft`, `active`, `expired`, `closed`, `held`, `pending_reports`. |
| `GET /api/jobs/admin/moderation/{public_id}/` | Chi tiết, `review_token`, `state_actions`, `blocked_reasons`, `content_changes`, báo cáo, lịch sử. |
| `POST /api/jobs/admin/moderation/{public_id}/decisions/` | `action=hide|restore`. |
| `GET /api/jobs/admin/reports/` | Hàng chờ báo cáo. |
| `POST /api/jobs/admin/reports/{public_id}/resolve/` | `status=upheld|dismissed` kèm `note`. |
| `POST /api/jobs/admin/reports/{public_id}/reverse/` | Gỡ kết luận `upheld`, `note` bắt buộc. |

## UI và responsive

- Dùng `AdminPageHeader`, `AdminPanel`, `AdminDataActions` và spacing chung của
  admin; alert lỗi một dòng có nút "Thử lại"; Skeleton khi tải.
- Bảng cuộn ngang cục bộ, trang không tràn ngang ở desktop, tablet và mobile.
- Rich text hiển thị qua `@/shared/lib/sanitize-html`.

## Việc còn mở

- Tên hàng chờ báo cáo trỏ thẳng ra trang công khai của tin, chưa có lối tắt
  sang trang chi tiết admin của tin đó.
