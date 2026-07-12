# Quy trình Pull Request

Tài liệu này là policy cho mọi Pull Request. Mục tiêu là giữ thay đổi đủ nhỏ để
review, test, rollback và truy nguyên regression được; không dùng số dòng thay
cho đánh giá kỹ thuật vì file move có thể tạo diff lớn.

## Tạo Pull Request

1. Dùng [PR template](../../.github/pull_request_template.md) và điền mọi mục.
   Nếu mục không áp dụng, ghi rõ `Không áp dụng` cùng lý do.
2. Nêu contract API/URL/token/storage bị ảnh hưởng, hoặc xác nhận không đổi.
3. Dán test evidence thực tế, không chỉ tick checklist.
4. Với refactor lớn, mô tả source → target, dependency trước/sau và rollback.
5. Không merge khi còn conversation chưa giải quyết.

## Kích thước PR

| Số file thay đổi | Yêu cầu |
| --- | --- |
| Dưới 30 | Bình thường. |
| 30–60 | Giải thích rõ vì sao không thể tách nhỏ hơn. |
| Trên 60 | Chia nhỏ hoặc đính kèm kế hoạch migration đã được reviewer chấp thuận. |

File được rename/move vẫn được tính trong review scope. Khi cần migration lớn,
chia theo vertical slice hoặc compatibility window; không trộn refactor cấu trúc
với thay đổi UI/nghiệp vụ lớn nếu không có lý do và test riêng.

## Branch protection cho `main`

Thiết lập này phải được bật trong GitHub repository settings bởi administrator:

- Require a pull request before merging.
- Require ít nhất một approval.
- Dismiss stale approvals khi có commit mới.
- Require status checks trước khi merge.
- Require conversation resolution trước khi merge.
- Không cho force push.
- Không cho merge khi CI thất bại.

Các quality gate hiện có là Frontend CI (`static-quality`, `coverage`, `build`,
`bundle-budget`, `e2e-smoke`, `audit`) và Backend CI (`quality`) khi phần tương
ứng của repo bị thay đổi. Thay đổi tên job phải đồng thời cập nhật required checks
trong GitHub để branch protection không bị vô hiệu hóa ngầm.

## CODEOWNERS

Các vùng có rủi ro kiến trúc được khai báo tại
[`.github/CODEOWNERS`](../../.github/CODEOWNERS). Owner hiện tại là
`@VanhauDAU`; khi có GitHub team chuyên trách, thay handle ở từng path bằng team
thực tế, không thêm handle minh họa không tồn tại.

## Commit convention

Dùng Conventional Commit với scope là domain/layer bị thay đổi:

```text
fix(search-jobs): clear all search history safely
refactor(session): extract authentication state
refactor(saved-jobs): consolidate save job modules
ci(frontend): enforce FSD dependency rules
test(router): add portal route smoke tests
docs(frontend): archive completed migration plan
```

Type thường dùng: `fix`, `feat`, `refactor`, `test`, `ci`, `docs`, `chore`.
Một commit phải có một mục đích review được; không gộp format hàng loạt, đổi UI
không liên quan và migration vào cùng một commit nghiệp vụ.

## Definition of Done

### Code

- Không có unused import, `console.log` debug, hard-coded storage key trong UI,
  deep import sang slice khác hoặc feature-to-feature import.
- Business logic có thể tách không nằm lẫn trong component; API request ở API layer.
- Không tạo `utils` chung thiếu owner, global context cho state chỉ thuộc một
  feature, hoặc route page trong feature.

### Test và kiến trúc

- Có unit test cho logic mới và regression test cho lỗi đã sửa.
- Production build thành công; route bị ảnh hưởng có E2E phù hợp.
- Coverage không thấp hơn threshold; layer dependency đúng và public contract
  export qua `index.js` khi dùng liên-layer.

### Pull Request

- Có mô tả, test evidence, ít nhất một reviewer và CI pass.
- Không còn unresolved conversation.
- Có rollback plan nếu thay đổi lớn hoặc tác động contract/data.
