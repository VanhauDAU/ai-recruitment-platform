# 08 - Frontend

Stack: ReactJS + Vite, Tailwind CSS v4, Ant Design (theme xanh `#00b14f` qua `ConfigProvider` trong `App.jsx`), react-router-dom, axios.

## Cấu trúc thư mục (`frontend/src`)

```
pages/           # trang theo route
  auth/, candidate/, employer/, admin/   # chia theo role
  jobs/            # JobList.jsx (/jobs), JobDetail.jsx (/jobs/:slug)
  Home.jsx         # trang chủ public (TopCV-style)
components/      # component dùng chung
  Header.jsx, Footer.jsx        # mega-menu nav (Việc làm/Tạo CV/Công cụ/Cẩm nang) + footer
  JobCard.jsx, JobCardSkeleton.jsx
  CategoryMenu.jsx      # flyout danh mục 3 cấp ở trang chủ (hover nhóm nghề, phân trang nhóm)
  CategoryPicker.jsx    # modal chọn danh mục 3 cấp (multi-select), drill-down 1 cột trên mobile
  LocationFilter.jsx    # popover chọn nhiều tỉnh/thành + phường/xã, drill-down 1 cột trên mobile
  BannerCarousel.jsx    # banner tự trượt (5s), prev/next, dot, dừng khi hover
layouts/         # AuthLayout, DashboardLayout (Sider/Header theo role), MainLayout (Header+Footer, dùng cho Home/jobs)
api/             # api.js (axios + JWT interceptor + refresh), authService.js
                 # jobService.js, locationService.js — gọi API jobs/categories/locations
                 # pagination.js — helper fetchAllPages() gộp hết trang của endpoint bị phân trang
constants/       # jobOptions.js — label tiếng Việt (work_type/employment_type/experience_level/education_level) + formatSalary/formatEducation/formatLocations
hooks/           # useAuth.jsx (AuthContext: user, login, logout)
routes/          # AppRoutes.jsx (lazy-load toàn bộ trang qua React.lazy + Suspense), ProtectedRoute.jsx (chặn theo allowedRoles)
```

## Quy ước
- Gọi API qua `api/`, không gọi axios trực tiếp trong component.
- Route theo role bọc trong `<ProtectedRoute allowedRoles={[...]}>`; trang public (Home, jobs) bọc trong `MainLayout`.
- Access/refresh token lưu ở `localStorage`; refresh tự động khi access token hết hạn (401).
- Trang/route dùng `React.lazy` + `Suspense` (xem `AppRoutes.jsx`) để tách chunk theo trang.
- Loading state dùng Ant Design `Skeleton` (không dùng `Spin` cho khung nội dung có cấu trúc) để tránh giật layout.
- Component chỉ tách ra khi thực sự dùng lại ở nhiều nơi (ví dụ `LocationFilter` dùng chung ở Home và `/jobs`) — không tách sớm.
- Trên mobile, các overlay nhiều cột (`CategoryPicker`, `LocationFilter`) chuyển sang drill-down 1 cột (nút "←" quay lại) thay vì hiển thị nhiều cột song song như desktop.
