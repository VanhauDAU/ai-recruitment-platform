# ADR 0001 — Frontend feature-first hybrid, chuyển đổi tăng dần

**Trạng thái:** Accepted — 2026-07-13

## Bối cảnh

Frontend đang tổ chức theo technical-layer (api / components / hooks / contexts /
constants / pages) trộn với feature-local trong từng portal. Một feature (auth,
jobs...) bị trải qua 5–7 thư mục cấp cao, tốn thời gian sửa và dễ phụ thuộc chéo.
Dự án đã có alias `@`, lazy page, Vitest, Playwright, oxlint và convention "component
chỉ dùng cho một page thì đặt gần page".

## Quyết định

Chuyển sang **feature-first hybrid**, tăng dần, giữ tương thích:

```
src/
  app/        # App, providers, router, guards
  features/   # auth, account, two-factor, onboarding, jobs, applications, ...
              #   mỗi feature: api/ components/ hooks/ pages/ model/ index.js
  portals/    # main, employer, admin — compose feature + shared
  shared/     # api/ components(ui,layout)/ hooks/ config/ constants/ utils
```

- Không bắt buộc di chuyển toàn bộ `pages/main|employer|admin` ngay; chỉ tạo
  `app/`, `shared/`, `features/` cho module được chọn, chuyển portal khi pilot ổn.
- Kế thừa convention "component một-page đặt gần page" (nay là gần feature/page trong feature).
- Dùng re-export tương thích tối đa 2–3 PR, rồi xóa ở PR cleanup riêng.

## Ràng buộc phụ thuộc

- `shared` KHÔNG import `features` hay `portals`.
- `portal` được compose `feature` + `shared`.
- `feature` chỉ expose public API qua `index.js`; cấm import sâu file nội bộ của feature khác.

## Hệ quả

- (+) Sửa một feature chủ yếu trong một module; ranh giới rõ, test được.
- (+) Migrate được từng phần, không "đập đi xây lại".
- (−) Trong thời gian chuyển tiếp tồn tại 2 kiểu tổ chức song song + lớp re-export tạm.

## Thay thế đã cân nhắc

- Giữ nguyên technical-layer: bị loại vì chính là nguyên nhân phân tán.
- Big-bang chuyển toàn bộ sang feature-first: rủi ro cao, vi phạm nguyên tắc tăng dần.
