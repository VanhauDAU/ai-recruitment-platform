# P8 + P9 Tối ưu thời gian CI

P8 và P9 được gộp trên nhánh `perf/ci-pipeline-speedup`, bắt đầu từ `dev` tại
commit `54ed49d2`. Phạm vi chỉ gồm workflow GitHub Actions, settings test và
dependency test. Không đổi logic ứng dụng, cấu trúc thư mục, số lượng test,
ngưỡng coverage, tên required check; không thêm skip hoặc retry.

Trạng thái: **Implemented, chưa Verified**. Các thay đổi chưa được chạy trên
GitHub Actions; số đo trước/sau phải được điền từ run thật của PR.

## Backend (P8)

| Thay đổi | File | Lý do |
| --- | --- | --- |
| `PASSWORD_HASHERS` dùng MD5 trong settings test | `backend/config/settings/test.py` | PBKDF2 mặc định tốn khoảng 0,23 giây mỗi hash; fixture tạo user trong hầu hết `setUp` |
| PostgreSQL service chạy trên tmpfs, tắt `fsync`, `synchronous_commit`, `full_page_writes` | `.github/workflows/backend-ci.yml` | Dữ liệu CI bị hủy cùng job; giảm chi phí tạo DB từ migration và truncate của `TransactionTestCase` |
| `pytest -n auto --dist loadfile` qua `pytest-xdist==3.8.0` | `backend/requirements.txt`, `backend-ci.yml` | Mỗi worker có database riêng; `loadfile` giữ mọi test của một module trên cùng worker |

Rollback song song: đặt `PYTEST_WORKERS: '0'` trong `backend-ci.yml`. Lệnh local
trong `AGENTS.md` và `scripts/check_all.sh` không đổi và vẫn chạy tuần tự.

Giới hạn đã biết: `loadfile` không chia nhỏ một file, nên file migration chậm
nhất (sáu test 45–51 giây) vẫn là cận dưới của thời gian suite.

## Frontend (P9)

| Thay đổi | Job | Lý do |
| --- | --- | --- |
| Unit test chia `--shard=N/3` trên ba runner, mỗi runner vẫn `--maxWorkers=1` | `coverage-shard` | Song song theo runner thay vì theo worker, giữ lý do ổn định jsdom/Ant Design |
| Gộp blob report, áp ngưỡng coverage một lần trên báo cáo đã gộp | `coverage` | Một shard chỉ thấy một phần ba suite nên không thể tự đánh giá ratchet |
| Smoke E2E chia theo ba project Playwright | `e2e-smoke-shard` | 276 lượt test trước đây chạy trong một job |
| Job tổng hợp giữ tên required check | `coverage`, `e2e-smoke` | Ruleset `Protect main` và `frontend-final-gate` không cần sửa |

Hai chốt chặn bổ sung để việc chia nhỏ không làm yếu gate:

- `coverage` đọc `thresholds` trực tiếp từ `frontend/vite.config.js` và so với
  `coverage-summary.json` đã gộp, độc lập với kiểm tra của Vitest.
- `e2e-smoke` thất bại nếu danh sách project trong `playwright.config.js` khác
  matrix của workflow.

## Đã cân nhắc nhưng không làm

- Tách lint backend thành job riêng: các bước lint chỉ mất vài giây, không đổi
  thời gian tổng.
- Cache trình duyệt Playwright: thời gian restore cache xấp xỉ thời gian tải
  Chromium, trong khi `--with-deps` vẫn phải chạy.

## Gate còn lại

1. Push nhánh, mở PR và ghi thời lượng từng job trước/sau vào tài liệu này.
2. Xác nhận cùng số test với baseline P1 (backend 1.263 thu thập, unit 1.235,
   E2E 276 lượt) và coverage backend >=84%, frontend đạt ratchet.
3. Chạy ba lượt liên tiếp không flaky trước khi đánh dấu `Verified`.
