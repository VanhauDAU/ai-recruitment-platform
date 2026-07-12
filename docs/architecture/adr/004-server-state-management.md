# ADR 004 — Server state management

## Decision

Giữ custom hooks/provider theo feature cho server state hiện tại. `saved-jobs`
dùng query hook, mutation hook, optimistic update, pending lock và sync lifecycle;
API server vẫn là source of truth. Không thêm Query library trong đợt refactor này.

## Context

Số resource có mutation server state còn ít. Dự án đã có API client, request
deduplication và test cho race/rollback Saved Jobs. Thêm thư viện query lúc này
sẽ mở rộng phạm vi sang cache/provider/migration toàn ứng dụng mà không giải quyết
một lỗi hiện tại không thể xử lý bằng hook cục bộ.

## Alternatives considered

- React Query/TanStack Query ngay lập tức: có nhiều tiện ích nhưng là migration
  toàn cục và tăng bundle/convention.
- Global context cho mọi server state: cache domain bị lẫn vào global state.
- Không giữ cache/optimistic update: UX chậm và không bảo vệ mutation trùng.

## Consequences

- Mỗi feature có mutation phải khai báo ownership, invalidation và test rollback.
- `shared/api` tiếp tục là nơi duy nhất sở hữu HTTP client/deduplication chung.
- Cần đánh giá lại khi số resource, cache rule hoặc cross-screen synchronization
  vượt quá khả năng hooks cục bộ; thay đổi đó phải có ADR mới.

## Migration notes

Provider Saved Jobs chỉ compose các hook chuyên trách. Logout hoặc đổi session
xóa state cũ, và sync chạy theo lifecycle đã test. Endpoint/payload không đổi.
