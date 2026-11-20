# 04 - API

Phạm vi:
- Danh sách endpoint theo module (auth, candidate, employer, cv, jobs, applications, ai)
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
| POST | `/api/auth/avatar/` | Upload avatar vào storage nội bộ (JPG/PNG/GIF/WebP, multipart `file`; DB lưu storage key; ảnh lớn hơn 1024 px được thu nhỏ). Cổng ứng viên cắt vuông phía client rồi gửi JPEG |
| DELETE | `/api/auth/avatar/` | Xóa avatar hiện tại (xóa file nội bộ, `avatar_url` về rỗng), trả `SessionUser` |
| GET | `/api/auth/oauth/{provider}/start/?portal=main\|employer&next=/...` | Bắt đầu social login (`provider` = google/facebook/linkedin), redirect sang provider. Cổng `employer` chỉ chấp nhận google |
| GET | `/api/auth/oauth/{provider}/callback/` | Provider gọi lại; verify state, tạo/liên kết user, redirect về trang callback frontend kèm `one_time_code` (hoặc `?error=`) |
| POST | `/api/auth/oauth/complete/` | Đổi `one_time_code` (1 lần dùng, TTL 60s) lấy `{user, access, refresh}` |
| GET/PATCH | `/api/candidate/profile/` | Đọc/cập nhật `gender` cho onboarding và cài đặt gợi ý việc làm (tự tạo profile legacy khi cần) |
| GET/PUT | `/api/candidate/job-preferences/` | Candidate: đọc/lưu nhu cầu việc làm chuẩn hóa. PUT yêu cầu 1–5 `desired_specialization_ids`, ít nhất một `preferred_province_ids`, `experience_level` và `desired_salary_vnd` > 0; đồng thời lưu hai quyết định consent. |
| GET/PATCH | `/api/candidate/email-notification-settings/` | Cài đặt nhận thông báo theo sự kiện thật (mọi field đều có nơi đọc): `application_received_email/_web`, `similar_jobs_in_application_email`, `cv_activity_email/_web`, `employer_invitation_email/_web`, `configured_job_alerts`, `suitable_job_recommendations`, `followed_company_jobs`, cùng `email_delivery_enabled` chỉ đọc (công tắc email toàn site). Kết quả xử lý hồ sơ luôn gửi, không có field. Field `_web` quyết định thông báo có vào chuông (đọc lúc phát), field email đọc lại lúc gửi; email chỉ gửi tới tài khoản đã xác thực. GET chưa có row trả mặc định mà không ghi DB; PATCH partial bỏ qua key không còn tồn tại. Ba email việc làm giữ luật bật cũ (`email_unverified`, `preferences_required`, `consent_required`). `followed_company_jobs` gom tin mới mỗi ngày 08:00 của các công ty đang theo dõi, không gửi trùng tin. |
| GET | `/api/candidate/notifications/?page=` | Thông báo đã giao của ứng viên, mới nhất trước (`delivered_at`); thông báo đang trong cửa sổ hoàn tác, đã hủy, hoặc thuộc loại ứng viên tắt kênh web (`show_in_inbox=false`) không xuất hiện. Nộp hồ sơ thành công tạo ngay thông báo "Hồ sơ đã được tiếp nhận" kèm email xác nhận có tối đa 5 việc làm tương tự. |
| GET | `/api/candidate/notifications/unread-count/` | `{count}` thông báo đã giao chưa đọc. |
| POST | `/api/candidate/notifications/{public_id}/read/`, `/api/candidate/notifications/read-all/` | Đánh dấu một/toàn bộ đã đọc; thông báo của người khác trả `404`. |
| GET/PATCH | `/api/candidate/recruiter-visibility/` | Đọc/bật-tắt consent để NTD tìm thấy hồ sơ; bật yêu cầu xác nhận và mọi quyết định được audit. |
| GET/PATCH | `/api/employer/me/` | Hồ sơ nhà tuyển dụng của tôi + canonical `job_workspace_ready`, `verification_approved`, `candidate_data_access`, `dpa_status`, `blockers[]`, `account_verification` (Cấp 0–3/quota) và `badge_eligibility` (năm tiêu chí dấu tick tách biệt; chỉ self mới thấy failure/action). Chỉ `position_title` sửa được. |
| POST | `/api/admin/accounts/{public_id}/company-unlink-impact/` | Xem tác động gỡ company chọn nhầm; reason bắt buộc, chỉ trả signed token khi relation clean |
| POST | `/api/admin/accounts/{public_id}/unlink-company/` | Confirm bằng exact reason + impact token; stale trả 409, relation đã có dữ liệu bị khóa, company/history không bị xóa |
| POST | `/api/employer/register/` | Đăng ký employer, tạo atomically user/recruiter/consent, trả JWT và gửi email xác thực. **Không tự tạo hoặc liên kết company**; company chỉ có sau thao tác rõ ràng ở settings |
| POST | `/api/employer/onboarding/registration/` | Hoàn thiện profile bắt buộc cho employer mới qua Google |
| GET/POST | `/api/employer/consulting-need/` | Đọc hoặc tạo **một lần** nhu cầu tuyển dụng ưu tiên; POST lặp lại trả `400` |
| GET/POST | `/api/employer/campaigns/` | Danh sách/tạo chiến dịch của chính recruiter. Cả read workspace và mutation yêu cầu `job_workspace_ready=true`. POST nhận `name` và thông tin đợt tuyển (`description`, `start_date`, `target_date`, `is_continuous`, `budget_min`, `budget_max`, `budget_source`); response có `headcount` = tổng số lượng tuyển của các tin trong chiến dịch; chiến dịch tạo ở `draft`, trừ khi gửi `activate=true` (tạo nhanh trong form đăng tin). Filter gồm `status` (một trạng thái, hoặc `ended` = hoàn tất + đã hủy), `q`, `scope=open|needs_review|active_jobs|expired_jobs`; `ordering=status` (mặc định ở giao diện: đang chạy → tạm dừng → đã lên lịch → nháp → hoàn tất → đã hủy) hoặc `activity|newest|oldest|name`. Response phân trang có thêm `status_counts` (số chiến dịch theo từng trạng thái, `ended`, `all`; tôn trọng `q`). |
| GET/PATCH | `/api/employer/campaigns/{public_id}/` | Xem/sửa chiến dịch do chính recruiter sở hữu và workspace đang ready. PATCH ghi tên và thông tin đợt tuyển; từ chối sửa chiến dịch đã kết thúc, đổi `start_date` sau khi đã chạy, hoặc `target_date` trước hạn nộp của tin đang tuyển. Response có `first_activated_at`, `ended_at`, `ended_by`, `active_days`. |
| GET | `/api/employer/campaigns/options/` | Option để gắn tin (trừ chiến dịch hoàn tất/hủy). |
| POST/GET | `/api/employer/campaigns/{public_id}/status/` | `report/` | Dừng/mở lại/hoàn tất/hủy/hủy lịch theo transition hợp lệ (mục 2 của đặc tả chiến dịch); `draft|scheduled → active` trả `CAMPAIGN_LAUNCH_REQUIRED`. Hoàn tất/hủy đóng mọi tin đang tuyển của chiến dịch. Report trả tổng tin theo trạng thái, lượt xem, tổng/CV mới, phễu và hồ sơ 7 ngày. |
| GET/POST | `/api/employer/campaigns/{public_id}/channels/` | Kênh phân phối (`apps.campaigns`). GET trả từng kênh kèm `target`, `jobs` (public_id tin trong bài), `link` (link chính của bài), `links` (mọi link theo dõi: `landing`, `company`, rồi một dòng mỗi tin đang mở của chiến dịch, dạng `{key, label, url}`), `rendered_content` (đã thay `{link}` và `{link:<mã tin>}`), `clicks`, `unique_clicks`, `applications`, `hires`, `cost`. POST `{kind, label}`; tên trùng trong chiến dịch hoặc chiến dịch đã kết thúc trả 400. |
| PATCH/DELETE | `/api/employer/campaigns/{public_id}/channels/{channel_id}/` | Sửa `label`, `target` (`landing`/`job`/`company`), `jobs` (tin ngoài chiến dịch trả 400), `content` (đánh dấu `content_source=manual`), `posted` (true ghi `posted_at`), `posted_url`; DELETE xóa kênh, hồ sơ đã nhận giữ `acquisition_channel`. |
| POST | `/api/employer/campaigns/{public_id}/channels/{channel_id}/content/` | Soạn nội dung bằng AI (`ai_core.generate_structured`, use case `campaign_channel_post`, chỉ dữ liệu công khai của tin). AI tắt hoặc lỗi thì dùng mẫu có sẵn và trả `fallback_reason` = `ai_disabled`/`ai_failed`; vượt 20 lượt/ngày/người trả 429. |
| GET/POST, DELETE | `/api/employer/campaigns/{public_id}/channels/{channel_id}/costs/`, `.../costs/{id}/` | Sổ chi phí nhập tay `{amount, incurred_on, note}`. |
| GET/POST | `/api/employer/campaigns/{public_id}/channels/{channel_id}/posts/` | Bài đăng Fanpage của kênh (chỉ kênh `facebook_page`). POST `{connection, scheduled_for?, message?, images?}` (`images`: tối đa 4 khóa ảnh lấy từ `post-images/`): bỏ trống giờ là đăng ngay, bỏ trống nội dung thì dùng nội dung đã soạn có link theo dõi. Mỗi bài trả `status`, `status_label`, `last_error_code` và `images` (URL), `error_message` (lỗi diễn đạt kèm cách xử lý, ví dụ link `localhost` với lỗi Graph 1500). |
| GET/POST | `/api/employer/campaigns/{public_id}/channels/{channel_id}/post-images/` | GET trả `company_images` (ảnh bìa, logo công ty nếu lưu ở ProCV) để chọn nhanh. POST multipart `file` (JPG/PNG/WebP/GIF ≤ 5 MB): ảnh được mã hóa lại (bỏ EXIF, cạnh dài tối đa 2048 px) và lưu ở media công khai, trả `{path, url}`. Chỉ kênh `facebook_page` của chiến dịch chưa kết thúc; throttle 60/giờ. |
| PATCH/DELETE | `.../posts/{post_id}/` | PATCH `{scheduled_for}` hẹn lại (bài đã hẹn, hoãn hoặc lỗi); DELETE hủy bài chưa đăng. |
| GET | `/api/employer/social/networks/` | Các mạng tự đăng được: `key`, `platform`, `label`, `channel_kind`, `capabilities` (`max_chars`, `max_images`, `requires_image`, `supports_delete`) và `simulated` (mạng đang chạy provider giả lập). |
| GET, DELETE | `/api/employer/social/connections/`, `.../{connection_id}/` | Tài khoản mạng xã hội đã kết nối: `network`, `network_label`, `account_id`, `account_name`, `account_picture_url`, `simulated`, trạng thái (không bao giờ trả token). DELETE ngắt kết nối và hủy bài đang hẹn. |
| POST | `/api/employer/social/{network}/authorize/` | Trả `{url}` để chuyển sang hộp cấp quyền của mạng (state ký gồm mạng và nonce một lần, 10 phút). `404` khi mạng không hỗ trợ. |
| GET | `/api/employer/social/{network}/callback/` | Callback OAuth (không cần JWT): đổi mã, liệt kê tài khoản, rồi 302 về `/tuyendung/app/account/settings/integrations?network=<n>&social_select=<nonce>` hoặc `&social_error=denied|expired|provider`. `/api/employer/social/facebook/callback/` vẫn nhận cho `facebook_page` vì Redirect URI đó đã khai với Meta. |
| GET/POST | `/api/employer/social/{network}/pending/{nonce}/` | GET danh sách tài khoản vừa cấp quyền; POST `{account_id}` lưu kết nối. |
| GET | `/api/employer/campaigns/{public_id}/channel-report/` | So sánh theo nguồn: mỗi kênh (người bấm, hồ sơ, tỷ lệ nộp = hồ sơ ÷ người bấm, trúng tuyển, đã chi, chi phí/hồ sơ, chi phí/trúng tuyển) và ba nguồn tự nhiên (mời từ kho, gợi ý ProCV, tự tìm thấy); `totals` có % ngân sách đã dùng. |
| GET | `/api/employer/campaigns/{public_id}/health/` | `{health, history}`: chỉ số và dự báo hiện tại (`status`, `headcount`, `accepted`, `forecast`, `required_velocity`, `velocity_7d`, `hire_rate`, `stage_rates`, `pipeline`, `funnel`, `response`, `budget`, `silent_channels`, `alerts`; chỉ số thiếu mẫu số là `null`) và tối đa 60 ảnh chụp ngày. Công thức ở [suc-khoe-chien-dich.md](../07-algorithms/suc-khoe-chien-dich.md). |
| GET | `/api/employer/campaigns/{public_id}/report/export/?type=xlsx\|pdf` | Tải báo cáo chiến dịch (chỉ số liệu tổng hợp, không có dữ liệu ứng viên). Throttle 20/giờ; PDF lỗi trả 400. Tham số là `type` vì DRF dành `format` cho renderer. |
| GET | `/api/public/campaigns/{slug}/` | Trang tuyển dụng công khai (AllowAny, throttle): `name`, `intro`, `state` = open/paused/upcoming/ended, khoảng thời gian, công ty. 404 với nháp, chiến dịch không có công ty, đã tắt trang hoặc chủ tài khoản bị khóa. Danh sách tin lấy qua `GET /api/public/jobs/?campaign=<public_id>`. |
| GET | `/r/{code}` (ngoài `/api`) | Link theo dõi: đếm lượt bấm (không cookie, không lưu IP), 302 về `/viec-lam/<slug>` khi kênh trỏ tới tin còn công khai và chiến dịch đang chạy, ngược lại về `/tuyen-dung/<slug>`; luôn kèm `?ref=` ký bằng `TimestampSigner` (hạn 30 ngày). |
| GET/PUT/POST | `/api/employer/campaigns/{public_id}/launch/` | Wizard thiết lập (`apps.campaigns`). GET trả `draft_jobs`, `attachable_jobs`, `campaign_jobs`, `check` (`ready`, `items[]`, `job_problems[]`), `can_schedule`, `statement_version`, `last_error`. PUT `{publish_job_ids, attach_job_ids}` lưu lựa chọn tin. POST `{mode: now|scheduled, accepted_statement_version}` kích hoạt theo kiểu tất cả hoặc không gì cả; lỗi `CAMPAIGN_NOT_READY` (kèm `items`, `job_problems`), `CAMPAIGN_LAUNCH_FAILED` (kèm `jobs`), `JOB_RESPONSIBILITY_REQUIRED`. Trả `{public_id, status}`. |
| GET | `/api/employer/campaigns/{public_id}/activities/` | Activity owner-only. Event application chỉ trả candidate actor/name/deep-link khi `candidate_data_access=true`; nếu chỉ workspace-ready thì metadata được allowlist/redact. |
| POST/GET | `/api/shared/uploads/sessions/` · `/api/shared/uploads/sessions/{public_id}/` | Tạo và poll upload session owner-scoped. State machine `uploading → quarantined → scanning → clean\|rejected\|error\|expired`; response không lộ storage key hoặc scanner evidence. |
| POST | `/api/shared/uploads/sessions/{public_id}/content/` · `cancel/` · `retry/` | Gửi byte vào quarantine, hủy hoặc retry bounded. Chỉ owner và purpose/role hợp lệ; chỉ `clean` có thể attach vào nghiệp vụ. |
| GET | `/api/employer/phone/check/?phone=` | Compatibility format check trả kết quả generic; không tiết lộ số đã thuộc tài khoản khác |
| POST | `/api/employer/phone/send-otp/` | Re-auth bằng mật khẩu, tạo challenge actor-bound và gửi OTP qua SMS; cooldown 60 giây, hết hạn 10 phút |
| GET | `/api/employer/phone/challenges/{public_id}/` | Poll trạng thái challenge của chính actor; không trả số điện thoại, OTP, provider ID hoặc secret |
| POST | `/api/employer/phone/verify/` | Nhận `{challenge_id,code}`; xác thực initial/change/reverify, chống replay và giới hạn 5 lần sai |
| POST | `/api/employer/dpa/accept/` | Chấp nhận exact DPA hiện hành bằng `policy_version` + `document_sha256`; stale trả 409 |
| GET | `/api/employer/company/` | Công ty của tôi (chỉ đọc — thay đổi thông tin qua update-requests) |
| POST | `/api/employer/company/create/` | Tạo hồ sơ catalogue công ty mới, không phụ thuộc trạng thái xác thực SĐT; người tạo là owner và liên kết có hiệu lực ngay. Company không có verification lifecycle. Bị từ chối nếu recruiter đã tạo/chọn một công ty |
| GET | `/api/employer/company/search/?q=&page=` | Catalogue phân trang `{count,next,previous,results}`, cố định 6 bản ghi/trang. Không có `q`: công ty thật mới tạo, mới nhất trước; có `q`: tìm không dấu theo tên đăng ký / tên thương mại / MST. Không trả placeholder từ luồng đăng ký cũ |
| GET | `/api/public/companies/?q=&cursor=` | Danh bạ công khai. Không `q`: tối đa 18 company featured đã qua eligibility, finite và không có `count`. Có `q`: tìm không dấu trên tên/tên thương mại trong mọi `Company`, không áp dụng verification/completeness gate; trang đầu trả exact `count`, trang cursor sau bỏ `count`. DTO public-safe không trả MST/email/phone/raw address/recruiter và luôn redact địa chỉ hộ kinh doanh. Cả hai chế độ loại công ty đang bị tạm ẩn trang. |
| GET | `/api/public/companies/{slug}/` | Trang công ty công khai (ADR-0017), xem [chi tiết bên dưới](#trang-công-ty-công-khai-adr-0017). Slug lạ hoặc công ty bị tạm ẩn trả `404 {detail}`. |
| GET | `/api/public/companies/{public_id}/similar/` | `{results}`: tối đa 6 công ty cùng lĩnh vực chính, không bị tạm ẩn, không gồm chính nó; công ty đang tuyển xếp trước. Item cùng shape với danh bạ. |
| GET | `/api/public/companies/{public_id}/job-facets/` | `{locations: [{id, name, count}]}`: tỉnh/thành của các tin đang công khai của công ty, xếp theo `count` giảm dần rồi tên; `id` dùng cho `GET /api/public/jobs/?company=&location=`. |
| GET/PUT/DELETE | `/api/public/companies/{public_id}/follow/` | Candidate-only (anonymous `401`, role khác `403`). Cả ba trả `{following, notify_new_jobs, follower_count}`; PUT nhận `{}` hoặc `{notify_new_jobs}` và idempotent, DELETE idempotent. Công ty lạ hoặc đang bị tạm ẩn trả `404`. PUT/DELETE dùng throttle `company_follow` 60/giờ theo tài khoản. Xem [chi tiết](#theo-dõi-và-báo-cáo-trang-công-ty). |
| GET | `/api/candidate/followed-companies/?page=&page_size=` | Candidate-only. `{count,next,previous,results}`; item gồm mọi key của danh bạ công ty cộng `followed_at`, `notify_new_jobs`; theo dõi mới nhất trước, loại công ty đang bị tạm ẩn. |
| POST | `/api/public/companies/{public_id}/reports/` | Candidate-only. Body `{reason, section_key, detail}`; trả `201 {public_id, status}`. Mỗi ứng viên chỉ có một báo cáo `pending` cho mỗi công ty (trùng trả `400 {detail}`); công ty lạ hoặc bị tạm ẩn trả `404`. Throttle `company_report` 10/giờ theo tài khoản. |
| GET | `/api/employer/company/catalogs/` | Source-of-truth cho `business_types`, `company_sizes`, `markets`, `target_customers` của form công ty |
| POST | `/api/employer/company/join/` | Liên kết ngay với công ty có sẵn, không phụ thuộc trạng thái xác thực SĐT hay admin duyệt: multipart chỉ cần `company`; membership có hiệu lực ngay. API vẫn nhận tùy chọn `proof_type` (`business_registration` hoặc `authorization_and_id`) và file giấy tờ khi cần bổ sung hồ sơ. Bị từ chối nếu recruiter đã tạo/chọn một công ty |
| GET/POST | `/api/employer/company/domain-claims/` | Liệt kê claim của company hiện tại hoặc tạo DNS TXT challenge cho exact domain được suy từ mailbox hiện tại đã xác thực. Plaintext TXT value chỉ có trong response tạo; list không trả lại secret. Pending không giữ chỗ domain toàn cục. |
| POST | `/api/employer/company/domain-claims/{public_id}/verify/` | Kiểm tra DNS TXT có timeout; đúng challenge thì chuyển `verified`, xung đột active company khác trả 409. Không gọi DNS trong API job/list. |
| POST | `/api/employer/company/domain-claims/{public_id}/rotate/` | Nhận `lock_version`, vô hiệu challenge cũ và trả TXT value mới đúng một lần; stale/email-domain đổi bị từ chối. |
| POST | `/api/employer/company/domain-claims/{public_id}/request-manual-review/` | Nhận `lock_version` + `reason`, xóa challenge và đưa claim vào hàng chờ admin fallback có audit. |
| POST | `/api/employer/company/logo/` \| `cover/` \| `images/` | Gắn logo/cover/ảnh giới thiệu từ `upload_session` clean purpose `employer_company_update`; backend tạo public derivative JPG/PNG/WebP tối đa 5 MB và giữ private-original audit link. Raw `file` chỉ còn trong compatibility window; strict mode trả `UPLOAD_SESSION_REQUIRED`. Gallery tối đa 10 ảnh; ảnh lớn được thu về trong 2400×1600, không ép tỉ lệ. |
| DELETE | `/api/employer/company/logo/` \| `cover/` | Xóa logo/cover; xóa logo đồng thời đặt `has_no_logo=true`. Mọi endpoint ảnh công ty (upload và xoá) nhận owner (luật cũ) hoặc recruiter đang có `can_edit_content` của trang công ty; người khác trả `400 {detail}`. |
| DELETE | `/api/employer/company/images/{id}/` | Xóa ảnh giới thiệu (owner hoặc người biên tập trang còn hiệu lực) |
| GET | `/api/employer/company/page/` | Workspace trang công ty (ADR-0017): `{company, permissions, registry, layout, pinned_jobs, content, stats}`. Mọi recruiter đã liên kết công ty đọc được; chưa liên kết trả `404`. `permissions` do server tính tại thời điểm request. Xem [chi tiết](#workspace-trang-công-ty-của-nhà-tuyển-dụng). |
| PATCH | `/api/employer/company/page/layout/` | Cần `can_edit_layout`. Body `{lock_version, section_order?, hidden_sections?, accent?, pinned_job_public_ids?}`; áp dụng ngay lên trang công khai và trả lại payload workspace. `409 COMPANY_PAGE_LAYOUT_STALE` kèm `layout` hiện tại khi `lock_version` cũ; `403 COMPANY_PAGE_EDIT_FORBIDDEN`; `400` theo field. Throttle `company_page_layout` 60/giờ theo tài khoản. |
| POST | `/api/employer/company/page/content/` | Cần `can_edit_content`. Body `{changes: {…}}` chỉ gồm `headline, description, culture, employee_benefits, video_url, social_links, benefits, offices, logo_pending, cover_pending, gallery_pending, gallery_deletions`. Mặc định đăng ngay và ghi một thay đổi chờ hậu kiểm; khi công ty bị bật duyệt trước (`content_form.review_mode = review`) thì gộp vào yêu cầu cập nhật đang mở của chính người gửi. Trả payload workspace kèm `content_change` (mã để tải ảnh đã báo trước; `null` khi vào yêu cầu chờ duyệt). `409 COMPANY_UPDATE_IN_REVIEW` khi khối đó đang nằm trong yêu cầu đang thẩm định; `403 COMPANY_PAGE_EDIT_FORBIDDEN`; `400` theo field. Throttle `company_page_content` 30/giờ theo tài khoản. Xem [chi tiết](#nội-dung-trang-qua-kiểm-duyệt). |
| GET | `/api/employer/company/page/pinnable-jobs/?q=` | Cần `can_edit_layout`. `{results: [{public_id, title, slug, published_at}]}`: tối đa 20 tin đang công khai của công ty, mới nhất trước; `q` khớp tiêu đề không dấu. Chỉ có siêu dữ liệu công khai. |
| GET/POST | `/api/employer/company/page/editors/` | Cần `can_manage_editors`. GET `{results: [row]}`; POST `{member_id}` trả `201` row của member. `400 {code, detail}` với `EDITOR_NOT_VERIFIED`, `EDITOR_ALREADY_GRANTED`, `EDITOR_IS_OWNER`; member lạ trả `404`. POST/DELETE dùng throttle `company_page_editors` 20/giờ. |
| DELETE | `/api/employer/company/page/editors/{grant_public_id}/` | Cần `can_manage_editors`. Thu hồi grant đang hiệu lực, trả row của member với `grant: null`; grant lạ hoặc đã thu hồi trả `404`. |
| GET/POST | `/api/employer/company/documents/` | Giấy tờ công ty; contract chuẩn POST `doc_type` + `upload_session`, có thể kèm `update_request` của chính actor. Purpose là `employer_verification` hoặc `employer_company_update` theo workflow; backend recheck owner/clean/one-time claim và structural validation. Metadata private tiếp tục redacted theo quyền. `trade_name_proof` có thể dùng `source_type=website` + `website_url`; ĐKDN/ủy quyền/định danh nhận JPG/PNG/PDF, `candidate_dpa` nhận PDF/DOCX. Raw `file` chỉ còn compatibility window. |
| POST | `/api/employer/company/documents/preview/` | Luôn trả `409 UPLOAD_SCAN_REQUIRED`; không parse/convert raw Office file trước malware scan. |
| GET | `/api/employer/company/documents/{id}/content/` | Mở private binary sau object-level authorization. Uploader/requester và company owner được phép; member khác, outsider hoặc URL website trả `404`. Response dùng `Cache-Control: private, no-store` và không phát storage key/signed URL trước authorization |
| GET/POST | `/api/employer/company/update-requests/?scope=mine\|company` | Mọi employer đã liên kết công ty có thể tạo yêu cầu riêng, tối đa một active request trên mỗi `(company, requester)`; nhiều member được gửi song song. Recruiter UI chỉ gọi `scope=mine`, không hiển thị lịch sử công ty. Response có `current_revision_public_id`, `allowed_actions`, `submitted_at`, base/lock version; mỗi submit/resubmit tạo revision bất biến. `in_review` read-only; diff rỗng bị từ chối và field không sửa không được tự thêm vào `changes`. Các field nội dung trang (`headline, culture, video_url, social_links, benefits, offices`) cần `can_edit_content` của trang công ty, thiếu trả `403 COMPANY_PAGE_EDIT_FORBIDDEN`; field cũ vẫn mở cho mọi member (ER-D05). |
| POST | `/api/employer/company/update-requests/{public_id}/{withdraw\|cancel}/` | Rút/hủy trước review bằng `lock_version`; requester được withdraw, company owner được cancel. Backend ghi append-only event và recheck quyền/status dưới lock. |
| GET/POST | `/api/admin/company-update-requests/{public_id}/` · `start-review/` · `review/` | Admin mở exact request, nhận review bằng exact revision/lock rồi mới ra quyết định cuối `approved\|changes_requested\|rejected`. Duyệt từng document không tự quyết định toàn request. Apply so conflict theo field (cả `benefits`, `offices`) và không partial apply. Payload có `previews` cạnh `media_previews`: `previews.benefits: [{name, note}]`, `previews.offices: [{label, address, province_name, is_headquarters}]` (chỉ có key đang được đề xuất); `current_values.benefits`/`current_values.offices` dùng cùng shape. |
| GET | `/api/admin/company-content-changes/?status=unreviewed\|reviewed\|reverted\|all&company=&q=&page=` | Hậu kiểm nội dung trang công ty, mới nhất trước; mặc định `unreviewed`, bỏ lần lưu chỉ báo ảnh mà chưa tải. Mỗi dòng `{public_id, status, company: {public_id, name, public_path, content_review_required}, actor_email, sections, changed_fields: [{field, label, kind: text\|html\|image\|images\|list, before, after}], created_at, reviewed_by_email, reviewed_at, review_note}`; `before/after` đã đổi sang URL ảnh và tên phúc lợi/tỉnh. |
| POST | `/api/admin/company-content-changes/mark-reviewed/` | Body `{public_ids: [..]}` (1–100); đóng các thay đổi `unreviewed`, xoá tệp ảnh chúng đã thay, trả `{count}`. |
| POST | `/api/admin/company-content-changes/{public_id}/revert/` | Body `{reason, require_review?}` (`reason` 10–500 ký tự). Khôi phục giá trị trước (kể cả ảnh, ảnh thư viện đã xoá), thông báo `company_content_reverted` cho người sửa; `400 {detail, fields}` khi đã có thay đổi mới hơn ở cùng trường. `require_review=true` bật luôn duyệt trước cho công ty. |
| POST | `/api/admin/companies/{public_id}/content-review/` | Body `{action: require\|release, reason}`; bật/tắt `content_review_required`, ghi `CompanyPageEvent` và audit; trả cùng payload với `public-page/`. |
| GET | `/api/admin/companies/{public_id}/public-page/` | Trả `{public_path, is_indexable, policy_hold: {active, reason, actor_name, at}, content_review_required, profile}`; `profile` là đúng DTO của `GET /api/public/companies/{slug}/` và vẫn được dựng khi trang đang bị tạm ẩn. |
| POST | `/api/admin/companies/{public_id}/policy-hold/` | Body `{action: apply\|release, reason}` với `reason` 10–500 ký tự; trả cùng payload với `public-page/`. Lặp lại quyết định đang có hiệu lực trả `400`. Mỗi lần ghi `CompanyPageEvent` và nhật ký quản trị, không đổi `Company.updated_at`. |
| GET | `/api/admin/company-reports/?status=&reason=&company=&q=&ordering=&page=` | Hàng chờ báo cáo trang công ty, phân trang chuẩn. `company` là `public_id` công ty; `q` tìm theo mã báo cáo, mã/tên công ty (không dấu), email người báo cáo, nội dung và ghi chú kết luận. `ordering` chỉ nhận whitelist `company_name\|reason\|detail\|reporter_email\|status\|created_at` (thêm `-` để giảm dần), giá trị khác trả `400`. Không có endpoint summary; đếm hàng chờ bằng `?status=pending&page_size=1`. |
| POST | `/api/admin/company-reports/{public_id}/resolve/` | Body `{status: upheld\|dismissed, note, apply_hold}`; `note` bắt buộc, tối đa 1000 ký tự. `apply_hold=true` chỉ hợp lệ với `upheld`, tạm ẩn trang trong cùng transaction với `note` làm lý do và bỏ qua nếu trang đã bị ẩn. Chỉ báo cáo `pending` được kết luận. Trả row đã cập nhật; ghi nhật ký `resolve_company_report`. Không ảnh hưởng huy hiệu xác thực của recruiter. |
| POST | `/api/admin/company-reports/{public_id}/reverse/` | Quyền như `resolve/`. Body `{note}` bắt buộc. Đưa báo cáo `upheld`/`dismissed` về `pending`, xoá `resolution_note`/`resolved_at`/`resolved_by_email`, thêm một dòng lịch sử; không bao giờ gỡ tạm ẩn trang. Bị từ chối `400` nếu người báo cáo đã có báo cáo `pending` khác cho cùng công ty. Ghi nhật ký `reverse_company_report`. |
| GET/POST | `/api/admin/company-domain-claims/` · `{public_id}/manual-review-impact/` · `approve-manual/` · `reject-manual/` · `revoke-impact/` · `revoke/` | Hàng chờ domain dùng permission `employer_domain.view/review/revoke`. Mọi quyết định ghi reason, preview signed impact token, recheck stale dưới lock và append audit; manual proof hết hạn sau 12 tháng. |
| GET | `/api/employer/industries/all/` | Toàn bộ lĩnh vực cho dropdown tạo hồ sơ công ty |
| GET | `/api/employer/dashboard/` | Read-model dashboard employer: account/verification, KPI tổng hợp, activity 7 ngày, nhu cầu và tin gần đây. `recent_applications` chỉ có khi `candidate_data_access=true`. |
| GET | `/api/admin/dashboard/` | Dashboard cổng quản trị (`period` = 7, 30, 90; mặc định 30): hàng chờ kèm quá hạn/thời điểm cũ nhất, KPI so kỳ trước, chuỗi theo ngày, phễu ứng tuyển, tình trạng tin, an toàn, ngành nghề, AI. |
| GET | `/api/admin/dashboard/queues/` | Chỉ phần hàng chờ của dashboard quản trị (đếm, quá hạn, thời điểm cũ nhất, hạn xử lý) cho badge sidebar và chuông header; cổng quản trị gọi lại mỗi 30 giây. |
| GET | `/api/employer/notifications/?page=` | Danh sách thông báo website của employer hiện tại, mới nhất trước; có `is_read`, internal `action_path` và metadata đã redact. |
| GET | `/api/employer/notifications/unread-count/` | Số thông báo chưa đọc của employer hiện tại. |
| GET/PATCH | `/api/employer/notification-preferences/` | Email quyết định xác thực quan trọng luôn bật; employer cấu hình `intermediate_verification_email`, `new_application_email` và `campaign_weekly_report_email` (PATCH từng phần). Hồ sơ mới luôn tạo thông báo `application_received` trên chuông; email gửi tới địa chỉ nhận hồ sơ của tin, không chứa tên ứng viên. |
| POST | `/api/employer/notifications/{public_id}/read/`, `/api/employer/notifications/read-all/` | Đánh dấu một hoặc toàn bộ notification của chính actor; resource actor khác trả `404`. |
| GET | `/api/employer/activities/?page=` | Activity business/security đã redact, retention 730 ngày. |
| GET | `/api/public/locations/?level=&parent=&search=` | Tra cứu địa điểm (cascading tỉnh -> xã/phường), public — không phân trang (trả tối đa 500 bản ghi/lần) |
| GET | `/api/public/jobs/categories/` | Danh sách ngành nghề (taxonomy 3 cấp: nhóm nghề/nghề/vị trí chuyên môn), public, có phân trang mặc định |
| GET | `/api/public/jobs/benefits/` | Danh mục quyền lợi chuẩn hóa (đang active), public, không phân trang |
| GET | `/api/public/jobs/languages/` | Danh mục ngoại ngữ (đang active), public, không phân trang |
| GET | `/api/public/jobs/stats/` | Thống kê thị trường việc làm cho dashboard trang chủ (số job/công ty, job mới 24h, tăng trưởng 7 ngày, nhu cầu theo ngành, job mới nhất), public |
| GET | `/api/public/jobs/best/?rotation_seed=&page=&page_size=` | Box Việc làm tốt nhất trang chủ: chỉ tin public có nhãn `tier=top` do quản trị viên gán, luân phiên ổn định theo seed riêng và không kế thừa thứ tự của danh sách việc làm |
| GET | `/api/candidate/jobs/recommendations/for-me/?page=&page_size=` | Candidate-only: feed chỉ dùng nhu cầu công việc đã lưu (vị trí taxonomy/tự nhập, kỹ năng, lương, kinh nghiệm, tỉnh, relocate), có setup/consent và phân trang. `sources.cv=false`, `source_cv=null`; loại job đã ứng tuyển/đã ẩn trước cap. |
| GET | `/api/candidate/jobs/recommendations/by-cv/{cv_public_id}/` | Candidate owner-only: tối đa 6 việc làm giải thích được cho CV vừa lưu; yêu cầu consent gợi ý trước khi đọc nội dung CV, thiếu consent trả `403` và client hiển thị CTA tới cài đặt. |
| GET | `/api/candidate/jobs/recommendations/inline/?page=&ranking_seed=&excluded=` | Candidate-only: `ranking_seed` bắt buộc; lane độc lập có xác suất deterministic 40% theo candidate/seed/page; trả `not_shown` hoặc 1–2 job cùng `after_result_index` zero-based. `excluded` là CSV tối đa 50 public ID; luôn loại tin đã ứng tuyển/đã ẩn. |
| POST | `/api/candidate/jobs/recommendations/hidden/` | Candidate-only, idempotent: body `{job_public_id, source}` với source `matching`, `homepage` hoặc `inline`; ẩn đúng job khỏi các bề mặt cá nhân hóa. |
| DELETE | `/api/candidate/jobs/recommendations/hidden/{job_public_id}/` | Candidate-only, owner-scoped và idempotent: hoàn tác ẩn; không tác động bản ghi ẩn của ứng viên khác. |
| GET | `/api/candidate/jobs/recommendations/by-saved/?limit=` | Candidate-only: so pairwise tối đa 20 tin lưu gần nhất, trả similarity score/details/reasons, loại tin đã lưu/đã ứng tuyển/không còn public; fallback tin active mới nhất khi chưa có tín hiệu. `limit` từ 1–20, mặc định 12. |
| GET | `/api/cv-templates/` | **Legacy V1** public catalogue; chuyển sang `/api/public/cv-templates/` |
| GET | `/api/cv-templates/{slug}/` | **Legacy V1** template detail; chuyển sang `/api/public/cv-templates/{slug}/` |
| GET/POST | `/api/cvs/` | **Legacy V1** candidate CV; không dùng cho client mới |
| GET/PUT/PATCH/DELETE | `/api/cvs/{public_id}/` | **Legacy V1** CV detail; chuyển sang V2 metadata/draft endpoints |
| POST | `/api/cvs/upload/` | **Legacy V1** upload; chuyển sang `/api/candidate/cvs/imports/` |
| GET | `/api/public/cv-templates/?locale=&category=&tag=&page=` | Public catalogue V2. Card DTO gồm localization, category/tag và `colors[]`; không lộ layout/style JSON hoặc renderer config. |
| GET | `/api/public/cv-templates/{slug}/` | Public template detail V2: card fields + preview metadata, `seo_title`/`seo_description` theo `locale`, renderer contract an toàn và section list. |
| GET | `/api/public/cv-templates/{slug}/related/` | Template published liên quan theo category, cùng locale. |
| GET | `/api/public/cv-categories/?type=` | Taxonomy template active (`style`, `feature`, `position`, `audience`). |
| GET | `/api/public/cv-position-options/?locale=&q=` | Vị trí chuyên môn active có `CvPositionProfile` bật, có localization và content resolve được; response gồm `public_id`, `slug` (dùng cho query `vi-tri` của trang chi tiết mẫu), `display_name`, `name_vi`, có ordering quản trị được. |
| GET | `/api/public/cv-position-details/?position_public_id=&locale=` | Khung section `position_details` (trường riêng của vị trí, nhãn theo ngôn ngữ, giá trị rỗng) hoặc `section: null`; editor dùng khi ứng viên đổi vị trí. Public cache 5 phút. |
| GET | `/api/public/cv-position-preview/?position_public_id=&locale=&experience_band=&template_public_id=&theme_color=` | Resolve nội dung theo nhóm kinh nghiệm gần nhất (`entry/junior/mid/senior`, mặc định `junior`, giá trị khác → 400), riêng của vị trí trước chung; response có `source` (`curated`/`generic`/`blank`), `experience_band`; khi có template trả thêm canonical `document`, `renderer`, `revision`. `source=blank` compose document trống. Contract content-only cũ vẫn hoạt động nếu thiếu template. |
`locale` trên catalogue/position preview và `language` khi tạo/import CV chỉ
nhận `vi-VN` hoặc `en-US` (enum `CvLanguage` ở
`apps/cv_templates/models/language.py`); giá trị khác trả `400`. Từ CVT-1a không
còn API quản lý ngôn ngữ (`/api/public/site/locales/`, `/api/admin/site/locales/`).

### Trang công ty công khai (ADR-0017)

`GET /api/public/companies/{slug}/` cho phép anonymous, dùng chung throttle
`public_companies` với danh bạ. Response do một builder duy nhất sinh ra
(`build_public_company_profile`); frontend render theo `sections[].type` và
`sidebar[].type`, không suy luận từ tên cột:

```json
{
  "public_id": "co_ab12",
  "slug": "fpt-software",
  "canonical_path": "/cong-ty/fpt-software",
  "indexable": true,
  "identity": {
    "display_name": "FPT Software",
    "legal_name": "Công ty TNHH Phần mềm FPT",
    "headline": "Kiến tạo tương lai số",
    "logo_url": "https://…/logo.png",
    "cover_image_url": "",
    "website_url": "https://fpt-software.com",
    "industries": [{"id": 1, "name": "Công nghệ thông tin", "slug": "cong-nghe-thong-tin", "is_primary": true}]
  },
  "stats": {"active_public_job_count": 12, "follower_count": 34, "company_size": "100-499", "company_size_display": "100 - 499 nhân viên", "founded_year": 2010},
  "theme": {"accent": {"key": "brand", "primary": "#00b14f", "hover": "#008a3e", "soft": "#f0fbf5"}},
  "sections": [
    {"key": "about", "type": "rich_text", "title": "Giới thiệu công ty", "body_html": "<p>…</p>"},
    {"key": "jobs", "type": "jobs", "title": "Việc làm đang tuyển", "pinned_job_public_ids": ["jb_ab12"]},
    {"key": "benefits", "type": "benefits", "title": "Phúc lợi", "items": [{"name": "Bảo hiểm sức khoẻ", "icon": "shield", "category": "welfare", "note": "Cho cả gia đình"}], "body_html": "<ul>…</ul>"},
    {"key": "culture", "type": "rich_text", "title": "Văn hoá công ty", "body_html": "<p>…</p>"},
    {"key": "gallery", "type": "gallery", "title": "Hình ảnh công ty", "items": [{"image_url": "https://…", "caption": ""}]},
    {"key": "video", "type": "video", "title": "Video giới thiệu", "provider": "youtube", "video_id": "dQw4w9WgXcQ", "embed_url": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"}
  ],
  "sidebar": [
    {"key": "general_info", "type": "facts", "title": "Thông tin chung", "items": [{"key": "website", "label": "Website", "value": "fpt-software.com", "href": "https://fpt-software.com"}]},
    {"key": "offices", "type": "offices", "title": "Địa điểm", "items": [{"label": "Trụ sở chính", "address": "17 Duy Tân", "province_name": "Hà Nội", "is_headquarters": true}]},
    {"key": "social_links", "type": "social_links", "title": "Mạng xã hội", "items": [{"network": "facebook", "label": "Facebook", "url": "https://facebook.com/fptsoftware"}]},
    {"key": "share", "type": "share", "title": "Chia sẻ công ty"},
    {"key": "similar_companies", "type": "similar_companies", "title": "Công ty cùng lĩnh vực"}
  ]
}
```

- `display_name` là tên thương mại, thiếu thì dùng tên đăng ký; `legal_name`
  rỗng khi trùng `display_name`.
- Thứ tự và việc ẩn khối trong `sections`/`sidebar` cùng `theme.accent` theo bố
  cục công ty đã lưu; chưa lưu thì dùng mặc định của registry. Khối `jobs` có
  `pinned_job_public_ids`: tin ghim còn công khai, theo thứ tự ghim.
- Khối rỗng bị bỏ khỏi response. Luôn có `jobs`, `general_info`, `share` và
  `similar_companies`; `general_info.items` chỉ gồm fact có giá trị
  (`company_size`, `industries`, `founded_year`, `website`), riêng `website` có
  thêm `href`.
- `website_url` và `href` chỉ trả URL `http(s)`. `offices` lấy từ các văn phòng
  đã duyệt (`CompanyOffice`); công ty chưa có văn phòng nào dùng một item từ
  `Company.public_headquarters` (`province_name` rỗng). Hộ kinh doanh không bao
  giờ có khối này, kể cả khi đã khai văn phòng.
- `benefits` có mặt khi có phúc lợi từ danh mục (`items`) hoặc mô tả phúc lợi
  (`body_html`, rỗng khi không có). `video` chỉ có với video YouTube/Vimeo hợp lệ;
  `embed_url` do server sinh (`youtube-nocookie.com` hoặc `player.vimeo.com`),
  frontend chỉ tải khi người xem bấm. `social_links` theo thứ tự registry.
- `indexable` đúng khi công ty không bị tạm ẩn, có người đại diện hợp lệ, có
  lĩnh vực và có mô tả hoặc ít nhất một tin đang công khai. Sitemap dùng cùng
  định nghĩa này.
- `stats.follower_count` là tổng số ứng viên đang theo dõi; không endpoint nào
  trả danh tính người theo dõi cho nhà tuyển dụng hay khách.
- Response không bao giờ chứa mã số thuế, email, số điện thoại, `address` thô,
  danh tính recruiter hay trạng thái kiểm duyệt.

SEO shell `GET /cong-ty/{slug}` (ngoài `/api`) trả title, description,
canonical, robots, Open Graph/Twitter và JSON-LD `Organization` +
`BreadcrumbList`; `Organization.sameAs` là danh sách website và các mạng xã hội,
`address` lấy từ văn phòng được đánh dấu trụ sở chính (kèm `addressRegion`);
công ty chưa khai văn phòng nào dùng địa chỉ đăng ký của doanh nghiệp, và hộ
kinh doanh không bao giờ có `address`. Chỉ
`index, follow` khi `indexable` và `seo_robots_index`
đang bật. Slug lạ hoặc công ty bị tạm ẩn trả HTTP 404 kèm `noindex`.
`/sitemaps/companies.xml` liệt kê các công ty `indexable` với `lastmod` lấy từ
`Company.updated_at` và được khai báo trong `/sitemap.xml`.

### Workspace trang công ty của nhà tuyển dụng

`GET /api/employer/company/page/`:

```json
{
  "company": {"public_id": "co_ab12", "slug": "fpt-software", "display_name": "FPT Software", "public_path": "/cong-ty/fpt-software", "is_public": true, "is_indexable": true},
  "permissions": {"can_view": true, "can_edit_layout": false, "can_edit_content": false, "can_manage_editors": false, "blockers": [{"code": "NO_GRANT", "message": "…"}]},
  "registry": {
    "sections": [{"key": "about", "title": "Giới thiệu công ty", "zone": "main", "always_on": false}],
    "accents": [{"key": "brand", "label": "Xanh ProCV", "primary": "#00b14f", "hover": "#008a3e", "soft": "#f0fbf5"}],
    "limits": {"pinned_jobs": 3}
  },
  "layout": {"section_order": ["about", "jobs", "benefits", "culture", "gallery", "video"], "hidden_sections": [], "accent": "brand", "pinned_job_public_ids": [], "lock_version": 0},
  "pinned_jobs": [{"public_id": "jb_ab12", "title": "…", "slug": "…", "published_at": "…"}],
  "content": {"…": "DTO của GET /api/public/companies/{slug}/ với mọi khối có nội dung, thứ tự registry, màu brand"},
  "stats": {"follower_count": 12, "active_public_job_count": 5}
}
```

- Quyền là chính sách suy ra tại thời điểm request
  (`employers/models/page_access.py`), không lưu thành vai trò. Recruiter "đủ
  điều kiện" khi là người đại diện hợp lệ của chính công ty mình và không có
  compliance hold đang áp dụng. `can_manage_editors` = owner đủ điều kiện;
  `can_edit_layout` = `can_edit_content` = owner đủ điều kiện, hoặc member đủ
  điều kiện có grant còn hiệu lực trong khi owner vẫn đủ điều kiện.
- `blockers[].code`: `OWNER_NOT_VERIFIED` (owner của công ty không đủ điều
  kiện, áp cho mọi người kể cả owner), `NOT_VERIFIED`, `COMPLIANCE_HOLD`,
  `NO_GRANT`. Danh sách rỗng khi và chỉ khi được sửa.
- `registry.sections` liệt kê vùng `main` rồi `sidebar`; chỉ vùng `main` sắp xếp
  được, khối `always_on` không ẩn được. `hero` không thuộc registry.
- `layout.section_order` luôn là hoán vị đầy đủ của các key vùng `main`.
  `hidden_sections` nhận key của cả hai vùng và được chuẩn hoá theo thứ tự
  registry. Chưa lưu lần nào thì `lock_version = 0`.
- PATCH không đổi gì thì trả `200` và giữ nguyên `lock_version`; mỗi thay đổi
  bố cục hoặc tin ghim tăng `lock_version` một lần và ghi `CompanyPageEvent`
  (`layout_updated`, `pinned_jobs_updated`) kèm `before`/`after`. Bố cục và tin
  ghim nằm ở bảng riêng nên không đổi `Company.updated_at`.
- Tin ghim phải là tin đang công khai của chính công ty, tối đa 3, không trùng.
  Tin ghim rời trạng thái công khai tự biến mất khỏi `pinned_job_public_ids`.
  `GET /api/public/jobs/?company=<public_id>` không kèm `ordering` xếp tin ghim lên
  đầu theo thứ tự ghim.

### Nội dung trang qua kiểm duyệt

Nội dung (chữ, video, mạng xã hội, phúc lợi, văn phòng, ảnh) không lên trang
ngay mà đi qua `CompanyUpdateRequest` như hồ sơ công ty; bố cục thì áp dụng
ngay. Workspace `GET /api/employer/company/page/` có thêm:

```json
{
  "content_form": {
    "review_mode": "direct",
    "published": {"headline": "", "description": "<p>…</p>", "culture": "", "employee_benefits": "", "video_url": "",
                  "social_links": {"facebook": "", "linkedin": "", "youtube": "", "tiktok": "", "instagram": ""},
                  "benefits": [{"benefit_id": 7, "note": ""}],
                  "offices": [{"label": "Trụ sở chính", "address_line": "17 Duy Tân", "province_id": 1, "province_name": "Hà Nội", "is_headquarters": true}],
                  "logo_url": "", "cover_image_url": "", "gallery": [{"id": 3, "image_url": "https://…", "caption": ""}]},
    "pending": {"culture": "<p>…</p>", "logo_pending": true},
    "request": {"public_id": "cur_…", "status": "submitted", "submitted_at": "…", "review_note": "", "editable": true, "lock_version": 2, "allowed_actions": ["edit", "withdraw", "cancel"]},
    "section_status": {"hero": "pending", "about": "published", "benefits": "empty", "culture": "pending", "gallery": "published", "video": "empty", "offices": "empty", "social_links": "empty"}
  },
  "completeness": {"score": 30, "items": [{"key": "logo", "label": "Logo", "done": false}]}
}
```

- `review_mode`: `direct` (mặc định, lưu là đăng ngay và hậu kiểm) hoặc
  `review` (quản trị viên bật duyệt trước cho công ty, lưu là gửi duyệt).
- `pending` và `request` là `null` khi người gọi không có yêu cầu đang mở;
  yêu cầu của member khác không hiện ở đây. `pending` chỉ gồm key nội dung
  trang của yêu cầu, cùng shape với `published`; ảnh đang chờ trả URL xem trước
  (`logo_url`, `cover_image_url`, `gallery_additions: [{image_url}]`) và
  `gallery_deletions: [id]`. `request.lock_version`/`allowed_actions` dùng cho
  `POST /api/employer/company/update-requests/{public_id}/withdraw/`.
- `section_status`: khối có key trong yêu cầu đang mở là `pending` (hoặc
  `changes_requested` khi admin yêu cầu chỉnh sửa); còn lại `published` nếu đã
  có nội dung công khai, ngược lại `empty`.
- `completeness.score` là phần trăm của 10 mục đã có nội dung công khai: logo,
  ảnh bìa, khẩu hiệu, giới thiệu, phúc lợi (danh mục hoặc mô tả), văn hoá,
  thư viện ảnh, văn phòng, mạng xã hội, video.
- `registry.social_networks: [{key, label, placeholder}]` và `registry.limits`
  thêm `benefits: 8, offices: 10, gallery: 10, headline: 160`.

`POST /api/employer/company/page/content/` khi `review_mode = direct` (mặc định)
ghi thẳng các key khác giá trị đang công khai lên công ty và tạo
`CompanyContentChange` (`changes` mới, `previous` bị thay). Cờ `*_pending` ghi
vào `pending_media` của thay đổi; gửi ảnh lên `logo/`, `cover/`, `images/` kèm
`content_change=<mã>` trong 30 phút để ảnh lên trang và nhập vào thay đổi đó.
Key vừa đăng bị bỏ khỏi yêu cầu cập nhật đang mở của chính người gửi (rút yêu
cầu nếu không còn gì); key nằm trong yêu cầu đang thẩm định vẫn bị khoá (`409`).
Không có key nào khác giá trị công khai và không có ảnh báo trước thì `400 {changes}`.

Khi `review_mode = review`, endpoint gộp `changes` vào yêu cầu đang mở:
key gửi lên ghi đè key cũ, key không gửi giữ nguyên (kể cả thay đổi pháp lý
gửi từ form hồ sơ), và key gửi đúng bằng giá trị đang công khai bị bỏ khỏi
yêu cầu. Gộp xong mà không còn gì thì yêu cầu đang mở được rút (`withdrawn`);
nếu chưa có yêu cầu thì trả `400 {changes}`. Key giữ lại vẫn so xung đột với
giá trị công khai lúc nó được gửi lần đầu.

Quy tắc kiểm tra (chạy khi gửi và chạy lại khi admin duyệt):

- `headline`: một dòng chữ thuần, tối đa 160 ký tự, không chứa `<`/`>`.
- `culture`: rich text cùng allow-list với mô tả, tối đa 5.000 ký tự hiển thị.
- `video_url`: chỉ `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`
  hoặc `vimeo.com/<số>`; lưu dạng chuẩn `https://www.youtube.com/watch?v=<id>`
  hoặc `https://vimeo.com/<id>`, `""` để xoá. Không bao giờ nhận mã nhúng.
- `social_links`: chỉ `facebook, linkedin, youtube, tiktok, instagram`; mỗi
  giá trị là URL `https` thuộc tên miền của mạng đó (kể cả tên miền con như
  `m.facebook.com`, `vn.linkedin.com`) và trỏ tới một trang cụ thể; chuỗi rỗng
  bị bỏ.
- `benefits`: tối đa 8 `{benefit_id, note}` không trùng, `benefit_id` là
  `Benefit` đang hoạt động (`GET /api/public/jobs/benefits/`), `note` tối đa 160 ký tự.
- `offices`: tối đa 10 `{label, address_line, province_id, is_headquarters}`,
  `province_id` là `Location` cấp tỉnh (`GET /api/public/locations/?level=province`),
  tối đa một trụ sở chính.
- Lỗi trả ở cấp cao nhất theo field; lỗi từng phần tử của danh sách lồng theo
  chỉ số dạng chuỗi, ví dụ `{"offices": {"1": {"address_line": ["…"]}}}`, lỗi
  của cả danh sách là `{"offices": ["…"]}`; lỗi mạng xã hội lồng theo mạng,
  ví dụ `{"social_links": {"facebook": ["…"]}}`.

Row của `editors/`:

```json
{"member_id": "rec_ab12cd34ef56", "display_name": "Nguyễn Văn A", "position_title": "Chuyên viên tuyển dụng", "email_masked": "a***@fpt.com", "company_role": "member", "eligible": true,
 "grant": {"public_id": "cpg_ab12cd34ef56", "granted_at": "2026-11-14T07:00:00Z", "granted_by_name": "Trần Thị B", "effective": true}}
```

- Owner luôn đứng đầu và không cấp quyền được cho owner. `grant.effective` chỉ
  đúng khi cả member lẫn owner còn đủ điều kiện.
- Cấp và thu hồi ghi `CompanyPageEvent` (`editor_granted`, `editor_revoked`) và
  gửi thông báo website cho member (`company_page_editor_granted`,
  `company_page_editor_revoked`). Admin gỡ liên kết công ty của member sẽ thu
  hồi grant với `revoke_reason = company_unlinked`.

### Theo dõi và báo cáo trang công ty

`GET|PUT|DELETE /api/public/companies/{public_id}/follow/` luôn trả cùng một shape:

```json
{"following": true, "notify_new_jobs": true, "follower_count": 13}
```

- Lần theo dõi đầu mặc định `notify_new_jobs=true`; PUT sau đó không gửi key
  (hoặc gửi `null`) giữ nguyên lựa chọn đã lưu. Khi chưa theo dõi,
  `notify_new_jobs` luôn là `false`.
- `Company.follower_count` chỉ được ghi bằng `QuerySet.update(F())` trong cùng
  transaction với dòng `CompanyFollow`, không đổi `Company.updated_at`. Chiều
  giảm đi qua một receiver `pre_delete` duy nhất, nên bỏ theo dõi và xoá hẳn
  tài khoản ứng viên đều giữ `follower_count` bằng đúng số dòng theo dõi.
- GET không tính vào throttle `company_follow`: mỗi lượt xem trang công ty đều
  đọc trạng thái này.

`POST /api/public/companies/{public_id}/reports/`:

```json
{"reason": "wrong_info", "section_key": "offices", "detail": "Địa chỉ trụ sở không đúng."}
```

- `reason`: `wrong_info`, `impersonation`, `inappropriate_content`, `scam`,
  `other`. `section_key` rỗng hoặc là một `key` của khối trên trang (`about`,
  `jobs`, `benefits`, `culture`, `gallery`, `video`, `general_info`, `offices`,
  `social_links`, `share`, `similar_companies`). `detail` tối đa 2000 ký tự,
  bắt buộc từ 10 ký tự khi `reason=other`.
- Báo cáo lưu lại tên đăng ký và tên thương mại của công ty tại thời điểm gửi.

Row của `GET /api/admin/company-reports/` (và response của `resolve/`,
`reverse/`) giữ nguyên các key của row báo cáo tin tuyển dụng, thay nhóm key
của tin bằng object `company` và thêm `section_key`, `section_title`:

```json
{
  "public_id": "crp_ab12cd34ef56",
  "company": {"public_id": "co_ab12", "slug": "fpt-software", "display_name": "FPT Software", "logo_url": "https://…/logo.png", "content_policy_hold": false},
  "reporter_email": "ung-vien@example.com",
  "reason": "wrong_info",
  "reason_label": "Thông tin công ty sai sự thật",
  "section_key": "offices",
  "section_title": "Địa điểm",
  "detail": "Địa chỉ trụ sở không đúng.",
  "status": "pending",
  "resolution_note": "",
  "resolved_at": null,
  "resolved_by_email": "",
  "resolution_history": [{"public_id": "crpe_…", "from_status": "pending", "to_status": "upheld", "note": "…", "actor_email": "admin@example.com", "created_at": "…"}],
  "created_at": "2026-11-14T07:00:00Z"
}
```

### Phân quyền admin (hai cấp, ADR-0018)

`GET /api/auth/me/` trả thêm `admin_access` với admin và `null` với
candidate/employer:

```json
{"is_superuser": false}
```

Mọi endpoint quản trị dùng `AdminPortalPermission`: tài khoản `role=admin` còn
truy cập được đều dùng chức năng nghiệp vụ. Thao tác chỉ dành cho superuser:
tài khoản quản trị (đọc/ghi), lời mời quản trị, site locale/settings/upload,
tổng quan cấu hình AI, cấm và khôi phục tài khoản bị cấm, gỡ policy hold,
nhật ký toàn hệ thống (`/api/admin/audit-logs/?scope=all`). Khi bị từ chối:

```json
{
  "code": "admin_permission_denied",
  "message": "Bạn không có quyền thực hiện hành động này."
}
```

### API quản lý tài khoản G3

Base quản trị: `/api/admin/`; public accept: `/api/auth/admin-invitations/`.

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/accounts/`, `/accounts/summary/`, `/accounts/{id}/` | Danh sách, KPI và chi tiết; admin thường chỉ thấy ứng viên và NTD, superuser thấy cả quản trị viên |
| PATCH | `/accounts/{id}/` | Sửa họ tên/SĐT; Admin active vẫn superuser-only |
| GET | `/accounts/{id}/sessions/`, `/activity/` | Phiên và audit liên quan |
| POST | `/accounts/{id}/status-impact/`, `/change-status/` | Preview/xác nhận state machine tạm khóa, cấm, bắt đầu khôi phục hoặc mở lại; payload cấm cần `violation_category` và `enforcement_evidence` |
| POST | `/accounts/{id}/resource-hold-impact/`, `/release-resource-holds/` | Superuser preview/xác nhận gỡ `ban_review`/`legacy_lock`; account vẫn inactive |
| POST | `/accounts/{id}/revoke-sessions-impact/`, `/revoke-sessions/` | Preview/xác nhận thu hồi phiên |
| POST | `/accounts/{id}/send-password-reset/`, `/resend-verification/` | Xếp lịch email bảo mật. Admin nhận template/link cổng Admin; không gửi reset cho tài khoản `inactive`/`banned`. |
| GET/POST | `/account-invitations/` | Superuser xem/tạo lời mời; body tạo `{email, full_name, reason}` |
| POST | `/account-invitations/{id}/resend/`, `/revoke/` | Superuser gửi lại (token cũ mất hiệu lực) / thu hồi |
| GET | `/api/auth/admin-invitations/validate/?token=...` | Kiểm tra link mời công khai; trả `{email, full_name, expires_at}` |
| POST | `/api/auth/admin-invitations/accept/` | Đặt mật khẩu và kích hoạt tài khoản admin được mời |

Filter tài khoản gồm `q`, `role`, `status`, `email_verified`,
`has_active_session`, `company`, khoảng ngày tạo, khoảng lần đăng nhập và
`ordering`. Lời mời hỗ trợ `q`, `status`, `invited_by`. Không có tự đăng ký
quản trị: superuser đầu tiên tạo bằng `createsuperuser`, quên mật khẩu do
superuser gửi link đặt lại.

Các POST xác nhận impact bắt buộc gửi lại `impact_token` từ preview. Token stale
trả `409 admin_resource_changed`. Thao tác vượt cấp quản trị trả
`403 admin_permission_denied`; validation field thông thường trả `400`.

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
- Admin thường thao tác trên tài khoản quản trị hoặc cấm tài khoản trả `403`; account `PENDING` hoặc transition sai trả `400`;
  soft-deleted fail-closed thành `404`; input/snapshot/global audit revision
  đổi giữa preview và confirm trả `409`. Client phải tải preview mới nhưng
  không tự gửi confirm lại.

### Hậu kiểm tin tuyển dụng (ADR-0014)

Tin không còn qua bước duyệt trước. Nhà tuyển dụng đăng là tin công khai; quản
trị viên chỉ hậu kiểm.

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET | `/api/admin/jobs/moderation/` | Danh sách vận hành; mỗi dòng có `published_job_count`, `pending_report_count`, `is_publicly_visible` |
| GET | `/api/admin/jobs/moderation/summary/` | `total`, `draft`, `active`, `expired`, `closed`, `held`, `pending_reports` |
| GET | `/api/admin/jobs/moderation/{public_id}/` | Trả `review_token`, `state_actions` (`hide` hoặc `restore`), `blocked_reasons`, `content_changes` (khác biệt so với nội dung của lần đăng gần nhất) |
| POST | `/api/admin/jobs/moderation/{public_id}/decisions/` | Chỉ nhận `action=hide\|restore`; `hide` cần `reason_code` và `note`, `restore` cần `note` |

Điều kiện đăng được kiểm tra khi nhà tuyển dụng gọi `submit` hoặc `reopen`.
Không đạt thì API trả HTTP 400 với payload máy đọc được và tin giữ nguyên
trạng thái:

```json
{
  "code": "JOB_PUBLICATION_BLOCKED",
  "detail": "Chưa thể đăng tin.",
  "blocked_reasons": [
    {"code": "verification_required", "label": "Nhà tuyển dụng chưa được duyệt xác thực."},
    {"code": "dpa_outdated", "label": "Nhà tuyển dụng chưa có chấp thuận DPA còn hiệu lực."}
  ]
}
```

Các mã lý do: `verification_required`, `dpa_outdated`, `compliance_hold_active`,
`campaign_inactive`. `review_token` chỉ khóa revision của job cho thao tác tạm
ẩn và khôi phục.

Cam kết chịu trách nhiệm được kiểm tra trước điều kiện đăng. Client lấy
`responsibility_statement` từ posting context, hiển thị `text` cho nhà tuyển
dụng xác nhận rồi gửi lại `version` trong `responsibility_statement_version`.
Backend lưu `responsibility_accepted_at` và
`responsibility_statement_version` trên tin; chi tiết tin của admin trả hai
field này (rỗng với tin công khai trước khi có cam kết).

Danh sách và chi tiết tin của nhà tuyển dụng trả `visibility_hold`, là `null`
khi ứng viên nhìn thấy tin:

```json
{
  "kind": "moderation",
  "code": "manual_review",
  "label": "Tạm ẩn để rà soát nội dung",
  "held_at": "2026-11-12T08:00:00+07:00",
  "reason_code": "fraud_risk",
  "reason_label": "Có dấu hiệu lừa đảo"
}
```

`kind=moderation` là tin bị quản trị viên tạm ẩn, kèm nhóm lý do của lần tạm
ẩn gần nhất; `kind=account` là tin bị giữ theo trạng thái tài khoản và không
có lý do. Ghi chú của quản trị viên không nằm trong payload này. Báo cáo
hiệu quả tin của chiến dịch (`.../campaigns/{public_id}/job-performance/`)
trả cờ `visibility_held` cho từng tin.

### Admin employer verification — final decision và lifecycle

| Method | Endpoint | Contract |
| --- | --- | --- |
| POST | `/api/admin/employer-verifications/{public_id}/decision-impact/` | Preview final decision, tax/company/capability/hold impact; không ghi dữ liệu |
| POST | `/api/admin/employer-verifications/{public_id}/decision/` | Confirm bằng `impact_token`; stale trả `409 admin_resource_changed` |
| POST | `/api/admin/employer-verifications/{public_id}/revoke-impact/`, `/revoke/` | Preview/xác nhận thu hồi và áp verification hold |
| POST | `/api/admin/employer-verifications/{public_id}/expire-impact/`, `/expire/` | Preview/xác nhận hết hiệu lực manual |
| POST | `/api/admin/employer-verifications/{public_id}/unlock-resubmission/` | Mở khóa ngoại lệ sau ba final rejection; body `{reason, lock_version}`, giữ nguyên rejection count/history |

Mọi admin được review, quyết định, revoke/expire. Approve với tax advisory
không matched cần thêm `tax_override_reason`.

Document review không phải final decision. Revoke/expire không downgrade
company; compliance hold chỉ chặn candidate-data/job approval và public job,
không khóa workspace hoặc tạo/sửa/gửi tin. Reapprove chỉ gỡ exact verification
hold, không gỡ hold thuộc DPA/account/moderation.

List/detail verification trả `final_rejection_count`, `rejection_limit`,
`resubmission_locked`, `resubmission_locked_at`; preview decision trả thêm
`rejection_impact`. Chỉ final `rejected` tăng count. Document reject/yêu cầu bổ
sung không tính lượt; sau khi recruiter thay đủ bộ giấy tờ cần sửa, cùng case
được resubmit với `revision++`. Lần final reject thứ ba khóa nộp lại nhưng không
tự ban `User`. Endpoint unlock yêu cầu reason và optimistic lock; stale
trả `409 admin_resource_changed`.

### CV catalogue admin (admin-only)

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| CRUD | `/api/admin/cv-templates/` | Metadata template và danh sách version/localization. |
| POST | `/api/admin/cv-templates/{public_id}/versions/` | Tạo draft version; body rỗng clone contract published hiện tại. |
| POST | `/api/admin/cv-templates/{public_id}/versions/{id}/publish/` | Validate và publish immutable template version. |
| POST | `/api/admin/cv-templates/{public_id}/versions/{id}/retire/` | Retire version không còn là current pointer. |
| POST | `/api/admin/cv-templates/{public_id}/snapshots/regenerate/` | Queue snapshot cho mọi màu của template. |
| CRUD | `/api/admin/cv-categories/` | Taxonomy catalogue. |
| CRUD | `/api/admin/cv-colors/` | Registry màu. |
| CRUD | `/api/admin/cv-sample-contents/` | Nội dung canonical draft. |
| POST | `/api/admin/cv-sample-contents/{public_id}/preview/` | Preview bằng canonical composer. |
| POST | `/api/admin/cv-sample-contents/{public_id}/publish\|archive/` | Lifecycle curated content. Publish nhận `draft` hoặc `in_review`, ghi người duyệt và lưu trữ bản đang xuất bản cùng tổ hợp. Danh sách lọc `?position=&locale=&band=&status=`. |
| POST | `/api/admin/cv-sample-contents/generate/` | Sinh nội dung mẫu bằng AI: `{position_public_ids, locales, experience_bands}`, tối đa 16 tổ hợp và 16 lượt đang chạy; `202` + `batch_id`. `503 runtime_disabled\|provider_not_configured`, `409 generation_in_progress`, `400 batch_too_large`. Kết quả ở trạng thái `in_review`. |
| GET | `/api/admin/cv-sample-generations/?batch=` | Trạng thái từng lượt sinh (`queued/processing/completed/failed`, `failure_code`, `sample_public_id`). |
| GET/POST/PATCH | `/api/admin/cv-positions/` | Cấu hình CV theo vị trí: `section_preset`, `keywords`, `is_active`, `sort_order`, `field_count`. Không đổi được vị trí của một profile. |
| GET | `/api/admin/cv-positions/coverage/` | Ma trận nội dung riêng ngôn ngữ × nhóm kinh nghiệm: `published`, `pending` (nháp/chờ duyệt), `generic`. Một truy vấn cho mọi vị trí. |
| GET/POST | `/api/admin/cv-positions/export/`, `.../import/` | JSON `cv-positions-v1` theo `JobCategory.slug` (gồm trường riêng và nội dung đã xuất bản). Import upsert profile + trường, nội dung vào nháp `origin=import`; lỗi ở một vị trí thì không ghi gì. |
| CRUD | `/api/admin/cv-position-fields/?position=` | Trường riêng: `key`, nhãn/placeholder vi/en, `field_type` (`text/long_text/url/number/date/select/multi_select/tags`), `options` vi/en, `maps_to` (`none`/`skills`), `is_required_hint`. |

Các action sinh snapshot trả `202 queued`; asset không được tạo trong request
web. Public card chỉ thấy storage URL mới sau khi worker đã render và swap đủ
thumbnail + preview.

### AI CV import

`POST /api/candidate/cvs/imports/` multipart giữ `title`, `template_public_id`,
`language`, `theme_color`; client mới gửi `upload_session` purpose
`candidate_cv` đã clean thay vì raw `file`. Khi có template, client nên gửi
`Idempotency-Key`; response `202` chứa `processing_status=queued` và
`import_job`. Gửi lại cùng key/user trả cùng CV với `200`, không tạo job/file mới.
Raw `file` chỉ còn trong compatibility window và trả
`409 UPLOAD_SESSION_REQUIRED` khi strict flag được bật. Backend claim session
trước khi parser PDF/DOCX; avatar `/api/candidate/cvs/assets/` cũng chỉ decode/re-encode
sau clean verdict.

`GET /api/candidate/cvs/{public_id}/` dùng để poll: `queued|processing|analyzed|failed`.
Khi failed, `import_job.failure_code` chỉ là mã an toàn, không chứa raw text.
`POST /api/candidate/cvs/{public_id}/imports/retry/` trả `202`, owner-only và chỉ dùng
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
| POST | `/api/employer/jobs/ai-generations/` | Tạo generation bất đồng bộ; trả `202 {public_id,status,phase,quota_remaining}`. |
| GET | `/api/employer/jobs/ai-generations/{public_id}/` | Poll trạng thái/phase, suggestion đã resolve, warning, field thủ công và quota còn lại. |
| POST | `/api/employer/jobs/ai-generations/{public_id}/cancel/` | Hủy queued/processing; terminal call là idempotent. |
| POST | `/api/employer/jobs/ai-generations/{public_id}/feedback/` | Đánh giá kết quả completed bằng `helpful\|not_helpful` và optional reason enum. |
| GET | `/api/admin/ai/overview/?days=30` | Superuser-only: hard/soft switch, provider/model, queue, success/error/P95/token/cost/quota và apply rate 7/30 ngày; không trả prompt, input/result hoặc allowlist ID. |

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
giới tính luôn nằm ngoài suggestion. `POST /api/employer/jobs/?as=draft` có thể nhận
write-only `ai_generation_public_id`; backend chỉ ghi provenance sau khi kiểm tra
owner, company, trạng thái completed và không cho dùng lại cho tin khác.

Mã lỗi ổn định gồm `JOB_AI_DAILY_QUOTA_EXCEEDED` (429),
`JOB_AI_IDEMPOTENCY_CONFLICT` (409), generation unavailable (503), validation
400 và owner mismatch 404. Provider message/raw content không được trả cho client.

| GET | `/api/public/cv-sample-contents/?locale=&experience_band=` | Thư viện nội dung mẫu riêng theo vị trí cho editor (không gồm nội dung chung); card có `position_public_id`, `position_slug`, `position_name`, `experience_band`. |
| GET/POST | `/api/candidate/cvs/` | Candidate lifecycle V2. POST nhận template, language, optional `position_public_id` (kèm `experience_band`) hoặc `source_cv_public_id` (loại trừ nhau) và optional màu. |
| GET/PATCH/DELETE | `/api/candidate/cvs/{public_id}/` | Candidate metadata/detail: PATCH nhận `title`, `is_default`, `position_public_id` (vị trí mục tiêu, `null` để bỏ) và `position_level` (`Job.PositionLevel`); response có thêm trường matching `position_level`, `experience_years`, `education_level`; DELETE xóa vĩnh viễn CV và library artifacts. Snapshot của application đã nộp được giữ detached cho recruiter. |
| POST | `/api/candidate/cvs/imports/` | Candidate import PDF/DOCX (`multipart upload_session`, optional `title`/template fields). Response không có storage key/URL; raw `file` chỉ compatibility. |
| POST | `/api/candidate/cvs/{public_id}/duplicate/` | Clone builder CV từ latest immutable version thành CV/draft/version độc lập. Optional `title`; không hỗ trợ uploaded CV để tránh dùng chung file storage. |
| GET/PUT | `/api/candidate/cvs/{public_id}/draft/` | Đọc/autosave canonical draft; PUT bắt buộc `If-Match: "lock-version-N"`. |
| PUT | `/api/candidate/cvs/{public_id}/template/` | Đổi template của mutable draft, giữ canonical content và optimistic lock. |
| GET | `/api/candidate/cvs/{public_id}/template-preview/?template_public_id=` | Project draft owner lên template mới để preview, không mutation aggregate. |
| POST | `/api/candidate/cvs/{public_id}/save-version/` | Tạo immutable manual version từ draft hợp lệ. |
| POST | `/api/candidate/cvs/{public_id}/publish/` | Tạo immutable published version. |
| GET | `/api/candidate/cvs/{public_id}/versions/` | History version của owner. |
| GET | `/api/candidate/cvs/{public_id}/view/` | Owner read-only view từ immutable version, không đọc draft. |
| GET/POST | `/api/candidate/cvs/{public_id}/shared-links/` | Quản lý bearer share link theo owner/version. |
| GET/POST | `/api/candidate/cvs/{public_id}/exports/` | Danh sách/yêu cầu PDF export từ immutable version. |
| GET | `/api/public/jobs/?category=&location=&work_type=&employment_type=&experience_level=&search=&company=` | Danh sách job đang active, public. `company` nhận `public_id` công ty và khớp chính xác, khác với `search_by=company` khớp theo tên; card trả `company_slug` để dẫn về trang công ty (`null` khi trang công ty đang bị tạm ẩn). `category`/`location` nhận **nhiều giá trị**; response là card DTO, không gồm description/requirements/benefits/deadline và dữ liệu quản trị. Boolean legacy `company_verified` thực chất là dấu tick của exact recruiter `posted_by`, được batch-evaluate với query count phẳng. Dùng `?view=preview` khi UI thực sự cần nội dung hover. |
| GET | `/api/public/jobs/{slug}/` | Chi tiết job, public và **chỉ đọc** (không tăng `view_count`). Trả `company_slug` (`null` khi trang công ty đang bị tạm ẩn); `company_address` chỉ có giá trị với doanh nghiệp, hộ kinh doanh luôn là chuỗi rỗng. Trả relation tối thiểu cùng view-model nhóm sẵn: `primary_specialization`, `domain_knowledge`, `workplace_groups`, `requirement_tags` (**không còn kèm kỹ năng**), `benefit_tags`, `required_skills`, `preferred_skills`, `benefit_groups` (quyền lợi gom theo danh mục, thứ tự theo `Benefit.Category`), `language_requirements[].proficiency_label`; không trả contact nhận hồ sơ hoặc trạng thái quản trị. `company_verification` chỉ có `{verified,criteria}`: khi chưa đủ năm điều kiện, `criteria=[]` để không lộ trạng thái email/phone/pháp lý/tuổi/report; khi đủ mới trả năm nhãn passed. |
| POST | `/api/candidate/jobs/{public_id}/report/` | Candidate-only, chỉ nhận tin đang public và throttle đồng thời theo account/IP; response tối thiểu `{public_id,status,created_at}`. Chỉ admin-UPHELD thuộc `fake_company\|scam\|wrong_info` làm mất tick recruiter và tự tạo hold ẩn tin; reverse phục hồi badge nhưng không tự public lại tin. |
| POST | `/api/public/jobs/{slug}/views/` | Ghi nhận lượt xem riêng, chỉ khi Analytics consent hợp lệ; Redis dedupe 24 giờ, response `{counted, view_count, reason?}`. |
| GET/POST | `/api/public/privacy/consent/` | Đọc/lưu lựa chọn cookie ký số (`preferences`, `analytics`, `marketing`); necessary luôn bật, rút Analytics sẽ xóa viewer cookie. |
| GET/POST | `/api/employer/jobs/` | Workspace recruiter owner-only và yêu cầu `job_workspace_ready=true`. `POST ?as=draft` lưu nháp thiếu dữ liệu; POST thường validate form, cam kết (`responsibility_statement_version`), điều kiện đăng và quota rồi đăng tin ở trạng thái `active`. Form giữ contract nested hiện hữu. Candidate preview chỉ gắn khi `candidate_data_access=true`. Mỗi dòng có `visibility_hold` và `unviewed_application_count` (số ứng viên có lần nộp mới nhất còn `submitted`). GET phân trang trả thêm `status_counts {all, active, draft, expired, closed}` đếm mọi tab trạng thái trong cùng phạm vi `campaign`/`q` (bỏ qua `status`), một query aggregate. |
| GET/PATCH/DELETE | `/api/employer/jobs/{public_id}/` | Chỉ người tạo và workspace-ready được đọc/sửa; chỉ xóa nháp chưa từng đăng. Cập nhật tin `active` có hiệu lực ngay và không đổi `published_at`. Response đọc có thêm `impression_count` và `application_summary {total, unviewed, unanswered, by_status}` tính trên lần nộp mới nhất của mỗi ứng viên; aggregate không chứa danh tính nên vẫn trả khi `candidate_data_access=false`. `unanswered` = `submitted`+`viewed`, cùng định nghĩa với `scope=unanswered` của `/api/employer/applications/`. |
| GET | `/api/employer/jobs/posting-context/` | Endpoint compliance không bị workspace guard để luôn trả quota + `job_workspace_ready`, `candidate_data_access`, `dpa_status`, `blockers[]`, `job_postable`, `block_reason`, policy hạn hồ sơ (`default_deadline_days`, `max_deadline_days`, `max_public_lifetime_days`) và `responsibility_statement {version, text}` là bản cam kết đang có hiệu lực. |
| POST | `/api/employer/jobs/{public_id}/submit/` | Đăng một tin nháp: tin công khai ngay (`active`). Body `{responsibility_statement_version}`; thiếu hoặc khác phiên bản đang có hiệu lực trả `400 JOB_RESPONSIBILITY_REQUIRED`. Trả `400 JOB_PUBLICATION_BLOCKED` kèm `blocked_reasons[]` khi nhà tuyển dụng chưa đạt điều kiện đăng. Gọi lại với tin đã `active` là idempotent và không cần cam kết. |
| POST | `/api/employer/jobs/{public_id}/close/`, `/reopen/`, `/extend/`, `/duplicate/` | Đóng, mở lại (tin `active` ngay, body `{deadline, responsibility_statement_version}`, cùng cam kết và điều kiện đăng), gia hạn tin active hoặc tạo nháp sao chép. Tin đang bị tạm ẩn trả `400 RECRUITMENT_HOLD_ACTIVE` cho sửa, mở lại, gia hạn và sao chép. |
| GET/POST | `/api/candidate/applications/` | Candidate application V2. POST bắt buộc `job_public_id`, `cv_public_id`, `version_public_id`; backend từ chối tin hết hạn, CV đang phân tích hoặc CV thiếu họ tên / liên hệ / nội dung (`400 {cv_public_id}`), tạo snapshot CV bất biến. `campaign_ref` (tùy chọn) là mã `?ref=` của link kênh chiến dịch: hợp lệ thì hồ sơ ghi `campaign_channel`; sai, hết hạn hoặc thuộc chiến dịch khác thì coi là tự nhiên, không bao giờ chặn việc nộp. GET trả `status`, `candidate_status` và timeline **đã công bố**: quyết định còn trong cửa sổ hoàn tác của NTD chưa hiện. |
| GET | `/api/employer/applications/?job=&status=&campaign=&q=` | Hồ sơ của các tin do caller tạo; yêu cầu `candidate_data_access=true`, filter theo tin/pipeline/chiến dịch/tên-email. |
| PATCH | `/api/employer/applications/{public_id}/` | Chỉ `{employer_note?, employer_rating?}` nội bộ; không nhận `status`. Owner-scope, candidate-data gate và canonical lock order được recheck trong transaction. |
| POST | `/api/employer/applications/{public_id}/status/` | `{status}` ∈ `shortlisted`/`interviewed`/`accepted`/`rejected` (phải nằm trong `available_decisions` của list). Trả `{application, candidate_notice_at}`: ứng viên nhận thông báo vào thời điểm đó (mặc định +5 phút), không ngay lập tức. `400 {status}` khi chuyển không hợp lệ. |
| POST | `/api/employer/applications/{public_id}/status/undo/` | Hoàn tác quyết định gần nhất của chính caller khi thông báo chưa giao; trả hồ sơ đã khôi phục, `409 {code: STATUS_UNDO_UNAVAILABLE, message}` khi đã giao hoặc không có gì để hoàn tác. |
| GET | `/api/employer/applications/{public_id}/cv/` | Snapshot CV owner-only, yêu cầu candidate-data access; lần mở đầu chuyển `submitted → viewed`, mọi lần mở ghi `CvAccessLog`. Asset URL của recruiter mang audience/actor/application/version và tải file recheck quyền live. |
| POST/GET | `/api/employer/applications/{public_id}/cv/exports/`, `…/cv/exports/{export_id}/` | Yêu cầu (201 tạo mới, 200 dùng lại; tự xếp lại job lỗi) và poll PDF của snapshot; `download_url` chỉ có khi artifact sẵn sàng. |
| GET | `/api/employer/applications/{public_id}/cv/exports/{export_id}/download/` | `application/pdf`; ghi `CvAccessLog` kênh `export` và báo ứng viên một lần cho mỗi hồ sơ. |
| GET/POST | `/api/employer/applications/{public_id}/review-links/` | Link mời người không có tài khoản đánh giá hồ sơ. POST `{reviewer_name, message?, expires_in_days ∈ 3/7/14/30}` trả `{link, url}`: `url` chứa token thô duy nhất một lần (server chỉ lưu SHA-256). GET liệt kê link với `status` active/expired/revoked, `open_count`, `has_review`. |
| POST | `/api/employer/applications/{public_id}/review-links/{link_id}/revoke/` | Thu hồi link; phiếu đã gửi được giữ. |
| GET | `/api/employer/applications/{public_id}/reviews/` | `{summary: {total, average_rating, by_recommendation}, results}` các phiếu đánh giá. |
| GET/PUT | `/api/public/application-reviews/{token}/` | Công khai, throttle theo IP (`application_review` 60/giờ). GET trả ngữ cảnh tin và CV đã ẩn ảnh, email, SĐT, địa chỉ, link, ngày sinh, mục "Người tham chiếu"; mỗi lần mở ghi `CvAccessLog` (anonymous, shared_link). PUT `{recommendation ∈ strong_yes/yes/no/strong_no, rating?, strengths?, concerns?}` tạo hoặc cập nhật phiếu; lần đầu báo NTD (`application_review_submitted`). Link sai, hết hạn hay đã thu hồi đều `404`. |
| GET/POST | `/api/employer/candidate-blocks/` | Danh sách đen của NTD. POST `{application_public_id, reason ∈ spam/inappropriate/fake_profile/other, note?, duration_days ∈ 30/90/180|null, reject_pending?}` chặn ứng viên đứng sau hồ sơ khỏi mọi tin của caller; `reject_pending` chuyển hồ sơ chưa phản hồi sang `rejected` qua luồng quyết định thường. Ứng viên bị chặn nộp hồ sơ nhận `400 {job_public_id: "Bạn không thể ứng tuyển vào tin này lúc này."}` (không lộ việc bị chặn). |
| POST | `/api/employer/candidate-blocks/{public_id}/lift/` | Gỡ chặn. List hồ sơ của NTD có thêm `candidate_blocked` và `mass_apply_signal {jobs, window_days}` khi ứng viên nộp ≥ 5 tin của caller trong 14 ngày. |
| GET/POST | `/api/employer/talent-pool/?q=&tag=` | Kho ứng viên tiềm năng của NTD. POST `{application_public_id, note?, tags? (≤5)}` lưu ứng viên đứng sau hồ sơ và báo ứng viên (`talent_pool_saved`); trùng → 400. Mục tự hết hạn sau 12 tháng; beat hằng ngày xóa mục hết hạn hoặc đã đóng quá 30 ngày. |
| PATCH/DELETE | `/api/employer/talent-pool/{id}/` | Sửa ghi chú/nhãn; bỏ khỏi kho. |
| GET | `/api/employer/talent-pool/suggestions/?job=` | Người trong kho xếp theo độ tương đồng giữa tin họ từng nộp và tin chọn (`score`, `reasons`, `already_invited`); loại người đã nộp tin đó hoặc đang bị chặn. |
| POST | `/api/employer/talent-pool/{id}/invite/` | `{job_public_id}` (tin đang công khai của caller) gửi lời mời ứng tuyển (`job_invitation`, theo kênh `employer_invitation_*`); mỗi tin một lần (lần hai 400). |
| GET/POST | `/api/candidate/talent-pools/mine/`, `…/mine/{id}/withdraw/` | Ứng viên xem NTD nào đang lưu hồ sơ và rút khỏi kho. |
| GET | `/api/employer/applications/{public_id}/history/` | Lịch sử pipeline kèm `reverted_at`, `candidate_notice {state: scheduled\|delivered\|superseded\|undone, deliver_at, delivered_at, email_sent_at}` và `can_undo`. |
| GET | `/api/public/site/settings/` | Cấu hình site công khai dạng `{key: value}` (chỉ key `is_public=true`), public. **Cache 1h**, tự invalidate khi admin sửa qua API/Django admin |
| GET | `/api/public/site/link-groups/?placement=footer_seo` | Cụm link SEO đang bật kèm items đã resolve, public |
| GET | `/api/public/site/link-groups/?placement=footer_nav` | Các cột menu điều hướng footer, public |
| GET | `/api/public/site/banners/?placement=home_hero` | Banner đang bật theo order, public |
| GET | `/api/admin/site/settings/` | **Admin**: toàn bộ cấu hình gộp theo 15 nhóm `{groups: [{key, label, settings: [...]}]}`, mỗi setting kèm metadata (`value_type`, `options`, `order`, `is_public`, `env_configured`) để frontend tự render form |
| PATCH | `/api/admin/site/settings/` | **Admin**: bulk update, body `{"values": {key: value}}`, validate theo `value_type` (boolean/number/color hex/select choices), từ chối key kiểu `env` → `{"updated": [...], "errors": {...}}` |
| POST | `/api/admin/site/settings/upload/` | **Admin**: upload ảnh cho setting kiểu image (multipart `file` + `key`) → `{"key", "value", "url"}`; ảnh favicon tự resize về tối đa 256×256 |

### Xem độ phù hợp CV–tin (đối sánh chạy local)

Chỉ ứng viên; tắt bằng site setting `ai_job_match_enabled` (mọi endpoint trả
`403 feature_disabled`). Yêu cầu phân tích giới hạn `20/hour`; xem lại kết quả
(poll) không tốn lượt. Kết quả được cache theo (phiên bản CV, tin, hash nội dung
tin, phiên bản mô hình, phiên bản công thức): sửa CV hay tin thì tính lại.

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| POST | `/api/candidate/matching/analyses/` | Body `{job: <slug tin>, cv: <public_id CV>}`. `200` kèm `cached: true` nếu đã có kết quả, `202` nếu phải tính (task ở `ml-worker`). |
| GET | `/api/candidate/matching/analyses/{public_id}/` | Poll trạng thái `queued`/`processing`/`succeeded`/`failed`; `result` khi hoàn tất. |
| GET | `/api/candidate/matching/analyses/?job=<slug>` | Tối đa 10 lần phân tích gần nhất của chính người dùng cho tin. |

Mã lỗi: `feature_disabled` (403), `job_not_active` (404, tin không còn hiển
thị), `cv_not_owned` (404), `job_text_too_short` (422), `throttled` (429). Lỗi lúc
tính nằm ở `error_code` của phân tích: `cv_text_unavailable` (PDF scan),
`cv_insufficient_content` (CV không có kỹ năng lẫn kinh nghiệm),
`analysis_timeout`, `internal_error`.

`result` gồm `overall` (`score` 0–100, `level`, `label`, `confidence`),
`components` (6 tiêu chí: `key`, `score`, `weight`, `status`, `summary`,
`detail`), `skills` (`matched` kèm `match_type` exact/semantic và câu bằng
chứng, `missing` kỹ năng cần có trước, `extra`), `requirements` (từng câu yêu
cầu: `met`/`partial`/`unmet`, câu CV làm bằng chứng), `suggestions` (`code`,
`priority`, `section`, `message`, `params`), `flags`, `disclaimer`, `meta`
(phiên bản mô hình, công thức, trích xuất, `latency_ms`).

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

**Quy ước ảnh (media):** DB lưu **storage key** (vd `site/settings/logo.png`), không lưu URL tuyệt đối; API resolve ra URL công khai theo domain/CDN hiện tại tại thời điểm trả về. Đổi domain hoặc bật `MEDIA_PUBLIC_BASE_URL` không cần sửa dữ liệu.

## Cutover CV API: V1 → V2

Không tạo alias `/api/v1/` và không redirect HTTP các request ghi: hai hành vi đó
làm client lỗi khó chẩn đoán hoặc vô tình đổi method/body. `/api/cvs/` và
`/api/cv-templates/` là contract legacy hiện hữu; `/api/candidate/cvs/` và
`/api/public/cv-templates/` là contract chuẩn cho client mới.

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

Card không còn `theme_color`/`color_variants` (CVT-1c): client dùng `colors[]`;
`thumbnail_url` của card và `preview_url` của detail là ảnh của màu mặc định. URL
ảnh thuộc quan hệ template–color, không suy ra từ hex hoặc hard-code trên frontend.

Position picker trả contract tối thiểu, không lộ hai cấp taxonomy trên UI:

```json
{
  "public_id": "jobcat_...",
  "name_vi": "Nhân viên CSKH"
}
```

Frontend dùng `public_id` làm value và chỉ hiển thị `name_vi`. Sau khi chọn,
frontend gọi position-preview với locale và `experience_band`. Resolver chọn
nhóm kinh nghiệm gần nhất, ưu tiên nội dung riêng của vị trí; nội dung chung được
thay `{position}` bằng `JobCategoryLocalization` theo locale để tạo `content_json`
deterministic. Không fallback tên tiếng Việt vào preview locale khác.

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

`position_public_id`, `experience_band` và `theme_color` đều optional;
`position_public_id` không được gửi cùng `source_cv_public_id`. Từ CVT-1c API tạo
CV không còn nhận `sample_content_public_id`. Nếu gửi màu không
active hoặc không được gán cho template, API trả `400 theme_color`. Màu hợp lệ
được copy vào `style_json.theme_color` của initial version và draft.

## Thông báo chạy đa cổng

> Trạng thái AN-P1: backend foundation và OpenAPI đã triển khai. Runtime UI thuộc
> AN-P2; dismiss/event/metrics thuộc AN-P4. Nguồn thiết kế canonical:
> [đặc tả thông báo đa cổng](../01-phan-tich/dac-ta-thong-bao-da-cong.md).

| Method | Endpoint | Quyền | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/public/site/announcements/active/` | Theo surface/session | Feed runtime đã target và xếp priority |
| `PUT` | `/api/shared/site/announcements/{public_id}/state/` | Authenticated | Dismiss/snooze idempotent theo revision và dismissal version |
| `POST` | `/api/public/site/announcements/events/` | Consent + throttle | Batch analytics best-effort; luôn không chặn runtime/CTA |
| `POST` | `/api/public/site/announcements/runtime-events/` | AllowAny + throttle | Operational event PII-free cho feed/contract/render failure |
| `GET/POST` | `/api/admin/site/announcements/` | Admin | List/create |
| `GET/PATCH` | `/api/admin/site/announcements/{public_id}/` | Admin | Detail/lịch sử và đổi tên vận hành |
| `POST` | `/api/admin/site/announcements/{public_id}/revisions/` | Admin | Tạo revision mới |
| `POST` | `/api/admin/site/announcements/{public_id}/publish/` | Admin | Publish ngay hoặc schedule |
| `POST` | `/api/admin/site/announcements/{public_id}/pause/` | Admin | Pause |
| `POST` | `/api/admin/site/announcements/{public_id}/resume/` | Admin | Resume |
| `POST` | `/api/admin/site/announcements/{public_id}/archive/` | Admin | Archive |
| `POST` | `/api/admin/site/announcements/{public_id}/reset-dismissals/` | Admin | Tăng `dismissal_version` để hiện lại cho người đã đóng |
| `POST` | `/api/admin/site/announcements/{public_id}/duplicate/` | Admin | Tạo draft độc lập |
| `GET` | `/api/admin/site/announcements/{public_id}/metrics/` | Admin | Summary và daily metrics toàn bộ revision, mặc định 30 ngày |

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
category active có revision đang công khai (`PUBLISHED`).

| Method | Endpoint | Query | Mục đích |
| --- | --- | --- | --- |
| `GET` | `/api/public/knowledgebase/categories/` | — | Category active và số bài public |
| `GET` | `/api/public/knowledgebase/articles/` | `category`, `type=faq\|guide`, `q`, `page`, `page_size<=60` | Browse/search bài public |
| `GET` | `/api/public/knowledgebase/articles/{category_slug}/{article_slug}/` | — | Revision đang publish, related/trước/sau tối đa 6 bài |

`q` dài 2–120 ký tự và search không dấu theo nhiều token. Draft,
archived, category inactive và slug không tồn tại đều trả cùng `404`; response
không lộ actor, source reference, revision token hay revision chưa
publish. Public response dùng `Cache-Control: public, max-age=60,
stale-while-revalidate=300` và ETag; conditional request khớp trả `304`.
`KNOWLEDGEBASE_PUBLIC_ENABLED=false` làm public API fail-closed `404` nhưng giữ
nguyên admin/data. `GET /api/public/site/settings/` đồng thời trả capability boolean
`knowledgebase_public_enabled` lấy trực tiếp từ switch này để frontend ẩn/hiện
entry point. Response còn có `knowledgebase_search_index_enabled`, chỉ true khi
public và index switch backend cùng bật; cả hai không phải row site setting mà
admin có thể sửa. Admin API luôn yêu cầu tài khoản quản trị và trả
`Cache-Control: private, no-store`.

`KNOWLEDGEBASE_SEARCH_INDEX_ENABLED=false` giữ toàn bộ Help Center `noindex` và
sitemap riêng rỗng. Khi public switch, index switch và global
`seo_robots_index` cùng true, home/category/article canonical chuyển sang
`index, follow`, `/sitemaps/knowledgebase.xml` được thêm vào `/sitemap.xml`;
URL có `q`, `type` hoặc `page` vẫn noindex. Trước khi bật phải chạy
`python manage.py check_knowledgebase_readiness --json` theo runbook deployment.

Public/admin request phát metric count/latency theo endpoint, status, loại và
bucket kết quả/độ dài query. Raw query, title, body, email và source
không được ghi vào metric hoặc label.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET/POST` | `/api/admin/knowledgebase/categories/` | List/tạo category |
| `GET/PATCH` | `/api/admin/knowledgebase/categories/{public_id}/` | Detail/cập nhật category |
| `POST` | `/api/admin/knowledgebase/categories/reorder/` | Sắp xếp toàn bộ category |
| `POST` | `/api/admin/knowledgebase/categories/{public_id}/activate/` | Bật category public |
| `POST` | `/api/admin/knowledgebase/categories/{public_id}/deactivate/` | Tắt category public |
| `GET/POST` | `/api/admin/knowledgebase/articles/` | List/filter/tạo article + revision 1 |
| `GET/PATCH` | `/api/admin/knowledgebase/articles/{public_id}/` | Detail/audit/cập nhật metadata |
| `POST` | `/api/admin/knowledgebase/articles/reorder/` | Sắp xếp bài trong một category |
| `GET/POST` | `/api/admin/knowledgebase/articles/{public_id}/revisions/` | Lịch sử/tạo revision mới |
| `GET/PATCH` | `/api/admin/knowledgebase/articles/{public_id}/revisions/{number}/` | Xem/sửa revision nháp |
| `POST` | `.../revisions/{number}/discard/` | Hủy bản nháp của bài đã công khai |
| `POST` | `/api/admin/knowledgebase/articles/{public_id}/publish/` | Xuất bản bản nháp hoặc công khai lại (rollback) một revision đã xuất bản; sửa bài đã công khai cần `change_summary` |
| `POST` | `/api/admin/knowledgebase/articles/{public_id}/archive/` | Ẩn bài nhưng giữ published pointer |
| `POST` | `/api/admin/knowledgebase/articles/{public_id}/restore/` | Khôi phục đúng revision trước đó |
| `GET/POST` | `/api/admin/knowledgebase/media/` | Media library/upload ảnh |

Mọi PATCH/action gửi `revision_token`; publish gửi thêm `revision_number` và
không tự chọn revision mới nhất. Token cũ hoặc transition sai trả `409` với
`code` ổn định. Revision `PUBLISHED` không sửa tại chỗ. Xuất bản bản sửa của
bài đã publish bắt buộc `change_summary`. Category/slug/type khóa sau publish
đầu. Bài đang công khai vẫn sửa trực tiếp trong editor: lần lưu đầu gọi
`POST .../revisions/` với nội dung đang sửa để mở bản nháp mới (ADR-0024).
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
