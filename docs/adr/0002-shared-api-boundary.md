# ADR 0002 — Tách hạ tầng API dùng chung khỏi API nghiệp vụ

**Trạng thái:** Accepted — 2026-07-13

## Bối cảnh

`frontend/src/api/` đang trộn hạ tầng HTTP (axios instance, interceptor refresh
token, error mapper, pagination, dedup) với các domain service (`jobService`,
`authService`, `siteService`...). Client HTTP biết cả chuyện nghiệp vụ; token key
theo portal nằm rải rác. `authService.test.js` và `errorMessage.test.js` đã có nên
refactor được bằng compatibility re-export + contract test.

## Quyết định

Tách phần hạ tầng thành `shared/api/`, độc lập với nghiệp vụ:

```
shared/api/
  client.js                # axios instance + interceptors (refresh, 401)
  tokenStore.js            # đọc/ghi access/refresh theo portal — 1 nơi duy nhất
  errorMapper.js           # map lỗi API -> thông điệp người dùng
  pagination.js
  requestDeduplication.js
```

- **Client HTTP không biết endpoint nghiệp vụ.** Domain service (trong `features/*/api`)
  import client từ `shared/api`, tự khai báo path của mình.
- Giữ `src/api/*.js` cũ re-export tạm để import cũ không vỡ; xóa ở PR cleanup.
- **Cấm `axios.create` ngoài `shared/api`** — cưỡng chế bằng grep trong CI/lint.

## Bất biến contract

- Không đổi endpoint, timeout, hành vi refresh-token.
- Không đổi localStorage token key theo portal.
- `authService.test.js`, `errorMessage.test.js` phải giữ xanh.

## Hệ quả

- (+) Hạ tầng HTTP test được độc lập; nghiệp vụ không lệ thuộc chi tiết axios.
- (+) Token key tập trung một chỗ, giảm lỗi ghi sai portal.
- (−) Thêm một lớp re-export tạm trong thời gian chuyển tiếp.

## Rủi ro

Refresh-token race và khác biệt token key giữa main/employer/admin — phải có test
trước khi chỉnh interceptor.
