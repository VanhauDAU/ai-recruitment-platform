# ADR 003 — No cross-feature import

## Decision

Code trong `src/features` không import feature khác. Feature chỉ phụ thuộc
`entities` và `shared`; việc ghép nhiều feature thuộc `widgets`, `pages` hoặc `app`.

## Context

Cross-feature import biến một action nhỏ thành dependency ngầm của action khác,
làm khó tái sử dụng, test và xóa feature. Các import Saved Jobs → Save Job/Auth và
Auth → Two Factor là ví dụ coupling cần loại bỏ.

## Alternatives considered

- Cho phép import qua deep path: còn chặt hơn vào nội bộ feature khác.
- Cho phép import qua public index: vẫn tạo chu kỳ/coupling giữa workflow.
- Dùng shim bridge: chỉ trì hoãn việc chọn đúng owner.

## Consequences

- Contract dùng chung phải được đặt vào entity/shared hoặc được compose từ layer
  cao hơn.
- Dependency-cruiser và script boundary chạy trong CI để phát hiện vi phạm.
- Ngoại lệ cần ADR, whitelist có phạm vi hẹp và test; mặc định không có ngoại lệ.

## Migration notes

Saved Jobs sở hữu API và server state riêng; login OTP được chuyển về auth còn
quản lý cài đặt 2FA giữ ở two-factor. Khi refactor feature mới, chạy
`rg "@/features/" frontend/src/features` và kiểm tra từng kết quả trước khi merge.
