# 04 - API

Phạm vi:
- Danh sách endpoint theo module (auth, candidate, employer, cv, jobs, applications, ai, interviews)
- Request/response mẫu, mã lỗi

Contract field theo từng màn hình: [frontend-response-contracts.md](frontend-response-contracts.md).

## Tài liệu API tương tác (Swagger / OpenAPI)

Dùng `drf-spectacular` (OpenAPI 3). Chạy backend rồi mở:

| URL | Mô tả |
|---|---|
| `/api/docs/` | **Swagger UI** — xem + thử API trực tiếp trên trình duyệt |
| `/api/redoc/` | ReDoc — tài liệu dạng đọc |
| `/api/schema/` | File schema OpenAPI 3 (YAML) để import vào Postman/Insomnia |

Xác thực trong Swagger UI: gọi `POST /api/auth/login/` lấy `access`, bấm **Authorize**, nhập `Bearer <access_token>`. Xuất schema ra file: `python manage.py spectacular --file schema.yml`.

## Đã triển khai

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/auth/register/` | Đăng ký tài khoản (candidate/employer) |
| POST | `/api/auth/register/email-availability/` | Kiểm tra email đã được dùng chưa cho UX form đăng ký candidate; body `{email}`, trả `{available}`; public, throttle 12/phút. Đây chỉ là pre-check — endpoint đăng ký vẫn xác thực lại để tránh race condition. |
| POST | `/api/auth/login/` | Đăng nhập, nhận access/refresh JWT (kèm `portal` để chặn sai vai trò theo cổng) |
| POST | `/api/auth/refresh/` | Làm mới access token |
| GET | `/api/auth/me/` | Thông tin tài khoản hiện tại. Employer có thêm `employer_job_workspace_ready`; giữ `employer_verification_completed` trong compatibility window. |
| POST | `/api/auth/verify/send/` | Gửi lại email xác thực (429 kèm `retry_after` khi còn cooldown) |
| POST | `/api/auth/verify/confirm/` | Xác nhận email bằng `token` trong link (public) |
| POST | `/api/auth/change-email/` | Đổi email → reset xác thực + gửi lại link |
| POST | `/api/auth/password-reset/` | Gửi email chứa link đặt lại mật khẩu (public, cần `captcha_token`). **Luôn trả 200 kèm cùng một `detail`** dù email có tồn tại hay không — chống dò danh sách email. Cooldown 60s/tài khoản (im lặng), throttle 5/phút theo IP |
| GET | `/api/auth/password-reset/validate/?token=` | Kiểm tra link còn hiệu lực, **không tiêu token**; 200 → `{email, role}`, 400 → link sai/hết hạn/tài khoản đã khóa. Link Admin phải thêm `portal=admin` và chỉ được phát từ khu vực quản trị. |
| POST | `/api/auth/password-reset/confirm/` | Đổi `token` + `password` lấy mật khẩu mới (public — token là bằng chứng, không cần captcha). Token dùng **một lần**, TTL 30 phút. Với Admin, body bắt buộc có `portal: "admin"`; tài khoản không active bị từ chối. Trả `{detail, role}` để frontend điều hướng về đúng cổng đăng nhập. Throttle riêng 10/phút (`password_reset_confirm`) |
| GET | `/api/auth/password/` | Điều kiện đặt/đổi mật khẩu của **phiên hiện tại**: `{has_usable_password, requires_reauth, reauth_provider, reauth_max_age_seconds}`. Client gọi trước khi hiển thị form để cảnh báo sớm, thay vì để người dùng điền xong rồi mới nhận 403. `reauth_provider` chỉ có giá trị khi `requires_reauth` = true; `null` nghĩa là tài khoản không có provider nào để xác thực lại (phải dùng luồng quên mật khẩu). |
| POST | `/api/auth/password/` | Đổi mật khẩu khi đã đăng nhập. Tài khoản thường gửi `current_password`; tài khoản OAuth chưa có mật khẩu đặt lần đầu chỉ với `password`. Có thể gửi `logout_all_sessions` để thu hồi các phiên khác; response xoay token của phiên hiện tại. Cả GET lẫn POST đều yêu cầu access token và refresh cookie trỏ về **cùng một phiên** (`sid`), và phiên OAuth quá cũ trả `403 {code: "reauth_required", reauth_provider}` để client mở luồng xác thực lại tại chỗ. |
| POST | `/api/auth/avatar/` | Upload avatar vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`; DB lưu storage key) |
| GET | `/api/auth/oauth/{provider}/start/?portal=main\|employer&next=/...` | Bắt đầu social login (`provider` = google/facebook/linkedin), redirect sang provider. Cổng `employer` chỉ chấp nhận google |
| GET | `/api/auth/oauth/{provider}/callback/` | Provider gọi lại; verify state, tạo/liên kết user, redirect về trang callback frontend kèm `one_time_code` (hoặc `?error=`) |
| POST | `/api/auth/oauth/complete/` | Đổi `one_time_code` (1 lần dùng, TTL 60s) lấy `{user, access, refresh}` |
| GET/PATCH | `/api/candidate/profile/` | Đọc/cập nhật `gender` cho onboarding và cài đặt gợi ý việc làm (tự tạo profile legacy khi cần) |
| GET/PUT | `/api/candidate/job-preferences/` | Candidate: đọc/lưu nhu cầu việc làm chuẩn hóa. PUT yêu cầu 1–5 `desired_specialization_ids`, ít nhất một `preferred_province_ids`, `experience_level` và `desired_salary_vnd` > 0; đồng thời lưu hai quyết định consent. |
| GET/PATCH | `/api/candidate/email-notification-settings/` | Đọc/cập nhật từng phần 12 preference email candidate. GET chưa có row trả defaults bật mà không ghi DB; PATCH partial tạo khi ghi lần đầu. Email xác thực/reset mật khẩu/2FA là email giao dịch, không thuộc contract hay UI preference. |
| GET/PATCH | `/api/candidate/recruiter-visibility/` | Đọc/bật-tắt consent để NTD tìm thấy hồ sơ; bật yêu cầu xác nhận và mọi quyết định được audit. |
| GET/PATCH | `/api/employer/me/` | Hồ sơ nhà tuyển dụng của tôi + canonical `job_workspace_ready`, `verification_approved`, `candidate_data_access`, `dpa_status`, `blockers[]`, `account_verification` (Cấp 0–3/quota) và `badge_eligibility` (năm tiêu chí dấu tick tách biệt; chỉ self mới thấy failure/action). Chỉ `position_title` sửa được. |
| POST | `/api/admin/accounts/{public_id}/company-unlink-impact/` | Admin permission riêng xem tác động gỡ company chọn nhầm; reason bắt buộc, chỉ trả signed token khi relation clean |
| POST | `/api/admin/accounts/{public_id}/unlink-company/` | Confirm bằng exact reason + impact token; stale trả 409, relation đã có dữ liệu bị khóa, company/history không bị xóa |
| POST | `/api/employer/register/` | Đăng ký employer, tạo atomically user/recruiter/consent, trả JWT và gửi email xác thực. **Không tự tạo hoặc liên kết company**; company chỉ có sau thao tác rõ ràng ở settings |
| POST | `/api/employer/onboarding/registration/` | Hoàn thiện profile bắt buộc cho employer mới qua Google |
| GET/POST | `/api/employer/consulting-need/` | Đọc hoặc tạo **một lần** nhu cầu tuyển dụng ưu tiên; POST lặp lại trả `400` |
| GET/POST | `/api/employer/campaigns/` | Danh sách/tạo chiến dịch của chính recruiter. Cả read workspace và mutation yêu cầu `job_workspace_ready=true`; POST chỉ nhận `name`. Filter gồm `status`, `q`, `scope=open|needs_review|active_jobs|pending_jobs|expired_jobs`. |
| GET/PATCH | `/api/employer/campaigns/{public_id}/` | Xem/sửa chiến dịch do chính recruiter sở hữu và workspace đang ready. |
| GET | `/api/employer/campaigns/options/` | `suggestions/` | Option để gắn tin (trừ chiến dịch hoàn tất/hủy) và nhu cầu tuyển dụng chưa chuyển thành chiến dịch. |
| POST | `/api/employer/campaigns/from-need/{public_id}/` | Tạo và mở chiến dịch từ nhu cầu tuyển dụng của chính recruiter. |
| POST/GET | `/api/employer/campaigns/{public_id}/status/` | `report/` | Dừng/mở lại/hoàn tất/hủy theo transition hợp lệ; report trả tổng tin theo trạng thái, lượt xem, tổng/CV mới, phễu và hồ sơ 7 ngày. |
| GET | `/api/employer/campaigns/{public_id}/activities/` | Activity owner-only. Event application chỉ trả candidate actor/name/deep-link khi `candidate_data_access=true`; nếu chỉ workspace-ready thì metadata được allowlist/redact. |
| POST/GET | `/api/uploads/sessions/` · `/api/uploads/sessions/{public_id}/` | Tạo và poll upload session owner-scoped. State machine `uploading → quarantined → scanning → clean\|rejected\|error\|expired`; response không lộ storage key hoặc scanner evidence. |
| POST | `/api/uploads/sessions/{public_id}/content/` · `cancel/` · `retry/` | Gửi byte vào quarantine, hủy hoặc retry bounded. Chỉ owner và purpose/role hợp lệ; chỉ `clean` có thể attach vào nghiệp vụ. |
| GET | `/api/employer/phone/check/?phone=` | Compatibility format check trả kết quả generic; không tiết lộ số đã thuộc tài khoản khác |
| POST | `/api/employer/phone/send-otp/` | Re-auth bằng mật khẩu, tạo challenge actor-bound và gửi OTP qua SMS; cooldown 60 giây, hết hạn 10 phút |
| GET | `/api/employer/phone/challenges/{public_id}/` | Poll trạng thái challenge của chính actor; không trả số điện thoại, OTP, provider ID hoặc secret |
| POST | `/api/employer/phone/verify/` | Nhận `{challenge_id,code}`; xác thực initial/change/reverify, chống replay và giới hạn 5 lần sai |
| POST | `/api/employer/dpa/accept/` | Chấp nhận exact DPA hiện hành bằng `policy_version` + `document_sha256`; stale trả 409 |
| GET | `/api/employer/company/` | Công ty của tôi (chỉ đọc — thay đổi thông tin qua update-requests) |
| POST | `/api/employer/company/create/` | Tạo hồ sơ catalogue công ty mới, không phụ thuộc trạng thái xác thực SĐT hoặc MFA; người tạo là owner và liên kết có hiệu lực ngay. Company không có verification lifecycle. Bị từ chối nếu recruiter đã tạo/chọn một công ty |
| GET | `/api/employer/company/search/?q=&page=` | Catalogue phân trang `{count,next,previous,results}`, cố định 6 bản ghi/trang. Không có `q`: công ty thật mới tạo, mới nhất trước; có `q`: tìm không dấu theo tên đăng ký / tên thương mại / MST. Không trả placeholder từ luồng đăng ký cũ |
| GET | `/api/employer/company/catalogs/` | Source-of-truth cho `business_types`, `company_sizes`, `markets`, `target_customers` của form công ty |
| POST | `/api/employer/company/join/` | Liên kết ngay với công ty có sẵn, không phụ thuộc trạng thái xác thực SĐT hay admin duyệt: multipart chỉ cần `company`; membership có hiệu lực ngay. API vẫn nhận tùy chọn `proof_type` (`business_registration` hoặc `authorization_and_id`) và file giấy tờ khi cần bổ sung hồ sơ. Bị từ chối nếu recruiter đã tạo/chọn một công ty |
| GET/POST | `/api/employer/company/domain-claims/` | Liệt kê claim của company hiện tại hoặc tạo DNS TXT challenge cho exact domain được suy từ mailbox hiện tại đã xác thực. Plaintext TXT value chỉ có trong response tạo; list không trả lại secret. Pending không giữ chỗ domain toàn cục. |
| POST | `/api/employer/company/domain-claims/{public_id}/verify/` | Kiểm tra DNS TXT có timeout; đúng challenge thì chuyển `verified`, xung đột active company khác trả 409. Không gọi DNS trong API job/list. |
| POST | `/api/employer/company/domain-claims/{public_id}/rotate/` | Nhận `lock_version`, vô hiệu challenge cũ và trả TXT value mới đúng một lần; stale/email-domain đổi bị từ chối. |
| POST | `/api/employer/company/domain-claims/{public_id}/request-manual-review/` | Nhận `lock_version` + `reason`, xóa challenge và đưa claim vào hàng chờ admin fallback có audit. |
| POST | `/api/employer/company/logo/` \| `cover/` \| `images/` | Gắn logo/cover/ảnh giới thiệu từ `upload_session` clean purpose `employer_company_update`; backend tạo public derivative JPG/PNG/WebP tối đa 5 MB và giữ private-original audit link. Raw `file` chỉ còn trong compatibility window; strict mode trả `UPLOAD_SESSION_REQUIRED`. Gallery tối đa 10 ảnh; ảnh lớn được thu về trong 2400×1600, không ép tỉ lệ. |
| DELETE | `/api/employer/company/logo/` \| `cover/` | Xóa logo/cover (owner); xóa logo đồng thời đặt `has_no_logo=true` |
| DELETE | `/api/employer/company/images/{id}/` | Xóa ảnh giới thiệu (owner) |
| GET/POST | `/api/employer/company/documents/` | Giấy tờ công ty; contract chuẩn POST `doc_type` + `upload_session`, có thể kèm `update_request` của chính actor. Purpose là `employer_verification` hoặc `employer_company_update` theo workflow; backend recheck owner/clean/one-time claim và structural validation. Metadata private tiếp tục redacted theo quyền. `trade_name_proof` có thể dùng `source_type=website` + `website_url`; ĐKDN/ủy quyền/định danh nhận JPG/PNG/PDF, `candidate_dpa` nhận PDF/DOCX. Raw `file` chỉ còn compatibility window. |
| POST | `/api/employer/company/documents/preview/` | Luôn trả `409 UPLOAD_SCAN_REQUIRED`; không parse/convert raw Office file trước malware scan. |
| GET | `/api/employer/company/documents/{id}/content/` | Mở private binary sau object-level authorization. Uploader/requester và company owner được phép; member khác, outsider hoặc URL website trả `404`. Response dùng `Cache-Control: private, no-store` và không phát storage key/signed URL trước authorization |
| GET/POST | `/api/employer/company/update-requests/?scope=mine\|company` | Mọi employer đã liên kết công ty có thể tạo yêu cầu riêng, tối đa một active request trên mỗi `(company, requester)`; nhiều member được gửi song song. Recruiter UI chỉ gọi `scope=mine`, không hiển thị lịch sử công ty. Response có `current_revision_public_id`, `allowed_actions`, `submitted_at`, base/lock version; mỗi submit/resubmit tạo revision bất biến. `in_review` read-only; diff rỗng bị từ chối và field không sửa không được tự thêm vào `changes`. |
| POST | `/api/employer/company/update-requests/{public_id}/{withdraw\|cancel}/` | Rút/hủy trước review bằng `lock_version`; requester được withdraw, company owner được cancel. Backend ghi append-only event và recheck quyền/status dưới lock. |
| GET/POST | `/api/admin/company-update-requests/{public_id}/` · `start-review/` · `review/` | Admin mở exact request, nhận review bằng exact revision/lock rồi mới ra quyết định cuối `approved\|changes_requested\|rejected`. Duyệt từng document không tự quyết định toàn request. Apply so conflict theo field và không partial apply. |
| GET/POST | `/api/admin/company-domain-claims/` · `{public_id}/manual-review-impact/` · `approve-manual/` · `reject-manual/` · `revoke-impact/` · `revoke/` | Hàng chờ domain dùng permission `employer_domain.view/review/revoke`. Mọi quyết định ghi reason, preview signed impact token, recheck stale dưới lock và append audit; manual proof hết hạn sau 12 tháng. |
| GET | `/api/employer/industries/all/` | Toàn bộ lĩnh vực cho dropdown tạo hồ sơ công ty |
| GET | `/api/dashboard/employer/` | Read-model dashboard employer: account/verification, KPI tổng hợp, activity 7 ngày, nhu cầu và tin gần đây. `recent_applications` chỉ có khi `candidate_data_access=true`. |
| GET | `/api/employer/notifications/?page=` | Danh sách thông báo website của employer hiện tại, mới nhất trước; có `is_read`, internal `action_path` và metadata đã redact. |
| GET | `/api/employer/notifications/unread-count/` | Số thông báo chưa đọc của employer hiện tại. |
| GET/PATCH | `/api/employer/notification-preferences/` | Email quyết định xác thực quan trọng luôn bật; employer chỉ cấu hình email cập nhật từng giấy tờ. |
| POST | `/api/employer/notifications/{public_id}/read/`, `/api/employer/notifications/read-all/` | Đánh dấu một hoặc toàn bộ notification của chính actor; resource actor khác trả `404`. |
| GET | `/api/employer/activities/?page=` | Activity business/security đã redact, retention 730 ngày. |
| GET | `/api/locations/?level=&parent=&search=` | Tra cứu địa điểm (cascading tỉnh -> xã/phường), public — không phân trang (trả tối đa 500 bản ghi/lần) |
| GET | `/api/jobs/categories/` | Danh sách ngành nghề (taxonomy 3 cấp: nhóm nghề/nghề/vị trí chuyên môn), public, có phân trang mặc định |
| GET | `/api/jobs/benefits/` | Danh mục quyền lợi chuẩn hóa (đang active), public, không phân trang |
| GET | `/api/jobs/languages/` | Danh mục ngoại ngữ (đang active), public, không phân trang |
| GET | `/api/jobs/stats/` | Thống kê thị trường việc làm cho dashboard trang chủ (số job/công ty, job mới 24h, tăng trưởng 7 ngày, nhu cầu theo ngành, job mới nhất), public |
| GET | `/api/jobs/best/?rotation_seed=&page=&page_size=` | Box Việc làm tốt nhất trang chủ: chỉ tin public có quyền lợi `best_jobs_eligible`/legacy TOP, luân phiên ổn định theo seed riêng và không kế thừa ranking/refresh của danh sách việc làm |
| GET | `/api/jobs/recommendations/for-me/?page=&page_size=` | Candidate-only: feed preference-first có phân trang, CV active bổ sung, trạng thái setup/consent, nguồn dữ liệu và lý do/điểm khớp. Loại job đã ứng tuyển và CV archived/failed; không dùng search activity trong phiên bản hiện tại. |
| GET | `/api/jobs/recommendations/by-cv/{cv_public_id}/` | Candidate owner-only: tối đa 6 việc làm giải thích được cho CV vừa lưu; yêu cầu consent gợi ý trước khi đọc nội dung CV, thiếu consent trả `403` và client hiển thị CTA tới cài đặt. |
| GET | `/api/jobs/recommendations/by-saved/?limit=` | Candidate-only: so pairwise tối đa 20 tin lưu gần nhất, trả similarity score/details/reasons, loại tin đã lưu/đã ứng tuyển/không còn public; fallback tin active mới nhất khi chưa có tín hiệu. `limit` từ 1–20, mặc định 12. |
| GET | `/api/cv-templates/` | **Legacy V1** public catalogue; chuyển sang `/api/v2/cv-templates/` |
| GET | `/api/cv-templates/{slug}/` | **Legacy V1** template detail; chuyển sang `/api/v2/cv-templates/{slug}/` |
| GET/POST | `/api/cvs/` | **Legacy V1** candidate CV; không dùng cho client mới |
| GET/PUT/PATCH/DELETE | `/api/cvs/{public_id}/` | **Legacy V1** CV detail; chuyển sang V2 metadata/draft endpoints |
| POST | `/api/cvs/upload/` | **Legacy V1** upload; chuyển sang `/api/v2/cvs/imports/` |
| GET | `/api/v2/cv-templates/?locale=&category=&tag=&page=` | Public catalogue V2. Card DTO gồm localization, category/tag và `colors[]`; không lộ layout/style JSON hoặc renderer config. |
| GET | `/api/v2/cv-templates/{slug}/` | Public template detail V2: card fields + preview metadata, renderer contract an toàn và section list. |
| GET | `/api/v2/cv-templates/{slug}/related/` | Template published liên quan theo category, cùng locale. |
| GET | `/api/v2/cv-categories/?type=` | Taxonomy template active (`style`, `feature`, `position`, `audience`). |
| GET | `/api/v2/cv-position-options/?locale=&experience_level=&q=` | Vị trí chuyên môn active có localization và content resolve được; response gồm `public_id`, `display_name`, `name_vi`, có ordering quản trị được. |
| GET | `/api/v2/cv-position-preview/?position_public_id=&locale=&experience_level=&template_public_id=&theme_color=` | Resolve curated→blueprint; khi có template trả thêm canonical `document`, `renderer`, `revision`. `source=blank` compose document trống. Contract content-only cũ vẫn hoạt động nếu thiếu template. |
| GET | `/api/site/locales/` | Danh sách locale active theo `sort_order`; public, không phân trang. |
| GET/POST | `/api/site/admin/locales/` | Admin list/create locale. `code` bất biến sau khi tạo; đổi default demote default cũ trong transaction. |
| GET/PATCH/PUT | `/api/site/admin/locales/{code}/` | Admin đọc/cập nhật locale; không có DELETE. Locale default không thể inactive. |

`locale` trên catalogue/position preview và `language` khi tạo CV phải thuộc
registry active. API tiếp tục nhận/trả locale code để giữ tương thích; FK
`locale_ref` là chi tiết migration nội bộ, không làm đổi public payload.

### Contract phân quyền admin G1

`GET /api/auth/me/` trả thêm `admin_access` với admin và `null` với
candidate/employer:

```json
{
  "is_superuser": false,
  "permissions": ["job_moderation.approve", "job_moderation.view"],
  "primary_department": {
    "code": "job-moderation",
    "name": "Kiểm duyệt tin tuyển dụng"
  },
  "memberships": [
    {
      "department": {
        "code": "job-moderation",
        "name": "Kiểm duyệt tin tuyển dụng"
      },
      "role": {"code": "staff", "name": "Nhân viên", "rank": 10}
    }
  ]
}
```

`primary_department` có thể `null`. Permission luôn sort theo code. Khi thiếu
quyền, endpoint RBAC trả:

```json
{
  "code": "admin_permission_denied",
  "message": "Bạn không có quyền thực hiện hành động này."
}
```

| Bề mặt admin | Trạng thái G1 |
| --- | --- |
| Site locale/settings/upload | `HasAdminPermission`, luôn `require_superuser` |
| Service category/package | `service_catalog.view/manage` |
| Consultation lead | `consultation_lead.view/manage` |
| CV catalogue | `cv_template.view/create/edit/publish/archive/delete` theo action |
| Job moderation | `.view` ở cửa vào, `.approve/.reject` sau khi serializer hợp lệ |
| `/api/dashboard/` | Vẫn `IsAdmin`, chuyển ở G2 |
| Blog admin upload | Vẫn legacy `CanEditBlog` + Django Groups, chuyển ở G2 |

Các field lifecycle CV được bảo vệ riêng để quyền `.edit` không thể phát hành
qua PATCH: `CvTemplate.status/lifecycle_status/current_published_version`,
`is_active` của localization/category/color/background/blueprint và
`CvSampleContent.status/published_at`. Staff tạo template ở `inactive`; các tài
nguyên `is_active` mặc định `false`; sample/version tiếp tục ở `draft`. Chuyển
ẩn → hiện cần `.publish`, hiện → ẩn cần `.archive`; gửi lại giá trị không đổi
không bị chặn.

### API quản lý tài khoản G3

Base quản trị: `/api/admin/`; public accept: `/api/auth/admin-invitations/`.

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/accounts/`, `/accounts/summary/`, `/accounts/{id}/` | Danh sách, KPI và chi tiết theo permission đọc |
| PATCH | `/accounts/{id}/` | Sửa họ tên/SĐT; Admin active vẫn superuser-only |
| GET | `/accounts/{id}/sessions/`, `/activity/` | Phiên và audit liên quan |
| POST | `/accounts/{id}/status-impact/`, `/change-status/` | Preview/xác nhận state machine tạm khóa, cấm, bắt đầu khôi phục hoặc mở lại; payload cấm cần `violation_category` và `enforcement_evidence` |
| POST | `/accounts/{id}/resource-hold-impact/`, `/release-resource-holds/` | Superuser preview/xác nhận gỡ `ban_review`/`legacy_lock`; account vẫn inactive |
| POST | `/accounts/{id}/revoke-sessions-impact/`, `/revoke-sessions/` | Preview/xác nhận thu hồi phiên |
| POST | `/accounts/{id}/send-password-reset/`, `/resend-verification/` | Xếp lịch email bảo mật. Admin nhận template/link cổng Admin; không gửi reset cho tài khoản `inactive`/`banned`. |
| GET/POST | `/account-invitations/` | Danh sách theo scope người mời / tạo lời mời |
| GET | `/account-invitations/available-roles/` | Chức danh backend đã lọc theo whitelist |
| PATCH | `/account-invitations/{id}/` | Đổi chức danh trước khi accept |
| POST | `/account-invitations/{id}/resend/`, `/revoke/` | Làm token cũ mất hiệu lực / thu hồi |
| GET/POST | `/provisioning-scopes/` | Đọc/tạo whitelist; ghi superuser-only |
| POST | `/provisioning-scopes/{id}/status-impact/`, `/activate/`, `/deactivate/` | Impact token và xác nhận trạng thái scope |
| GET | `/api/auth/admin-invitations/validate/?token=...` | Kiểm tra link mời công khai |
| POST | `/api/auth/admin-invitations/accept/` | Đặt mật khẩu, bật MFA email, trả mã dự phòng một lần |

Filter tài khoản gồm `q`, `role`, `status`, `email_verified`, `mfa`,
`has_active_session`, `department`, `admin_role`, `company`, khoảng ngày tạo,
khoảng lần đăng nhập và `ordering`. Lời mời hỗ trợ `q`, `status`, `department`,
`role`; superuser có thêm `invited_by`.

Các POST xác nhận impact bắt buộc gửi lại `impact_token` từ preview. Token stale
trả `409 admin_resource_changed`. Role ngoài whitelist và thao tác vượt scope
trả `403 admin_permission_denied`; validation field thông thường trả `400`.

Contract trạng thái tài khoản:

- `status-impact` nhận `status`, `reason`, `enforcement_evidence` và
  `violation_category`. Evidence và nhóm vi phạm bắt buộc khi đích là
  `banned`; evidence cũng bắt buộc khi bắt đầu khôi phục từ `banned`.
- Transition hợp lệ: `active → inactive|banned`,
  `inactive → active|banned`, `banned → inactive`. Không có
  `banned → active`.
- Response preview trả `transition_kind`, `active_session_count`, `effects`,
  `requires_manual_resource_review`, `blocked_reasons`, `can_apply` và
  `impact_token`. Client chỉ được bật confirm khi `can_apply=true`.
- `change-status` nhận lại chính payload preview cộng `impact_token`. Confirm
  trả `ManagedAccountDetail`; backend khóa account/session/campaign/job trước
  khi xác nhận snapshot.
- `resource-hold-impact` và `release-resource-holds` nhận `reason`,
  `enforcement_evidence` (20–500 ký tự); chỉ superuser, chỉ áp dụng cho employer
  `inactive` có `ban_review`/`legacy_lock`. Thao tác không đổi status nghiệp vụ
  và không tự mở account.
- Thiếu permission trả `403`; account `PENDING` hoặc transition sai trả `400`;
  soft-deleted fail-closed thành `404`; input/snapshot/global audit revision
  đổi giữa preview và confirm trả `409`. Client phải tải preview mới nhưng
  không tự gửi confirm lại.

### API quản trị phân quyền G2

Base path: `/api/admin/`. Cột “SU” nghĩa là endpoint bắt buộc
`is_superuser=True`, kể cả khi tài khoản có permission tương ứng.

| Method | Endpoint | Permission | SU |
| --- | --- | --- | :---: |
| GET | `/departments/`, `/departments/{public_id}/` | `admin_access.view` | |
| POST/PATCH | `/departments/`, `/departments/{public_id}/` | `admin_access.manage_department` | ✓ |
| POST | `/departments/{id}/status-impact/`, `activate/`, `deactivate/` | `admin_access.manage_department` | ✓ |
| GET/POST | `/departments/{id}/restore-system-default/` | `admin_access.manage_department` | ✓ |
| GET | `/roles/?department={code}`, `/roles/{public_id}/` | `admin_access.view` | |
| POST/PATCH | `/roles/`, `/roles/{public_id}/` | `admin_access.manage_role` | ✓ |
| POST | `/roles/{id}/status-impact/`, `activate/`, `deactivate/` | `admin_access.manage_role` | ✓ |
| POST/PUT | `/roles/{id}/permissions-impact/`, `/roles/{id}/permissions/` | `admin_access.manage_role` | ✓ |
| GET/POST | `/roles/{id}/restore-system-default/` | `admin_access.manage_role` | ✓ |
| GET | `/permissions/?role={role_public_id}` | `admin_access.view` | |
| GET | `/memberships/?department=&user=&include_revoked=` | `admin_access.view` | ✓ |
| POST | `/memberships/assignment-impact/`, `/memberships/` | `admin_access.manage_staff` | ✓ |
| GET/POST | `/memberships/{id}/revoke-impact/`, `revoke/` | `admin_access.manage_staff` | ✓ |
| GET | `/staff/?q={email}` | `admin_access.view` | ✓ |

Mỗi nhân viên chỉ có **một membership đang hiệu lực**. `POST /memberships/`
thay chức danh hiện tại trong cùng transaction: membership cũ được thu hồi, quyền
hiệu dụng được cache-bust và audit ghi lại cả trước/sau. Preview assignment trả
`permissions_gained`, `permissions_lost` và `replaced_membership`; client không
tự tính diff. Không còn endpoint hay payload `set-primary` / `is_primary`.

Action xác nhận nhận `impact_token` từ preview tương ứng. Token chỉ dùng đúng
operation/resource/payload đã xem và hết hạn sau 600 giây. Operation hợp lệ:

```text
department.status.change · department.restore
role.status.change · role.permissions.update · role.restore
membership.assign · membership.revoke
```

Thiếu quyền trả `403 admin_permission_denied`. Preview stale, đổi payload, dùng
token sai resource/operation hoặc có audit mới xen giữa trả:

```json
{
  "code": "admin_resource_changed",
  "message": "Dữ liệu đã thay đổi. Vui lòng xem lại tác động trước khi tiếp tục."
}
```

Permission picker chỉ đọc `/permissions/?role=...`; JSON generated là contract
build-time. Permission deprecated đang được role giữ vẫn xuất hiện với
`is_active=false`, `is_granted_to_role=true` và không được gửi trong
`permission_codes` active.

### Admin job moderation — employer approval safety

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET | `/api/jobs/admin/moderation/{public_id}/` | Trả `review_token`, `state_actions`, `approve_blockers`, `approve_requirements`; eligibility do backend tính |
| POST | `/api/jobs/admin/moderation/{public_id}/decisions/` | Canonical approve/reject/hide/restore; approve recompute account, campaign, verification và DPA trong transaction |
| POST | `/api/jobs/admin/moderation/{public_id}/review/` | Endpoint compatibility; vẫn bắt buộc cùng backend approval guard |

Approve bị từ chối với HTTP 400 và payload máy đọc được:

```json
{
  "code": "JOB_APPROVAL_BLOCKED",
  "detail": "Không thể duyệt tin.",
  "blocked_reasons": [
    {"code": "verification_required", "label": "Nhà tuyển dụng chưa được duyệt xác thực."},
    {"code": "dpa_outdated", "label": "Nhà tuyển dụng chưa có chấp thuận DPA còn hiệu lực."}
  ]
}
```

Client không được gửi hoặc tự suy eligibility. `review_token` chỉ khóa revision
của job; backend vẫn đọc lại policy state ngay trước khi chuyển sang `active`.

### Admin employer verification — final decision và lifecycle

| Method | Endpoint | Contract |
| --- | --- | --- |
| POST | `/api/admin/employer-verifications/{public_id}/decision-impact/` | Preview final decision, tax/company/capability/hold impact; không ghi dữ liệu |
| POST | `/api/admin/employer-verifications/{public_id}/decision/` | Confirm bằng `impact_token`; stale trả `409 admin_resource_changed` |
| POST | `/api/admin/employer-verifications/{public_id}/revoke-impact/`, `/revoke/` | Preview/xác nhận thu hồi và áp verification hold |
| POST | `/api/admin/employer-verifications/{public_id}/expire-impact/`, `/expire/` | Preview/xác nhận hết hiệu lực manual |
| POST | `/api/admin/employer-verifications/{public_id}/unlock-resubmission/` | Mở khóa ngoại lệ sau ba final rejection; body `{reason, lock_version}`, giữ nguyên rejection count/history |

`decision` yêu cầu `employer_verification.review`; revoke/expire yêu cầu
`employer_verification.revoke`. Approve với tax advisory không matched cần thêm
`employer_verification.tax_override` và `tax_override_reason`. Hai quyền rủi ro
cao không được grant mặc định cho manager/staff; Super Admin có bypass hiện hữu,
Compliance Lead phải được gán tường minh qua RBAC.

Document review không phải final decision. Revoke/expire không downgrade
company; compliance hold chỉ chặn candidate-data/job approval và public job,
không khóa workspace hoặc tạo/sửa/gửi tin. Reapprove chỉ gỡ exact verification
hold, không gỡ hold thuộc DPA/account/moderation.

List/detail verification trả `final_rejection_count`, `rejection_limit`,
`resubmission_locked`, `resubmission_locked_at`; preview decision trả thêm
`rejection_impact`. Chỉ final `rejected` tăng count. Document reject/yêu cầu bổ
sung không tính lượt; sau khi recruiter thay đủ bộ giấy tờ cần sửa, cùng case
được resubmit với `revision++`. Lần final reject thứ ba khóa nộp lại nhưng không
tự ban `User`. Endpoint unlock yêu cầu permission
`employer_verification.resubmission_unlock`, reason và optimistic lock; stale
trả `409 admin_resource_changed`.

### CV catalogue admin (admin-only)

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| CRUD | `/api/v2/admin/cv-templates/` | Metadata template và danh sách version/localization. |
| POST | `/api/v2/admin/cv-templates/{public_id}/versions/` | Tạo draft version; body rỗng clone contract published hiện tại. |
| POST | `/api/v2/admin/cv-templates/{public_id}/versions/{id}/publish/` | Validate và publish immutable template version. |
| POST | `/api/v2/admin/cv-templates/{public_id}/versions/{id}/retire/` | Retire version không còn là current pointer. |
| POST | `/api/v2/admin/cv-templates/{public_id}/snapshots/regenerate/` | Queue snapshot cho mọi màu của template. |
| CRUD | `/api/v2/admin/cv-template-localizations/` | Localization của template. |
| CRUD | `/api/v2/admin/cv-categories/` | Taxonomy catalogue. |
| CRUD | `/api/v2/admin/cv-colors/` | Registry màu. |
| CRUD | `/api/v2/admin/cv-sample-contents/` | Nội dung canonical draft. |
| POST | `/api/v2/admin/cv-sample-contents/{public_id}/preview/` | Preview bằng canonical composer. |
| POST | `/api/v2/admin/cv-sample-contents/{public_id}/publish\|archive/` | Lifecycle curated content. |
| CRUD | `/api/v2/admin/cv-content-blueprints/` | Blueprint canonical/compatibility fields. |
| POST | `/api/v2/admin/cv-content-blueprints/{public_id}/preview\|activate/` | Preview/activate blueprint. |

Các action sinh snapshot trả `202 queued`; asset không được tạo trong request
web. Public card chỉ thấy storage URL mới sau khi worker đã render và swap đủ
thumbnail + preview.

### AI CV import

`POST /api/v2/cvs/imports/` multipart giữ `title`, `template_public_id`,
`language`, `theme_color`; client mới gửi `upload_session` purpose
`candidate_cv` đã clean thay vì raw `file`. Khi có template, client nên gửi
`Idempotency-Key`; response `202` chứa `processing_status=queued` và
`import_job`. Gửi lại cùng key/user trả cùng CV với `200`, không tạo job/file mới.
Raw `file` chỉ còn trong compatibility window và trả
`409 UPLOAD_SESSION_REQUIRED` khi strict flag được bật. Backend claim session
trước khi parser PDF/DOCX; avatar `/api/v2/cvs/assets/` cũng chỉ decode/re-encode
sau clean verdict.

`GET /api/v2/cvs/{public_id}/` dùng để poll: `queued|processing|analyzed|failed`.
Khi failed, `import_job.failure_code` chỉ là mã an toàn, không chứa raw text.
`POST /api/v2/cvs/{public_id}/imports/retry/` trả `202`, owner-only và chỉ dùng
cho job failed chưa vượt ba attempt. Bucket throttle là `cv_import=10/hour`.

V1 chỉ nhận `.pdf/.docx`, 5 MB, PDF tối đa 20 trang. `scanned_pdf_ocr_unavailable`
nghĩa là PDF scan chưa có text layer; OCR không được giả lập trong release này.

### AI tạo tin tuyển dụng

Mọi endpoint generation yêu cầu employer và owner-scope. Create dùng burst
`3/min`, quota mặc định 10 generation mới/ngày/NTD; replay cùng idempotency key
và cùng payload không trừ lượt. Retry provider bên trong cùng generation tối đa
hai lần gọi và không tạo quota mới.

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/api/jobs/mine/ai-generations/` | Tạo generation bất đồng bộ; trả `202 {public_id,status,phase,quota_remaining}`. |
| GET | `/api/jobs/mine/ai-generations/{public_id}/` | Poll trạng thái/phase, suggestion đã resolve, warning, field thủ công và quota còn lại. |
| POST | `/api/jobs/mine/ai-generations/{public_id}/cancel/` | Hủy queued/processing; terminal call là idempotent. |
| POST | `/api/jobs/mine/ai-generations/{public_id}/feedback/` | Đánh giá kết quả completed bằng `helpful\|not_helpful` và optional reason enum. |
| GET | `/api/ai/admin/overview/?days=30` | Superuser-only: hard/soft switch, provider/model, queue, success/error/P95/token/cost/quota và apply rate 7/30 ngày; không trả prompt, input/result hoặc allowlist ID. |

Brief request:

```json
{
  "mode": "ai_brief",
  "idempotency_key": "client-generated-uuid",
  "locale": "vi-VN",
  "brief": {
    "position": "Kỹ sư Backend Python",
    "responsibilities": ["Xây dựng API tuyển dụng"],
    "requirements": ["Có kinh nghiệm Django"],
    "preferred_skills": ["Google Cloud"],
    "notes": "Văn phong rõ ràng"
  }
}
```

JD request dùng `mode=jd_text`, bỏ `brief` và gửi `source_text` tối đa 20.000
ký tự. Backend loại email, số điện thoại, URL/contact handle và xem toàn bộ input
là dữ liệu không tin cậy trước khi gọi provider.

Status completed chỉ trả field AI được phép trong `suggestion`; lương, địa điểm,
lịch, deadline, số lượng, campaign, thông tin nhận hồ sơ, auto-reject, tuổi và
giới tính luôn nằm ngoài suggestion. `POST /api/jobs/mine/?as=draft` có thể nhận
write-only `ai_generation_public_id`; backend chỉ ghi provenance sau khi kiểm tra
owner, company, trạng thái completed và không cho dùng lại cho tin khác.

Mã lỗi ổn định gồm `JOB_AI_DAILY_QUOTA_EXCEEDED` (429),
`JOB_AI_IDEMPOTENCY_CONFLICT` (409), generation unavailable (503), validation
400 và owner mismatch 404. Provider message/raw content không được trả cho client.

| GET | `/api/v2/cv-sample-contents/?locale=&experience_level=` | Compatibility catalogue cho client cũ; frontend mới không dùng endpoint này làm nguồn dropdown. |
| GET | `/api/v2/cv-sample-contents/{public_id}/` | Compatibility detail cho client cũ dùng `sample_content_public_id`. |
| GET/POST | `/api/v2/cvs/` | Candidate lifecycle V2. POST nhận template, language, optional sample/position/`source_cv_public_id` và optional màu; các source loại trừ nhau. |
| GET | `/api/v2/cvs/latest-recoverable-draft/` | Trả đúng một server draft dirty mới nhất của candidate hoặc `204`; dirty xác định bằng document hash so với base version. |
| GET/PATCH/DELETE | `/api/v2/cvs/{public_id}/` | Candidate metadata/detail: PATCH chỉ nhận `title`, `is_default`; DELETE xóa vĩnh viễn CV và library artifacts. Snapshot của application đã nộp được giữ detached cho recruiter. |
| POST | `/api/v2/cvs/imports/` | Candidate import PDF/DOCX (`multipart upload_session`, optional `title`/template fields). Response không có storage key/URL; raw `file` chỉ compatibility. |
| POST | `/api/v2/cvs/{public_id}/duplicate/` | Clone builder CV từ latest immutable version thành CV/draft/version độc lập. Optional `title`; không hỗ trợ uploaded CV để tránh dùng chung file storage. |
| GET/PUT | `/api/v2/cvs/{public_id}/draft/` | Đọc/autosave canonical draft; PUT bắt buộc `If-Match: "lock-version-N"`. |
| PUT | `/api/v2/cvs/{public_id}/template/` | Đổi template của mutable draft, giữ canonical content và optimistic lock. |
| GET | `/api/v2/cvs/{public_id}/template-preview/?template_public_id=` | Project draft owner lên template mới để preview, không mutation aggregate. |
| POST | `/api/v2/cvs/{public_id}/save-version/` | Tạo immutable manual version từ draft hợp lệ. |
| POST | `/api/v2/cvs/{public_id}/publish/` | Tạo immutable published version. |
| GET | `/api/v2/cvs/{public_id}/versions/` | History version của owner. |
| GET | `/api/v2/cvs/{public_id}/view/` | Owner read-only view từ immutable version, không đọc draft. |
| GET/POST | `/api/v2/cvs/{public_id}/shared-links/` | Quản lý bearer share link theo owner/version. |
| GET/POST | `/api/v2/cvs/{public_id}/exports/` | Danh sách/yêu cầu PDF export từ immutable version. |
| GET | `/api/jobs/?category=&location=&work_type=&employment_type=&experience_level=&search=` | Danh sách job đang active, public. `category`/`location` nhận **nhiều giá trị**; response là card DTO, không gồm description/requirements/benefits/deadline và dữ liệu quản trị. Boolean legacy `company_verified` thực chất là dấu tick của exact recruiter `posted_by`, được batch-evaluate với query count phẳng. Dùng `?view=preview` khi UI thực sự cần nội dung hover. |
| GET | `/api/jobs/{slug}/` | Chi tiết job, public và **chỉ đọc** (không tăng `view_count`). Trả relation tối thiểu cùng view-model nhóm sẵn: `primary_specialization`, `domain_knowledge`, `workplace_groups`, `requirement_tags` (**không còn kèm kỹ năng**), `benefit_tags`, `required_skills`, `preferred_skills`, `benefit_groups` (quyền lợi gom theo danh mục, thứ tự theo `Benefit.Category`), `language_requirements[].proficiency_label`; không trả contact nhận hồ sơ hoặc trạng thái quản trị. `company_verification` chỉ có `{verified,criteria}`: khi chưa đủ năm điều kiện, `criteria=[]` để không lộ trạng thái email/phone/pháp lý/tuổi/report; khi đủ mới trả năm nhãn passed. |
| POST | `/api/jobs/{public_id}/report/` | Candidate-only, chỉ nhận tin đang public và throttle đồng thời theo account/IP; response tối thiểu `{public_id,status,created_at}`. Chỉ admin-UPHELD thuộc `fake_company\|scam\|wrong_info` làm mất tick recruiter và tự tạo hold ẩn tin; reverse phục hồi badge nhưng không tự public lại tin. |
| POST | `/api/jobs/{slug}/views/` | Ghi nhận lượt xem riêng, chỉ khi Analytics consent hợp lệ; Redis dedupe 24 giờ, response `{counted, view_count, reason?}`. |
| GET/POST | `/api/privacy/consent/` | Đọc/lưu lựa chọn cookie ký số (`preferences`, `analytics`, `marketing`); necessary luôn bật, rút Analytics sẽ xóa viewer cookie. |
| GET/POST | `/api/jobs/mine/` | Workspace recruiter owner-only và yêu cầu `job_workspace_ready=true`. `POST ?as=draft` lưu nháp thiếu dữ liệu; POST thường validate form/quota rồi tạo `pending`. Form giữ contract nested hiện hữu. Candidate preview chỉ gắn khi `candidate_data_access=true`. |
| GET/PATCH/DELETE | `/api/jobs/mine/{public_id}/` | Chỉ người tạo và workspace-ready được đọc/sửa; chỉ xóa nháp. Cập nhật tin `active` quay lại `pending`. |
| GET | `/api/jobs/mine/posting-context/` | Endpoint compliance không bị workspace guard để luôn trả quota + `job_workspace_ready`, `candidate_data_access`, `dpa_status`, `blockers[]`, `job_postable`, `block_reason` và policy hạn hồ sơ (`default_deadline_days`, `max_deadline_days`, `max_public_lifetime_days`). |
| POST | `/api/jobs/mine/{public_id}/submit/` | Gửi nháp/tin bị từ chối để duyệt lại; cập nhật tin pending giữ hàng chờ. |
| POST | `/api/jobs/mine/{public_id}/close/`, `/reopen/`, `/extend/`, `/duplicate/` | Đóng, mở lại (trở về `pending`, body `{deadline}`), gia hạn tin active hoặc tạo nháp sao chép. |
| GET | `/api/jobs/admin/moderation/?status=pending` | **Admin**: danh sách tin để kiểm duyệt, gồm người tạo, công ty, thời điểm gửi và lý do từ chối (nếu có). |
| POST | `/api/jobs/admin/moderation/{public_id}/review/` | **Admin**: body `{"action":"approve"}` để thành `active`, hoặc `{"action":"reject","reason":"..."}`. Lý do từ chối bắt buộc và trả cho chủ tin. |
| GET/POST | `/api/v2/applications/` | Candidate application V2. POST bắt buộc `job_public_id`, `cv_public_id`, `version_public_id`; backend từ chối tin hết hạn, tạo snapshot CV bất biến và trả `candidate_status` cùng timeline đã lọc. |
| GET | `/api/v2/recruiter/applications/?job=&status=&campaign=&q=` | Hồ sơ của các tin do caller tạo; yêu cầu `candidate_data_access=true`, filter theo tin/pipeline/chiến dịch/tên-email. |
| PATCH | `/api/v2/recruiter/applications/{public_id}/` | Cập nhật pipeline/ghi chú/điểm nội bộ; owner-scope, candidate-data gate và canonical lock order được recheck trong transaction. |
| GET | `/api/v2/recruiter/applications/{public_id}/cv/` | `history/` | Snapshot CV và lịch sử pipeline owner-only, yêu cầu candidate-data access. Asset URL của recruiter mang audience/actor/application/version và tải file recheck quyền live. |
| GET | `/api/site/settings/` | Cấu hình site công khai dạng `{key: value}` (chỉ key `is_public=true`), public. **Cache 1h**, tự invalidate khi admin sửa qua API/Django admin |
| GET | `/api/site/link-groups/?placement=footer_seo` | Cụm link SEO đang bật kèm items đã resolve, public |
| GET | `/api/site/link-groups/?placement=footer_nav` | Các cột menu điều hướng footer, public |
| GET | `/api/site/banners/?placement=home_hero` | Banner đang bật theo order, public |
| GET | `/api/site/admin/settings/` | **Admin**: toàn bộ cấu hình gộp theo 15 nhóm `{groups: [{key, label, settings: [...]}]}`, mỗi setting kèm metadata (`value_type`, `options`, `order`, `is_public`, `env_configured`) để frontend tự render form |
| PATCH | `/api/site/admin/settings/` | **Admin**: bulk update, body `{"values": {key: value}}`, validate theo `value_type` (boolean/number/color hex/select choices), từ chối key kiểu `env` → `{"updated": [...], "errors": {...}}` |
| POST | `/api/site/admin/settings/upload/` | **Admin**: upload ảnh cho setting kiểu image (multipart `file` + `key`) → `{"key", "value", "url"}`; ảnh favicon tự resize về tối đa 256×256 |

### Employer readiness và mã lỗi ER-2

`blockers[]` có đúng bốn field `code`, `capabilities[]`, `message`, `action`.
Blocker code viết thường; capability ổn định là `job_workspace`,
`verification`, `candidate_data`, `job_approval`. Client không được tự suy
capability từ các checkbox onboarding.

`dpa_status` có enum
`missing|current|legacy_unversioned|outdated|grace|hold|unknown`. Timestamp cũ
không có evidence là `legacy_unversioned`; acceptance khác exact version/hash
hiện hành là `outdated`. `GET /api/employer/me/::dpa_policy` công bố policy
server; `POST /api/employer/dpa/accept/` bắt buộc gửi lại version/hash đó, stale
trả `409 DPA_POLICY_CHANGED`, thiếu cấu hình trả `503 DPA_POLICY_UNAVAILABLE`.
`dpa_grace_expires_at` là timestamp ISO-8601 nullable của cohort rollout; server
vẫn là nguồn quyết định `grace|hold`, client không tự so giờ để mở quyền.

- Job/campaign read hoặc write bị chặn trả HTTP 403,
  `code=EMPLOYER_WORKSPACE_BLOCKED`.
- Candidate list/detail/export/status/history/CV bị chặn trả HTTP 403,
  `code=CANDIDATE_DATA_BLOCKED`; resource ngoài ownership trả `404`.
- Admin approve bị chặn tiếp tục trả `JOB_APPROVAL_BLOCKED` theo moderation
  contract. `verification_required` và `dpa_outdated` là blocker code, không
  phải endpoint error code viết hoa riêng.

`candidate_data_access` là tập con nghiêm ngặt của workspace, cần verification
case approved đúng recruiter/company và DPA current; feature flag không thể bỏ
qua. Verification chưa approved/đã yêu cầu bổ sung không tự khóa job workspace
nếu các điều kiện workspace khác còn hợp lệ. Posting-context là ngoại lệ read
để UI luôn lấy được blocker/action. Aggregate count hiện hữu chưa đổi trong
ER-2 và không kèm candidate PII/deep-link; policy bỏ/giữ count chờ quyết định
riêng.

**Quy ước ảnh (media):** DB lưu **storage key** (vd `site/settings/logo.png`), không lưu URL tuyệt đối; API resolve ra URL công khai theo domain/CDN hiện tại tại thời điểm trả về. Đổi domain hoặc bật `MEDIA_PUBLIC_BASE_URL` không cần sửa dữ liệu. Chuyển dữ liệu URL cũ sang key bằng `python manage.py normalize_media_references --apply`.

## Cutover CV API: V1 → V2

Không tạo alias `/api/v1/` và không redirect HTTP các request ghi: hai hành vi đó
làm client lỗi khó chẩn đoán hoặc vô tình đổi method/body. `/api/cvs/` và
`/api/cv-templates/` là contract legacy hiện hữu; `/api/v2/cvs/` và
`/api/v2/cv-templates/` là contract chuẩn cho client mới.

Trong cửa sổ cutover, mọi response V1 có ba header: `Deprecation` (structured
date), `Sunset` và `Link` với `rel="successor-version"`. Backend phát event log
`deprecated_api_request` theo contract/method/status/authenticated; event không
ghi raw path, user-agent hoặc user ID. Ngày header được cấu hình bằng
`LEGACY_CV_API_DEPRECATION_AT` và `LEGACY_CV_API_SUNSET_AT` (ISO-8601) trong
environment. Sau khi metric V1 bằng 0 trong thời hạn vận hành đã chốt, mới có
release riêng trả `410 Gone`, rồi mới xóa view/serializer/field legacy.

## Contract CV Template V2

Một phần tử `colors` trong card/detail:

```json
{
  "public_id": "cvcolor_...",
  "name": "Xanh thương hiệu",
  "slug": "brand-green",
  "hex_code": "#00A66A",
  "thumbnail_url": "/media/cv-templates/modern/green-thumb.webp",
  "preview_url": "/media/cv-templates/modern/green-preview.webp",
  "is_default": true
}
```

`theme_color` và `color_variants` vẫn có trong response trong cửa sổ tương
thích. Client mới phải dùng `colors[]`; URL ảnh thuộc quan hệ template–color,
không suy ra từ hex hoặc hard-code trên frontend.

Position picker trả contract tối thiểu, không lộ hai cấp taxonomy trên UI:

```json
{
  "public_id": "jobcat_...",
  "name_vi": "Nhân viên CSKH"
}
```

Frontend dùng `public_id` làm value và chỉ hiển thị `name_vi`. Sau khi chọn,
frontend gọi position-preview với locale. Resolver ưu tiên curated sample; nếu
không có, nó kết hợp `JobCategoryLocalization` và `CvContentBlueprint` để tạo
`content_json` deterministic. Không fallback tên tiếng Việt vào preview locale khác.

Payload tạo CV V2:

```json
{
  "title": "CV Modern",
  "template_public_id": "tpl_...",
  "language": "vi-VN",
  "position_public_id": "jobcat_...",
  "theme_color": "#2255AA"
}
```

`position_public_id` và `theme_color` đều optional. `sample_content_public_id`
vẫn được nhận cho client cũ nhưng không được gửi cùng `position_public_id`. Nếu gửi màu không
active hoặc không được gán cho template, API trả `400 theme_color`. Màu hợp lệ
được copy vào `style_json.theme_color` của initial version và draft.

## Thông báo chạy đa cổng

> Trạng thái AN-P1: backend foundation và OpenAPI đã triển khai. Runtime UI thuộc
> AN-P2; dismiss/event/metrics thuộc AN-P4. Nguồn thiết kế canonical:
> [kế hoạch hệ thống thông báo chạy](../03-database/ke-hoach-he-thong-thong-bao-chay.md).

| Method | Endpoint | Quyền | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/site/announcements/active/` | Theo surface/session | Feed runtime đã target và xếp priority |
| `PUT` | `/api/site/announcements/{public_id}/state/` | Authenticated | Dismiss/snooze idempotent theo revision và dismissal version |
| `POST` | `/api/site/announcements/events/` | Consent + throttle | Batch analytics best-effort; luôn không chặn runtime/CTA |
| `POST` | `/api/site/announcements/runtime-events/` | AllowAny + throttle | Operational event PII-free cho feed/contract/render failure |
| `GET/POST` | `/api/site/admin/announcements/` | `announcement.view/manage` | List/create |
| `GET/PATCH` | `/api/site/admin/announcements/{public_id}/` | `announcement.view/manage` | Detail/lịch sử và đổi tên vận hành |
| `POST` | `/api/site/admin/announcements/{public_id}/revisions/` | `announcement.manage` | Tạo revision mới |
| `POST` | `/api/site/admin/announcements/{public_id}/publish/` | `announcement.publish` | Publish ngay hoặc schedule |
| `POST` | `/api/site/admin/announcements/{public_id}/pause/` | `announcement.publish` | Pause |
| `POST` | `/api/site/admin/announcements/{public_id}/resume/` | `announcement.publish` | Resume |
| `POST` | `/api/site/admin/announcements/{public_id}/archive/` | `announcement.publish` | Archive |
| `POST` | `/api/site/admin/announcements/{public_id}/reset-dismissals/` | `announcement.publish` | Tăng `dismissal_version` để hiện lại cho người đã đóng |
| `POST` | `/api/site/admin/announcements/{public_id}/duplicate/` | `announcement.manage` | Tạo draft độc lập |
| `GET` | `/api/site/admin/announcements/{public_id}/metrics/` | `announcement.view` | Summary và daily metrics toàn bộ revision, mặc định 30 ngày |

Public feed yêu cầu `surface`, chấp nhận `path` và `locale`. Role/auth state lấy
từ request. Surface/path/locale sai trả `400`; không có item trả `200` với mảng
rỗng. Response luôn có `remote_enabled`; false nghĩa kill switch đang tắt
surface và backend không query feed. Feed personalized dùng
`Cache-Control: private, no-store`.

Admin mutation lỗi validation trả `400`; thiếu quyền trả
`403 admin_permission_denied`; resource không tồn tại trả `404`; revision stale
trả `409 announcement_revision_stale`. Publish/pause/resume/archive là service
transactional, khóa hàng bằng `select_for_update()` và ghi audit. Mọi mutation
sau create gửi `revision_token`; publish gửi thêm số `revision`. Revision đã
publish không bị cập nhật tại chỗ: chỉnh nội dung luôn tạo revision mới.

## Trung tâm trợ giúp — Public, Admin và rollout (KB-P2–KB-P6)

Public API không yêu cầu đăng nhập, dùng throttle `knowledgebase_public`
120 request/phút theo IP client đã kiểm chứng và chỉ trả article active thuộc
category active có revision đang publish ở trạng thái approved.

| Method | Endpoint | Query | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/knowledgebase/categories/` | — | Category active và số bài public |
| `GET` | `/api/knowledgebase/articles/` | `category`, `type=faq\|guide`, `q`, `page`, `page_size<=60` | Browse/search bài public |
| `GET` | `/api/knowledgebase/articles/{category_slug}/{article_slug}/` | — | Revision đang publish, related/trước/sau tối đa 6 bài |

`q` dài 2–120 ký tự và search không dấu theo nhiều token. Draft, rejected,
archived, category inactive và slug không tồn tại đều trả cùng `404`; response
không lộ actor, review note, source reference, revision token hay revision chưa
publish. Public response dùng `Cache-Control: public, max-age=60,
stale-while-revalidate=300` và ETag; conditional request khớp trả `304`.
`KNOWLEDGEBASE_PUBLIC_ENABLED=false` làm public API fail-closed `404` nhưng giữ
nguyên admin/data. `GET /api/site/settings/` đồng thời trả capability boolean
`knowledgebase_public_enabled` lấy trực tiếp từ switch này để frontend ẩn/hiện
entry point. Response còn có `knowledgebase_search_index_enabled`, chỉ true khi
public và index switch backend cùng bật; cả hai không phải row site setting mà
admin có thể sửa. Admin API luôn yêu cầu tài khoản quản trị, permission cụ thể và trả
`Cache-Control: private, no-store`.

`KNOWLEDGEBASE_SEARCH_INDEX_ENABLED=false` giữ toàn bộ Help Center `noindex` và
sitemap riêng rỗng. Khi public switch, index switch và global
`seo_robots_index` cùng true, home/category/article canonical chuyển sang
`index, follow`, `/sitemaps/knowledgebase.xml` được thêm vào `/sitemap.xml`;
URL có `q`, `type` hoặc `page` vẫn noindex. Trước khi bật phải chạy
`python manage.py check_knowledgebase_readiness --json` theo runbook deployment.

Public/admin request phát metric count/latency theo endpoint, status, loại và
bucket kết quả/độ dài query. Raw query, title, body, email, source và review note
không được ghi vào metric hoặc label.

| Method | Endpoint | Quyền chính | Mục đích |
| --- | --- | --- | --- |
| `GET/POST` | `/api/knowledgebase/admin/categories/` | `view/manage` | List/tạo category |
| `GET/PATCH` | `/api/knowledgebase/admin/categories/{public_id}/` | `view/manage` | Detail/cập nhật category |
| `POST` | `/api/knowledgebase/admin/categories/reorder/` | `manage` | Sắp xếp toàn bộ category |
| `POST` | `/api/knowledgebase/admin/categories/{public_id}/activate/` | `publish` | Bật category public |
| `POST` | `/api/knowledgebase/admin/categories/{public_id}/deactivate/` | `publish` | Tắt category public |
| `GET/POST` | `/api/knowledgebase/admin/articles/` | `view/manage` | List/filter/tạo article + revision 1 |
| `GET/PATCH` | `/api/knowledgebase/admin/articles/{public_id}/` | `view/manage` | Detail/audit/cập nhật metadata |
| `POST` | `/api/knowledgebase/admin/articles/reorder/` | `manage` | Sắp xếp bài trong một category |
| `GET/POST` | `/api/knowledgebase/admin/articles/{public_id}/revisions/` | `view/manage` | Lịch sử/tạo revision mới |
| `GET/PATCH` | `/api/knowledgebase/admin/articles/{public_id}/revisions/{number}/` | `view/manage` | Xem/sửa revision nháp |
| `POST` | `.../revisions/{number}/submit/` | `manage` | Gửi duyệt |
| `POST` | `.../revisions/{number}/approve/` | `review` | Phê duyệt |
| `POST` | `.../revisions/{number}/reject/` | `review` | Từ chối, bắt buộc lý do |
| `POST` | `/api/knowledgebase/admin/articles/{public_id}/publish/` | `publish` | Publish/rollback revision approved chỉ định |
| `POST` | `/api/knowledgebase/admin/articles/{public_id}/archive/` | `publish` | Ẩn bài nhưng giữ published pointer |
| `POST` | `/api/knowledgebase/admin/articles/{public_id}/restore/` | `publish` | Khôi phục đúng revision trước đó |
| `GET/POST` | `/api/knowledgebase/admin/media/` | `view/manage` | Media library/upload ảnh |

Mọi PATCH/action gửi `revision_token`; publish gửi thêm `revision_number` và
không tự chọn revision mới nhất. Token cũ hoặc transition sai trả `409` với
`code` ổn định. Approved/rejected không sửa tại chỗ. Tạo bản sửa của bài đã
publish bắt buộc `change_summary`. Category/slug/type khóa sau publish đầu.
Frontend thu thập `change_summary` trong modal **Tạo revision mới** trước khi
gọi `POST .../revisions/`; không validate form revision đang ở trạng thái chỉ
đọc. Response tạo draft mới làm editor mở lại và cho phép tiếp tục sửa tóm tắt.
Các object `related_articles`, `previous_article` và `next_article` trong detail
public có trường `order`; sidebar ghép bài hiện tại với related rồi sắp xếp theo
`order`, không dùng trạng thái được chọn để thay đổi vị trí.
Upload tùy chọn chỉ nhận JPEG/PNG/WebP, tối đa 5 MB và 1600×1600. Body nhận ảnh
từ media library, đường dẫn nội bộ hoặc URL HTTPS mà không bắt buộc upload vào
ProCV trước; ảnh vẫn phải có alt text có nghĩa. Khi không tìm kiếm, trang ứng
viên gọi API theo category/page. Khi nhập tối thiểu hai ký tự, frontend debounce
250 ms rồi gọi list API với `q` và không gửi category để tìm trên toàn bộ chuyên
mục; `q` không được ghi lên URL. UI dùng `count` từ response, đặt nhãn category
phía trên title, highlight phần khớp và hiện excerpt một dòng. Editor FAQ cung cấp tab
**Từ URL** bên cạnh kho media và upload để biên tập viên dùng trực tiếp nguồn
HTTPS hợp lệ.
