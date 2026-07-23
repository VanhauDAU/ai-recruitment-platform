# Giai đoạn 2 — Tối ưu GitHub Actions CI

> Triển khai ngày 2026-07-24. Số liệu “trước” lấy từ GitHub Actions public API
> và log job thực tế; số local chỉ dùng để xác nhận command. Không suy diễn số
> local thành thời gian runner GitHub.

## 1. Kết quả đo trước khi sửa

Kế hoạch ban đầu mô tả CI “gần 10 phút”, nhưng 20 run thành công gần nhất cho
thấy median thấp hơn. Dù vậy, duplicate run và DAG tuần tự vẫn lãng phí đáng kể.

| Workflow | Mẫu | Median wall-clock | Khoảng |
| --- | ---: | ---: | ---: |
| Backend CI | 20 successful run | 223 giây | 183–262 giây |
| Frontend CI | 20 successful run | 311,5 giây | 220–393 giây |

Run frontend `29928530435` trên `main` mất 382 giây. Các job đại diện:

| Job | Thời gian |
| --- | ---: |
| `install` | 17 giây |
| `static-quality` | 21 giây |
| `coverage` | 154 giây |
| `build` | 18 giây |
| `bundle-budget` | 11 giây |
| `audit` | 19 giây |
| `e2e-smoke` | 199 giây |

Trong E2E, cài Chromium/system dependencies khoảng 20 giây và chạy test khoảng
164 giây. Upload/download artifact chỉ 1–3 giây nên không phải bottleneck chính.

Run backend đại diện `29983737333` mất 245 giây: PostgreSQL service khoảng 35
giây, dependency install 14 giây, pytest khoảng 180 giây, còn toàn bộ static
checks chỉ khoảng 4 giây. Vì vậy tách backend static/test thành hai job sẽ nhân
đôi setup để tiết kiệm rất ít wall-clock.

Trong 100 run mới nhất mỗi workflow, duplicate SHA có cả `push` và
`pull_request` tạo lower bound:

| Workflow | Nhóm SHA trùng | Số run | Wall-clock quan sát bị dùng |
| --- | ---: | ---: | ---: |
| Backend | 15 | 31 | 4.605 giây |
| Frontend | 23 | 46 | 9.200 giây |

Nguồn kiểm chứng: [Backend Actions](https://github.com/VanhauDAU/ai-recruitment-platform/actions/workflows/backend-ci.yml),
[Frontend Actions](https://github.com/VanhauDAU/ai-recruitment-platform/actions/workflows/frontend-ci.yml),
[ruleset `Protect main`](https://api.github.com/repos/VanhauDAU/ai-recruitment-platform/rulesets/18844743).

## 2. Workflow cũ

### Backend

```text
quality
  PostgreSQL + Redis
  → pip install
  → static checks
  → Django/migration checks
  → pytest coverage
```

- Workflow-level path filter có thể làm required context không xuất hiện.
- Không có concurrency; push feature và PR có thể chạy cùng SHA.
- Redis được khởi động dù test settings dùng `LocMemCache` và Celery eager.
- Một job và một lần `pip install`.

### Frontend

```text
install
├── static-quality ─────────────┐
├── coverage ───────────────────┼── e2e-smoke
├── build → bundle-budget ──────┘
└── audit
```

- `install` không chia sẻ `node_modules`; năm job sau vẫn chạy `npm ci` lại.
- Tổng cộng sáu lần `npm ci`.
- E2E đợi coverage, static và bundle hoàn tất dù không dùng output của chúng.
- Build upload `dist`, bundle-budget download lại chỉ để chạy một script.
- Audit cài toàn bộ dependency trước khi đọc lockfile.
- Artifact coverage/bundle/Playwright được upload cả khi thành công.

## 3. Workflow mới

### Bộ phát hiện vùng thay đổi

Hai workflow dùng chung `scripts/ci_changed_areas.sh`:

```text
pull_request   base...head
push main      before..head
manual         force full
schedule       chỉ dependency audit
```

Script dùng `git diff --no-renames -z`, kiểm tra revision tồn tại và fail
conservative: SHA thiếu, diff lỗi hoặc event mới đều bật toàn bộ heavy gates.
Outputs gồm `backend`, `frontend`, `docs`, `ci`, `deploy`, `frontend_audit` và
`changed_count`.

Không đặt `pull_request.paths`. Workflow luôn xuất hiện; heavy job mới skip theo
output. Thay đổi root chưa phân loại được coi là ảnh hưởng cả backend/frontend.

### Backend

```text
changes
   └── backend-checks (conditional, PostgreSQL, 1 pip install)
          └── quality (always unless run bị cancel, fail-closed)
```

- Trigger: mọi PR, push `main`, manual; bỏ push `feature/**` và `epic/**`.
- Concurrency gom theo PR number hoặc `{event}-{ref}` và hủy run cũ.
- Bỏ Redis; vẫn giữ PostgreSQL vì migration/query/locking semantics cần nó.
- Giữ một heavy job: Ruff, format, import-linter, boundary/env, Django,
  migration và pytest coverage.
- Pytest sinh JUnit, coverage JSON và log; chỉ upload diagnostics khi lỗi.
- Context `quality` được giữ nguyên và đánh giá rõ cả trường hợp heavy job skip.

### Frontend

```text
changes
├── static-quality ──┬── build             (compatibility context)
│                    └── bundle-budget      (compatibility context)
├── coverage
├── e2e-smoke
└── audit

changes + 6 contexts → frontend-final-gate
```

`static-quality`, `coverage` và `e2e-smoke` bắt đầu song song ngay sau detector.

- `static-quality`: một `npm ci`, API/feature/env boundary, lint, architecture,
  build và bundle budget trong cùng job.
- `coverage`: một `npm ci`, 374 unit tests, ratchet coverage; Vitest ghi test
  count và thêm `coverage-summary.json` cho job summary.
- `e2e-smoke`: một `npm ci`, giữ `playwright install --with-deps chromium` vì
  benchmark hiện tại chỉ khoảng 20 giây. Lượt gate không retry/trace; nếu fail,
  một diagnostic step chạy lại đúng failed tests với trace nhưng không thể đổi
  kết quả đỏ của lượt gate.
- `audit`: không `npm ci`; chạy `npm audit --package-lock-only` khi lock/package
  đổi, chính frontend workflow/detector đổi, push `main`, manual hoặc lịch hằng
  ngày 01:17 ICT.
- `build` và `bundle-budget` là bridge fail-closed để giữ hai required contexts;
  thao tác thật đã chuyển vào `static-quality`, không còn truyền `dist`.
- `frontend-final-gate` tổng hợp toàn DAG. Chưa dùng nó thay required checks cũ.
- Artifact chỉ được upload khi job lỗi, retention 5 ngày.

## 4. So sánh trước/sau

| Hạng mục | Trước | Sau |
| --- | --- | --- |
| Frontend `npm ci` | 6 lần | 3 lần |
| Backend `pip install` | 1 lần | 1 lần |
| Frontend critical path | install → coverage → E2E | detector → max(quality, coverage, E2E) |
| Build/budget | 2 job + upload/download `dist` | cùng `static-quality` |
| Playwright setup | cài Chromium mỗi run | giữ nguyên, đã đo ~20 giây |
| E2E diagnostics | config trace nhưng 0 retry | Gate không retry; failed tests được rerun có trace để debug |
| Dependency audit | mọi frontend run, sau `npm ci` | dependency/main/manual/nightly, lockfile-only |
| Backend service | PostgreSQL + Redis | chỉ PostgreSQL |
| Artifact | nhiều artifact `always()` | diagnostics khi failure |
| Feature push + PR | chạy trùng | feature push không còn trigger |
| Superseded backend run | tiếp tục chạy | bị cancel |
| Path-only PR | có thể chạy full/thiếu context | workflow có mặt, heavy job skip |

Về cấu trúc, frontend critical path không còn cộng tuần tự 154 giây coverage với
199 giây E2E. Tuy nhiên đây chỉ là dự báo từ DAG và số cũ, không phải số “sau”.

**Chưa có dữ liệu GitHub Actions thực tế sau tối ưu.**

Do chưa push theo quy định của kế hoạch, chưa thể báo median mới, thời gian
docs-only, tỷ lệ cancel, duplicate runs thực tế sau thay đổi hoặc mức runner
minutes tiết kiệm. Các số này phải được thu sau tối thiểu 20 successful PR run.

## 5. Required checks và branch protection

Ruleset active `Protect main` hiện yêu cầu đúng sáu frontend contexts:

```text
static-quality
coverage
build
bundle-budget
e2e-smoke
audit
```

Workflow mới giữ nguyên cả sáu tên nên **không cần cập nhật ruleset để áp dụng
thay đổi này**. `build`/`bundle-budget` vẫn fail nếu detector hoặc static gate
fail; docs-only tạo kết quả thành công mà không build hai lần.

Backend `quality` hiện **không nằm trong required checks**. Đây là khoảng trống
governance: backend đỏ chưa chắc chặn merge. Đề xuất sau khi có một run xác nhận
workflow mới: thêm `quality` vào ruleset. Không thay đổi external ruleset trong
giai đoạn này.

`frontend-final-gate` cũng chưa required. Chỉ cân nhắc thay sáu context bằng
final gate sau khi quan sát skip/failure/cancel trên PR thật; không đổi ngay để
tránh cửa sổ branch protection thiếu gate.

Ruleset hiện không bật merge queue. Nếu bật sau này, phải thêm event
`merge_group` trước khi yêu cầu các context trong queue.

## 6. CI summary và diagnostics

Mỗi workflow ghi `$GITHUB_STEP_SUMMARY`:

- vùng và số file thay đổi;
- lý do run/skip;
- test count, failures/errors/skips khi có;
- backend/frontend coverage;
- initial JS/CSS gzip;
- E2E result và duration;
- kết quả từng gate và final gate.

Các parser là best-effort: thiếu/malformed diagnostics hiển thị `n/a`, không làm
một test đã pass thành fail. Gate test vẫn lấy trực tiếp exit code qua
`set -o pipefail`.

## 7. Kiểm chứng local

| Check | Kết quả |
| --- | --- |
| `actionlint` 1.7.7, cả hai workflow | Pass |
| YAML parse + `bash -n scripts/ci_changed_areas.sh` | Pass |
| Detector docs/frontend/backend/dependency/schedule/manual/invalid SHA | Pass |
| API + feature + backend layering + env sync | Pass |
| Frontend lint/architecture/build/budget | Pass; 12 warning cũ |
| Frontend coverage | 106/106 file, 374/374 test; 38,84% statements |
| E2E command mới | 81/81 test; JUnit ghi 81 test, 0 failure |
| `npm audit --package-lock-only --audit-level=high` | 0 vulnerability |
| Backend Ruff/format/import-linter/Django/migration | Pass |
| Backend pytest + JSON/JUnit diagnostics | 352/352 test; coverage 85,56%; JUnit parser ghi đúng 352 test |

## 8. Bottleneck và bước đo tiếp theo

- E2E vẫn là job dài nhất; chưa đổi image/cache browser vì phần cài chỉ ~20 giây
  và cache không giải quyết system packages. Benchmark official Playwright image
  khớp version với cách hiện tại trên nhiều run trước khi đổi.
- Backend pytest (~180 giây trên GitHub) vẫn chiếm phần lớn backend workflow.
  Chưa bật `xdist`; concurrency/transaction/migration tests cần thử riêng với
  `-n 2` trước khi chấp nhận.
- Hai compatibility bridge cấp hai runner ngắn. Sau khi chuyển branch protection
  sang một final gate có thể xóa chúng.
- Lấy lại p50/p95, runner-seconds, duplicate SHA và cancellation sau 20 run;
  chỉ khi đó mới kết luận mục tiêu 4–6 phút và docs-only dưới 2 phút đã đạt.
