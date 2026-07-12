<!-- Kế hoạch tái cấu trúc: mỗi PR nhỏ, không trộn refactor với nghiệp vụ/UI lớn. -->

## Mục tiêu

<!-- PR này làm gì và vì sao. Link ADR/giai đoạn nếu có. -->

## Phạm vi di chuyển (nếu là PR refactor)

- **Source → Target:** <!-- vd: src/api/jobService.js → features/jobs/api/ -->
- **Contract giữ nguyên:** <!-- endpoint / response schema / token key / URL không đổi -->

## Loại thay đổi

- [ ] Tái cấu trúc (không đổi hành vi)
- [ ] Tính năng mới
- [ ] Sửa lỗi
- [ ] Tài liệu / CI / tooling

## Checklist bắt buộc

- [ ] Không đổi contract ngoài phạm vi đã nêu (endpoint, response schema, token key, URL).
- [ ] Không trộn refactor với thay đổi giao diện/nghiệp vụ lớn.
- [ ] Không import vòng, không import sâu xuyên feature (chỉ qua `index.js`).
- [ ] Frontend: lint + test + build xanh; E2E cho luồng bị ảnh hưởng (nếu có).
- [ ] Backend: `check` + `makemigrations --check` + `test` xanh.
- [ ] Không còn `console.log` debug, catch rỗng, TODO vô chủ.
- [ ] Migration reversible nếu đụng database.

## Rollback

<!-- Cách quay lại: tag/branch/re-export nào giữ tương thích. -->

## Đã kiểm tra

<!-- Lệnh đã chạy: ./scripts/check_all.sh, luồng thủ công đã thử... -->
