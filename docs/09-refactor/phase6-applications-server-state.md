# Giai đoạn 6 — Applications, Saved Jobs và server state

**Ngày:** 2026-07-13 · **Trạng thái:** phần state/API hoàn tất; UI Applications chưa có trước refactor.

## Source → target

| Khu vực | Trước | Sau |
| --- | --- | --- |
| Saved Jobs state | `contexts/SavedJobsProvider.jsx`, `hooks/useSavedJobs.js` | `features/saved-jobs` |
| Saved Jobs legacy | context/hook cũ | re-export tương thích tới R10 |
| Applications frontend | chưa có domain client | `features/applications/api/applicationService.js` |
| Application status | service nhận mọi status | transition graph tập trung trong `apps.applications.services` |
| Site Settings | global context không có retry | global configuration context với fallback, retry và `retry()` |

## Contract và state

- Không đổi endpoint: `/applications/`, `/applications/employer/`,
  `/jobs/saved/` và `/jobs/saved/:publicId/`.
- Saved Jobs vẫn dùng API làm source of truth. Optimistic UI chỉ dùng cho tab
  hiện tại; mutation thành công phát `BroadcastChannel`, tab khác/focus sẽ tải
  lại từ server.
- Login/logout hoặc đổi candidate key xóa state cũ và tải lại đúng candidate.
- Application status cho phép đi tới bước đánh giá sau hoặc quyết định cuối;
  `accepted`/`rejected` là terminal và không thể mở lại/quay lùi.
- Site Settings là configuration bootstrap toàn app nên tiếp tục là global
  context; khi API lỗi, giao diện dùng `DEFAULT_SITE_SETTINGS` và có retry tối
  đa hai lần trước khi expose `error`.

## Quyết định server state

Không thêm Query library ở R6. Lý do và ngưỡng xem xét lại được ghi tại
[ADR 0006](../adr/0006-custom-server-state-during-refactor.md): resource server
state hiện còn ít, có dedupe/TTL trong `shared/api`, và migration toàn cục sẽ
vượt phạm vi lát cắt này.

## Giới hạn còn lại

Frontend chưa có màn candidate apply/chọn CV hoặc employer quản lý ứng viên
trước giai đoạn này. API đã được feature hóa và backend transition đã được
khóa; UI/E2E nghiệp vụ cần được triển khai cùng luồng CV và thiết kế employer,
không dựng màn giả trong đợt tái cấu trúc.

## Xác nhận

- Frontend unit: 50/50; lint và build xanh.
- Backend `apps.applications`: 3/3.
