# Giai đoạn 1 — Audit kiến trúc hiện tại

> Audit read-only ngày 2026-07-24 trên commit `b31cd4b`. Không refactor code,
> không đổi API, migration, token/session hay CV snapshot trong giai đoạn này.

## 1. Phạm vi và bằng chứng

Audit bao phủ 16 Django app, 619 frontend module, ba portal, 185 OpenAPI path,
117 migration, Docker/deployment, security và toàn bộ luồng CV Builder. Các
nguồn bằng chứng chính:

- `python manage.py check`, migration check, Ruff, import-linter và layering
  script đều pass.
- 352 backend test, 374 frontend unit test và 81 smoke E2E pass ở baseline.
- `npm run check:architecture` kiểm 1.254 dependency, không có violation.
- `manage.py spectacular --validate` hiện báo **52 error, 441 warning (328
  unique)**; file `docs/04-api/openapi.yaml` khớp output hiện tại nhưng schema
  chưa hoàn chỉnh.
- Scan source cho thấy 15 file từ 500 dòng và 45 file từ 300–499 dòng; độ dài
  chỉ là tín hiệu, không tự động là lý do tách.

Không phát hiện issue mức Critical. Các issue High đều được ghi trong
[technical-debt register](./03-technical-debt-register.md); thay đổi auth,
authorization, database, autosave và snapshot phải qua proposal trước khi sửa.

## 2. Backend domain map

| App | Trách nhiệm hiện tại | Phụ thuộc chính | Nhận định |
| --- | --- | --- | --- |
| `accounts` | User, JWT/session, email verification/reset, OAuth, MFA | employer/site settings, Redis, SimpleJWT | Nền tảng tốt; còn assurance/MFA và OTP concurrency |
| `ai_core` | Provider/adapter cấu trúc hóa CV | CV import, site settings | Không có API; đang nằm ngoài contract import-linter |
| `applications` | Apply, CV snapshot, status/history/export | accounts, jobs, cvs, employers, locations | Ownership SQL tốt; status transition chưa lock row |
| `blog` | Post/category/home read model | accounts | Home selector có query theo từng category |
| `candidates` | Profile, preference, consent, email notification | accounts, jobs, locations | Read selector còn `get_or_create` |
| `cv_templates` | Catalogue, immutable template versions, renderer metadata | cvs, jobs, site settings | Có vòng phụ thuộc với `cvs` |
| `cvs` | CV aggregate, draft/version, asset, share/import/export | cv_templates, applications, ai_core | Core được test tốt; view/task lớn và có race frontend |
| `dashboard` | Employer aggregate read model | employers, jobs, applications | Coupling cao nhưng phù hợp vai trò read model |
| `employers` | Recruiter/company/onboarding/verification/campaign | accounts, jobs, applications, locations | Nhiều workflow còn ở view; phone OTP race |
| `interviews` | Placeholder domain | — | Chưa có use case/API thực, nằm ngoài import-linter |
| `jobs` | Taxonomy, posting, moderation, search/recommendation | employer, candidate, privacy, locations, skills | State transitions thiếu row lock; serializer lớn |
| `locations` | Taxonomy tỉnh/xã | — | CRUD nhỏ, boundary rõ |
| `privacy` | Consent/cookie policy | accounts | Nhỏ, ít test chuyên sâu |
| `services` | Gói dịch vụ và consultation lead | accounts | Admin category có N+1; cache invalidation race |
| `sitecontent` | Locale/settings/links/banner/feedback | jobs, locations | Dynamic links N+1; view settings lớn |
| `skills` | Taxonomy kỹ năng | accounts | CRUD nhỏ, boundary tương đối rõ |

### Backend dependency hiện tại

```text
HTTP api
  ├── services (write/transaction/side effect)
  ├── selectors (read/query shaping)
  └── serializers
        ↓
      models

applications → cvs public service → immutable snapshot
dashboard    → employers + jobs + applications read models
cvs          ↔ cv_templates                         (cycle cần tháo dần)
```

ADR-0010 và import-linter đang gác dependency trong từng app, nhưng chưa gác
luật cross-app. Production code vẫn deep-import service/selector nội bộ, ví dụ
`cv_templates/api/views/admin.py`, `cv_templates/tasks.py`,
`employers/api/views/registration.py` và `jobs/services/posting.py`. Vòng
`cvs ↔ cv_templates` còn đi qua cả schema, service và URL/view.

### Layer placement và transaction

Điểm tốt:

- Ownership của application/job/CV thường được scope ngay trong SQL selector.
- Application creation khóa candidate; campaign transition và CV draft CAS có
  transaction/lock phù hợp.
- Services/selectors không import DRF HTTP machinery; migration state sạch.

Khoảng trống:

- Một số HTTP view/serializer vẫn sở hữu business mutation, nổi bật employer
  membership/company/recruitment need, admin CV template và site settings.
- `candidates/selectors/profiles.py` tạo record bằng `get_or_create`, khiến GET
  có side effect.
- Job moderation/posting và application status dùng instance đã đọc trước
  transaction, không `select_for_update`; history có thể lệch khi request đua.
- Phone OTP cooldown/attempt là chuỗi read-modify-write không atomic.
- Một số Celery task trực tiếp điều phối ORM/storage/state và nuốt exception,
  khiến task được đánh dấu success dù artifact thất bại.

## 3. Frontend và ba portal

Frontend đang tuân thủ FSD giản lược:

```text
app → pages → widgets → features → entities → shared
```

Không phát hiện cross-feature, deep-import slice, cross-portal page import,
cycle hay page gọi HTTP client trực tiếp. Route và layout đều lazy-load.

| Portal | Route registry | Layout chính | Guard hiện tại | Nhận định |
| --- | --- | --- | --- | --- |
| Candidate/main | `app/router/routes/main.routes.jsx` | `MainLayout`, `CandidateAccountLayout`, onboarding/auth layouts | `AuthGuard → RoleGuard(candidate)` | Guard đúng; pagination/error/returnUrl còn debt |
| Employer | `app/router/routes/employer.routes.jsx` | marketing, auth/setup, workspace dashboard | `AuthGuard → RoleGuard(employer) → onboarding/job verification` | Router dùng helper đúng, nhưng 8 consumer hardcode base path dev |
| Admin | `app/router/routes/admin.routes.jsx` | auth + dashboard | `AuthGuard → RoleGuard(admin)` | Backend vẫn là nguồn quyền; list/moderation error và pagination chưa tốt |

### Frontend finding hành vi

1. Có 27 literal `/tuyendung/app` trong 8 file employer. Đây là đường same-host
   local; production employer subdomain dùng `/app`, nên click có thể vào 404.
2. Nhiều entity adapter trả `data.results || data`, bỏ `count/next/previous`
   của pagination 20 bản ghi. CV/application/job và metric/status có thể chỉ đọc
   trang đầu.
3. Refresh thất bại trong `shared/api/client.js` chỉ xóa token. `SessionProvider`
   không nhận sự kiện tương ứng nên vẫn giữ `user`; `AuthGuard` tiếp tục render
   protected shell với phiên giả đăng nhập.
4. Employer JobList, candidate AppliedJobs/My CV và admin moderation biến lỗi
   mạng/5xx thành empty state, làm người dùng không biết cần retry.
5. Candidate/employer onboarding bỏ `returnUrl` của deep link sau login.
6. Company documents có hai query-key namespace, gây duplicate GET/stale cache.
7. `CampaignList`, `JobForm`, `ApplicationList` và một số admin CRUD page thực
   sự trộn orchestration với UI. Các warning file dài khác như CV editor hoặc
   JobFormPreview vẫn có cohesion, không nên tách máy móc.
8. ConsultationLeads dùng request thủ công không abort/request-id; response filter
   cũ có thể ghi đè filter mới.

## 4. API contract

- Root API giữ contract hiện hành: CV/application/template dùng `/api/v2/`, các
  domain khác dùng `/api/<domain>/`; không còn consumer frontend của CV V1.
- `docs/04-api/openapi.yaml` có đúng 185 path/260 operation hiện tại.
- OpenAPI không có security scheme cho `AccountJWTAuthentication`; 164 warning
  không resolve authenticator và 150 warning method field không có type.
- 13 endpoint unique không suy ra serializer (52 error khi tính theo method),
  gồm employer campaign reports/options/status, employer job lifecycle/admin
  moderation và application CSV export.
- Error response vẫn là hỗn hợp `detail`, field map và partial-success shape.
  Đây là compatibility debt, không được đổi hàng loạt.
- Global pagination là 20 record, nhưng một số admin/user collection tắt
  pagination hoặc dùng detail serializer cho list.

## 5. Database và query

Điểm tốt:

- 117 migration có lịch sử rõ, không có migration pending.
- Domain chính đã có partial unique/check/index cho status, default CV, email,
  ownership và version number.
- Query budget hiện khóa job/application list ở số query phẳng.

Debt xác nhận:

- N+1 ở blog home (mỗi category), admin service category (`packages.count`) và
  dynamic link group (query Location/JobCategory mỗi group).
- Một số invariant chỉ ở serializer/model `clean`: owner của CompanyDocument,
  budget/date/headcount, CvAsset owner-kind, soft-delete timestamp.
- Có explicit index trùng với implicit FK/unique index; chỉ được drop sau khi
  kiểm tra PostgreSQL catalog/EXPLAIN production.
- Cache signal xóa cache trước transaction commit, cho phép request khác refill
  dữ liệu cũ.
- Admin CV template list không pagination và nhúng toàn bộ version/JSON schema.

## 6. Security audit

### Mitigation đã xác nhận

- Access token chỉ ở memory; refresh token là HttpOnly cookie tách portal,
  rotate/blacklist và `sid` session revocation.
- Password reset chống enumeration, one-use, captcha/throttle và thu hồi session.
- Safe return URL chặn absolute/protocol-relative URL.
- Application/CV/job ownership được scope SQL; chưa xác nhận IDOR.
- Upload CV/avatar có size/type/decode, private storage; CV HTML/PDF dùng canonical
  schema và escaping/sanitization.
- Shared-link token chỉ lưu hash, có expiry/revoke; import không log raw CV.

### Security gap cần proposal

- Email-verification token chỉ bind `user_id`, không bind email/generation; token
  cấp cho email cũ có thể xác thực email mới sau change-email.
- OAuth cố ý bypass account MFA; session chưa lưu assurance đáng tin cậy. Endpoint
  đọc candidate PII/legal document chỉ kiểm role employer, còn stock Django Admin
  đi ngoài policy API MFA/status.
- `.env.example` đặt SSL/session/CSRF/HSTS/proxy hardening ở giá trị development.
  Production validation không từ chối hầu hết override không an toàn hoặc HTTP
  origins, nên deploy copy env có thể fail-open.
- AI import gửi extracted CV text đầy đủ sang provider khi có API key nhưng không
  có consent/transparency riêng cho outbound processing.
- DOCX/PDF/image/legal uploads có size/magic check nhưng chưa có ZIP expansion,
  pixel, malware quarantine/sandbox budget đầy đủ.
- MFA challenge counter chưa atomic; private/bearer CV responses thiếu policy
  `Cache-Control: private, no-store`; TOTP encryption key chưa fail-fast ở prod.

## 7. CV Builder audit

### Contract đang đúng

```text
UserCv aggregate
  ├── một CvDraft mutable + lock_version CAS
  ├── nhiều CvVersion immutable
  ├── latest/published version pointers
  └── assets bằng public ID

Application
  └── submitted_cv_version → application_snapshot (PROTECT)
```

- Autosave dùng `If-Match: lock-version-N`, trả 409 conflict và UI dừng autosave
  thay vì ghi đè.
- Save/publish/export/share/thumbnail dùng immutable version; application tạo
  snapshot riêng và hard delete library CV vẫn giữ snapshot.
- Template renderer/schema/version được pin; preview/export dùng cùng canonical
  document contract.

### Gap core

- Khi autosave cũ đang in-flight, Save/Publish/Switch template/Apply sample chỉ
  await một promise, không drain edit mới vừa queue như `saveDraft()`; thao tác
  có thể commit/transform draft cũ.
- Save-version không idempotent và không tăng draft lock; double-click có thể tạo
  hai version giống nhau.
- Django Admin cho sửa `Application.submitted_cv_version` và `cv`; model không
  bảo vệ pointer, nên provenance snapshot có thể bị viết lại.
- Immutability version chủ yếu nằm trong `save()`; `QuerySet.update`/raw SQL vẫn
  bypass. Hard delete còn làm `parent_version` của snapshot thành null và mất
  exact source provenance.
- Model có archive/retention fields nhưng V2 delete là hard delete; chưa có
  archive/restore CV hay restore một historical version thành draft mới.

## 8. Kết luận

Kiến trúc nền hiện tại tốt và đã được enforce đáng kể; mục tiêu không phải viết
lại. Ưu tiên tiếp theo là:

1. Giữ nguyên contract và thêm enforcement đang thiếu (OpenAPI/cross-app).
2. Sửa các race/integrity bằng transaction test trước implementation.
3. Chuẩn hóa pagination/error/query keys theo từng domain frontend.
4. Thiết kế auth assurance và CV snapshot/autosave trước mọi thay đổi high-risk.
5. Chỉ tách file theo workflow/resource có owner rõ, không theo số dòng đơn thuần.

