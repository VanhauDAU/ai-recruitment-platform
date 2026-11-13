# P8 + P9 Tối ưu thời gian CI

P8 và P9 được gộp trên nhánh `perf/ci-pipeline-speedup` (PR #162), bắt đầu từ
`dev` tại commit `54ed49d2`. Phạm vi gồm workflow GitHub Actions, settings test,
dependency test, cấu hình Playwright và hai test E2E đã lỗi thời. Không đổi
logic ứng dụng, cấu trúc thư mục, ngưỡng coverage hoặc tên required check;
không thêm skip hoặc retry.

Trạng thái: **Implemented, chưa Verified**. Lượt 1 đã chạy trên GitHub Actions;
lượt 2 (mục "Lượt 2") chưa có số đo.

## Baseline trước tối ưu (PR #160, run ngày 10/10/2026)

| Job | Thời lượng | Ghi chú |
| --- | --- | --- |
| `backend-checks` | 32m49s | pytest 31m38s, 1.266 pass, coverage 87,60% |
| `coverage` | 16m51s | Vitest một worker |
| `e2e-smoke` | 17m40s, **fail** | Bị `timeout 17m` hủy; 276 lượt test trên dev server |
| `audit` | fail trên `dev`/`main` | Advisory Tiptap mức high |

Trong 31m38s của pytest, 15 test migration chiếm khoảng 19 phút
(`applications/tests/test_migrations.py` 648 giây, announcement 155 giây,
employers 275 giây, jobs 61 giây).

## Lượt 1 (commit `ae18dc1a`, run ngày 13/11/2026)

| Thay đổi | Kết quả đo |
| --- | --- |
| Unit test chia 3 shard, gộp coverage ở `coverage` | Shard 197/223/290 giây, gộp 22 giây; đạt ratchet |
| E2E chia theo 3 viewport | 5,4–7,4 phút mỗi viewport; vẫn fail 2–5 test |
| Hasher MD5, PostgreSQL tmpfs, `pytest -n auto --dist loadfile` | Vẫn hơn 21 phút: `loadfile` ghim cả file migration 648 giây vào một worker |
| Frontend CI tổng | 18 phút → 8m39s |

Lỗi E2E quan sát được, đều đã tồn tại trước lượt 1:

| Test | Nguyên nhân |
| --- | --- |
| `admin.spec.js:5` (cả 3 viewport) | 24 lần `page.goto` trên dev server vượt timeout 30 giây |
| `employer-readiness.spec.js:62` (cả 3 viewport) | Test còn kỳ vọng gate hiển thị tại chỗ; từ `7e4c7269` guard chuyển hướng sang `/employer-verify` |
| `blog-admin.spec.js:4`, `employer.spec.js:452`, `candidate-job-alerts.spec.js:322` (không ổn định) | Luồng nhiều bước vượt 30 giây trên runner |

## Lượt 2

### Backend

| Thay đổi | File | Lý do |
| --- | --- | --- |
| Tách 6 module test migration khỏi `backend-checks` | `backend-ci.yml` | 19 trên 31 phút serial; không còn ghim một worker |
| Job `backend-migration-tests` chạy `--dist load` | `backend-ci.yml` | Mỗi test tự rewind schema trong DB của worker nên độc lập với nhau |
| Detector xuất `backend_migrations` | `scripts/ci_changed_areas.sh` | Job migration chỉ chạy khi có thể bị ảnh hưởng |

`backend_migrations=true` khi PR đổi `backend/apps/*/migrations/`,
`backend/apps/*/management/`, chính các file `test_*migrations*.py`,
`backend/requirements*.txt`, `backend/pyproject.toml`, `backend/manage.py`,
`backend/config/settings/`, `backend-ci.yml` hoặc `ci_changed_areas.sh`; và ở
mọi `push` vào `main` cùng `workflow_dispatch`. Gate `quality` thất bại nếu kết
quả job migration không khớp đầu ra detector.

Đánh đổi có chủ ý: PR chỉ sửa service/view/serializer không còn chạy test
migration. Model đổi mà thiếu migration vẫn bị `makemigrations --check` chặn,
và `main` luôn chạy đủ. Coverage gate 84% giờ tính trên suite không gồm test
migration (thư mục `migrations/` và `management/` vốn đã bị loại khỏi nguồn
coverage); cần xác nhận con số ở run đầu.

### Frontend

| Thay đổi | File | Lý do |
| --- | --- | --- |
| E2E trên CI chạy bundle production (`vite build` + `vite preview`) | `playwright.config.js`, `frontend-ci.yml` | Dev server không bundle cần hơn một giây mỗi lần điều hướng trên runner |
| `test.slow()` cho test duyệt toàn bộ route admin | `admin.spec.js` | Ngân sách thời gian phải tăng theo bảng route |
| Cập nhật kỳ vọng chuyển hướng | `employer-readiness.spec.js` | Khớp hành vi hiện tại và `EmployerCapabilityGuard.test.jsx`; vẫn khẳng định không gọi API ứng viên |
| Unit test 4 shard thay vì 3 | `frontend-ci.yml` | Shard chậm nhất 290 giây là cận trên của job |
| Merge `codex/frontend-dependency-audit` | `package.json`, lockfile | Sửa advisory Tiptap/Axios làm `audit` fail |

Chạy local không đổi: `npm run test:e2e:smoke` vẫn dùng dev server. Đặt
`PLAYWRIGHT_WEB_SERVER=preview` (kèm `VITE_API_BASE_URL`) để tái hiện chế độ CI;
đặt `PLAYWRIGHT_WEB_SERVER: dev` trong workflow để quay lại hành vi cũ.

## Đã cân nhắc nhưng không làm

- Tách lint backend thành job riêng: các bước lint chỉ mất vài giây.
- Cache trình duyệt Playwright: cài Chromium chỉ mất khoảng 20 giây.
- Tăng worker Playwright hoặc Vitest: P1 yêu cầu có số đo ổn định trước.
- Bỏ job giữ chỗ `build` và `bundle-budget`: ruleset `Protect main` đang yêu
  cầu hai context này; cần sửa ruleset trước.

## Việc ngoài workflow nên cân nhắc

- PR #152 (`dev` → `main`) đang mở dài hạn nên mỗi lần `dev` thay đổi, toàn bộ
  CI chạy lại lần thứ hai cho PR đó. Chỉ mở PR này khi chuẩn bị phát hành sẽ
  giảm một nửa số lượt chạy.
- Run `schedule` hằng ngày trên `main` fail liên tục vì `main` chưa có bản vá
  dependency; sẽ hết khi bản vá được merge vào `main`.

## Gate còn lại

1. Ghi thời lượng từng job của lượt 2 vào tài liệu này.
2. Xác nhận số test: tổng `backend-checks` + `backend-migration-tests` bằng
   baseline (1.266 pass, 2 skip; trong đó 15 test migration), unit 1.235, E2E
   276 lượt; coverage backend >=84%, frontend đạt ratchet.
3. Chạy ba lượt liên tiếp không flaky trước khi đánh dấu `Verified`.
