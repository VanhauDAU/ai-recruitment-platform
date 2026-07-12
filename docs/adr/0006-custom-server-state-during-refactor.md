# ADR 0006 — Giữ server state bằng custom hooks có ranh giới rõ trong đợt refactor

**Trạng thái:** Accepted — 2026-07-13

## Bối cảnh

R6 cần đồng bộ Saved Jobs sau login/logout/save/unsave và đưa Applications về
feature riêng. Frontend đã có `shared/api/requestDeduplication` với dedupe theo
request và TTL cache cho dữ liệu công khai. Số resource cần state server tương
tác hiện tại còn nhỏ: Saved Jobs, Applications và Site Settings.

Thêm React Query/TanStack Query ngay lúc này sẽ là migration toàn cục ngoài
phạm vi lát cắt R6: thay provider, cache keys và quy ước mutation của nhiều
feature chưa được di chuyển.

## Quyết định

- Giữ custom hooks/provider trong feature cho server state có mutation:
  `features/saved-jobs` là chủ sở hữu cache, optimistic update và invalidation.
- Saved Jobs lấy API làm source of truth; sau mutation phát sự kiện
  `BroadcastChannel` để tab khác refresh, đồng thời refresh khi quay lại tab.
- Applications chỉ expose domain API qua `features/applications`; UI apply và
  manage sẽ được thêm theo luồng CV/employer đã chốt, không dựng UI giả trong
  refactor.
- Site Settings tiếp tục là global configuration context (brand/layout dùng từ
  lúc bootstrap), với fallback mặc định, retry giới hạn và hàm `retry` tường
  minh.
- `shared/api` vẫn là nơi duy nhất có client HTTP, dedupe và TTL cache.

## Bất biến

- Không thêm dependency server-state mới vào bundle initial ở R6.
- Không đổi endpoint, payload hoặc response API.
- Context toàn cục chỉ dành cho configuration/session/UI; state nghiệp vụ nằm
  trong feature sở hữu nó.

## Hệ quả

- (+) Di chuyển tăng dần, ít rủi ro bundle và không ép các feature chưa migrate.
- (+) Mutation Saved Jobs có hành vi đa tab rõ ràng.
- (-) Feature mới phải tự khai báo lifecycle/invalidation; khi số resource hoặc
  cache rule tăng đáng kể cần viết ADR mới để cân nhắc Query library.
