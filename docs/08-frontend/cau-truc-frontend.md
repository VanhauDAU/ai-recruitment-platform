# 08 - Frontend

Tóm tắt nhanh. Quy tắc layer, public API của slice, placement, ownership map
từng mảng và quy trình thêm page hoặc portal nằm ở nguồn chuẩn
[`frontend/ARCHITECTURE.md`](../../frontend/ARCHITECTURE.md); file này không
lặp lại các quy tắc đó.

## Stack

React 19 + Vite 8, React Router 8, Ant Design 6 (theme qua `ConfigProvider`),
Tailwind CSS 4, TanStack Query 5, axios (chỉ trong `shared/api`), Paraglide JS cho song ngữ
vi/en (ADR-0023). Unit test bằng Vitest, E2E smoke bằng Playwright ở ba
viewport (desktop, tablet, mobile).

## Ba cổng

Cấu hình tập trung ở `src/shared/config/portals.js`: base path, khóa phiên theo
cổng và trang chủ theo role. Dev chạy cùng host; production có thể tách subdomain.

| Cổng | Prefix | Người dùng |
| --- | --- | --- |
| `main` | `/` | Ứng viên và khách |
| `employer` | `/tuyendung` (marketing), `/tuyendung/app` (workspace) | Nhà tuyển dụng |
| `admin` | `/admin` | Quản trị viên (superuser hoặc admin, ADR-0018) |

## Cấu trúc `src`

```text
src/
├── app/                 # Khởi tạo ứng dụng: providers, router, guard, layout, lazy registry
├── pages/               # Trang theo cổng và mục; chỉ ghép UI và đọc route params
│   ├── main/            #   Ứng viên, khách: home, jobs, companies, cvs, account, auth…
│   ├── employer/        #   NTD: marketing, auth, dashboard, jobs, candidates, campaigns…
│   └── admin/           #   Quản trị: dashboard, accounts, companies, jobs, cvs, blog…
├── widgets/             # Khối giao diện lớn của một cổng hoặc layout
│   └── <cổng>/<widget>/ #   main · employer · admin · common
├── features/            # Hành động và workflow của người dùng
│   ├── main/            #   job · application · cv · company · account
│   ├── employer/        #   account · company · job · candidate · campaign · marketing
│   ├── admin/           #   account · company · job · content · system
│   └── common/          #   account · cv · privacy (dùng ở từ hai cổng trở lên)
│       └── <module>/<slice>/
│           ├── index.js #     Public API của slice
│           ├── ui/      #     Component
│           ├── model/   #     Hook, state, logic
│           ├── api/     #     Gọi backend
│           └── lib/     #     Hàm thuần hỗ trợ
├── entities/            # Model, API và UI theo domain
│   └── <domain>/        #   account · job · company · cv · application · campaign ·
│       └── <entity>/    #   content · notification · dashboard · system
└── shared/              # Hạ tầng không biết nghiệp vụ: api, config, hooks, lib, ui
```

Chiều phụ thuộc `app → pages → widgets → features → entities → shared` được
`npm run check:architecture` kiểm tra tự động, cùng với cách ly cổng: trang và
widget của một cổng chỉ dùng feature/widget của cổng đó hoặc `common`.

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
