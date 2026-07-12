# Frontend FSD — Giai đoạn 0–1

## Route inventory giữ nguyên

| Portal | Route chính |
| --- | --- |
| Public | `/`, `/viec-lam`, `/viec-lam/:slug`, `/brand/:companySlug/tuyen-dung/:slug`, `/blog/*` |
| Candidate | `/viec-lam-da-luu`, `/tai-khoan/*`, `/tai-khoan/xac-thuc-email` |
| Employer | `/tuyendung`, `/tuyendung/app/*` |
| Admin | `/admin`, `/admin/app/*` |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/oauth/callback` |

## Skeleton và luật

- Thêm `pages`, `widgets`, `entities`; `app`, `features`, `shared` đã tồn tại.
- `frontend/ARCHITECTURE.md` quy định ownership, dependency, public API và naming.
- CI giữ API boundary và feature-boundary; migration tiếp theo phải không đổi URL,
  permission, lazy loading hoặc UI khi chỉ chuyển cấu trúc.

## Đợt kế tiếp

Hợp nhất router vào `app/router/routes/*` và chuyển các page theo một portal/lát cắt
mỗi lần. Không di chuyển toàn bộ `pages`, `components`, `layouts` cùng lúc.
