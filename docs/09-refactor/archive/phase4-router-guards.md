# Giai đoạn 4 — Providers, router và route guards

**Ngày:** 2026-07-13 · **Trạng thái:** hoàn tất phần hạ tầng, sẵn sàng cho onboarding R9.

## Kết quả

- `App.jsx` chỉ còn compose `BrowserRouter`, `AppProviders`, scroll restoration và `AppRouter`.
- `AppProviders` tập trung site settings, Ant Design theme và auth session.
- `AppRouter` compose portal route; `routes/AppRoutes.jsx` chỉ còn compatibility re-export.
- `AuthGuard` xử lý loading/authentication và luôn render loading shell khi session đang tải.
- `RoleGuard` chỉ kiểm tra role; không gọi API.
- `OnboardingGuard` dùng policy thuần, không có status thì allow để user cũ không bị redirect.

## Contract điều hướng

1. Thứ tự guard luôn là **AuthGuard → RoleGuard → OnboardingGuard**.
2. `AuthGuard` redirect tới trang login của portal kèm `returnUrl` là path nội bộ gốc,
   bao gồm query và hash.
3. Login email, 2FA và OAuth chỉ chấp nhận `returnUrl`/`next` là path nội bộ; URL tuyệt
   đối hoặc `//host` bị bỏ qua để chặn open redirect.
4. Khi R9 cung cấp `onboarding_status`, `OnboardingGuard` chỉ redirect
   `not_started`/`in_progress`; `completed`/`skipped` không bị ép quay lại.

## Xác nhận

- Unit: 46/46, gồm policy return URL và onboarding.
- E2E: 14/14 trên desktop/mobile, gồm refresh direct route protected và return URL.
- Lint và production build thành công.
