# ADR 0004 — Route guard đơn trách nhiệm (auth / role / onboarding)

**Trạng thái:** Accepted — 2026-07-13

## Bối cảnh

Hiện có `ProtectedRoute` gộp việc kiểm tra đã-đăng-nhập và role. `App.jsx` cũng gánh
nhiều việc. Sắp thêm luồng onboarding — nếu nhồi tiếp vào guard cũ sẽ dễ gây redirect
loop và khó test. Guard hiện `return null` khi auth đang loading (màn trắng).

## Quyết định

Tách guard thành các thành phần đơn trách nhiệm dưới `app/router/guards/`:

- **AuthGuard** — chỉ xử lý authenticated/loading. Khi loading hiển thị *loading shell*,
  KHÔNG `return null`. Không tự gọi API trùng với `AuthProvider`.
- **RoleGuard** — chỉ xử lý role/portal.
- **OnboardingGuard** — chỉ áp policy onboarding, thiết kế để KHÔNG gây loop
  (trạng thái `not_started/in_progress/completed/skipped`; user cũ không bị ép quay lại).

Đồng thời gom provider vào `app/providers/AppProviders.jsx` và router vào
`app/router/AppRouter.jsx`; `App.jsx` chỉ còn composition.

## Bất biến

- Toàn bộ URL hiện tại giữ nguyên.
- `returnUrl` chuẩn hóa: đăng nhập xong quay đúng trang đang chặn.
- Có test refresh trực tiếp tại route protected (không mất phiên, không loop).

## Hệ quả

- (+) Mỗi guard test được độc lập; thêm onboarding không đụng auth/role.
- (+) Không còn màn trắng khi đang xác thực phiên.
- (−) Nhiều component guard nhỏ thay vì một — nhưng rõ trách nhiệm hơn.

## Rủi ro

Thứ tự lồng guard (auth → role → onboarding) phải nhất quán để tránh loop; phủ bằng
route-matrix test.
