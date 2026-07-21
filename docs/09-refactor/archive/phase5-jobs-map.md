# Giai đoạn 5 — Jobs theo lát cắt dọc

**Ngày:** 2026-07-13 · **Trạng thái:** candidate slice và backend boundary hoàn tất; employer UI chưa tồn tại từ trước.

## Source → target

| Khu vực | Trước | Sau |
|---|---|---|
| API frontend | `src/api/jobService.js` | `src/features/jobs/api/jobService.js` |
| URL builder | `src/config/jobPaths.js` | `src/features/jobs/lib/jobPaths.js` |
| Candidate UI | `src/pages/main/jobs/*` | `src/features/jobs/pages/candidate/*` |
| Lazy routes | import page cũ | `features/jobs/routes.js` dynamic loader |
| Backend employer query | lặp `select_related/prefetch_related` trong view | `apps.jobs.selectors.employer.employer_jobs_queryset` |
| Backend employer update | serializer save trực tiếp | `apps.jobs.services.update_employer_job` |

## Contract giữ nguyên

- Không đổi URL candidate `/viec-lam`, `/viec-lam/:slug`, `/brand/:companySlug/tuyen-dung/:slug`, `/viec-lam-da-luu`.
- Không đổi endpoint public hay employer: `/jobs/`, `/jobs/saved/`, `/jobs/mine/`.
- `src/api/jobService.js`, `src/config/jobPaths.js` và ba candidate page cũ là re-export tương thích; cleanup ở R10.
- Query public và employer vẫn dùng `select_related`/`prefetch_related`; selector employer dùng chung cho list/detail để không lệch quan hệ đã preload.

## Giới hạn còn lại

Frontend hiện không có màn employer jobs CRUD trước giai đoạn này. API command
`get/create/update/deleteEmployerJob` đã được đặt trong feature, nhưng không dựng UI mới
ngoài phạm vi refactor để tránh trộn thay đổi nghiệp vụ/giao diện. Employer UI và E2E CRUD
sẽ được triển khai khi có luồng/thiết kế được chốt.

## Xác nhận

- Frontend unit: 48/48.
- Backend `apps.jobs`: 9/9.
- E2E Jobs: refresh trực tiếp `/viec-lam` qua desktop/mobile đều xanh.
- Frontend lint/build xanh.
