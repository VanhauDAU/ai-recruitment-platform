# ADR 001 — Frontend layered architecture

## Decision

Frontend dùng các layer `app → pages → widgets → features → entities → shared`.
Dependency chỉ đi xuống layer thấp hơn; public API của feature/entity/widget là
đường import liên-layer duy nhất.

## Context

Sau PR #28, frontend có nhiều domain trải qua các technical folder và có nguy cơ
deep import hoặc phụ thuộc ngược khi tiếp tục refactor. Cần một quy tắc đơn giản,
kiểm tra được tự động mà vẫn cho phép migrate theo lát cắt.

## Alternatives considered

- Giữ technical-layer toàn cục: không thể hiện ownership của domain và dễ tạo
  dependency chéo.
- Big-bang chuyển toàn bộ source: rủi ro regression và vượt phạm vi.
- Cho phép import tùy ý qua re-export: che coupling thay vì loại bỏ coupling.

## Consequences

- Page/widget composition mỏng hơn; domain action và domain model có nơi sở hữu rõ.
- Consumer phải dùng `index.js` công khai thay vì file nội bộ của slice.
- Quy tắc được kiểm bằng dependency-cruiser trong CI.

## Migration notes

Di chuyển theo từng slice, cập nhật mọi consumer rồi mới xóa shim. Khi thêm module
mới, áp dụng [frontend architecture](../../../frontend/ARCHITECTURE.md) trước khi
viết import đầu tiên.
