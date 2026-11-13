# 08 - Frontend

Tóm tắt nhanh. Quy tắc layer, public API của slice, placement, ownership map
từng mảng và quy trình thêm page hoặc portal nằm ở nguồn chuẩn
[`frontend/ARCHITECTURE.md`](../../frontend/ARCHITECTURE.md); file này không
lặp lại các quy tắc đó.

## Stack

React 19 + Vite 8, React Router 8, Ant Design 6 (theme qua `ConfigProvider`),
Tailwind CSS 4, TanStack Query 5, axios (chỉ trong `shared/api`), i18next cho cổng
marketing nhà tuyển dụng. Unit test bằng Vitest, E2E smoke bằng Playwright ở ba
viewport (desktop, tablet, mobile).

## Ba cổng

Cấu hình tập trung ở `src/shared/config/portals.js`: base path, khóa phiên theo
cổng và trang chủ theo role. Dev chạy cùng host; production có thể tách subdomain.

| Cổng | Prefix | Người dùng |
| --- | --- | --- |
| `main` | `/` | Ứng viên và khách |
| `employer` | `/tuyendung` (marketing), `/tuyendung/app` (workspace) | Nhà tuyển dụng |
| `admin` | `/admin` | Quản trị viên theo RBAC |

## Cấu trúc `src`

```text
app/       composition root: AppProviders, AppRouter, layouts, guards, lazy page registry
pages/     page theo cổng (main, employer, admin); chỉ ghép UI và đọc route params
widgets/   khối UI lớn của một cổng hoặc layout
features/  hành động và workflow của người dùng; không import feature khác
entities/  model, API và UI theo domain
shared/    api client, config, hooks, lib, ui không biết domain
```

Chiều phụ thuộc `app → pages → widgets → features → entities → shared` được
`npm run check:architecture` kiểm tra tự động.

## Routing và phiên đăng nhập

- Route theo cổng ở `app/router/routes/*`, page lazy-load qua `app/router/lazy/*`.
- Guard ở `app/router/guards`: `AuthGuard`, `GuestGuard`, `RoleGuard`,
  `PermissionGuard` (quyền admin), `EmployerOnboardingGuard`,
  `EmployerCapabilityGuard`, `JobWorkspaceGuard`, `CandidateDataGuard`.
- Access token chỉ nằm trong memory theo cổng (`shared/api/token-store.js`);
  refresh token là cookie HttpOnly do backend quản lý. Đăng xuất một cổng không
  xóa phiên của cổng khác.
- Social login chuyển hẳn trang sang `/api/auth/oauth/<provider>/start/`; trang
  `OAuthCallback` của từng cổng đổi `one_time_code` lấy phiên rồi điều hướng.

## Quy ước UI

- Mọi màn hình phải dùng được trên mobile (Tailwind `sm:`/`md:`/`lg:`); E2E kiểm
  tra không tràn ngang ở cả ba viewport.
- Trạng thái tải dùng `Skeleton` cho khung nội dung có cấu trúc.
- HTML giàu định dạng chỉ render qua `@/shared/lib/sanitize-html`.
- File trên 300 dòng bị lint cảnh báo; không để file đang vượt ngưỡng dài thêm.

Tài liệu runtime riêng: [dải thông báo đa cổng](dai-thong-bao-da-cong.md),
[quản lý tin tuyển dụng quản trị](admin-job-management.md).
