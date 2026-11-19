# Tiêu chuẩn kiểm thử

Chuẩn bắt buộc cho mọi test trong repo: đặt test ở đâu, viết thế nào để đáng tin,
được phép chạy bao lâu, và CI kiểm những gì. Mục tiêu là CI **xanh ổn định**,
**wall-clock mỗi PR ≤ 8 phút** và mỗi job ≤ 5 phút, mà không hạ chất lượng.

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

CI kiểm tự động bằng `scripts/check_test_budgets.mjs`, đọc báo cáo JUnit sau khi
test pass. Vượt **ngưỡng mềm** thì có cảnh báo trên PR, nên sửa. Vượt **ngưỡng
cứng** thì fail CI, phải sửa hoặc tách test. Không có whitelist.

| Đối tượng | Mềm | Cứng | Ghi chú |
| --- | --- | --- | --- |
| Backend, mỗi test (phần `call`) | 2s | 15s | Không tính setup DB (`junit_duration_report=call`) |
| Frontend unit, mỗi test | 3s | 10s | Đo trên runner CI: 1 worker, có coverage |
| Frontend unit, mỗi file | 10s | 30s | |
| E2E, mỗi test | 15s | 90s | Timeout Playwright 30s; `test.slow()` ×3 |
| Job CI | 4 phút | 5 phút | `timeout-minutes` của job đặt sát ngân sách |
| Wall-clock một PR | 6 phút | 8 phút | |

Test mới phải nằm dưới **ngưỡng mềm**. Ngưỡng cứng hiện chừa chỗ cho vài test cũ
đang chậm, và chỉ được hạ dần, không được nới. Nới ngưỡng hoặc timeout phải có lý
do đo được trong PR.

## 3. Viết test nhanh mà vẫn đúng

### Frontend

- **Không truy vấn role trên toàn trang có antd.** `getByRole`/`getByLabelText`
  phải tính computed style của mọi node trước CSS mà antd chèn vào, có lúc mất
  hàng giây (AdminCompanyWorkspace từng mất 7,6s cho một truy vấn). Hãy thu phạm
  vi trước:
  - dòng bảng: `within(getTableRow('<rowKey>'))` từ `@/test/table`;
  - dialog: `within(screen.getByRole('dialog'))`;
  - vùng có nhãn: `within(screen.getByRole('navigation', { name }))`.
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

Trên CI: `backend-checks` chạy ~3 phút, 5 shard unit frontend mỗi shard ≤ 4 phút,
E2E chạy trong image `mcr.microsoft.com/playwright` đúng phiên bản lockfile. Job
nào vượt 5 phút là tín hiệu cần chia nhỏ hoặc tối ưu, không phải lý do để tăng
timeout.
