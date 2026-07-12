# ADR 002 — Session as an entity

## Decision

Session hiện tại được sở hữu bởi `entities/session`: API session, storage,
`SessionProvider` và `useSession` cùng nằm trong entity này. Feature auth gọi API
xác thực nhưng không sở hữu global session state.

## Context

Session được dùng bởi guards, layouts, nhiều portal và nhiều feature. Đặt provider
trong auth feature buộc các consumer không thực hiện đăng nhập phải phụ thuộc vào
feature, trái với hướng dependency của layered architecture.

## Alternatives considered

- Giữ `AuthProvider` trong `features/auth`: làm feature trở thành dependency toàn
  ứng dụng.
- Đặt session trong `shared`: shared sẽ biết user/token/domain session.
- Mỗi portal tự quản lý session: tạo state lệch nhau và mất contract chung.

## Consequences

- Router, guard và feature có thể dùng session qua entity public API.
- Logout/reset session có một lifecycle rõ ràng, không trộn UI/auth workflow.
- Auth feature vẫn chịu trách nhiệm login, logout command và các flow xác thực.

## Migration notes

Consumer cũ chuyển sang `@/entities/session`. Xóa `AuthProvider`, auth context và
`useAuth` legacy sau khi không còn import; không thay đổi token key hay API payload.
