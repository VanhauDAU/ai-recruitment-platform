# 08 - Frontend

Stack: ReactJS + Vite, Tailwind CSS v4, Ant Design (theme xanh `#00b14f` qua `ConfigProvider` trong `App.jsx`), react-router-dom, axios.

## Mô hình 3 cổng

Frontend chia thành 3 cổng (portal), cấu hình tập trung ở `config/portals.js` (base path, token key theo cổng, điều hướng theo role). Dev cùng host: cổng NTD prefix `/tuyendung`, admin prefix `/admin`. Production tách subdomain.

| Cổng | Prefix (dev) | Vai trò |
|---|---|---|
| `main` | `/` | Ứng viên + khách (Home, việc làm, auth, xác thực email) |
| `employer` | `/tuyendung` | Nhà tuyển dụng (marketing + app) |
| `admin` | `/admin` | Quản trị |

## Cấu trúc thư mục (`frontend/src`)

```
pages/           # trang theo 3 cổng
  main/            # Home.jsx, jobs/ (JobList, JobDetail), auth/ (Login, Register, OAuthCallback,
                   #   ForgotPassword, ResetPassword — dùng chung cho cả 3 cổng), account/ (VerifyEmail)
  employer/        # marketing/ (Landing, Services, Pricing) + app/ (Login, Register, Dashboard)
  admin/           # app/ (Settings, ...)
components/      # component dùng chung
  layout/          # Header, CandidateUserMenu, ...
  auth/            # LoginForm (dùng chung 3 cổng), SocialLoginButtons (Google/FB/LinkedIn), AuthLogo,
                   #   PasswordRequirements + passwordValidation (rule mật khẩu dùng chung register/reset)
  ui/, admin/, site/, ...
  CategoryPicker / LocationFilter   # overlay nhiều cột, drill-down 1 cột trên mobile
  BannerCarousel   # banner tự trượt (5s), prev/next, dot
layouts/         # AuthLayout, DashboardLayout, MainLayout (Header+Footer), EmployerMarketingLayout
api/             # api.js (axios + JWT interceptor + refresh), authService.js (kèm oauthStartUrl/completeOAuth)
                 # jobService/locationService/siteService/adminSiteService/mediaService
                 # errorMessage.js (getApiErrorMessage + getOAuthErrorMessage), pagination.js (fetchAllPages)
config/          # portals.js — 3 cổng: base path, getAuthStorageKeys(portal), HOME_BY_ROLE, getCurrentPortal
constants/       # jobOptions.js — label tiếng Việt + formatSalary/formatEducation/formatLocations
contexts/        # React context/provider dùng toàn app (AuthProvider, SiteSettingsContext)
hooks/           # Hook tái sử dụng (useAuth, useColorScheme, ...)
routes/          # AppRoutes + route definitions; lazyPages.jsx quản lý page-level code splitting
                 # ProtectedRoute.jsx (chặn theo allowedRoles)
```

## Social login (OAuth)

- `SocialLoginButtons` full-page redirect sang `GET /api/auth/oauth/<provider>/start/`; backend xử lý xong redirect về trang `OAuthCallback` (`/oauth/callback` hoặc `/tuyendung/app/oauth/callback`).
- `OAuthCallback` đổi `one_time_code` lấy JWT (guard chống StrictMode gọi 2 lần), lưu token đúng cổng, rồi điều hướng về `next` hoặc trang chủ theo role. Lỗi → về trang login kèm `?oauth_error=` hiển thị trong `LoginForm`.

## Quy ước
- Gọi API qua `api/`, không gọi axios trực tiếp trong component.
- Route theo role bọc trong `<ProtectedRoute allowedRoles={[...]}>`; trang public (Home, jobs) bọc trong `MainLayout`.
- Access/refresh token lưu ở `localStorage`; refresh tự động khi access token hết hạn (401).
- Trang/route dùng `React.lazy` qua registry `routes/lazyPages.jsx` và `Suspense` ở `AppRoutes.jsx` để tách chunk theo trang.
- Loading state dùng Ant Design `Skeleton` (không dùng `Spin` cho khung nội dung có cấu trúc) để tránh giật layout.
- Component chỉ tách ra khi thực sự dùng lại ở nhiều nơi (ví dụ `LocationFilter` dùng chung ở Home và `/jobs`) — không tách sớm.
- Trên mobile, các overlay nhiều cột (`CategoryPicker`, `LocationFilter`) chuyển sang drill-down 1 cột (nút "←" quay lại) thay vì hiển thị nhiều cột song song như desktop.
