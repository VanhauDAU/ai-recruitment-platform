# Đặc tả miền Nhà tuyển dụng

Tài liệu mô tả miền Nhà tuyển dụng (NTD) như hệ thống đang chạy: đăng ký và
onboarding, mô hình công ty/recruiter, yêu cầu cập nhật công ty, hồ sơ xác thực
và compliance hold, DPA, xác minh số điện thoại bằng SMS, upload quarantine, gỡ
liên kết công ty, thông báo/activity, danh bạ công ty và các cổng quyền của
workspace. Lý do của từng quyết định nằm ở
[biên bản quyết định employer](../02-tong-quan/employer-remediation-decision-log.md);
tài liệu này chỉ dẫn ID khi quy tắc phụ thuộc vào nó.

Owner code: app `apps.employers` (model, service, selector, API
`/api/employer/*`, `/api/admin/*`, `/api/companies/`), app dùng chung
`apps.uploads` (upload session) và cổng frontend `/tuyendung/app`.

## 1. Nguyên tắc nền

- **Company là catalogue**, không có vòng đời xác thực (ER-D52). Duyệt, từ chối,
  thu hồi hay hết hạn chỉ tác động `EmployerVerificationCase` của từng recruiter.
- **Tenant nghiệp vụ là recruiter** (`posted_by`, ER-D19): job, campaign,
  application thuộc người tạo; thành viên cùng công ty không thấy dữ liệu tuyển
  dụng của nhau.
- **Backend là nguồn quyết định**: readiness, blocker, `allowed_actions[]` và
  quyền đều do server tính; frontend không suy diễn từ field rời rạc.
- **Fail closed**: lỗi tải dữ liệu không được hiểu là rỗng; scanner/SMS/DPA chưa
  sẵn sàng thì chặn, không fallback. IDOR, chặn tải file chưa sạch và cổng đăng
  tin không có flag bypass.
- Object ngoài phạm vi trả `404` để tránh dò tài nguyên; response cho member
  không chứa storage key, signed URL, checksum hay chi tiết scanner.

## 2. Đăng ký, đăng nhập và onboarding

### 2.1 Luồng

```text
Email:  register → /account/verify → bấm link → /consulting-need → /employer-verify → /dashboard
Google: callback → /account/complete-profile → /consulting-need → /employer-verify → /dashboard
```

`POST /api/employer/register/` chạy trong một transaction: tạo `User` role
`employer`, `RecruiterProfile`, ghi consent, gửi email xác thực và trả JWT. Đăng
ký **không** tạo công ty. reCAPTCHA v3 (`register`) chạy trước validate để thông
báo "email đã dùng" không thành oracle.

| Trường | Điều kiện |
| --- | --- |
| Email | Hợp lệ, chuẩn hóa, chưa tồn tại (không phân biệt hoa thường) |
| Mật khẩu | Validator Django, 8–25 ký tự, có hoa, thường, số |
| Họ tên, giới tính | Bắt buộc; họ tên ≥ 2 ký tự |
| Số điện thoại liên hệ | `0`/`+84`, 10–11 chữ số |
| Nơi làm việc | Location cấp tỉnh/thành đang hoạt động |
| Điều khoản + quyền riêng tư | Bắt buộc; lưu `terms_accepted_at`, `terms_policy_version` (`EMPLOYER_TERMS_POLICY_VERSION`) |
| Marketing | Tùy chọn; `marketing_opt_in`, `marketing_decided_at` |

Tài khoản ứng viên và NTD cùng email là hai tài khoản độc lập. Email xác thực và
email chào mừng dùng template riêng cho employer; mỗi user có tối đa một
`AuthEmailJob(kind=welcome)`, ghi khi `email_verified` chuyển `false → true`
(email) hoặc ngay ở callback tạo mới (Google). Tài khoản OAuth chưa có mật khẩu
phải đặt mật khẩu tại `/account/settings/password-login` trước khi xác minh số
điện thoại.

### 2.2 State machine onboarding

Backend trả `employer_onboarding_step`; `employer_onboarding_required=false` chỉ
ở `complete`. `EmployerOnboardingGuard` chặn direct navigation, và API khai báo
nhu cầu cũng tự chặn khi email chưa xác thực.

| Step | Điều kiện | Route |
| --- | --- | --- |
| `registration` | Thiếu hồ sơ người liên hệ | `/account/complete-profile` |
| `email_verification` | Email chưa xác thực | `/account/verify` |
| `consulting_need` | Chưa có nhu cầu tuyển dụng | `/consulting-need` |
| `complete` | Có nhu cầu hợp lệ | `/employer-verify` nếu checklist chưa đủ, ngược lại `/dashboard` hoặc `returnUrl` an toàn |

`POST /api/employer/consulting-need/` tạo đúng một lần (lần sau `400`); nhu cầu
gồm vị trí, cấp bậc, hạn tuyển hoặc "liên tục", số lượng 1–10.000, ngân sách
min/max tùy chọn (`max ≥ min`), nguồn ngân sách và chủ đề tư vấn. Các nhu cầu
thêm sau quản lý ở `/api/employer/recruitment-needs/`.

### 2.3 Chống lạm dụng đăng nhập

Throttle theo IP lấy qua `common/client_ip.py` (production bắt buộc
`TRUSTED_PROXY_IPS`); sai mật khẩu quá `LOGIN_BACKOFF_FREE_ATTEMPTS` thì backoff
gấp đôi, không khóa cứng, bộ đếm tách theo cổng; refresh token dùng lại sau xoay
vòng thu hồi cả phiên; đăng nhập luôn băm mật khẩu kể cả email không tồn tại.

## 3. Mô hình công ty và recruiter

```text
User 1─1 RecruiterProfile N─1 Company ─┬─ CompanyIndustry (is_primary)
                                        ├─ CompanyImage (gallery)
                                        ├─ CompanyDocument
                                        ├─ CompanyUpdateRequest → Revision / Event
                                        └─ CompanyDomainClaim
RecruiterProfile 1─1 EmployerVerificationCase
```

- `Company`: `public_id` (`co…`), `slug` (sinh một lần, không đổi),
  `business_type` (`enterprise`/`household`), `tax_code` (đúng 10 hoặc 13 chữ số
  ASCII; với hộ kinh doanh là MST người đại diện nên được coi là dữ liệu cá
  nhân), `company_name`, `trade_name`, logo/cover/website kèm cờ `has_no_*`,
  liên hệ, `company_size` (bucket), `description` và `employee_benefits` (HTML
  sanitize, chỉ `p/br/strong/em/u/ul/ol/li`, không attribute; mô tả 500–10.000
  ký tự nhìn thấy), `markets`, `target_customers`, `founded_year`,
  `has_brand_page` (cột lịch sử, không điều khiển URL).
- `RecruiterProfile`: `company` (null khi mới đăng ký), `company_role`
  `owner|member`, `verified_phone` (unique khi có giá trị), `phone_verified_at`,
  các trường DPA (mục 6) và consent.
- **Liên kết công ty**: tìm và chọn (`POST /api/employer/company/join/`, thành
  `member` ngay, không cần duyệt) hoặc tạo mới (`POST .../company/create/`,
  thành `owner`, có hiệu lực ngay). Gán dùng khóa hàng; sau lần đầu recruiter bị
  khóa với công ty đó ở cả UI và API, chỉ admin gỡ được (mục 9). Company rỗng do
  shortcut đăng ký cũ không được tính là đã liên kết.
- `GET /api/employer/company/search/` (6 bản ghi/trang) tìm không dấu theo tên,
  tên thương mại, MST; không lọc theo xác thực, chỉ loại placeholder.
- **Quyền owner/member**: logo, cover, gallery (JPG/PNG/WebP ≤ 5 MB, tối đa 10
  ảnh) chỉ owner upload. Trước khi công ty có case xác thực hoặc update request,
  owner ghi trực tiếp; sau đó mọi thay đổi, kể cả ảnh, phải đi qua update
  request. Không có đường `PATCH` trực tiếp vào `Company`.

## 4. Yêu cầu cập nhật công ty (V2)

Áp dụng ER-D46/ER-D48 và ER-O01/ER-O02.

```text
submitted ──► in_review ──► approved
   │  ▲           ├──────► changes_requested ──► submitted (revision mới)
   │  └ resubmit  └──────► rejected
   ├──► withdrawn   (requester, trước review)
   └──► cancelled   (owner, trước review, bắt buộc lý do)
```

- Mỗi recruiter có tối đa **một request active** trên công ty (unique
  `(company, requested_by)` với `submitted|in_review|changes_requested`); nhiều
  member gửi song song. `requested_by` bất biến; chỉ người tạo sửa/resubmit.
- Mỗi submit/resubmit tạo `CompanyUpdateRevision` bất biến và
  `CompanyUpdateEvent` append-only; tài liệu, media, tax evidence gắn đúng
  revision. `in_review` là read-only (`COMPANY_UPDATE_IN_REVIEW`).
- Request lưu `submitted_at` (ngày nghiệp vụ), `revision`, `lock_version`,
  `base_values` và `base_company_updated_at`. Đổi `tax_code` hoặc `company_name`
  là `is_sensitive`: bắt buộc `reason`, `proof_type` (`business_registration`
  hoặc `authorization_and_id`) và giấy tờ tương ứng.
- Admin mở exact `public_id`, **Nhận thẩm định** (`start-review`), duyệt tài liệu
  của exact revision rồi ra quyết định cuối riêng. Duyệt tài liệu không tự duyệt
  request.
- Apply chạy trong transaction, so base theo từng field: field bị đổi đồng thời
  trả conflict và không partial apply (request quay về sửa); field không chồng
  lấn vẫn áp dụng. Không tự thêm `trade_name` legacy khi người dùng không sửa
  (ER-D45).
- Endpoint: `GET|POST /api/employer/company/update-requests/?scope=mine|company`,
  `POST .../update-requests/<public_id>/withdraw|cancel/` (gửi `lock_version`).
  `scope=company` vẫn tồn tại ở backend cho audit, nhưng trang company settings
  của recruiter chỉ gọi `scope=mine`, không hiển thị lịch sử công ty, khóa submit
  khi diff rỗng và luôn có nút quay lại. Lỗi tải `scope=mine` hiện alert + retry
  và khóa mọi thao tác ghi (ER-D02).

**Quyền xem tài liệu** (ER-D07): metadata đã redacted cho mọi member; binary
(preview/download) chỉ uploader, company owner và admin có quyền. Admin cần
`company_update.view`/`company_update.review`; metadata nhạy cảm bị che nếu
thiếu quyền sensitive, binary cần cả view lẫn sensitive.

## 5. Hồ sơ xác thực nhà tuyển dụng

### 5.1 Checklist phía NTD

`/tuyendung/app/employer-verify` là checklist có thể làm dần (không phải bước
onboarding): (1) xác thực số điện thoại; (2) chọn hoặc tạo công ty; (3) giấy
đăng ký doanh nghiệp; (4) tải thỏa thuận DLCN với ứng viên; (5) đồng ý DPA nền
tảng; (6) đăng tin đầu tiên (chỉ ghi nhận khi tin thực sự công khai). Trang chỉ
hiển thị checklist và tiến độ, không lặp banner readiness/case (ER-D43).

Trang `/account/settings/gpkd` có hai phương thức loại trừ nhau:
`business_registration` (một tệp ĐKDN) hoặc `authorization_and_id` (giấy ủy
quyền + CCCD/hộ chiếu), JPG/PNG/PDF ≤ 5 MB. Đổi phương thức chỉ xóa bộ cũ sau
khi cả bộ mới attach thành công. Tệp đã nộp xem qua endpoint binary có
authorization (`company/documents/<pk>/content/`), không phát storage URL.

### 5.2 State machine case

```text
draft → pending → in_review ─┬─► approved ─┬─► revoked ─┐
          ▲                  │             └─► expired ─┴─► pending (xử lý lại, revision++)
          │                  ├─► changes_requested ─► pending
          └──────────────────┴─► rejected ─► pending (thay đủ bộ cần sửa, revision++)
```

- Document decision và case decision là hai lớp (ER-D14): duyệt hết giấy tờ
  không tự approve case. Phone, DPA hay nhu cầu cũng không tự approve.
- Quyết định cuối hai bước: `decision-impact` trả tax/capability/hold impact và
  `impact_token`, rồi confirm. Dữ liệu đổi giữa hai bước trả `409` và admin xem
  lại. Revoke/expire cũng qua `revoke-impact`/`expire-impact`. Expire chỉ thủ
  công, chưa có TTL tự động (ER-D41).
- Đối chiếu MST (`CompanyTaxLookupEvidence`) chỉ mang tính bổ trợ (ER-D15,
  ER-D38): `pending` phải chờ; `not_found|unavailable|invalid_response|mismatch`
  hoặc thiếu chỉ được duyệt bởi actor có `employer_verification.tax_override`
  kèm lý do. Kết quả không chứng minh người nộp sở hữu hồ sơ công ty; quyền đại
  diện của member dựa trên giấy ủy quyền + định danh.
- **Giới hạn từ chối** (ER-D47): chỉ final `rejected` tăng
  `final_rejection_count`; lần thứ ba (`MAX_FINAL_REJECTIONS = 3`) khóa nộp lại
  nhưng không ban tài khoản. Reject/changes-requested một tài liệu không tính
  lượt. Mở khóa cần `employer_verification.resubmission_unlock`, lý do và
  `lock_version`; lịch sử và số đếm giữ nguyên.
- Hồ sơ auto-approved lịch sử mang `decision_source`
  `legacy_auto|legacy_unknown` (command `classify_legacy_employer_verifications`),
  không bị reset hay hold tự động.

**Quyền admin** (`/api/admin/employer-verifications/`):
`employer_verification.view`, `.review`, `.revoke`, `.tax_override`,
`.resubmission_unlock`, `.unlink_company`. Revoke, override, unlock và unlink
không grant mặc định. Hàng chờ "Cần xử lý" gồm `pending`, `in_review` và case
có giấy tờ hiện hành vừa nộp lại đang chờ.

### 5.3 Compliance hold

`EmployerComplianceHold` có `source` (`verification|dpa`), `reason`
(`verification_revoked|verification_expired|dpa_outdated|dpa_hold`), `status`
(`active|released`) và liên kết tới campaign/job bị ảnh hưởng.

- Revoke/expire (ER-D37): ẩn ngay tin đang công khai (predicate public loại job
  hoặc campaign có hold active), khóa dữ liệu ứng viên và đăng tin; workspace,
  tạo/sửa nháp vẫn mở. Company không bị ảnh hưởng.
- Reapprove chỉ gỡ hold nguồn `verification`; re-consent DPA chỉ gỡ hold nguồn
  `dpa`. Không gỡ moderation/account hold khác (ER-D20).
- Áp hold cho dữ liệu hiện hữu luôn dry-run, ops review rồi mới apply
  (`reconcile_employer_verifications`, `rollout_employer_dpa_compliance`).

### 5.4 Cấp tài khoản và dấu tick

Sidebar hiển thị **Cấp 0–3**: chưa xác thực email = 0; email = 1; thêm phone đã
xác minh và bộ giấy tờ current đã duyệt theo phương thức = 2; thêm case
`approved` đúng recruiter/company = 3. Giấy tờ "Chờ duyệt" chỉ đánh dấu bước
checklist, chưa nâng cấp.

Dấu tick công khai trên tin là read-model của `posted_by` (ER-D53–ER-D57), bật
khi đủ năm điều kiện: mailbox công việc khớp exact domain claim đang hiệu lực
của công ty; phone đã xác minh; case approved và bộ giấy tờ current đã duyệt;
tài khoản đủ `employer_badge_min_account_months` (mặc định 6, tháng lịch); không
có report trust `upheld`. Domain claim xác minh qua DNS TXT
`_procv-verification.<domain>` (`/api/employer/company/domain-claims/`), recheck
mỗi 30 ngày, grace tối đa 7 ngày; admin fallback cần quyền `employer_domain.*`
và hết hạn sau 12 tháng. Cấp tài khoản, dấu tick và quota là ba policy riêng.

## 6. DPA

Hai mốc độc lập trên trang `/account/settings/personal-data-protection`:

1. **Văn bản DLCN ứng viên – NTD** (`CompanyDocument` `data_processing_agreement`,
   DOCX/PDF ≤ 5 MB): gắn theo recruiter, không bắt buộc company; thay tệp reset
   trạng thái duyệt; admin duyệt thủ công. Tệp của công ty trước không được kế
   thừa sau khi relink.
2. **DPA nền tảng – NTD**: `POST /api/employer/dpa/accept/` gửi exact version và
   hash do `GET /api/employer/me/` (`dpa_policy`) công bố. Mỗi lần chấp nhận ghi
   `EmployerDpaAcceptance` append-only (version, hash, actor, thời điểm, IP,
   phiên, hash User-Agent) — ER-D24.

`dpa_status`: `missing|current|legacy_unversioned|outdated|grace|hold|unknown`.

| Trạng thái | Ý nghĩa | Workspace | Dữ liệu ứng viên, đăng tin |
| --- | --- | --- | --- |
| `current` | Khớp `EMPLOYER_DPA_POLICY_VERSION` + hash hiện hành | Mở | Mở |
| `legacy_unversioned` | Timestamp cũ, không có bằng chứng; không bịa hash/IP | Mở | Khóa |
| `outdated` | Đã chấp nhận bản khác bản hiện hành | Mở | Khóa |
| `grace` | Đang trong `EMPLOYER_DPA_GRACE_DAYS` (30 ngày) sau rollout | Mở | Khóa |
| `hold` | Quá hạn grace; tạo hold nguồn `dpa` | Khóa | Khóa |
| `missing`, `unknown` | Chưa chấp nhận / cấu hình không hợp lệ | Khóa | Khóa |

## 7. Xác minh số điện thoại bằng SMS

- Chỉ nhận số di động Việt Nam chuẩn hóa `+84` (ER-D32). Không có availability
  oracle: `GET /api/employer/phone/check/` chỉ kiểm format và trả kết quả
  generic; uniqueness được kiểm lại trong transaction sau khi chứng minh sở hữu.
- `POST /api/employer/phone/send-otp/` (re-auth mật khẩu) tạo `PhoneOtp`
  actor-bound với purpose `initial_verification|phone_change|reverify` và đẩy
  SMS qua queue `auth-sms`. `GET .../phone/challenges/<public_id>/` poll trạng
  thái `queued|dispatching|retry_pending|sent|failed|disabled|verified|expired`.
  `POST .../phone/verify/` gửi `{challenge_id, code}`.
- Cooldown 60 giây, TTL 10 phút, tối đa năm lần sai; mã mới vô hiệu mã cũ, mã đã
  dùng không replay. Đổi số giữ proof và readiness cũ cho tới khi số mới thành
  công (ER-D31). `PATCH /api/auth/me/` không cho employer đổi phone.
- Tài khoản cũ giữ proof hiện có, không deadline hay hold (ER-D22). Challenge
  chứa PII xóa sau 30 ngày; `EmployerPhoneVerificationEvent` redacted giữ 24
  tháng; admin không sửa trực tiếp phone đã xác minh (ER-D33).
- `EMPLOYER_SMS_OTP_ENABLED` tắt ⇒ dispatch fail closed, không fallback email
  (ER-D34). Cấu hình provider/sender/template:
  [employer-sms-provider-adapter.md](../06-deployment/employer-sms-provider-adapter.md).

## 8. Upload session, quarantine và malware scan

Mọi tệp từ cổng NTD (giấy phép, giấy tờ update request, DPA, logo, cover,
gallery) và CV ứng viên đi qua app `uploads`:

```text
uploading → quarantined → scanning → clean | rejected | error (retry → scanning) | expired
```

- API owner-scoped `/api/uploads/sessions/` (tạo, `content/` ghi byte vào
  quarantine, xem trạng thái, `cancel/`, `retry/`). Object của người khác trả
  `404`; không có endpoint download/claim chung. Purpose khai báo tường minh
  theo role: `employer_verification`, `employer_company_update`, `candidate_cv`.
- Quota số session và tổng byte theo owner; byte còn tồn trong quarantine vẫn
  chiếm quota tới khi cleanup thành công.
- ClamAV INSTREAM trên queue `upload-scan`, có timeout, retry giới hạn,
  reconciliation, expiry và cleanup idempotent. DOCX chỉ đọc bounded ZIP
  metadata và từ chối archive bất thường; không extract trước scan.
- Domain chỉ nhận tệp qua `claim_clean_upload(owner, expected_purpose)`: recheck
  owner, purpose, `clean` và one-time claim trong transaction. Sau scan, phía
  employer còn parse PDF (pypdf strict) và ảnh (Pillow verify); tệp clean nhưng
  hỏng cấu trúc bị từ chối và rollback claim.
- Frontend pre-scan toàn bộ tập tệp trước khi tạo request/hồ sơ, attach tuần tự
  và chỉ báo thành công khi mọi attach xong. Raw upload chỉ được dùng khi backend
  trả đúng `UPLOAD_PIPELINE_DISABLED`; lỗi scanner/reject/timeout không fallback.
- Retention (ER-D12): tệp clean giữ tối thiểu 730 ngày sau khi release, trừ
  legal hold; tệp độc hại xóa sớm sau khi lưu kết quả. Tệp có từ trước pipeline
  là `legacy_trusted`, không bị gắn kết quả scan giả (ER-D13).
- Storage tách public/private/quarantine; private và quarantine không có `.url()`
  công khai (ER-D30). Flag: `UPLOAD_QUARANTINE_ENABLED`,
  `EMPLOYER_UPLOAD_SESSION_REQUIRED`, `CANDIDATE_UPLOAD_SESSION_REQUIRED`;
  production từ chối bật strict khi quarantine chưa bật. Vận hành:
  [employer-upload-storage-boundary-runbook.md](../06-deployment/employer-upload-storage-boundary-runbook.md).

## 9. Gỡ liên kết công ty chọn nhầm

Áp dụng ER-D27/ER-D49. Admin có `employer_verification.unlink_company` thao tác
trên trang chi tiết tài khoản: `POST /api/admin/accounts/<id>/company-unlink-impact/`
(preview ký số) rồi `.../unlink-company/` với lý do. Chỉ áp dụng cho `member`
chưa có document, update request, lịch sử xác thực/MST, nhu cầu tuyển dụng,
campaign, job hay compliance hold active; owner không thuộc luồng này. Backend
khóa User → Recruiter → VerificationCase → Company, recheck snapshot, giữ công
ty, tách case nháp sạch, ghi `EmployerCompanyLinkEvent` append-only và audit
admin. Không chuyển bằng chứng sang công ty mới. Recruiter nhận thông báo
`company_link_removed`.

## 10. Thông báo và activity

- `EmployerNotification` ghi trong cùng transaction nghiệp vụ, unique
  `(recipient, dedupe_key)`; metadata theo allowlist, `action_path` map phía
  server. Sự kiện: duyệt/cần bổ sung/từ chối/thu hồi/hết hạn hồ sơ, giấy tờ cần
  bổ sung/bị từ chối, gỡ liên kết công ty.
- API: `GET /api/employer/notifications/`, `.../unread-count/`,
  `POST .../<public_id>/read/`, `.../read-all/`, `notification-preferences/`,
  `GET /api/employer/activities/`. Topbar có chuông + badge + popover; có trang
  lịch sử thông báo và activity.
- Email quyết định xác thực luôn gửi qua outbox (`EmployerVerificationNotification`)
  có retry; Celery sweep 60 giây phục hồi bản ghi pending/treo (ER-D50). Sự kiện
  trung gian cấu hình được qua preference.
- Retention hằng ngày xóa notification, activity và outbox terminal quá
  `EMPLOYER_EVENT_RETENTION_DAYS` (730 ngày, ER-D26). Activity không chứa
  secret, hash file hay storage key.

## 11. Readiness và cổng quyền workspace

`GET /api/employer/me/` trả `job_workspace_ready`, `verification_approved`,
`candidate_data_access`, `compliance_hold_active`, `dpa_status`, `blockers[]`;
session `/api/auth/me/` trả `employer_job_workspace_ready`. Field cũ
`employer_verification_completed` còn trong cửa sổ tương thích, không dùng cho
quyền mới.

| Capability | Điều kiện (tất cả, tài khoản phải active) |
| --- | --- |
| `job_workspace` | Onboarding xong (hồ sơ + email + nhu cầu), phone đã xác minh, liên kết công ty tường minh, giấy tờ đại diện current chưa bị reject, đã nộp văn bản DLCN ứng viên, `dpa_status ∈ {current, legacy_unversioned, outdated, grace}` |
| `verification` | Case `approved` của đúng recruiter và công ty hiện tại |
| `candidate_data` | Workspace ready + verification approved + DPA `current` + không có compliance hold active |
| `job_approval` (đăng tin công khai) | Verification approved đúng công ty của tin + DPA `current` + không có compliance hold |

Mỗi blocker có `code`, `capabilities`, `message`, `action`; frontend chỉ map
`action` qua allowlist route nội bộ. Hồ sơ pending/rejected không khóa workspace
nhưng luôn khóa dữ liệu ứng viên và đăng tin.

**Thực thi phía backend**

- Job/campaign list, detail, options, report, activity và mọi mutation recheck
  workspace (`EMPLOYER_WORKSPACE_BLOCKED`). Posting-context là ngoại lệ đọc để
  hiện blocker.
- Application list/detail/export/history/CV snapshot, dashboard recent
  applications và CV asset dùng cổng candidate-data (`CANDIDATE_DATA_BLOCKED`).
  Khi bị khóa vẫn trả số tổng hợp không định danh; tên, email, avatar, CV, link
  và activity ứng viên bị ẩn (ER-D29).
- Theo [ADR-0014](../02-tong-quan/adr-0014-job-post-moderation.md), tin công
  khai ngay khi NTD đăng; capability `job_approval` giữ tên cũ nhưng nghĩa là
  "được phép đưa tin lên công khai". Lúc đăng, backend khóa recruiter/company và
  tính lại blocker; không đạt thì tin ở `draft` và API trả
  `JOB_PUBLICATION_BLOCKED` kèm `blocked_reasons`.
- Quota đăng tin đếm tin đã từng đưa lên công khai: mặc định 3
  (`employer_free_job_quota`), 100 khi đạt Cấp 3 với DPA current
  (`employer_verified_level_three_job_quota`).

**Frontend**: `JobWorkspaceGuard` và `CandidateDataGuard` tách riêng. Route bị từ
chối khi readiness đã tải thành công thì chuyển về
`/tuyendung/app/employer-verify`; chỉ lỗi tải readiness mới giữ màn retry
fail-closed (ER-D42). Khi readiness chuyển `true → false`, query nhạy cảm ngừng
chạy và PII đã cache bị xóa.

## 12. Danh bạ công ty công khai

Theo [ADR-0013](../02-tong-quan/adr-0013-public-companies-api.md):
`GET /api/companies/` (anonymous) có hai chế độ: không `q` trả tối đa 18 công
ty nổi bật đã lọc theo recruiter approved, giấy tờ đủ, có logo, ảnh bìa, lĩnh
vực và tin công khai, xáo thứ tự mỗi lần (`Cache-Control: no-store`); có `q` thì
tìm không dấu theo tên/tên thương mại trên mọi Company, cursor 18 bản ghi. Không
trả MST, email, phone hay danh tính recruiter.

Frontend có `/cong-ty` (danh bạ) và `/cong-ty/tim-kiem?keyword=`; liên kết
công ty từ tin dẫn tới trang tìm kiếm theo tên, "việc làm của công ty" là
`/viec-lam?search=<tên>&search_by=company`. Chưa có trang chi tiết
`/cong-ty/:slug`, theo dõi, văn phòng hay báo cáo thông tin công ty; thương hiệu
gồm logo, ảnh bìa, gallery, mô tả, phúc lợi do owner quản lý. Mọi tin có một URL
canonical `/viec-lam/:slug`; `/brand/:companySlug/tuyen-dung/:slug` chỉ còn để
tương thích và SEO shell phát canonical về `/viec-lam/:slug`.

## 13. Giới hạn đã chấp nhận

- `company/search/` của cổng NTD trả cả danh mục khi `q` rỗng và trả `tax_code`
  đầy đủ; `GET /api/employer/company/` trả hồ sơ đầy đủ cho member. Đây là
  accepted risk, xem
  [employer-flow-security-audit-2026-08.md](../02-tong-quan/employer-flow-security-audit-2026-08.md).
- Hành động bảo mật NTD tự thực hiện (đổi mật khẩu, MFA, thu hồi phiên) chưa
  ghi audit log.
- MFA cho NTD là tùy chọn. Tra cứu MST không phải nguồn quyết định pháp lý.

## 14. Việc còn mở

- **Upload (ER-3)**: QA trên Chrome với session thật sau khi bật pipeline ở
  staging (import CV từ thư viện, tạo từ template, ứng tuyển, avatar, và các
  luồng upload employer); lặp lại kịch bản readiness/clean/EICAR/outage của
  scanner trên staging giống production, duyệt telemetry và worker queue, rồi
  mới bật `EMPLOYER_UPLOAD_SESSION_REQUIRED` và
  `CANDIDATE_UPLOAD_SESSION_REQUIRED`. QA local từng bị chặn vì Vite local
  không có reCAPTCHA site key.
- **Kích hoạt và soak (ER-8)**: chạy `audit_employer_workflow_rollout --strict`
  ở staging/production, bật flag theo thứ tự, theo dõi soak rồi mới mở PR dọn
  compatibility (`verification_completed`, status `pending` của update request,
  fallback `UPLOAD_PIPELINE_DISABLED`). Rollout hold dữ liệu thật chỉ chạy sau
  dry-run và ops duyệt.
- **DPA**: chưa có văn bản pháp lý chính thức được pháp chế duyệt để chốt
  `EMPLOYER_DPA_POLICY_VERSION`/hash; mẫu văn bản DLCN và link vẫn trỏ tài liệu
  tham khảo bên ngoài. Xem
  [employer-dpa-evidence-rollout.md](../06-deployment/employer-dpa-evidence-rollout.md).
- **SMS**: chưa chọn gateway/sender/template; production giữ
  `EMPLOYER_SMS_OTP_ENABLED=False` cho tới khi qua sandbox smoke.
- **Copy cảnh báo domain ở trang đăng ký**: `Register.jsx` cảnh báo đăng ký bằng
  email không thuộc tên miền công ty có thể bị giới hạn quyền mua hoặc sử dụng
  dịch vụ. Giới hạn này không tồn tại: email domain chỉ ảnh hưởng dấu tick, và
  sau [ADR-0015](../02-tong-quan/adr-0015-remove-commercial-services.md) không
  còn gì để mua. Cần sửa lại câu chữ.
- Hết hạn xác thực tự động (TTL/scheduler) chờ chính sách thời hạn pháp lý riêng.
