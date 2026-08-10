# Frontend response contracts

Tài liệu này ghi lại kết quả đối chiếu các API với consumer thực tế trong
`frontend/src`. Mục tiêu là response theo use case, không phản chiếu nguyên model
hoặc cấu trúc database.

## Nguyên tắc

- DTO đọc danh sách, đọc chi tiết và ghi form là các serializer riêng.
- Field không được giao diện đọc không thuộc public contract.
- Quan hệ chỉ trả view-model nhỏ; dữ liệu ghi nested chỉ xuất hiện trong API form
  được bảo vệ tương ứng.
- `password`, quyền nội bộ và định danh database của user không xuất hiện trong
  resource response. `access`/`refresh` chỉ được trả ở endpoint xác thực có mục
  đích phát token (`register`, `login`, `oauth/complete`, `refresh`).
- Test contract so sánh tập key chính xác để một field model mới không tự động bị
  lộ ra API.

## Contract đã đối chiếu

| Màn hình / use case | Endpoint | DTO đọc | Field chính frontend sử dụng |
|---|---|---|---|
| Header, guard, tài khoản | `GET /api/auth/me/` | `SessionUserSerializer` | `public_id`, `email`, `role`, `full_name`, `phone`, `avatar_url`, `email_verified`, `two_factor_enabled`, `job_preferences_configured`; employer có `employer_job_workspace_ready` canonical và field legacy trong compatibility window |
| Sửa thông tin tài khoản | `PATCH /api/auth/me/` | `ProfileUpdateSerializer` → session DTO | candidate dùng `full_name`, `phone`; employer chỉ đổi `full_name`, phone bắt buộc qua SMS challenge |
| Onboarding / cài đặt gợi ý | `GET/PATCH /api/candidate/profile/` | `CandidateProfileReadSerializer` / `CandidateProfileUpdateSerializer` | `gender` |
| Onboarding / cài đặt gợi ý | `GET/PUT /api/candidate/job-preferences/` | `CandidateJobPreferenceSerializer` | vị trí chuyên môn, vị trí khác, lương, kinh nghiệm, tỉnh, relocate và hai consent |
| Cài đặt email candidate | `GET/PATCH /api/candidate/email-notification-settings/` | `CandidateEmailNotificationSettingsSerializer` | 12 boolean preference mặc định bật; PATCH chỉ gửi field vừa đổi, không có field email giao dịch bảo mật |
| Việc làm phù hợp | `GET /api/jobs/recommendations/for-me/` | `CandidateJobRecommendationResponseSerializer` (job nền là `PublicJobListSerializer`) | `status`, `sources`, `source_cv`, `pagination`; mỗi job thêm score/details/reasons/high-match |
| Việc làm sau lưu CV | `GET /api/jobs/recommendations/by-cv/{public_id}/` | `CvJobRecommendationResponseSerializer` (job nền là `PublicJobListSerializer`) | `focus_keyword`, related positions và tối đa 6 job giải thích được; `403` khi chưa có consent |
| Gợi ý từ việc đã lưu | `GET /api/jobs/recommendations/by-saved/?limit=` | `SavedJobRecommendationResponseSerializer` (job nền là `PublicJobListSerializer`) | `status`, `strategy`, `source_saved_job_count`; mỗi job thêm similarity score/details/reasons, fallback có score 0 |
| Picker địa điểm | `GET /api/locations/` | `LocationLookupSerializer` | `id`, `name`, `level`, `parent`, `merged_from` |
| Picker vị trí chuyên môn | `GET /api/jobs/categories/` | `JobCategoryListSerializer` | `id`, `name`, `logo_url`, `parent`, `category_type` |
| Job card / kết quả tìm kiếm / việc đã lưu | `GET /api/jobs/` | `PublicJobListSerializer` | định danh public, tiêu đề/công ty, địa điểm, skill, loại việc, kinh nghiệm/cấp bậc/học vấn/tuổi, lương, badge/tier, thời gian đăng |
| Hover preview trang chủ | `GET /api/jobs/?view=preview` | `PublicJobPreviewSerializer` | list DTO + mô tả/yêu cầu/quyền lợi, lịch, địa chỉ, số lượng và hạn nộp |
| Chi tiết / quick view việc làm | `GET /api/jobs/{slug}/` | `JobDetailSerializer` | nội dung chi tiết, thông tin công ty tối thiểu, salary/deadline/view, location/schedule/language và các nhóm view-model |
| Bảng quản lý tin NTD | `GET /api/jobs/mine/` | `EmployerJobListSerializer` | `public_id`, `title`, `company_name`, `locations_detail`, `employment_type`, `deadline`, `status`, `application_count`, timestamps cần hiển thị |
| Form tin NTD | `POST/PATCH /api/jobs/mine/...` | `EmployerJobWriteSerializer`; response `EmployerJobDetailSerializer` | dữ liệu form và nested relation, gồm liên hệ nhận hồ sơ; endpoint có `IsEmployer` |
| Admin duyệt tin | `GET /api/jobs/admin/moderation/{public_id}/`, `POST .../decisions/` | `AdminJobDetailSerializer` / `AdminJobDecisionSerializer` | `review_token`, `state_actions`, `blocked_reasons`, `approve_blockers`, `approve_requirements`; eligibility do backend tính |
| Readiness nhà tuyển dụng | `GET /api/employer/me/` | `RecruiterProfileSerializer` + readiness selector | Năm field top-level `job_workspace_ready`, `verification_approved`, `candidate_data_access`, `dpa_status`, `blockers`; onboarding legacy chỉ để tương thích |
| Thẻ yêu cầu cập nhật của tôi | `GET /api/employer/company/update-requests/?scope=mine` | `CompanyUpdateRequestSerializer` | request của actor, `submitted_at`, status/review note, revision và file/media actor được phép mở |
| Compatibility/audit company scope | `GET /api/employer/company/update-requests/?scope=company` | `CompanyUpdateRequestSerializer` | backend compatibility có redaction; recruiter company settings không gọi/render contract này |
| Admin mở đúng yêu cầu cập nhật | `GET /api/admin/company-update-requests/{public_id}/` | `AdminCompanyUpdateRequestSerializer` | exact request, company/requester/status/revision/lock version; document metadata tùy `account.sensitive.view` |
| Card blog / blog home | `GET /api/blog/`, `/api/blog/home/` | `PostListSerializer` | `public_id`, `title`, `slug`, `excerpt`, `thumbnail_url`, category link, `published_at` |
| Chi tiết blog | `GET /api/blog/{slug}/` | `PostDetailSerializer` | list identity + `content`, tags, related job category, `seo_title` |

Các catalog nhỏ (industry, benefit, language, skill), site settings/banner/link và
consent vốn đã dùng explicit field. Admin site settings cố ý trả metadata form
(`value_type`, `options`, `order`, `is_public`, `env_configured`) nhưng chỉ qua
permission admin.

### Contract canonical employer readiness

`GET /api/employer/me/` trả năm field readiness ở top-level, không lồng trong
`onboarding`:

```json
{
  "job_workspace_ready": true,
  "verification_approved": true,
  "candidate_data_access": false,
  "dpa_status": "outdated",
  "dpa_grace_expires_at": null,
  "dpa_policy": {
    "available": true,
    "policy_version": "2026-08",
    "document_sha256": "<64 lowercase hex>",
    "document_url": "https://..."
  },
  "blockers": [
    {
      "code": "dpa_outdated",
      "capabilities": ["candidate_data", "job_approval"],
      "message": "Chấp thuận DPA không còn là phiên bản hiện hành.",
      "action": "accept_current_dpa"
    }
  ]
}
```

- `capabilities[]` chỉ gồm `job_workspace`, `verification`, `candidate_data`,
  `job_approval`; `code` và `action` là machine value chữ thường.
- `dpa_status` thuộc `missing|current|legacy_unversioned|outdated|grace|hold|unknown`.
  Timestamp cũ không có evidence luôn là `legacy_unversioned`; acceptance có
  version/hash khác cấu hình hiện hành là `outdated`. Client chỉ gọi accept với
  exact `dpa_policy.policy_version` + `document_sha256`; `available=false` phải
  khóa checkbox/nút xác nhận.
- `dpa_grace_expires_at` là ISO-8601 nullable. Field chỉ có giá trị khi
  `dpa_status=grace|hold`; client hiển thị deadline tại workflow DPA, không dùng
  deadline phía client để tự cấp quyền.
- Action hiện hành gồm `contact_support`, `complete_onboarding`, `verify_phone`,
  `link_company`, `upload_business_document`, `upload_candidate_dpa`,
  `open_verification`, `accept_dpa`, `accept_current_dpa`. Frontend map action
  sang destination allowlist; backend không gửi URL điều hướng.
- Nếu bất kỳ field canonical nào xuất hiện, client phải dùng canonical. Payload
  partial, sai kiểu, blocker sai schema hoặc boolean `true` vẫn có blocker cho
  capability đó đều fail closed. Chỉ khi cả năm field vắng mới fallback
  workspace legacy; `candidate_data_access` không bao giờ fallback legacy.
- `GET /api/auth/me/` dùng `employer_job_workspace_ready` cho login destination.
  Canonical present thắng `employer_verification_completed`; canonical present
  nhưng không phải boolean `true` được xử lý fail closed.
- Error API ER-2 dùng code chữ hoa `CANDIDATE_DATA_BLOCKED`,
  `EMPLOYER_WORKSPACE_BLOCKED`, `JOB_APPROVAL_BLOCKED`; không trộn với blocker
  code chữ thường và không parse message để điều khiển UI. Các code mục tiêu
  `VERIFICATION_REQUIRED`/`DPA_OUTDATED` trong canonical plan chưa được tuyên bố
  là error response đã triển khai ở ER-2.

Frontend dùng `JobWorkspaceGuard` cho jobs/campaigns và `CandidateDataGuard`
cho applications. Known denial điều hướng về `employer-verify`; checking/error
không redirect và vẫn fail-closed với loading/retry.
Query candidate-data phải tắt khi checking/error/denied và UI phải bỏ cả PII đã
cache; aggregate không chứa danh tính vẫn được hiển thị.

### Contract SMS challenge nhà tuyển dụng

- `POST /api/employer/phone/send-otp/` nhận `{phone,password}`, trả `202` với
  `{public_id,purpose,status,failure_code,expires_at,attempts_remaining,`
  `can_verify,can_retry}`. `purpose` là
  `initial_verification|phone_change|reverify`; client không tự gửi purpose.
- Frontend poll `GET /api/employer/phone/challenges/{public_id}/` trong các
  trạng thái `queued|dispatching|retry_pending`. Resource khác actor trả `404`.
  Response không có phone, destination hint, OTP, provider message ID hoặc
  ciphertext.
- Chỉ `status=sent` và `can_verify=true` mới mở ô nhập mã. Verify gửi exact
  `{challenge_id,code}`; không tìm “OTP mới nhất” và không retry challenge đã
  `verified|expired|invalidated`.
- `PHONE_OTP_COOLDOWN` trả `retry_after_seconds`; `PHONE_SMS_DISABLED`,
  provider failure, stale/replay và attempt exhaustion đều fail closed. Client
  không fallback email.
- Availability endpoint chỉ còn compatibility format check và luôn generic.
  Uniqueness được backend recheck sau mã đúng trong transaction. UI không gọi
  endpoint này để tô trạng thái “số đã được dùng”.
- Khi đổi số, UI vẫn hiển thị proof hiện tại tới khi challenge số mới thành
  công. Self-reverify là hành động tự nguyện; pending/failure không thu hồi
  proof. Employer không được đổi phone qua `PATCH /api/auth/me/`.

### Contract khôi phục liên kết công ty

- `POST /api/admin/accounts/{user_public_id}/company-unlink-impact/` nhận
  `{reason}` và trả `target`, các `counts`, blocker code canonical, `can_apply`
  cùng signed `impact_token` khi relation còn clean.
- Chỉ `company_role=member` và toàn bộ count document/update request/
  verification event/tax evidence/recruitment need/campaign/job/active hold bằng
  0 mới có thể confirm. Owner hoặc account đã hoạt động không được unlink.
- `POST .../unlink-company/` gửi lại exact `{reason,impact_token}`; backend lock
  và recompute. State thay đổi sau preview trả `409`, UI phải bỏ token cũ và
  yêu cầu preview lại.
- Success tách recruiter cùng clean draft case khỏi company cũ, không xóa
  company/evidence và không tự liên kết company mới. UI refetch account context;
  lịch sử nằm trong append-only audit, không render raw snapshot cho recruiter.

### Contract notification và activity employer

- `GET /api/employer/notifications/?page=` trả envelope phân trang; item gồm
  `public_id,event_type,title,message,action_path,metadata,is_read,read_at,created_at`.
  `action_path` luôn là relative path thuộc `/tuyendung/app/`; frontend không
  dựng URL từ metadata hoặc message.
- `GET /api/employer/notifications/unread-count/` trả `{count}`. Sau
  `POST /notifications/{public_id}/read/` hoặc `/read-all/`, consumer invalidate
  root key `employerNotificationKeys.all` để list và badge nhất quán.
- `GET/PATCH /api/employer/notification-preferences/` trả hai boolean:
  `important_decision_email=true` read-only và
  `intermediate_verification_email` configurable. Tắt email trung gian không
  tắt website notification.
- `GET /api/employer/activities/?page=` trả
  `public_id,event_type,summary,subject_public_id,metadata,actor_name,occurred_at`.
  `actor_name` chỉ là `Bạn|Quản trị viên|Hệ thống`, không lộ danh tính admin.
- Loading/error/empty/unread/read/pagination đều là UI state tường minh; direct
  route nằm dưới `AuthGuard → RoleGuard → EmployerOnboardingGuard`.

### Contract yêu cầu cập nhật công ty

`CompanyUpdateRequestSerializer` trả các field chính: `public_id`,
`requested_by_summary`, `current_revision_public_id`, `allowed_actions`,
`changes`, `is_sensitive`, `reason`, `proof_type`, `status`, `review_note`,
`documents`, `media_previews`, `submitted_at`, `created_at`, `updated_at`,
`revision`, `lock_version` và `base_company_updated_at`.

- `requested_by_summary` có đúng view-model
  `{public_id, display_name}`; không trả email. `display_name` dùng họ tên đã
  trim hoặc nhãn an toàn `Thành viên công ty`.
- `scope=mine` dùng cho thẻ cá nhân. `scope=company` giữ cho admin/audit và là
  mặc định để tương thích, nhưng company settings của recruiter không gọi hoặc
  render scope này. Giá trị scope khác trả `400`.
- Consumer recruiter chỉ suy trạng thái và pending action từ response `mine`;
  tuyệt đối không lấy phần tử đầu của response `company` làm request của actor.
- Loading, error, empty và has-data là bốn state riêng. Nếu query `mine` lỗi,
  kể cả background refresh, client hiện retry và khóa fail-closed toàn bộ
  create/edit/upload/delete/submit cho tới khi cả hai query thành công; không
  chuyển error thành mảng rỗng.
- Ngày trên thẻ cá nhân chỉ dùng `submitted_at` hợp lệ. Không fallback sang
  `created_at`, `updated_at` hoặc placeholder. Recruiter UI không có section
  lịch sử công ty và không gọi `scope=company`.
- State active gồm `pending|submitted|in_review|changes_requested` để giữ
  compatibility; `in_review` luôn read-only. `allowed_actions` là nguồn cho
  `edit|resubmit|withdraw|cancel`; backend vẫn recheck actor, role, status,
  revision và lock version.
- POST gửi `base_company_updated_at` và chỉ chứa field thực sự đổi. Diff rỗng
  trả validation error; thay đổi field không liên quan không được tự thêm
  `trade_name`. Mỗi submit/resubmit tạo revision bất biến mới.
- `POST /api/employer/company/update-requests/{public_id}/{action}/` chỉ nhận
  `action=withdraw|cancel`, payload `{lock_version, reason?}`; `withdraw` dành
  requester, `cancel` dành owner và cả hai chỉ hợp lệ trước review.
- Với request của member khác, `changes.logo_url`/`cover_image_url` là `null`,
  `gallery_additions=[]` và `media_previews={}`. Client chỉ được biết field
  media đã thay đổi, không nhận storage key hay preview URL.
- Với private document không thuộc quyền binary của actor, `file_url=null`,
  `file_name=""`, `mime_type=""`, `file_size=0`; direct content trả `404`.
  Requester/uploader và company owner nhận content URL sau authorization.

### Contract upload session cho employer

- Frontend tạo `POST /api/uploads/sessions/` với purpose
  `employer_verification` hoặc `employer_company_update`, gửi byte qua
  `.../{public_id}/content/` rồi poll owner-scoped detail tới khi
  `ready_for_submit=true`. Chỉ `clean` được chuyển vào endpoint nghiệp vụ.
- `POST /api/employer/company/documents/` nhận `upload_session`; logo, cover và
  gallery nhận cùng field. Client không gửi đồng thời `file` và
  `upload_session`. Backend recheck owner, purpose, state và one-time claim;
  không tin trạng thái UI.
- UI map machine state sang copy cố định cho
  `uploading|quarantined|scanning|clean|rejected|error|expired`. Retry chỉ khi
  `retryable=true`, một lần tự động; timeout/rejection/scanner error khóa submit
  và không được báo thành công.
- Với form nhiều file, tất cả file phải clean trước khi tạo company/update
  request; attach chạy tuần tự để lỗi có vị trí rõ. Không dùng
  `Promise.allSettled` để nuốt lỗi hoặc lưu business request một phần.
- Compatibility window: client chỉ fallback multipart raw khi create session
  trả exact `UPLOAD_PIPELINE_DISABLED`. Mọi lỗi khác fail closed. Sau khi staging
  scanner đạt gate, backend bật `EMPLOYER_UPLOAD_SESSION_REQUIRED=true` và raw
  trả `409 UPLOAD_SESSION_REQUIRED`.
- Raw Office preview luôn trả `409 UPLOAD_SCAN_REQUIRED`; client không gửi DOCX
  chưa scan để backend/LibreOffice parse. Có thể cho người dùng tải tệp local đã
  chọn để tự kiểm tra trước khi nộp.

### Contract upload session cho candidate CV

- Library import, import từ template, CV tải trực tiếp khi ứng tuyển và avatar
  đều tạo purpose `candidate_cv`, gửi byte vào quarantine và poll tới
  `ready_for_submit=true`. Business API chỉ nhận `upload_session` clean; frontend
  không gửi raw byte cùng lúc.
- `POST /api/v2/cvs/imports/` giữ các field `title`, `template_public_id`,
  `language`, `theme_color` và `Idempotency-Key`; nguồn file thay bằng
  `upload_session`. `POST /api/v2/cvs/assets/` dùng cùng field cho avatar.
- Backend claim exact owner/purpose một lần trước structural validation. PDF/DOCX
  được kiểm contract riêng của app `cvs`; avatar được Pillow verify/re-encode.
  Failure rollback claim và không tạo CV/asset.
- Client map machine state bằng presentation chung; library/template/application
  khóa action trong lúc scan. Chỉ exact `UPLOAD_PIPELINE_DISABLED` được fallback
  multipart trong compatibility window; `UPLOAD_NOT_CLEAN`, rejection, timeout,
  scanner error và `UPLOAD_ALREADY_SUBMITTED` đều fail closed.
- Sau staging, bật `CANDIDATE_UPLOAD_SESSION_REQUIRED=true`; raw multipart trả
  `409 UPLOAD_SESSION_REQUIRED`. Delete/expiry chỉ release business claim, không
  trực tiếp xóa clean evidence trước minimum retention.

### Contract admin review yêu cầu cập nhật công ty

- Queue phải truyền exact `request.public_id`; consumer gọi
  `GET /api/admin/company-update-requests/{public_id}/` và dùng query key theo
  request. Không lọc theo company rồi lấy phần tử đầu tiên.
- Deep-link hiện hành là
  `/admin/recruiters/{requester_public_id}?tab=verification&company_update={request_public_id}`.
  Panel fail-closed nếu response không khớp company/requester đang mở hoặc
  request không nằm trong lifecycle được hỗ trợ; actor phải quay lại queue thay
  vì review record khác.
- Admin gọi `POST .../{public_id}/start-review/` với `lock_version` và
  `revision_public_id` trước mọi document/final decision. Chỉ request
  `in_review` mới được duyệt tài liệu hoặc quyết định cuối.
- Document decision chỉ đổi tài liệu của exact revision, không tự approve hoặc
  reject toàn request. `POST .../{public_id}/review/` là quyết định cuối tường
  minh `approved|changes_requested|rejected`, luôn kèm lock/revision hiện hành.
- Khi company đã đổi sau base snapshot, backend so theo từng field. Overlap trả
  `409` và đưa request về `changes_requested`; non-overlap được apply atomically.
- `company_update.view` cho list/retrieve nhưng không tự mở metadata nhạy cảm.
  Khi thiếu `account.sensitive.view`, mỗi document trả `file_name=""`,
  `mime_type=""`, `file_size=0`, `sha256=""`, `uploaded_by_email=""` và
  `source_url=null`; tax code cũng bị mask.
- Endpoint content
  `GET /api/admin/company-update-requests/{request_public_id}/documents/{document_public_id}/content/`
  bắt buộc đồng thời `company_update.view` và `account.sensitive.view`, đồng
  thời document phải thuộc đúng request. Response là binary private/no-store;
  không trả storage URL.
- Mutation khóa theo thứ tự
  `Company → CompanyUpdateRequest → CompanyDocument` và luôn recheck ownership,
  status cùng `lock_version` trong transaction. Django admin chỉ đọc, không có
  đường mutation vượt service/API.

### Contract admin quyết định cuối verification

Workflow bắt buộc hai bước và backend là nguồn quyết định cuối:

- `POST /api/admin/employer-verifications/{public_id}/decision-impact/` nhận
  `decision`, `reason`, `tax_override`, `tax_override_reason`; chỉ preview,
  không ghi dữ liệu. Response trả checks, tax advisory, company/capability/hold
  impact, `rejection_impact {current_count,next_count,limit,will_lock_resubmission}`
  và `impact_token`.
- `POST .../decision/` nhận lại cùng payload kèm `impact_token`. Backend khóa
  và tính lại hồ sơ, document, tax evidence, company, campaign, job và hold;
  `409 admin_resource_changed` bắt frontend reload detail rồi preview lại.
- Duyệt từng document chỉ đổi document và tăng `lock_version`; không tự approve
  case/company. Final decision chỉ hợp lệ từ `in_review` sang
  `approved|changes_requested|rejected`.
- List/detail case trả `final_rejection_count`, `rejection_limit`,
  `resubmission_locked`, `resubmission_locked_at`. Chỉ final `rejected` tăng
  count; document reject/changes-requested không tính. Case terminal chỉ trở về
  `pending`/tăng revision sau khi toàn bộ current document cần sửa đã được thay.
- `POST .../unlock-resubmission/` nhận `{reason,lock_version}` và yêu cầu
  `employer_verification.resubmission_unlock`. Thành công chỉ xóa lock, tăng
  lock version và ghi audit; không xóa count/lịch sử, không tự approve hoặc
  ban/mở ban tài khoản. Stale trả `409 admin_resource_changed`.
- Tax `pending` luôn chặn. `missing|mismatch|not_found|unavailable|invalid` chỉ
  cho approve khi actor có `employer_verification.tax_override` và gửi lý do.
- `POST .../revoke-impact|expire-impact/` rồi `POST .../revoke|expire/` dùng
  cùng preview/confirm model; action yêu cầu `employer_verification.revoke`.
  Revoke/expire không downgrade company, nhưng chặn candidate data/job approval
  và ẩn active public jobs; workspace cùng tạo/sửa/gửi tin vẫn hoạt động.
- Detail chỉ trả `decision_snapshot` qua allowlist presentation. Không trả
  `impact_token`, integrity fingerprint, raw filename, response hash hoặc field
  nội bộ không xác định cho actor thiếu quyền nhạy cảm.
- Error nghiệp vụ dùng code ổn định
  `VERIFICATION_INVALID_TRANSITION`, `VERIFICATION_REQUIREMENTS_INCOMPLETE`,
  `TAX_LOOKUP_PENDING`, `TAX_OVERRIDE_REQUIRED`,
  `TAX_OVERRIDE_REASON_REQUIRED`; field validation vẫn theo tên field.

Frontend admin ER-5 đã consume đủ impact, company warning, override reason và
stale refresh. UI trình bày bộ đếm từ chối/cảnh báo lần thứ ba và chỉ hiện thao
tác mở khóa cho actor có permission tương ứng. UI không gọi confirm trực tiếp
hoặc tự suy trạng thái; mọi thay đổi payload sau preview xóa impact hiện tại và
bắt preview lại.

### Contract blocker duyệt tin

`approve` chỉ xuất hiện trong `state_actions` khi `approve_blockers=[]`. Tối
thiểu có hai blocker employer fail-closed:

- `verification_required`: verification case chưa `approved`, không thuộc đúng
  recruiter hoặc không khớp company của tin;
- `dpa_outdated`: recruiter chưa có DPA hợp lệ theo nguồn trạng thái hiện hành.

Khi blocker xuất hiện giữa preview và submit, backend trả HTTP 400 với
`code=JOB_APPROVAL_BLOCKED` và `blocked_reasons[]`; frontend phải invalidate
detail và không hiển thị toast thành công. `review_token` bảo vệ revision của
job nhưng không thay thế việc backend đọc lại verification/DPA/campaign trong
transaction.

Frontend map allowlist `verification_required|dpa_outdated` tới deep-link
`/admin/app/recruiters/{employer_public_id}?tab=verification` chỉ khi actor có
`employer_verification.view`. Blocker khác chỉ giữ nút approve disabled và
label backend; không suy route từ message hoặc company.

## Query strategy

- Job list defer các cột rich text; chỉ prefetch location/skill, và chỉ thêm
  benefit/schedule khi `view=preview`.
- Job detail prefetch đúng các relation được DTO chi tiết và view-model sử dụng.
- Recommendation prefilter không dấu theo category/title/skill, chấm tối đa 500
  job đã prefetch; query-budget regression bảo đảm số query phẳng theo số kết quả.
- Recommendation theo saved job so pairwise tối đa 20 nguồn gần nhất, loại tin
  đã lưu/đã ứng tuyển; không có tín hiệu thì fallback tin active mới nhất.
- Employer list dùng query riêng, không tải nội dung rich text hoặc toàn bộ nested
  form; detail/write dùng query đầy đủ riêng.
- Blog list dùng `select_related(category)` + `only()` các cột card; detail mới
  prefetch tags và related category.
- Location/category lookup dùng `only()` đúng các cột picker.

Khi thêm field frontend mới, cập nhật đồng thời serializer, selector/query,
contract test và bảng này. Không dùng `fields = '__all__'` trong API serializer.

## Contract thông báo chạy đa cổng

Contract này được chốt ở AN-P0 và chỉ có hiệu lực sau khi backend foundation
AN-P1 được merge. Public feed không phản chiếu model/revision nội bộ.

### Active feed

`GET /api/site/announcements/active/?surface=candidate&path=/viec-lam&locale=vi`

```json
{
  "items": [
    {
      "public_id": "ann_...",
      "revision": 3,
      "kind": "info",
      "priority_tier": 6,
      "priority": 50,
      "message": "Khám phá cơ hội việc làm mới.",
      "badge": "Mới",
      "icon": "sparkles",
      "cta": {
        "label": "Xem ngay",
        "url": "/viec-lam",
        "external": false
      },
      "animation": "slide",
      "display_seconds": 6,
      "dismiss": {
        "mode": "close",
        "snooze_seconds": null,
        "version": 1
      },
      "starts_at": "2026-07-29T03:00:00Z",
      "ends_at": "2026-08-05T03:00:00Z"
    }
  ],
  "next_transition_at": "2026-08-05T03:00:00Z",
  "remote_enabled": true
}
```

Rules:

- `items` chỉ chứa tier cao nhất đã qua targeting và dismiss; thứ tự đã
  deterministic từ backend.
- `message`/`badge`/`cta.label` đã resolve locale, fallback từng field về
  tiếng Việt.
- `cta` là `null` khi không cấu hình; client không tự suy ra external từ text.
- `next_transition_at` là boundary sớm nhất có thể đổi feed, hoặc `null`.
- `remote_enabled` là kill switch authoritative theo surface. Frontend bỏ mọi
  remote item nếu field thiếu hoặc false; system label resolve độc lập.
- `internal_name`, creator, publisher, target rule và raw translations không
  xuất hiện trong public DTO.

### Functional state

`PUT /api/site/announcements/{public_id}/state/`

```json
{
  "revision": 3,
  "dismissal_version": 1,
  "action": "snooze"
}
```

Response `200` trả state canonical gồm `dismissed_at` hoặc `snoozed_until`.
Gửi lại cùng action là idempotent. Guest không gọi endpoint này.
Endpoint yêu cầu authenticated session. Revision hoặc dismissal version cũ trả
`409 announcement_state_stale`; `locked` hoặc action không khớp cấu hình trả
`400` và không tạo user state.

### Event batch

`POST /api/site/announcements/events/`

```json
{
  "events": [
    {
      "public_id": "ann_...",
      "revision": 3,
      "surface": "candidate",
      "event": "impression"
    }
  ]
}
```

Response `202 {"accepted": true}` không cam kết event được cộng khi thiếu
analytics consent hoặc Redis đang lỗi. Client không retry vô hạn.
Batch nhận 1–50 event, loại trùng trong cùng payload và throttle độc lập
240 request/giờ. Backend chỉ nhận revision đã publish và surface thuộc revision;
không lưu path, IP hoặc user-agent. CTA không chờ response tracking.

### Runtime operational event

`POST /api/site/announcements/runtime-events/`

```json
{
  "surface": "candidate",
  "event": "feed_error",
  "reason": "http_5xx"
}
```

Endpoint AllowAny, throttle 60 request/giờ và chỉ nhận enum. Event:
`feed_error`, `contract_error`, `render_error`; reason: `network`, `timeout`,
`http_4xx`, `http_5xx`, `contract`, `render`, `unknown`. Không gửi path, error
message, stack, user/cookie identifier hoặc payload API.

### Admin metrics

`GET /api/site/admin/announcements/{public_id}/metrics/?date_from=2026-07-01&date_to=2026-07-29`

- yêu cầu `announcement.view`;
- mặc định 30 ngày, tối đa 93 ngày, ngày báo cáo theo `Asia/Ho_Chi_Minh`;
- `summary` trả `impressions`, `unique_impressions`, `clicks`,
  `unique_clicks`, `dismisses`, `ctr`, `dismiss_rate`;
- `daily[]` aggregate theo ngày và surface trên toàn bộ revision;
- `consent_notice` bắt buộc để tránh diễn giải số liệu như toàn bộ traffic.

### Admin list/detail

Admin list trả paginated DTO phục vụ bảng:

- `public_id`, `internal_name`, `lifecycle_state`, `presentation_status`;
- `kind`, `surfaces`, `starts_at`, `ends_at`, `priority`;
- active/draft revision numbers, creator/publisher summary và timestamps;
- aggregate `impressions`, `clicks`, `ctr`, `dismisses`.

Detail mới trả raw nội dung Việt/Anh, target rules, dismiss/animation config,
revision token và revision history. Mutation phải gửi revision token; stale
token trả `409` với code `announcement_revision_stale`.
