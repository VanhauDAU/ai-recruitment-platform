# 08 - Frontend

Stack: ReactJS + Vite, Tailwind CSS v4, Ant Design, react-router-dom, axios.

## Cấu trúc thư mục (`frontend/src`)

```
pages/           # trang theo route, chia theo role: auth/, candidate/, employer/, admin/
components/      # component dùng chung
layouts/         # AuthLayout, DashboardLayout (Sider/Header theo role)
services/        # api.js (axios + JWT interceptor + refresh), authService.js
hooks/           # useAuth.jsx (AuthContext: user, login, logout)
routes/          # AppRoutes.jsx, ProtectedRoute.jsx (chặn theo allowedRoles)
```

## Quy ước
- Gọi API qua `services/`, không gọi axios trực tiếp trong component.
- Route theo role bọc trong `<ProtectedRoute allowedRoles={[...]}>`.
- Access/refresh token lưu ở `localStorage`; refresh tự động khi access token hết hạn (401).
