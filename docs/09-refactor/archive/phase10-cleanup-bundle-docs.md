# Giai đoạn 10 — Cleanup, bundle và tài liệu

**Ngày:** 2026-07-13 · **Trạng thái:** hoàn tất; R9 được bỏ qua để triển khai lại riêng.

## Cleanup compatibility

- Xóa shim đã hết compatibility window: legacy auth hooks/components/services,
  Jobs pages/service/path, Saved Jobs context/hook, Account candidate pages,
  router shim và API infrastructure re-export.
- Consumer chuyển sang public API `features/*` hoặc `shared/api/*`; các domain
  API chưa feature hóa (blog, location, site settings, admin settings) giữ ở
  `src/api` nhưng không còn phụ thuộc API infrastructure cũ.
- Thêm `scripts/check_feature_boundary.sh` và chạy trong frontend CI: cấm alias
  import sâu `@/features/<feature>/...`, ngoại trừ module route loader công khai.

## Bundle review

| Chunk | Trước cleanup | Sau cleanup |
| --- | ---: | ---: |
| entry `index` (gzip) | 103.43 kB | 82.46 kB |
| vendor `react` (gzip) | 74.53 kB | 74.53 kB |
| `JobList` lazy chunk (gzip) | 21.71 kB | 21.69 kB |

Route lazy-loading vẫn giữ ở `features/*/routes.js`; không thêm Query library
hoặc vendor chunk mới.

## Regression và tài liệu

- Chạy API boundary và feature boundary trong CI.
- Unit/lint/build, full Playwright desktop/mobile và backend check/migration/test
  là quality gate trước khi bàn giao.
- Tiến độ, ADR và changelog được cập nhật theo cấu trúc mới.
