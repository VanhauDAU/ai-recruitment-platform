# Tiến độ dự án

File này giữ trạng thái hiện tại và việc còn mở. Chi tiết từng thay đổi nằm ở
[`CHANGELOG.md`](../CHANGELOG.md); lịch sử đầy đủ của file này nằm trong git.

## Tổng quan

| Hạng mục | Trạng thái |
| --- | --- |
| [Làm lại Template CV, tạo CV, trích xuất upload (CVT-v3)](01-phan-tich/ke-hoach-cv-template-v3.md) | 📝 Đã lập kế hoạch (2026-11-13), chờ duyệt; CVT-0…CVT-7 chưa bắt đầu |
| [Gỡ xác thực hai bước (ADR-0016)](#gỡ-xác-thực-hai-bước-adr-0016-2026-11-13) | 🟨 Xong trên nhánh `refactor/remove-two-factor`, chưa commit/gộp |
| [Epic hậu kiểm tin, gỡ dịch vụ, dọn docs (PM)](#epic-hậu-kiểm-tin-gỡ-dịch-vụ-thương-mại-và-dọn-docs-pm-2026-11-13) | 🟨 PM-0 đến PM-6 xong trên nhánh, chưa gộp; còn PM-5 và một phần PM-7 |
| [Epic tái cấu trúc ProCV (P0–P10)](#epic-tái-cấu-trúc-procv-p0p10-2026-09) | 🟨 P0 Verified, P1–P4 và P8–P9 Implemented |
| [Epic hardening cổng nhà tuyển dụng (ER)](#epic-rà-soát-và-hardening-cổng-nhà-tuyển-dụng-er-2026-08-10) | 🟨 Code xong; chờ kích hoạt ER-3, ER-8 |
| [Các epic đã hoàn tất](#các-epic-đã-hoàn-tất) | ✅ |
| [Lộ trình theo PRD](#lộ-trình-theo-prd) | 🟨 Phần AI lõi (giai đoạn 2–3) còn mở |
| [Việc còn mở](#việc-còn-mở) | |

## Gỡ xác thực hai bước (ADR-0016, 2026-11-13)

Quyết định: [`adr-0016-remove-two-factor-auth.md`](02-tong-quan/adr-0016-remove-two-factor-auth.md).
Gỡ 2FA/MFA ở cả ba cổng (backend, frontend, docs); `bootstrap_admin_mfa` thay
bằng `verify_admin_email`. Migration `accounts.0030` và `knowledgebase.0004` đã
chạy trên DB local (có bản `pg_dump` trước khi chạy). Cổng `check_all.sh` xanh:
pytest 1155 passed (87,48%), vitest 1190, E2E smoke 258 passed.

## Epic hậu kiểm tin, gỡ dịch vụ thương mại và dọn docs (PM, 2026-11-13)

Quyết định:
[`adr-0014-job-post-moderation.md`](02-tong-quan/adr-0014-job-post-moderation.md),
[`adr-0015-remove-commercial-services.md`](02-tong-quan/adr-0015-remove-commercial-services.md).

Các nhánh nối tiếp nhau, chưa push; gộp theo thứ tự:

| PR | Nhánh | Phase | Cổng kiểm tra |
| --- | --- | --- | --- |
| 1–2 | `refactor/remove-job-approval-workflow` | PM-1 → PM-3b | pytest 1268 passed (87,70%); vitest 1247, E2E 270 passed |
| 3 | `refactor/remove-commercial-services` | PM-4a | pytest 1175 passed (87,47%); vitest 1208, E2E 258 passed |
| 4 | `chore/drop-services-app` | PM-4b | pytest 1176 passed (87,47%) |
| 5 | `docs/restructure-docs` | PM-6 | link check |
| 6 | `docs/sync-progress-and-changelog` | PM-7 | link check |

PR 4 chỉ được triển khai ở môi trường đã chạy `services.0012` (PR 3). DB local
đã áp dụng `services.0012` trước khi kịp sao lưu, vì container backend chạy
`manage.py migrate` khi khởi động; bản sao lưu sau đó nằm ở
`~/Documents/ai-recruitment-platform-backups/`.

> Lưu ý khi chạy E2E local: nếu container frontend Docker đang giữ cổng 5173,
> Playwright sẽ dùng lại server đó và nhiều test lỗi giả. Chạy
> `PLAYWRIGHT_PORT=4317 PLAYWRIGHT_WEB_SERVER=preview npm run test:e2e:smoke`.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| PM-0 | Tag `pre-post-moderation`, nhánh làm việc | ✅ Hoàn tất |
| PM-1 | ADR-0014, ADR-0015, đánh dấu ADR-0012 thay thế một phần | ✅ Hoàn tất |
| PM-2 | Backend: đăng tin là công khai, gỡ duyệt tin, migration dữ liệu | ✅ Hoàn tất — đạt cổng backend |
| PM-3 | Frontend: cổng nhà tuyển dụng và quản trị theo hợp đồng API mới | ✅ Hoàn tất — đạt cổng frontend kể cả E2E |
| PM-3b | Lưu cam kết chịu trách nhiệm khi đăng và mở lại tin; nhà tuyển dụng thấy tin bị tạm ẩn kèm nhóm lý do | ✅ Hoàn tất — đạt cổng backend và frontend |
| PM-4a | Gỡ mọi chỗ dùng `services`, giao diện, quyền admin; migration xóa bảng | ✅ Hoàn tất — đạt cổng, migration đã chạy trên DB local |
| PM-4b | Xóa thư mục app `services` và cấu hình còn lại | ✅ Hoàn tất — pytest 1176 passed, coverage 87,47% |
| PM-5 | Kiểm thử tích hợp ba cổng | ⬜ Chưa bắt đầu |
| PM-6 | Dọn docs, xóa `99-tien-do`, dựng lại mục lục | ✅ Hoàn tất — 88 → 46 file, link check đạt |
| PM-7 | Bổ sung changelog còn thiếu, rút gọn tiến độ, đồng bộ phân tích yêu cầu với báo cáo ĐATN | 🟨 Changelog và tiến độ xong; chờ báo cáo ĐATN |

Đã chốt (2026-11-13): nhà tuyển dụng không sửa được tin đang bị tạm ẩn; muốn
khắc phục nội dung phải liên hệ quản trị viên.

## Epic tái cấu trúc ProCV (P0–P10, 2026-09)

Mục tiêu: tổ chức lại repo, CI, env và docs mà không đổi UI, URL, API, dữ liệu,
quyền hay lịch tác vụ. Baseline: `dev` tại `dddf4455` (23/09/2026).

| Giai đoạn | Đầu ra | Trạng thái |
| --- | --- | --- |
| P0 | Kiểm kê repo, hợp đồng hành vi, số đo CI | ✅ Verified |
| P1 | Chẩn đoán và sửa test lỗi hoặc treo | 🟨 Implemented |
| P2 | Dọn artifact, media test và ignore; đợt 2 (2026-11-13, `chore/repo-cleanup`): test media vào thư mục tạm, siết `backend/.dockerignore`, xóa code/asset/lệnh one-off chết | 🟨 Implemented |
| P3 | Bỏ cấu hình deploy production, giữ Compose local | 🟨 Implemented |
| P4 | Mỗi service một cặp `.env`/`.env.example` (backend, frontend), bỏ env root, gỡ biến chết, `sync_local_env.py` | 🟨 Implemented |
| P5 | Chuẩn hóa backend theo app | ⬜ Planned |
| P6 | Chuẩn hóa ownership frontend | ⬜ Planned |
| P7 | Hợp nhất docs và tiến độ | Thay bằng PM-6, PM-7 của epic hậu kiểm |
| P8–P9 | Tối ưu thời gian CI: pytest song song, shard unit/E2E | 🟨 Implemented — lượt đo thứ hai chưa có |
| P10 | Nghiệm thu và hồ sơ bàn giao | ⬜ Planned |

Việc còn mở:

- P1–P4, P8–P9 chỉ chuyển Verified sau khi gộp vào `dev` và full CI đạt trên
  cùng SHA.
- E2E CI còn lỗi không ổn định ở một viewport mỗi lượt, chưa rõ nguyên nhân gốc;
  CI cho phép một lần retry và báo `flaky`.
- `npm audit fix` cần chạy trên máy có kết nối npm registry.
- Env cá nhân còn key `SPEECH_*` của TTS đã gỡ và hai key lặp
  (`EMPLOYER_DOMAIN_DNS_TIMEOUT_SECONDS`, `EMPLOYER_DOMAIN_RECHECK_BATCH_SIZE`);
  chủ máy tự xóa, không xóa theo wildcard.

## Epic rà soát và hardening cổng Nhà tuyển dụng (ER, 2026-08-10)

Đặc tả canonical:
[`dac-ta-nha-tuyen-dung.md`](01-phan-tich/dac-ta-nha-tuyen-dung.md).
Decision log:
[`employer-remediation-decision-log.md`](02-tong-quan/employer-remediation-decision-log.md).

Code đã hoàn tất cho ER-0 đến ER-8. Còn lại là việc kích hoạt: upload strict
mode và Chrome QA (ER-3), DPA cần bản pháp lý chính xác, SMS cần gateway
production, staging và soak (ER-8). Lệnh kiểm tra chỉ đọc:
`audit_employer_workflow_rollout`.

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| ER-0 | Audit baseline, permission/state matrix và khóa quyết định | ✅ Hoàn tất |
| ER-1 | Empty/error state, document IDOR và job approval guard | ✅ Hoàn tất |
| ER-2 | Readiness/permission contract và frontend guards | ✅ Hoàn tất |
| ER-3 | Upload session, quarantine, malware scan và retention | 🟨 Đang làm — Docker/ClamAV local đạt; còn Chrome + staging/strict rollout |
| ER-4 | Company update request V2, revision và conflict handling | ✅ Hoàn tất |
| ER-5 | Verification final decision, blockers và compliance holds | ✅ Hoàn tất |
| ER-6 | SMS provider adapter và DPA evidence/version/grace | ✅ Hoàn tất code — production SMS activation thuộc ER-8 |
| ER-7 | Company unlink, notification center và activity | ✅ Hoàn tất code |
| ER-8 | Rollout, reconciliation, compatibility cleanup và audit closure | 🟨 Code complete — chờ staging/production activation và soak |

## Các epic đã hoàn tất

| Epic | Thời gian | Kết quả chính | Tài liệu |
| --- | --- | --- | --- |
| FAQ và hướng dẫn sử dụng (KB-P0…P6) | 2026-08 | Trung tâm trợ giúp public, workspace quản trị có revision | [đặc tả](01-phan-tich/dac-ta-trung-tam-tro-giup.md) |
| Thông báo đa cổng (AN-P0…P5) và visual theme (AN-V0…V3) | 2026-07 → 08 | Dải thông báo ba cổng, targeting, analytics, theme và ảnh nền | [đặc tả](01-phan-tich/dac-ta-thong-bao-da-cong.md) |
| Hoàn thiện CV Builder (CVB-P0…P6, CVB-8) | 2026-07 | Canonical document, catalogue, import PDF/DOCX, editor WYSIWYG A4 | [kiến trúc](02-tong-quan/cv-builder-architecture-foundation.md) |
| Dọn dẹp frontend (FE-P1…P6) | 2026-07 | Enforcement FSD, TanStack Query, tách file lớn, tối ưu asset | [`frontend/ARCHITECTURE.md`](../frontend/ARCHITECTURE.md) |
| Audit và refactor toàn dự án (AR-P0…P8) | 2026-07 | Layout ADR-0010, import-linter, coverage gate 84%, xóa API v1 | [audit](02-tong-quan/flow-audit-2026-07.md) |
| Onboarding ứng viên dạng hội thoại | 2026-08 | Một trang hội thoại năm câu hỏi | [đặc tả](01-phan-tich/dac-ta-onboarding-ung-vien.md) |
| Account status enforcement, vá xác thực admin và OAuth | 2026-07 | Khóa, tạm khóa, hold tài nguyên; MFA admin | [database](03-database/thiet-ke-database.md) |
| Trang chủ, cổng marketing nhà tuyển dụng | 2026-07 | Trang chủ ứng viên, 4 trang marketing VI/EN | [tổng quan](02-tong-quan/tong-quan-he-thong.md) |

## Lộ trình theo PRD

| Giai đoạn | Trạng thái | Ghi chú |
| --- | --- | --- |
| 0 — Khởi tạo dự án | ✅ | |
| 1 — MVP lõi | ✅ | Ba cổng, việc làm, CV builder, ứng tuyển, workspace chiến dịch và tin |
| 2 — AI cơ bản | 🟨 | Đã có: import CV qua AI, đối sánh rule-based (`match_score`), runtime `ai_core` với `AiInvocation` và `AiUsageDaily`. Chưa có: bảng `cv_analysis`, `match_results`, `ai_suggestions`; trích xuất kỹ năng; mô hình phân loại kỹ năng |
| 3 — Tối ưu tìm kiếm / matching | ⬜ | Embedding (pgvector) và semantic matching CV–JD |
| 4 — CV nâng cao | 🟨 | Còn import LinkedIn, AI writer, review CV bằng AI |
| 5 — Tuyển dụng nâng cao | ✅ | Việc đã lưu, lịch sử trạng thái hồ sơ, notification center của nhà tuyển dụng |
| 6 — Thương mại & quản trị | ✅ | Quản trị, RBAC, blog, marketing. Gói đăng ký và quota trả phí (6.1, 6.2) bỏ khỏi phạm vi theo ADR-0015 |
| 7 — Deployment | 🟨 | Docker Compose local có; cấu hình production đã bỏ ở P3, chưa triển khai |

## Việc còn mở

AI lõi của đồ án:

- Giai đoạn 2–3: lưu kết quả phân tích CV và đối sánh, trích xuất kỹ năng,
  semantic matching ([thuật toán AI](07-algorithms/thuat-toan-ai.md)).
- Import CV gọi thẳng REST của Gemini, OpenAI hoặc Anthropic trong
  `apps/ai_core/services/cv_import.py`, không qua runtime `ai_core`: không bị
  `AI_RUNTIME_ENABLED` chặn, không ghi `AiInvocation`, không quota.
- Site setting `ai_cv_review_enabled`, `ai_job_match_enabled`,
  `ai_daily_request_limit` được seed nhưng không có chỗ nào đọc.

Dọn phần còn sót của ADR-0014 và ADR-0015:

- Site setting nhóm `payment` và `email_notify_job_approved` không còn consumer.
- `RecruitmentNeed.consultation_topics` còn lựa chọn `service_packages`.

Kích hoạt và rollout:

- ER-3, ER-8, DPA và SMS như mục ER ở trên; AN-P6 (xóa compatibility legacy sau
  một release ổn định); AN-V4 (runbook và seed ví dụ cho visual theme).
- P1–P4, P8–P9 chờ full CI trên `dev` để chuyển Verified.

Sản phẩm:

- Cảnh báo domain công ty ở `Register.jsx` hứa giới hạn mua hoặc đăng tin không
  tồn tại.
- `POST /api/jobs/mine/` bị chặn ở bước đăng vẫn giữ bản nháp vừa tạo.
