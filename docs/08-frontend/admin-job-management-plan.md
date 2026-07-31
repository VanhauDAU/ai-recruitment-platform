# Kế hoạch module quản lý tin tuyển dụng tại Admin

## Mục tiêu

Module cung cấp một màn hình vận hành thống nhất để admin tìm kiếm, lọc, xem đầy
đủ nội dung và đưa ra quyết định trên tin tuyển dụng. Luồng duyệt tin cũ tiếp tục
hoạt động, nhưng mọi quyết định mới được thực hiện từ trang chi tiết để admin có
đủ ngữ cảnh và tránh thao tác nhầm trên bảng.

## Phạm vi đã triển khai

- Danh sách có tìm kiếm, lọc theo trạng thái/phạm vi, sắp xếp và phân trang phía
  server; các thẻ tổng quan mở nhanh hàng chờ, tin đang hiển thị, tin bị giữ,
  tin từ chối và báo cáo.
- Trang chi tiết gồm nội dung tuyển dụng, điều kiện, địa điểm, lịch làm việc,
  tín hiệu nhà tuyển dụng, thông tin nhận hồ sơ theo quyền, báo cáo và lịch sử.
- Quyết định duyệt, từ chối, ẩn và khôi phục đều yêu cầu đúng quyền RBAC. Ẩn tin
  không sửa trạng thái nghiệp vụ của tin và loại tin khỏi mọi bề mặt công khai.
- Mỗi quyết định dùng token phiên bản; nếu nội dung đã thay đổi, API trả `409`
  để buộc admin tải lại trước khi tiếp tục.
- Nhật ký kiểm duyệt là bất biến, lưu người thao tác, lý do, ghi chú, trạng thái
  và trạng thái giữ trước/sau quyết định.

## Kiến trúc

```text
pages/admin
  -> widgets/admin-job-management
      -> features/review-job-submission
      -> features/enforce-job-visibility
      -> entities/admin-job
      -> shared/ui/admin
```

Backend tuân theo chiều phụ thuộc `api -> services/selectors -> models`:

- `selectors/moderation.py`: read model danh sách, chi tiết và tổng quan.
- `services/moderation.py`: khóa bản ghi, kiểm tra token và ghi quyết định.
- `models/moderation.py`: audit event bất biến.
- `api/views/moderation.py`: permission gate và HTTP contract.

## Hợp đồng API

| Endpoint | Mục đích |
| --- | --- |
| `GET /api/jobs/admin/moderation/` | Danh sách quản trị |
| `GET /api/jobs/admin/moderation/summary/` | Số liệu tổng quan |
| `GET /api/jobs/admin/moderation/{public_id}/` | Chi tiết và token phiên bản |
| `POST /api/jobs/admin/moderation/{public_id}/decisions/` | Duyệt, từ chối, ẩn, khôi phục |

Endpoint review cũ được giữ để tương thích với client hiện hữu.

## UI/UX và quyền truy cập

- Dùng cùng `AdminPanel`, `AdminStatCard`, spacing, màu trạng thái và shell điều
  hướng với các trang admin hiện tại.
- Bảng không hiển thị nút quyết định trực tiếp; admin mở chi tiết trước khi xử lý.
- Thông tin nhận hồ sơ chỉ trả về khi có
  `job_moderation.view_sensitive_contact`; liên kết hồ sơ nhà tuyển dụng chỉ hiện
  khi admin có quyền vào màn hình đích.
- Bố cục không tràn ngang ở desktop, tablet và mobile; bảng dùng cuộn ngang cục
  bộ khi không đủ không gian.

## Thứ tự phát hành

1. Chạy migration `0033_job_moderation_management`.
2. Đồng bộ permission catalog và gán quyền mới cho vai trò vận hành phù hợp.
3. Phát hành backend trước, sau đó frontend.
4. Smoke test các luồng danh sách, chi tiết, duyệt, từ chối, ẩn và khôi phục.
5. Theo dõi số lượng `409`, tin bị giữ và quyết định theo audit log trong giai
   đoạn đầu sau phát hành.

