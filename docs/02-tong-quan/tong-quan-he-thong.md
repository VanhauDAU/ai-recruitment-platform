# Tổng quan hệ thống ProCV

ProCV là nền tảng tuyển dụng tích hợp AI, phạm vi đồ án gồm: tạo CV trên trình
soạn thảo theo mẫu, import và phân tích CV, đối sánh hồ sơ/CV với tin tuyển
dụng (CV–JD matching) để gợi ý việc làm, và quy trình tuyển dụng của nhà tuyển
dụng từ xác thực doanh nghiệp, chiến dịch, tin tuyển dụng tới xử lý hồ sơ ứng
tuyển. Yêu cầu nghiệp vụ gốc ở
[`phan-tich-yeu-cau.md`](../01-phan-tich/phan-tich-yeu-cau.md).

## Ba cổng

| Cổng | URL frontend | Người dùng | Chức năng chính |
| --- | --- | --- | --- |
| Ứng viên | `/` | khách, `candidate` | tìm việc, công ty, mẫu CV, CV builder, ứng tuyển, gợi ý việc làm, cẩm nang, trợ giúp |
| Nhà tuyển dụng | `/tuyendung` (marketing), `/tuyendung/app` (workspace) | `employer` | xác thực công ty, DPA, chiến dịch, tin tuyển dụng, AI tạo tin, hồ sơ ứng tuyển, thông báo |
| Quản trị | `/admin/app` | `admin` | phân quyền RBAC, tài khoản, kiểm duyệt xác thực/báo cáo tin, nội dung, thông báo, cài đặt, tổng quan AI |

Mỗi cổng là một tài khoản độc lập: cùng email có thể có tối đa một tài khoản
cho mỗi role (ràng buộc `(lower(email), role)`), mật khẩu riêng, phiên riêng.

## Công nghệ

- **Backend**: Python, Django 5.1, Django REST Framework, SimpleJWT,
  drf-spectacular (OpenAPI), Celery 5 + Redis, Playwright Chromium + trang in
  frontend/pypdfium2 (render PDF và ảnh CV), pypdf/python-docx (trích text import), `google-genai` (AI).
- **Dữ liệu**: PostgreSQL 16 (tìm kiếm không dấu bằng `unaccent`), Redis 7
  (cache, throttle, broker Celery), lưu file local hoặc Cloudflare R2
  ([`cloudflare-r2-media.md`](../06-deployment/cloudflare-r2-media.md)).
- **Frontend**: React 19, Vite, React Router, TanStack Query, Ant Design,
  Tailwind CSS.
- **Hạ tầng dev/deploy**: Docker Compose, chi tiết ở
  [`docker-compose.md`](../06-deployment/docker-compose.md).

### Dịch vụ Docker Compose

| Service | Vai trò |
| --- | --- |
| `db` | PostgreSQL 16 |
| `redis` | Cache, throttle, broker |
| `media-init` | Khởi tạo quyền thư mục public/private media và quarantine |
| `backend` | Django API (`migrate` rồi chạy server) |
| `worker` | Celery queue `default`, `auth-email`, `auth-sms`, `cv-export`, `upload-scan`, `candidate-email` |
| `ai-worker` | Celery queue `ai-generation`, concurrency 2 |
| `beat` | Celery beat: dispatch outbox, dọn dữ liệu hết hạn, digest việc làm, thu hồi job AI stale |
| `clamav` | Quét virus file upload (profile `scanner`) |
| `frontend` | Vite dev server (Node 22) |

Định tuyến queue khai báo ở `CELERY_TASK_ROUTES`, lịch ở `CELERY_BEAT_SCHEDULE`
trong `backend/config/settings/base.py`.

## Bản đồ app backend

Mọi app trong `backend/apps/` theo layout `api/ · models/ · services/ ·
selectors/ · tasks/ · tests/`, phụ thuộc `api → services/selectors → models`
và được `import-linter` kiểm tra ([`AGENTS.md`](../../AGENTS.md),
[`quy-uoc-code.md`](./quy-uoc-code.md)). Miền CV dùng tiền tố `/api/v2/`, app
khác dùng `/api/<app>/`.

| App | Trách nhiệm |
| --- | --- |
| `accounts` | User theo role, đăng nhập/đăng ký, social login, JWT + `AuthSession`, outbox email xác thực, RBAC admin, lời mời admin, trạng thái tài khoản (`/api/auth/`, `/api/admin/`) |
| `candidates` | Hồ sơ ứng viên, onboarding, nhu cầu công việc, consent, cài đặt email (`/api/candidate/`) |
| `employers` | Công ty, recruiter, xác thực doanh nghiệp, DPA, OTP SMS, chiến dịch tuyển dụng, compliance hold, domain claim, thông báo NTD, API công ty công khai (`/api/employer/`, `/api/companies/`) |
| `jobs` | Tin tuyển dụng và vòng đời, tìm kiếm, tin đã lưu/ẩn, báo cáo tin và tạm ẩn, gợi ý việc làm, digest email, AI tạo tin (`/api/jobs/`, `/api/ai/`) |
| `applications` | Hồ sơ ứng tuyển, snapshot CV, lịch sử trạng thái, tự động từ chối (`/api/v2/`) |
| `cvs` | CV của ứng viên, draft/version, import, export PDF, chia sẻ, điểm hoàn thiện (`/api/v2/cvs/`) |
| `cv_templates` | Catalogue mẫu CV, phiên bản, taxonomy, thumbnail (`/api/v2/`) |
| `ai_core` | Runtime AI trung lập provider, invocation log, usage, retention |
| `uploads` | Upload session, quarantine, quét ClamAV, claim file sạch (`/api/uploads/`) |
| `privacy` | Cookie consent và định danh người xem ẩn danh (`/api/privacy/`) |
| `sitecontent` | Site settings, thông báo đa cổng, SEO shell/sitemap, media (`/api/site/`) |
| `knowledgebase` | Trung tâm trợ giúp FAQ/hướng dẫn có revision (`/api/knowledgebase/`) |
| `blog` | Cẩm nang nghề nghiệp (`/api/blog/`) |
| `dashboard` | Số liệu tổng quan cho admin (`/api/dashboard/`) |
| `skills`, `locations` | Danh mục kỹ năng, tỉnh/thành (kèm sáp nhập tỉnh) |

Lược đồ dữ liệu: [`thiet-ke-database.md`](../03-database/thiet-ke-database.md).
Danh sách endpoint: [`tai-lieu-api.md`](../04-api/tai-lieu-api.md),
[`openapi.yaml`](../04-api/openapi.yaml).

## Frontend

Feature-Sliced Design giản lược `app → pages → widgets → features → entities →
shared`; page tách theo portal `main`, `employer`, `admin`; route đăng ký qua
lazy loader của từng portal và guard `AuthGuard` → `RoleGuard`. Quy tắc đầy đủ
ở [`frontend/ARCHITECTURE.md`](../../frontend/ARCHITECTURE.md), cấu trúc thư
mục ở [`cau-truc-frontend.md`](../08-frontend/cau-truc-frontend.md), contract
response ở [`frontend-response-contracts.md`](../04-api/frontend-response-contracts.md).

## Luồng nghiệp vụ chính

### Ứng viên: từ CV tới ứng tuyển

1. Đăng ký/đăng nhập (email hoặc social), xác thực email, onboarding và khai
   báo nhu cầu công việc.
2. Tạo CV từ mẫu trên builder (autosave draft, version bất biến, export PDF
   qua worker) hoặc import PDF/DOCX; import trích text và cấu trúc hóa bằng AI
   thành CV có thể chỉnh sửa.
3. Đồng ý consent `ai_recommendation` để nhận gợi ý; hệ thống đối sánh nhu cầu
   công việc hoặc CV vừa lưu với tin active, trả điểm và lý do khớp. Thuật toán:
   [`thuat-toan-ai.md`](../07-algorithms/thuat-toan-ai.md).
4. Tìm việc (bộ lọc, không dấu), lưu tin, ẩn tin, nhận digest email.
5. Ứng tuyển bằng CV builder hoặc CV upload; hệ thống chụp snapshot CV tại
   thời điểm nộp. Ứng viên theo dõi trạng thái và có thể báo cáo tin vi phạm.

### Nhà tuyển dụng: từ xác thực tới tuyển

1. Đăng ký tài khoản NTD, xác thực email và số điện thoại (OTP).
2. Liên kết công ty, nộp hồ sơ xác thực doanh nghiệp (GPKD qua upload đã quét);
   admin ra quyết định cuối. Chấp nhận DPA đang hiệu lực.
3. Tạo chiến dịch tuyển dụng (trạng thái `draft`, `active`, `paused`,
   `completed`, `cancelled`) và tin tuyển dụng trong chiến dịch, có thể dùng AI
   tạo bản nháp.
4. Đăng tin: tin công khai ngay khi qua các điều kiện (xác thực, DPA, không
   hold, hạn hợp lệ) và NTD xác nhận cam kết trách nhiệm; vòng đời
   `draft → active → closed` ([ADR-0014](./adr-0014-job-post-moderation.md),
   vòng đời hiển thị theo [ADR-0012](./adr-0012-job-services-architecture.md)).
5. Xử lý hồ sơ: `submitted → viewed → considering → shortlisted → interviewed
   → accepted | rejected`, có lịch sử và quy tắc tự động từ chối.

Đặc tả chi tiết: [`dac-ta-nha-tuyen-dung.md`](../01-phan-tich/dac-ta-nha-tuyen-dung.md),
[`dac-ta-chien-dich-va-tin-tuyen-dung.md`](../01-phan-tich/dac-ta-chien-dich-va-tin-tuyen-dung.md);
onboarding ứng viên đặc tả trong [`dac-ta-onboarding-ung-vien.md`](../01-phan-tich/dac-ta-onboarding-ung-vien.md).

### Quản trị

- Hậu kiểm tin: xử lý báo cáo, tạm ẩn (`moderation_hold`) có lý do và khôi phục.
  Không có duyệt tin trước khi đăng.
- Gán nhãn hiển thị `tier`, `is_hot`, `is_urgent`, `has_flash_badge` cho tin.
  Không có gói dịch vụ, tin tài trợ hay remarketing
  ([ADR-0015](./adr-0015-remove-commercial-services.md)).
- Duyệt xác thực doanh nghiệp và yêu cầu cập nhật công ty.
- Quản lý tài khoản (khóa, cấm, khôi phục), nội dung (blog, trợ giúp, mẫu CV),
  thông báo đa cổng ([`dac-ta-thong-bao-da-cong.md`](../01-phan-tich/dac-ta-thong-bao-da-cong.md)),
  site settings ([`cau-hinh-site-settings.md`](../05-huong-dan/cau-hinh-site-settings.md)).

## Vấn đề xuyên suốt

### Xác thực và phiên

- Access JWT ngắn hạn (mặc định 15 phút; admin 5 phút) gửi qua header
  `Bearer`. Refresh JWT xoay vòng, blacklist sau khi xoay, nằm trong cookie
  HttpOnly tách theo portal, không vào storage JavaScript.
- Mỗi lần đăng nhập tạo `AuthSession` (một thiết bị); access token mang claim
  `sid` phải trỏ tới phiên còn hiệu lực, nên thu hồi phiên có tác dụng ngay.
  Có idle timeout, ân hạn tái sử dụng refresh khi đua giữa hai tab, và
  re-authentication cho thao tác nhạy cảm.
- `auth_revision` của tài khoản/phiên làm vô hiệu mọi token và link reset
  phát trước khi đổi email hay đổi trạng thái.
- Chống dò mật khẩu bằng backoff theo tài khoản. Không có xác thực hai bước
  ([ADR-0016](./adr-0016-remove-two-factor-auth.md)). Social login:
  [`social-login.md`](../05-huong-dan/social-login.md).

### Phân quyền admin (RBAC)

Admin thường thuộc phòng ban/chức danh (`AdminMembership`, `AdminRole`,
`Department`); endpoint khai báo permission cần thiết và được
`HasAdminPermission` kiểm tra, từ chối bằng 403 `admin_permission_denied`.
Superuser bypass RBAC. Mọi thay đổi quyền có audit. Lệnh đồng bộ và kiểm tra
readiness: [`van-hanh-va-kill-switch.md`](../06-deployment/van-hanh-va-kill-switch.md).

### Trạng thái tài khoản

`active | inactive | banned | pending`. Khóa hoặc cấm thu hồi phiên và đặt
`policy_hold` lên campaign/job của NTD thay vì đổi trạng thái nghiệp vụ; tin
bị hold không công khai. Khôi phục tài khoản bị cấm phải qua `inactive` và gỡ
hold có rà soát.

### Quyền riêng tư và consent

- Consent ứng viên (`ai_recommendation`, `recruiter_visibility`) có lịch sử
  `CandidateConsentEvent`; gợi ý cá nhân hóa kiểm consent trước khi đọc dữ liệu.
- Cookie consent và định danh người xem ký số, dùng cho đếm lượt xem tin
  ([`cookie-consent-va-job-view-tracking.md`](../04-api/cookie-consent-va-job-view-tracking.md)).
- AI không nhận PII liên hệ; log và metric chỉ có enum/bucket.

### Upload và quét file

File nhạy cảm (hồ sơ xác thực, cập nhật công ty, CV import) đi qua upload
session: ghi vào quarantine, quét ClamAV trên queue `upload-scan`, chỉ được
claim khi `clean`. Bắt buộc theo domain bằng cờ `*_UPLOAD_SESSION_REQUIRED`.
Ranh giới storage: [`employer-upload-storage-boundary-runbook.md`](../06-deployment/employer-upload-storage-boundary-runbook.md).

### Tác vụ bất đồng bộ

Email, SMS, export/import CV, quét upload, digest việc làm và AI chạy trên
Celery với outbox bền vững trong DB; beat định kỳ dispatch lại job pending và
dọn dữ liệu hết hạn. Request web không chờ provider bên ngoài.

### Cấu hình và kill switch

Biến môi trường: [`cau-hinh-env.md`](../05-huong-dan/cau-hinh-env.md). Production
fail-fast khi cấu hình sai. Cờ rollout và cách tắt khẩn cấp:
[`van-hanh-va-kill-switch.md`](../06-deployment/van-hanh-va-kill-switch.md).

## Quyết định kiến trúc

- [ADR-0012](./adr-0012-job-services-architecture.md): vòng đời hiển thị tin (phần còn hiệu lực).
- [ADR-0013](./adr-0013-public-companies-api.md): API công khai cho danh bạ công ty.
- [ADR-0014](./adr-0014-job-post-moderation.md): hậu kiểm tin thay cho duyệt trước.
- [ADR-0015](./adr-0015-remove-commercial-services.md): gỡ dịch vụ thương mại.
- [ADR-0016](./adr-0016-remove-two-factor-auth.md): gỡ xác thực hai bước.
- [`cv-builder-architecture-foundation.md`](./cv-builder-architecture-foundation.md): kiến trúc CV Builder.
- [`employer-remediation-decision-log.md`](./employer-remediation-decision-log.md),
  [`chatbot-local-decision-log.md`](./chatbot-local-decision-log.md): nhật ký quyết định theo mảng.

Cài đặt môi trường dev: [`huong-dan-cai-dat.md`](../05-huong-dan/huong-dan-cai-dat.md).
Tiến độ: [`TIEN-DO-DU-AN.md`](../TIEN-DO-DU-AN.md).
