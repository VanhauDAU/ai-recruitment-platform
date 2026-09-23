# Kế hoạch tái cấu trúc ProCV

Tài liệu này là sổ triển khai cho kế hoạch tái tổ chức ProCV phiên bản 1.1. Mục
tiêu là thực hiện tuần tự P0 đến P10, giữ nguyên UI, URL, API, dữ liệu, phân quyền
và lịch tác vụ. Mỗi giai đoạn dùng một nhánh ngắn từ `dev` đã cập nhật và chỉ
chuyển bước sau khi gate của giai đoạn trước có bằng chứng đạt.

## Nguồn và checkpoint

- Kế hoạch nguồn: `Ke_hoach_tai_to_chuc_ProCV.docx`, phiên bản 1.1 ngày
  21/09/2026, SHA-256
  `fabdda4946a846b6dd859fa5e144c220e6fefdb43f2008e8fc1068459203205d`.
- Baseline triển khai: nhánh `dev`, commit
  `dddf4455c4e4cdd8b82424fadf9f1f774f8ee09d`, chốt ngày 23/09/2026.
- Working tree trước khi tạo nhánh: sạch; `dev` đồng bộ `origin/dev`.
- Nhánh P0: `chore/procv-baseline`.
- Không gắn nhãn checkpoint là `verified` trước khi full gate hoàn tất. P0 không
  di chuyển app, thay env, xóa media hoặc sửa lỗi sản phẩm phát hiện khi khảo sát.

## Trạng thái giai đoạn

| Giai đoạn | Nhánh | Đầu ra | Trạng thái | Điều kiện chuyển |
| --- | --- | --- | --- | --- |
| P0 | `chore/procv-baseline` | Kiểm kê, hợp đồng hành vi, số đo CI | Implemented | Baseline có SHA và artifact kiểm chứng |
| P1 | `fix/ci-test-stability` | Chẩn đoán và sửa test lỗi hoặc treo | Planned | Ba lượt lặp ổn định; không hạ coverage hoặc skip |
| P2 | `chore/repo-cleanup` | Dọn artifact, media test và ignore | Planned | Test không sinh rác ở root; dữ liệu không mất |
| P3 | `chore/local-only-tooling` | Bỏ cấu hình deploy production, giữ local | Planned | Compose local, API, frontend và worker hoạt động |
| P4 | `refactor/env-configuration` | Env tối thiểu và catalog optional | Planned | Effective config trước và sau tương đương |
| P5 | `refactor/backend-organization` | Chuẩn hóa Django theo app | Planned | Schema, migration, quyền và task registry không đổi |
| P6 | `refactor/frontend-organization` | Chuẩn hóa ownership frontend | Planned | Import, route, bundle và UI không đổi |
| P7 | `docs/procv-consolidation` | Bộ tài liệu và tiến độ thống nhất | Planned | Mọi file cũ có mapping, link check đạt |
| P8 | `perf/ci-backend` | Test backend nhanh với coverage đúng | Planned | Cùng manifest test, coverage >=84%, ba lượt ổn định |
| P9 | `perf/ci-frontend` | Unit, E2E và báo cáo được tối ưu | Planned | Đủ test/coverage, E2E không xanh nhờ retry |
| P10 | `chore/procv-acceptance` | Nghiệm thu và hồ sơ bàn giao | Planned | Checkout sạch và full gate đạt trên cùng SHA |

## Bằng chứng P0

- [Kiểm kê repository](baseline/repository-inventory.md) và
  [manifest 2.551 file được Git theo dõi](baseline/tracked-files.csv).
- [Hotspot mã nguồn](baseline/code-hotspots.md) để chọn lát P5/P6; đây không phải
  yêu cầu tách mọi file lớn.
- [Hợp đồng API, migration, quyền, task và UI](baseline/contracts.md).
- [Số đo CI](baseline/ci-baseline.md), phân biệt run thành công, thất bại và bị
  hủy; timeout không được dùng làm runtime mục tiêu.

## Mapping đường dẫn và hành động

| Hiện tại | Đích hoặc hành động | Phụ thuộc cần kiểm tra | Giai đoạn | PR | Gate |
| --- | --- | --- | --- | --- | --- |
| `private-media/`, `public-media/` ở root | Phân loại fixture; chuyển fixture cần thiết về app sở hữu hoặc untrack runtime | Test upload, storage root, bản sao dữ liệu | P2 | Pending | Hai lượt test không sinh lại media ở root |
| `frontend/test-results/`, `frontend/coverage/` local | Giữ ngoài Git; clean script chỉ xóa artifact tái tạo được | Playwright/Vitest output | P2 | Pending | `git status` sạch sau test |
| `deploy/nginx/`, `docker-compose.prod.yml` | Bỏ sau checkpoint; lịch sử còn trong Git | README, CI detector, Compose comment, docs | P3 | Pending | Không còn tham chiếu bắt buộc; local smoke đạt |
| `frontend/Dockerfile`, `frontend/nginx.conf` | Ứng viên xóa sau kiểm tra consumer | Compose, docs, workflow | P3 | Pending | Frontend local/build không đổi |
| `docker-compose.yml`, `backend/Dockerfile` | Giữ cho local; sửa chú thích production lỗi thời nếu có | Volume/project name, DB, Redis, worker | P3 | Pending | Migrate, health, frontend và worker smoke đạt |
| `backend/.env.example` | Mẫu tối thiểu; phần optional sang `.env.optional.example` | Loader, Compose interpolation, CI, Celery | P4 | Pending | Native/Docker và env-sync đạt |
| `frontend/.env.example` | Mẫu public tối thiểu; optional sang `.env.optional.example` | Vite build-time contract | P4 | Pending | Không có secret; ba cổng giữ nguyên |
| `scripts/bootstrap-backend.sh`, check thuần backend | Chỉ chuyển vào `backend/scripts/` khi ownership rõ | Docker, CI, README | P5 | Pending | Full backend gate đạt |
| Frontend hiện tại | Chỉ di chuyển file sai owner hoặc trùng thật sự | Public index, lazy loader, router, asset động | P6 | Pending | Lint, architecture, coverage, build, budget, E2E |
| `docs/setup-development.md`, hướng dẫn cài đặt | Hợp thành `05-huong-dan/cai-dat-local.md` | README và link nội bộ | P7 | Pending | Chạy thử trên checkout sạch |
| `frontend/ARCHITECTURE.md`, docs frontend | Hợp nguồn chính tại `08-frontend/kien-truc-frontend.md`; cập nhật `AGENTS.md` | Architecture checker và quy tắc import | P7 | Pending | Link/structure docs đạt |
| `docs/06-deployment/` | Tách kiến thức local/nghiệp vụ; thay bằng `06-kiem-thu/` | Link từ docs, CHANGELOG, README | P7 | Pending | Không mất kiến thức còn hiệu lực |
| `docs/TIEN-DO-DU-AN.md` | Rút thành `99-tien-do/trang-thai-du-an.md`; backlog riêng | SHA/PR kiểm chứng | P7 | Pending | Trạng thái phản ánh đúng code |

## Thứ tự và quy tắc thực hiện

1. Mỗi nhánh tạo từ `dev` sau khi PR trước đã được squash merge.
2. File rename thuần tách khỏi sửa nội dung; dùng `git mv`; không mass-format.
3. Bug ứng dụng phát hiện trong khảo sát được ghi lại và sửa bằng PR riêng ở P1,
   không trộn vào P0.
4. Không đổi dependency major, framework, ORM, app label, migration cũ, URL,
   payload, token/storage key, permission codename hoặc UI trong đợt tổ chức.
5. Nếu API/UI khác baseline, có migration ngoài dự kiến, thiếu test/coverage, env
   làm tắt chức năng hoặc media biến mất thì dừng merge và sửa/revert PR gây ra.

## Kết quả gate P0

- Manifest toàn bộ file tại checkpoint được sinh lại từ Git index; generator đã
  qua Ruff, format check và compile.
- Django system check đạt; `makemigrations --check --dry-run` không phát sinh
  migration; permission sync, backend layering và env sync đạt.
- Frontend lint đạt với warning `max-lines` đã tồn tại; architecture check đạt
  trên 1.329 module và 2.724 dependency.
- E2E public smoke hiện có đạt trên desktop; ba ảnh baseline được chụp lại bằng
  mock cố định và không có page/console error.
- Markdown link check đạt trên 80 file, 229 internal destination; `git diff
  --check` đạt.
- P0 chỉ chuyển sang `Verified` sau khi PR được review/squash merge vào `dev`.

## Gate theo loại thay đổi

| Loại | Kiểm tra bắt buộc |
| --- | --- |
| Chỉ docs | Markdown link và cấu trúc; gate BE/FE skip có lý do |
| Backend | Ruff, import-linter, Django/migration, full coverage, contract liên quan |
| Frontend | Lint, architecture, full coverage, build/budget, E2E phạm vi đã khóa |
| Env, auth, API, shared, Compose | Cả hai phía, env matrix, integration và ba cổng |
| Workflow, selector, dependency | Test detector và full validation của cơ chế chọn |
| Không nhận diện hoặc detector lỗi | Chạy tất cả hoặc fail closed |
