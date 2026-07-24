# Giai đoạn 5 — Frontend refactor report

> Thực hiện ngày 2026-07-24. Phạm vi gồm sáu lát cắt có regression rõ trên FSD
> hiện tại; không đổi cấu trúc top-level, UI contract hoặc auth/CV workflow.

## 1. Phạm vi và guardrail

Đã xử lý:

1. Employer workspace path theo portal host (`FE-001`).
2. Company-document query key canonical (`FE-006`).
3. Create/rename campaign thuộc feature (`FE-007`, một phần).
4. Consultation Leads dùng TanStack Query (`FE-008`).
5. Boundary rules có negative fixtures (`FE-009`).
6. Manifest và lazy-route bundle measurement (`FE-010`, một phần).

Không thay token/storage key, refresh/logout/session restore, role/guard,
onboarding return URL, CV autosave/version/snapshot, URL route, API payload hoặc
copy/markup của workflow được tách.

## 2. Ba portal và navigation

Tám file employer trước đây chứa 27 literal `/tuyendung/app`. Tất cả đường dẫn
thực thi — `Link`, `navigate`, button `href` và URL có query string — hiện đi
qua `employerAppPath`.

Regression import lại portal config với env độc lập và khóa:

- Employer host: `/app/...`.
- Main host/dev: `/tuyendung/app/...`.

Production source không còn literal thực thi; chuỗi còn lại chỉ là comment mô
tả contract dev trong `shared/config/portals.js`.

## 3. Query key và request lifecycle

### Company documents

`employerProfileKeys.companyDocuments` là
`['employer', 'company', 'documents']`. Business License, Data Protection và
Company Form dùng cùng key; invalidation prefix
`employerProfileKeys.company` tiếp tục làm mới toàn bộ company namespace.

### Consultation Leads

Trang admin bỏ state/fetch thủ công và dùng:

```text
consultationLeadKeys.adminList({ status, page })
→ queryFn nhận AbortSignal
→ Axios forward signal
→ response count/results điều khiển pagination
```

- Đổi filter reset về trang 1 và request cũ bị abort.
- Response cũ không thể ghi đè filter mới.
- Mutation dùng biến pending theo row và invalidate list prefix canonical.
- Nếu lead duy nhất ở trang cuối của filter `new` được chuyển trạng thái, page
  lùi trước khi refetch để tránh DRF trả 404 page out of range.
- Error chỉ báo sau retry policy của provider.

## 4. Campaign feature boundary

`CreateCampaignModal` và `RenameCampaignModal` hiện thuộc
`features/manage-campaigns` và sở hữu:

- Domain mutation.
- `campaignKeys.all` invalidation.
- Success/error feedback.
- Form reset/close và callback mở activity flow.

`CampaignList` giữ query/filter/pagination, URL modal state, table composition và
activity modal. File giảm từ 573 xuống 494 dòng vật lý (470 lint lines). Đây là
lát cắt incremental; không mass-split JobForm/ApplicationList/admin CRUD.

## 5. Enforcement và bundle evidence

Dependency Cruiser hiện cấm:

- Circular dependency trong `src`.
- Import giữa hai entity slice.
- Page import chéo `main`, `employer`, `admin`.

Rule được sinh từ filesystem. `check:architecture` chạy graph production và một
fixture cố ý vi phạm; fixture phải bị đúng ba rule bắt lại. Runner gọi
dependency-cruiser bằng Node executable nên không phụ thuộc shell `.cmd`.

Production build bật Vite manifest. `bundle-stats.json` giữ initial budgets và
bổ sung:

- Mọi JavaScript chunk cùng gzip/raw size, static/dynamic imports và CSS.
- Mỗi lazy page entry cùng static-import closure.
- Incremental JS/CSS sau khi trừ initial assets.
- Referenced binary assets để audit, không cộng vào JS/CSS gzip.

Không đặt lazy-route threshold khi mới có một baseline.

## 6. Kiểm chứng

| Gate | Kết quả |
| --- | --- |
| Oxlint | Pass; còn 12 warning `max-lines` đã biết |
| Dependency graph | 627 module, 1.277 dependency, 0 violation |
| Negative architecture fixtures | Bắt đúng no-cycle, cross-entity, cross-portal |
| Unit + coverage | 111 file, 388/388 test pass |
| Coverage quan sát | Statements 39,38%; branches 35,47%; functions 35,07%; lines 41,81% |
| Production build | 3.770 module transformed; manifest sinh thành công |
| Initial bundle gate | JS 284,9/320 KiB; CSS 33,4/35 KiB gzip |
| Lazy report | 263 JavaScript chunk; 67 dynamic route |
| Smoke E2E | 81/81 pass ở lượt xác nhận cuối; lượt đầu có một timing flake trên tablet và case đó pass khi rerun riêng |

Warning JSDOM pseudo-element/canvas và Playwright `NO_COLOR` vẫn là `QA-001`;
không suppress rộng trong refactor này.

## 7. Debt và rollback

- `FE-002`, phần còn lại `FE-004`, `FE-007` và lazy-route thresholds vẫn mở.
- `FE-003`, `FE-005`, `FE-011` cùng toàn bộ CV hardening không thay đổi vì cần
  proposal/product decision hoặc contract rộng hơn.
- Revert từng commit khôi phục path/query/page cũ mà không cần migration hoặc
  data repair. Manifest/report chỉ là build artifact; không đổi runtime API.
