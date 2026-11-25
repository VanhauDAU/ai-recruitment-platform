# Tiêu chuẩn kiểm thử

Chuẩn bắt buộc cho mọi test trong repo: đặt test ở đâu, viết thế nào để đáng tin,
được phép chạy bao lâu, và CI kiểm những gì. Mục tiêu là CI **xanh ổn định**,
**wall-clock mỗi PR ≤ 5 phút** (mục tiêu 3,5 phút) và mỗi job ≤ 5 phút, mà không hạ chất lượng.

## 1. Kim tự tháp: test đặt ở tầng nào

| Cần kiểm | Loại test | Công cụ / vị trí |
| --- | --- | --- |
| Hàm thuần, model, mapper, presentation frontend | Unit, môi trường **node** | `*.test.js` cạnh file, dòng đầu `// @vitest-environment node` |
| Component, hook có DOM | Unit, jsdom (mặc định) | `*.test.jsx` cạnh component |
| Service/selector/API backend | `django.test.TestCase` | `backend/apps/<app>/tests/` |
| Concurrency thật (`select_for_update`, thread) | `TransactionTestCase` | chỉ dùng cho trường hợp này |
| Luồng đi qua route, tích hợp UI quan trọng | E2E Playwright | `frontend/tests/e2e/smoke/` |

- Test được viết ở tầng thấp nhất còn chứng minh được hành vi. Không dùng E2E để
  kiểm logic mà unit test kiểm được.
- Mỗi bug fix phải kèm một regression test, fail trước khi sửa và pass sau khi sửa.
- Feature mới phải có unit test cho logic. Route mới hoặc workflow đổi luồng phải
  có E2E (xem `AGENTS.md`).
- Sửa UI làm đổi selector hay luồng thì sửa E2E **trong cùng PR**. Lỗi E2E chiến
  dịch ngày 18/11 xảy ra vì đã bỏ qua điều này.

## 2. Ngân sách thời gian

CI kiểm tự động bằng `scripts/ci/check_test_budgets.mjs`, đọc báo cáo JUnit sau khi
test pass. Vượt **ngưỡng mềm** thì có cảnh báo trên PR, nên sửa. Vượt **ngưỡng
cứng** thì fail CI, phải sửa hoặc tách test. Không có whitelist.

| Đối tượng | Mềm | Cứng | Ghi chú |
| --- | --- | --- | --- |
| Backend, mỗi test (phần `call`) | 2s | 15s | Không tính setup DB (`junit_duration_report=call`) |
| Frontend unit, mỗi test | 3s | 10s | Đo trên runner CI: 1 worker, có coverage |
| Frontend unit, mỗi file | 10s | 30s | |
| E2E, mỗi test | 15s | 90s | Timeout Playwright 30s; `test.slow()` ×3 |
| Job CI | 4 phút | 5 phút | `timeout-minutes` của job đặt sát ngân sách |
| Wall-clock một PR | 3,5 phút | 5 phút | Thời gian của workflow chậm nhất |

Test mới phải nằm dưới **ngưỡng mềm**. Ngưỡng cứng hiện chừa chỗ cho vài test cũ
đang chậm, và chỉ được hạ dần, không được nới. Nới ngưỡng hoặc timeout phải có lý
do đo được trong PR.

## 3. Viết test nhanh mà vẫn đúng

### Frontend

- **Hạn chế `getByRole`/`getByLabelText` trên màn hình antd.** Để biết phần tử có
  bị ẩn không, các truy vấn này tính computed style của phần tử và mọi tổ tiên tới
  `<body>` trước toàn bộ CSS antd chèn vào. Một truy vấn có thể mất 2–3s
  (AdminCompanyWorkspace từng mất 7,6s), và `within(...)` không tránh được bước
  duyệt tổ tiên đó. Helper trong `@/test/antd-queries`:
  - `getTableRow('<rowKey>')` / `findTableRow(...)`: lấy dòng antd Table;
  - `getButtonByText(container, 'Nhãn')`: lấy nút có chữ.
  Chỉ dùng `getByRole` khi chính vai trò hoặc tên truy cập là điều cần kiểm (nút
  icon chỉ có `aria-label`, `tab`, `dialog`).
- Timeout mỗi test của Vitest: 5s khi chạy cục bộ, 10s trên CI (bằng ngưỡng cứng).
  Không thêm timeout riêng cho từng test để che test chậm.
- **Không chờ timer thật.** Độ trễ UX (gõ chữ, thời gian lưu tối thiểu, đếm ngược)
  dùng fake timer, ví dụ `vi.useFakeTimers()` rồi
  `await act(() => vi.advanceTimersByTimeAsync(ms))`. Với hiệu ứng có nhánh reduced
  motion thì stub `matchMedia('(prefers-reduced-motion: reduce)')`.
- `userEvent.setup({ pointerEventsCheck: 0 })` chỉ dùng khi test không cần kiểm
  `pointer-events`; nó bỏ bước duyệt computed style mọi phần tử tổ tiên.
- File không render DOM thì khai báo `// @vitest-environment node`. Khi đó setup
  jsdom (`src/test/setup-dom.js`) không được nạp.
- Không dùng `hidden: true` để lách kiểm tra hiển thị, và không tăng timeout để che
  test chậm.

### Backend

- Dữ liệu chỉ đọc dùng `setUpTestData`, không dùng `setUp`.
- Endpoint list giữ số query phẳng: `assertNumQueries` hoặc `tests/test_query_budget.py`.
- DB test được dựng **một lần**: `backend/conftest.py` migrate một template rồi
  clone cho từng worker. Template tự dựng lại khi migration đổi. Không cần và
  không được dùng `--reuse-db`.
- Không gọi mạng thật. Mặc định của `config.settings.test` (email locmem, Celery
  eager, provider giả) đã đảm bảo điều này.

### E2E

- Chờ theo trạng thái (`expect(locator).toHaveValue/toBeVisible`), không chờ theo
  thời gian.
- Với Select/Tab của antd, dùng helper thử lại trong `tests/e2e/smoke/helpers.js`
  (`chooseSelectOption`, `selectTab`): chỉ coi là xong khi control hiển thị đúng
  giá trị.
- Mọi API đều được mock (`mockPublicApi` và `page.route`); E2E không cần backend.
- **Viewport**: desktop chạy mọi test; tablet và mobile chỉ chạy test gắn
  `{ tag: '@responsive' }`. Gắn tag khi test kiểm bố cục, tràn ngang
  (`expectNoHorizontalOverflow`), touch, kích thước, hoặc có nhánh theo viewport.
  Luồng nghiệp vụ không có assert như vậy thì không gắn.

## 4. Độ tin cậy

- Test phải tất định: không phụ thuộc thứ tự chạy, giờ hệ thống, múi giờ máy,
  mạng hay `.env` cục bộ. Không commit `.only`.
- **Flaky**: CI cho E2E retry một lần. Test chỉ pass ở lần retry bị đánh dấu
  `flaky` và có cảnh báo trên PR. Phải sửa trong vòng 3 ngày, hoặc chuyển sang
  `test.fixme` kèm issue. Cục bộ không retry, để tác giả thấy test flaky ngay.
- Worker pytest chết ("node down") là lỗi hạ tầng, không phải test fail: rerun
  job, rồi báo lại nếu lặp lại.

## 5. Coverage

Coverage là ratchet và chỉ được tăng: backend ≥ 84% (`--cov-fail-under`), frontend
theo `thresholds` trong `frontend/vite.config.js`, đo trên báo cáo gộp các shard.
PR làm tụt số phải bổ sung test.

## 6. Vòng kiểm tra cục bộ và CI

Cục bộ chỉ chạy test liên quan tới phần sửa. CI của PR là lần kiểm tra đầy đủ.

| Mục đích | Lệnh |
| --- | --- |
| Unit liên quan tới file vừa sửa | `cd frontend && npm run test:related src/…/File.jsx` |
| Unit của mọi file đổi so với `origin/dev` | `npm run test:changed` |
| Một spec E2E giống CI | `PLAYWRIGHT_PORT=5180 VITE_API_BASE_URL=http://localhost:8000/api npx playwright test tests/e2e/smoke/<spec> --project=desktop-chromium` |
| Một module/class backend | `docker compose exec -T backend pytest apps/<app>/tests/test_x.py::Class` |
| Toàn bộ backend song song (~1 phút) | `docker compose exec -T backend pytest -n auto --dist load` |
| Toàn bộ, khớp CI | `./scripts/check_all.sh` |

### Cách CI chia việc

| Workflow | Job song song | Job tổng hợp (required check giữ nguyên tên) |
| --- | --- | --- |
| Backend | `backend-static` (ruff, import-linter, layering, `check`, migration, OpenAPI; không cần DB) và `backend-tests` 3 shard | `backend-checks`: gộp coverage, ratchet 84%, ngân sách thời gian → `quality` |
| Frontend | `static-quality` (lint, kiến trúc, build, bundle), `coverage-shard` 8 shard, `e2e-smoke-shard` 4 shard (desktop chia đôi, tablet, mobile) | `coverage`, `e2e-smoke`, `build`, `bundle-budget` → `frontend-final-gate` |

Shard được cân theo thời lượng đã đo, không theo số file:

- Backend: `pytest-split` đọc `backend/.test_durations`, thuật toán
  `duration_based_chunks` (giữ thứ tự TestCase trước TransactionTestCase).
- Frontend: `frontend/scripts/plan-vitest-shards.mjs` đọc
  `frontend/tests/vitest-durations.json`, xếp tham lam file lâu nhất vào shard nhẹ nhất.

Test mới chưa có số đo được tính bằng trung bình (backend) hoặc trung vị (frontend),
nên không cần cập nhật bảng mỗi PR. Khi bản tóm tắt của job `coverage` hoặc
`backend-checks` cho thấy shard lệch nhau hơn 30 giây, tải artifact
`vitest-durations-*` / `backend-test-durations-*` của lần chạy mới nhất trên `dev`
và chép đè lên hai tệp trên, kèm vào PR kế tiếp.

Thêm shard: tăng danh sách `matrix` và biến `UNIT_TEST_SHARDS` /
`BACKEND_TEST_GROUPS` của job tổng hợp cùng lúc; job tổng hợp fail nếu số kết quả
không khớp. E2E chạy trong image `mcr.microsoft.com/playwright` đúng phiên bản
lockfile. Job nào vượt 5 phút là tín hiệu cần chia nhỏ hoặc tối ưu, không phải lý
do để tăng timeout.
