# Giai đoạn 3 — Quick wins và dọn dẹp an toàn

> Thực hiện ngày 2026-07-24. Chỉ xóa hoặc chuẩn hóa mục có bằng chứng tĩnh,
> dependency graph và test. Không đổi route, payload API, storage key, migration
> lịch sử hoặc workflow nghiệp vụ.

## 1. Đã xóa an toàn

| File | Phân loại | Bằng chứng | Hành động | Rủi ro |
| --- | --- | --- | --- | --- |
| `backend/apps/{ai_core,dashboard,interviews}/admin.py` | Scaffold rỗng | Mỗi file chỉ có comment mặc định, không đăng ký model; Django admin autodiscovery chấp nhận app không có module admin | Xóa 3 file rỗng | Rất thấp |
| `backend/apps/cvs/tests/test_document_services.py` | Comment scaffold | File đã có test thực; dòng `Create your tests here` không còn giá trị | Xóa comment cuối file | Không có |
| `frontend/src/features/manage-campaigns/ui/CampaignForm.jsx` và export tương ứng | Component chết | Chỉ được re-export, không có consumer/test; dependency graph và production bundle không dùng symbol | Xóa component và re-export | Thấp |
| `getCvSampleContent`, `blocksToPlainText`, `getEmployerCompany`, `getEmployerTwoFactorMethods`, `disableEmployerTotp` | Helper/API client chết | Tìm kiếm exact-symbol toàn `src`, AST import/export và bundle đều không có consumer; luồng 2FA hiện dùng `disableEmployerTwoFactorMethod` | Xóa implementation và mock 2FA cũ | Thấp |
| `.cv-document-preview__overflow`, `.company-proof-options`, `slideInTop`/`.animate-slide-in`, `employerMarquee`/`.animate-employer-marquee` | CSS chết | Không có class/token consumer trong JSX/HTML/runtime library; marquee đang dùng animation khác do component sở hữu | Xóa selector và keyframes | Thấp |

## 2. Đã hợp nhất hoặc chuẩn hóa

| File | Phân loại | Bằng chứng | Hành động | Rủi ro |
| --- | --- | --- | --- | --- |
| `backend/apps/*/models/*.py` có `CheckConstraint` | API deprecated | Django 5.1 cảnh báo `check` sẽ bị bỏ ở Django 6; `condition` là tên hiện hành và deconstruct về cùng model state | Đổi keyword `check=` thành `condition=` trong model hiện tại; giữ migration lịch sử | Thấp |
| `backend/config/settings/{development,production,test}.py` | Suppression trùng | `F403` và `F405` đã được ignore tập trung trong `backend/pyproject.toml`; Ruff `RUF100` xác nhận 17 inline `noqa` thừa | Xóa suppression tại từng dòng | Rất thấp |
| `backend/config/settings/test.py` | Test config phụ thuộc `.env` | Baseline sinh 126 cảnh báo HMAC khi developer key ngắn; test cần key ổn định và SimpleJWT đã snapshot key từ base settings | Đặt test-only key đủ dài và đồng bộ `SIMPLE_JWT.SIGNING_KEY` | Thấp; chỉ settings test |
| `frontend/src/app/router/routes/*.routes.jsx` | Import trong cùng slice | `frontend/ARCHITECTURE.md` yêu cầu relative import khi ở cùng slice; 11 import guard đều nằm trong `app/router` | Đổi alias sâu sang `../guards/*` | Rất thấp |
| `scripts/check_all.sh` | Quality script lệch CI | Script tự mô tả “khớp CI” nhưng dùng Django test runner và bỏ coverage, bundle budget, E2E smoke; `AGENTS.md` coi đây là lệnh gate toàn repo | Dùng pytest coverage gate, thêm frontend coverage/budget/E2E và làm rõ venv/Compose runners | Thấp; chỉ tooling |
| `.gitignore` | CI output chưa ignore | Backend workflow tạo `coverage.json` và `pytest-results.xml`; trước sửa `git check-ignore` không nhận hai file | Ignore đúng hai đường dẫn output | Rất thấp |
| `docs/setup-development.md`, `docs/09-refactor/archive/phase6-applications-server-state.md`, `README.md` | Reference/tooling docs cũ | Đường dẫn migration test và ADR không resolve; mô tả quality command thiếu gate mới | Sửa link/path/module và mô tả | Không có |

Không có file nào cần hợp nhất vật lý. Việc “hợp nhất” ở đây chỉ tập trung policy
lint/test runner, tránh tạo abstraction mới hoặc coupling giữa domain.

## 3. Đã đổi tên

Không có. Audit không tìm thấy tên sai đủ quan trọng để biện minh cho churn import
hoặc thay đổi contract.

## 4. Đã di chuyển

Không có. Cấu trúc backend ADR-0010 và frontend FSD hiện tại được giữ nguyên ở
giai đoạn quick-win.

## 5. Giữ nguyên

| File | Phân loại | Bằng chứng | Hành động | Rủi ro nếu xóa |
| --- | --- | --- | --- | --- |
| `backend/apps/**/migrations/**` | Lịch sử schema | Migration đã áp dụng và migration tests phụ thuộc chuỗi lịch sử; còn 2 warning deprecated trong `0004_cv_exports.py` | Giữ nguyên, không sửa chỉ để làm sạch warning | Cao |
| Management commands/seed helpers | Bootstrap dữ liệu | Có consumer trong docs/setup/bootstrap; kế hoạch cấm xóa seed khi chưa xác minh | Giữ nguyên | Cao |
| `backend/apps/interviews/` | Placeholder roadmap | App chưa có API/model nghiệp vụ nhưng đã đăng ký và có migration; roadmap còn nhắc AI interview | Chỉ xóa `admin.py` scaffold, giữ toàn app | Cao |
| `frontend/src/test/setup.js`, `src/main.jsx`, lazy pages và test files | Entrypoint | Dependency graph indegree bằng 0 là đúng với entry/test; Vitest/Vite/router nạp chúng ngoài import graph thông thường | Giữ nguyên | Cao |
| `frontend/public/**` và 7 stylesheet đang dùng | Asset/style có consumer | 10/10 public assets có reference; 7/7 CSS file được import | Giữ nguyên | Trung bình–cao |
| OpenAPI current/baseline, refactor baseline/archive, changelog và tiến độ | Generated/canonical/history có chủ ý | Có cross-reference và dùng làm contract/baseline so sánh | Giữ nguyên | Cao |
| Hai `.python-version`, dev/prod Compose, base/AI requirements | Near-duplicate có vai trò riêng | Docs khóa runtime ở root/backend; Compose là override; AI requirements mở rộng base | Giữ nguyên | Trung bình |
| `scripts/*.sh`, `scripts/codebase_inventory.py` | Tool đang dùng | Có consumer CI/docs; toàn bộ shell script qua `bash -n` | Giữ, chỉ cập nhật `check_all.sh` | Thấp–trung bình |

## 6. Đề xuất xóa nhưng chưa xóa

| File | Phân loại | Bằng chứng | Hành động | Rủi ro |
| --- | --- | --- | --- | --- |
| `backend/apps/accounts/permissions.py` — `IsEmployerWithRecentReauthentication` | Không có consumer hiện tại | Exact-symbol chỉ thấy định nghĩa, coverage không đi qua thân class | Chưa xóa; thuộc authorization nên cần security review | Cao |
| `backend/apps/cv_templates/section_registry.py` — `section_definition_seed_data` | Helper chưa có caller | Exact-symbol chỉ thấy định nghĩa | Chưa xóa; có semantics seed/template | Trung bình |
| Các CV thumbnail/shared-link helpers, `searchEmployerCompanies`, `auth.logout` phía frontend | Capability chỉ có contract test hoặc chưa có runtime consumer | Không có consumer production nhưng API/test thể hiện capability dự kiến | Chưa xóa implementation | Trung bình |
| Toàn bộ `backend/apps/interviews/` | Placeholder domain | Chưa có use case/API thực | Chưa xóa app/migration/registration; cần quyết định sản phẩm và audit dữ liệu/deploy | Cao |

## 7. Cần xác minh thêm

| File | Phân loại | Bằng chứng | Hành động tiếp theo | Rủi ro |
| --- | --- | --- | --- | --- |
| `.claude/launch.json`, `frontend/.claude/launch.json` | Near-duplicate | Một file chạy workspace root, một file chạy workspace frontend; không có telemetry về cách team mở IDE | Xác nhận workflow của team trước khi hợp nhất | Trung bình |
| `docs/adr/**`, `docs/architecture/adr/**` | Hai cây ADR lịch sử | Cả hai được tham chiếu; có chủ đề overlap nhưng trạng thái/đời tài liệu khác nhau | Giai đoạn 7 lập index canonical/superseded, không xóa ngầm | Cao |
| Các public barrel export không có consumer ngoài slice | API surface dư | Bundle tree-shake được; một số implementation vẫn có relative consumer hoặc contract test | Thu hẹp theo từng feature trong Giai đoạn 5 sau regression test | Thấp–trung bình |

## 8. Kiểm chứng

| Gate | Kết quả |
| --- | --- |
| `git diff --check`, `bash -n scripts/check_all.sh` | Pass |
| Backend Ruff/format/import-linter/layering/Django/migration | Pass; không có migration mới |
| Backend pytest coverage | 352/352 test; coverage 85,56% ≥ 84% |
| Backend warnings | 146 → 2; hai warning còn lại chỉ nằm trong migration lịch sử được giữ nguyên |
| Frontend lint/architecture | Pass; 12 warning `max-lines` baseline; graph 618 module/1.253 dependency |
| Frontend coverage | 106/106 file, 374/374 test; 38,89% statements |
| Frontend build/bundle budget | Pass; initial JS 284,9/320 KiB, CSS 33,4/35 KiB gzip |
| Frontend E2E smoke | 81/81 test trên desktop/tablet/mobile; pass trong 1,3 phút |

Kết quả audit root: không có `*.bak`, `*.old`, `*.tmp`, `*.backup`, bản copy,
scratch/experimental script hoặc generated artifact bị commit nhầm. Không tạo
commit “cleanup” giả khi không có file rác để xóa.
