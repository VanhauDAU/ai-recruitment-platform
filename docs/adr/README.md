# Architecture Decision Records (ADR)

Ghi lại các quyết định kiến trúc của đợt tái cấu trúc ProCV (sau merge #24).
Mỗi ADR bất biến sau khi `Accepted`; muốn đổi thì viết ADR mới `Supersedes`.

| # | Quyết định | Trạng thái |
|---|---|---|
| [0001](./0001-feature-first-hybrid-frontend.md) | Frontend feature-first hybrid, chuyển đổi tăng dần | Accepted |
| [0002](./0002-shared-api-boundary.md) | Tách hạ tầng API dùng chung khỏi API nghiệp vụ | Accepted |
| [0003](./0003-backend-service-selectors.md) | Backend view/serializer mỏng + service/selectors | Accepted |
| [0004](./0004-single-responsibility-route-guards.md) | Route guard đơn trách nhiệm (auth/role/onboarding) | Accepted |
| [0005](./0005-env-based-settings.md) | Tách Django settings theo môi trường, giữ contract .env | Accepted |
| [0006](./0006-custom-server-state-during-refactor.md) | Server state bằng custom hooks có ranh giới rõ | Accepted |

Nguồn: *Kế hoạch tái cấu trúc ProCV sau merge main (2026-07-12)*.
