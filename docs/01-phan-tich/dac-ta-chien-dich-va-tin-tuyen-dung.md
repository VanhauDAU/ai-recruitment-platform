# Đặc tả chiến dịch, tin tuyển dụng và pipeline ứng viên

Tài liệu mô tả hành vi hiện tại của workspace nhà tuyển dụng: chiến dịch tuyển
dụng, vòng đời tin, điều kiện công khai, pipeline hồ sơ và hậu kiểm tin của
quản trị viên. Quyết định nền: [ADR-0014](../02-tong-quan/adr-0014-job-post-moderation.md)
(hậu kiểm thay cho duyệt trước), phần vòng đời hiển thị của
[ADR-0012](../02-tong-quan/adr-0012-job-services-architecture.md) và
[ADR-0015](../02-tong-quan/adr-0015-remove-commercial-services.md) (gỡ dịch vụ
thương mại). Giao diện admin: [admin-job-management.md](../08-frontend/admin-job-management.md).

Code chính: `backend/apps/jobs/services/posting.py`, `services/moderation.py`,
`services/reports.py`, `models/core.py`, `models/querysets.py`;
`backend/apps/employers/services/campaigns.py`, `selectors/campaigns.py`;
`backend/apps/applications/services/`.

## 1. Ranh giới sở hữu

- Chiến dịch, tin và hồ sơ ứng tuyển thuộc **một recruiter cụ thể**
  (`RecruitmentCampaign.owner`, `Job.posted_by`). Chỉ người tạo được xem, sửa,
  đóng, gia hạn, sao chép tin và xử lý hồ sơ của tin. Cùng công ty không tạo
  quyền xem chung; recruiter khác nhận `404`.
- Công ty là thực thể pháp lý/công khai của tin (`Job.company`), không phải
  tenant nghiệp vụ của module.
- Mọi read/mutation của workspace (job, campaign list/detail/options/report/
  performance/activity) đi qua `ensure_recruiter_job_workspace`; khi
  `job_workspace_ready=false` API trả `EMPLOYER_WORKSPACE_BLOCKED`. Ngoại lệ duy
  nhất là `GET /api/jobs/mine/posting-context/`, vẫn đọc được để client hiển
  thị blocker và hướng khắc phục.
- Dữ liệu cá nhân ứng viên (danh sách hồ sơ, export, lịch sử, snapshot CV,
  preview ứng viên trên job/campaign) chỉ trả khi `candidate_data_access=true`
  (`ensure_recruiter_candidate_data_access`). Verification chưa approved không
  khóa workspace nhưng khóa dữ liệu ứng viên và quyền đăng tin.

## 2. Chiến dịch tuyển dụng

Chiến dịch là workspace riêng tư của recruiter cho một nhu cầu tuyển: mục tiêu,
tiến độ, phễu hồ sơ. Tin tuyển dụng là kênh thu CV công khai bên trong chiến
dịch.

- Liên kết `Job.campaign` là **tùy chọn**; một tin thuộc tối đa một chiến dịch,
  một chiến dịch có thể chứa nhiều tin (ràng buộc một tin/chiến dịch cũ đã bị
  gỡ ở migration `jobs.0028`).
- Tạo nhanh chỉ cần `name` (modal submit bằng Enter); không cần liên kết công
  ty hay hoàn tất xác thực. `company` lấy theo recruiter và có thể rỗng. Chiến
  dịch tạo mới ở trạng thái `active`. Điều kiện xác thực chỉ được kiểm tra khi
  đăng tin (mục 4).
- Dữ liệu riêng của chiến dịch: vị trí chuyên môn, cấp bậc, `headcount_target`,
  `start_date`/`target_date` hoặc `is_continuous`, ngân sách min/max và nguồn,
  truy ngược `source_need` (nhu cầu tư vấn).
- Tin chỉ gắn được vào chiến dịch của chính recruiter, không bị `policy_hold`
  và chưa `completed`/`cancelled`.

### Trạng thái chiến dịch

```text
draft ──> active ⇄ paused
  │         │        │
  └──> cancelled <───┤
            └──> completed <──┘
```

| Từ | Được chuyển sang |
| --- | --- |
| `draft` | `active`, `cancelled` |
| `active` | `paused`, `completed`, `cancelled` |
| `paused` | `active`, `completed`, `cancelled` |
| `completed`, `cancelled` | — (trạng thái cuối) |

- Dừng (`paused`) bắt buộc nhập đúng mã chiến dịch (`confirmation_code =
  public_id`). Trước khi xác nhận, UI gọi `pause-impact/` để liệt kê các tin
  đang công khai sẽ bị ẩn.
- **Tác động khi dừng:** trạng thái của tin không đổi, nhưng điều kiện công
  khai yêu cầu chiến dịch `active` (mục 5), nên mọi tin của chiến dịch biến mất
  khỏi bề mặt ứng viên. Mở lại chiến dịch thì các tin còn hạn tự hiển thị lại.
  Trong lúc chiến dịch không `active`, không gia hạn hoặc mở lại tin của nó.
- Chiến dịch bị `policy_hold` (do khóa tài khoản) không sửa, đổi trạng thái
  hay nhận tin được (`RECRUITMENT_HOLD_ACTIVE`).
- Mỗi thay đổi ghi `CampaignActivity` (tạo, sửa, dừng, mở lại, thêm/gỡ/sửa tin,
  đổi trạng thái tin, nhận CV, đổi trạng thái ứng viên, giữ/gỡ giữ do tài
  khoản); tab "Lịch sử hoạt động" đọc từ bảng này.

### Giao diện workspace

- Danh sách: tìm theo tên/mã, lọc `scope` = `open` (đang mở), `needs_review`
  (có CV chưa xem), `active_jobs` (có tin đang hiển thị), `expired_jobs` (có tin
  hết hạn); sắp xếp theo hoạt động gần nhất, mới/cũ, tên. Mobile dùng card,
  desktop dùng bảng.
- Chi tiết có bốn tab: Tổng quan (phễu hồ sơ theo trạng thái, CV bảy ngày, tiến
  độ offer/headcount, biểu đồ hiển thị → xem → ứng tuyển theo tin), CV ứng
  tuyển, Tin tuyển dụng, Lịch sử hoạt động.
- Không hiển thị số liệu giả: tỷ lệ chỉ tính khi có mẫu số, chỉ số chưa có dữ
  liệu hiển thị `—`.

## 3. Vòng đời tin tuyển dụng

`Job.status` chỉ nhận `draft`, `active`, `closed` (check constraint
`chk_jobs_status`). Không còn `pending`/`rejected`.

```text
draft ── đăng ──> active ── đóng ──> closed
  ▲                 │                   │
  └─ sao chép ──────┘                   └── mở lại (hạn mới) ──> active
```

| Thao tác | Endpoint | Quy tắc |
| --- | --- | --- |
| Lưu nháp | `POST /api/jobs/mine/?as=draft`, `PATCH mine/{id}/` | Không validate đầy đủ, không tiêu quota. |
| Đăng | `POST /api/jobs/mine/` hoặc `mine/{id}/submit/` | Validate đủ form, kiểm tra blocker và quota, cần cam kết (mục 4). |
| Sửa tin đang tuyển | `PATCH mine/{id}/` | Có hiệu lực ngay, không đổi `published_at`, không hỏi lại cam kết. |
| Đóng | `mine/{id}/close/` | Chỉ tin `active`. |
| Mở lại | `mine/{id}/reopen/` | Chỉ tin `closed`; nhập hạn nhận hồ sơ mới; cần cam kết và qua blocker như khi đăng. |
| Gia hạn | `mine/{id}/extend/` | Chỉ tin `active`; xem mục 6. |
| Sao chép | `mine/{id}/duplicate/` | Tạo nháp mới tiêu đề "(bản sao)", giữ nguyên chiến dịch, reset mốc đăng/hold/số liệu. |
| Xóa | `DELETE mine/{id}/` | Chỉ nháp **chưa từng đăng** (`submitted_at` rỗng). |

- Trường bắt buộc khi đăng (`_validate_publishable`): tiêu đề, mô tả, yêu cầu,
  quyền lợi, cấp bậc, loại công việc, ít nhất một hình thức làm việc, học vấn,
  kinh nghiệm, loại lương hợp lệ với mức lương tương ứng, số lượng ≥ 1, ít nhất
  một địa điểm, một vị trí chuyên môn chính, hạn nhận hồ sơ hợp lệ, người nhận
  hồ sơ có họ tên, điện thoại và ít nhất một email.
- Hạn nhận hồ sơ (`deadline`, ngày theo `Asia/Ho_Chi_Minh`): từ hôm nay đến tối
  đa `JOB_POSTING_MAX_DEADLINE_DAYS` (mặc định 90), gợi ý
  `JOB_POSTING_DEFAULT_DEADLINE_DAYS` (30).
- Lần đăng (`_go_live`) đặt `published_at`, `approved_at`, chụp
  `approved_snapshot` làm bản gốc cho admin đối chiếu thay đổi, khởi tạo cửa sổ
  hiển thị nếu chưa có và ghi `JobStatusHistory`. Các cột `approved_*` và
  `first_approved_at` giữ tên cũ nhưng mang nghĩa "lần đăng công khai"
  (ADR-0014).
- Tin bị `moderation_hold` hoặc `policy_hold` không sửa, lưu nháp, gia hạn, mở
  lại hay sao chép được (`RECRUITMENT_HOLD_ACTIVE`).
- Mọi chuyển trạng thái ghi `JobStatusHistory` (actor `employer`/`admin`/
  `system` và ghi chú).

## 4. Điều kiện đăng tin

### Cam kết chịu trách nhiệm

Mỗi lần đưa tin lên công khai (đăng nháp, mở lại) recruiter phải gửi
`responsibility_statement_version` trùng phiên bản hiện hành
(`RESPONSIBILITY_STATEMENT_VERSION` trong `posting.py`); sai hoặc thiếu trả
`JOB_RESPONSIBILITY_REQUIRED`. Nội dung và phiên bản được trả trong
`posting-context.responsibility_statement`. Tin lưu
`responsibility_accepted_at` và `responsibility_statement_version`. Đổi nội dung
cam kết thì phải đổi phiên bản.

Tin công khai trước ADR-0014 hoặc được đăng lại bằng lệnh
`publish_converted_pending_jobs` không có bản ghi cam kết; admin thấy nhãn
tương ứng.

### Blocker công khai

Kiểm tra dưới lock trong cùng transaction (`recruiter_job_publication_state`).
Không đạt thì tin vẫn là nháp và API trả `JOB_PUBLICATION_BLOCKED` kèm
`blocked_reasons`:

| Code | Ý nghĩa |
| --- | --- |
| `verification_required` | Hồ sơ xác thực chưa approved cho đúng công ty của tin. |
| `dpa_outdated` | Chưa có chấp thuận DPA còn hiệu lực. |
| `compliance_hold_active` | Recruiter đang có compliance hold. |
| `campaign_inactive` | Tin thuộc chiến dịch không ở trạng thái `active`. |

Ngoài ra: chiến dịch bị `policy_hold` hoặc đã kết thúc trả
`RECRUITMENT_HOLD_ACTIVE`/lỗi `campaign`; cửa sổ hiển thị đã hết (chế độ
`enforce`) trả `JOB_VISIBILITY_EXPIRED`.

### Quota đăng tin

- Quota đếm số tin **từng được đăng** của recruiter (`submitted_at` không rỗng),
  tính trọn đời. Đăng lần đầu một tin mới mới tiêu lượt; sửa, đóng, mở lại,
  gia hạn, xóa nháp không tiêu hay hoàn lượt.
- Giới hạn: `employer_verified_level_three_job_quota` (mặc định 100) khi tài
  khoản đạt Cấp 3, ngược lại `employer_free_job_quota` (mặc định 3). Cả hai là
  site setting nhóm employer.
- `posting-context` trả `publish_limit`, `publish_remain`, `job_postable`,
  `block_reason` và các cờ readiness.

## 5. Điều kiện hiển thị công khai

Mọi bề mặt ứng viên (danh sách, chi tiết, gợi ý, email, báo cáo, ứng tuyển)
dùng một predicate duy nhất `publicly_available_job_filter`
(`models/querysets.py`). Tin công khai khi đồng thời:

- `status=active`, không `policy_hold`, không `moderation_hold`, không có
  compliance hold active trên tin;
- tài khoản người đăng `active`, chưa xóa, vẫn thuộc đúng công ty của tin, hồ
  sơ xác thực (nếu có) cùng công ty;
- hạn nhận hồ sơ chưa qua; ở chế độ `enforce` thêm điều kiện
  `visibility_starts_at <= now < visibility_ends_at`;
- không thuộc chiến dịch, hoặc chiến dịch `active`, không `policy_hold`, không
  compliance hold và chủ chiến dịch còn hoạt động.

Tin `active` quá hạn hiển thị "Hết hạn" trong workspace (`is_expired`), không
nhận ứng tuyển và bị ẩn khỏi API public; job, hồ sơ và audit vẫn giữ.

## 6. Cửa sổ hiển thị và gia hạn

Ba mốc thời gian độc lập, không suy mốc này từ mốc khác:

| Mốc | Trường | Ý nghĩa |
| --- | --- | --- |
| Nhận hồ sơ | `deadline` (API: `application_deadline`) | Ngày cuối nhận ứng tuyển. |
| Công khai | `first_approved_at`, `visibility_starts_at`, `visibility_ends_at`, `requested_visibility_days` | Chu kỳ hiển thị bắt đầu từ lần đăng đầu, mặc định 30 ngày, tối đa 90. |
| Sắp xếp | `published_at` | Mốc lần đăng gần nhất; sửa tin không đổi. |

- `JOB_LIFECYCLE_V2_MODE` (`legacy` mặc định, `shadow`, `enforce`): chỉ ở
  `enforce` cửa sổ hiển thị mới chặn công khai; `legacy`/`shadow` chỉ dùng hạn
  nhận hồ sơ. Production từ chối giá trị khác.
- Anchor chu kỳ (`first_approved_at`, `visibility_starts_at`) bất biến: đóng/mở
  lại không reset. Tin đã đăng không đổi `requested_visibility_days` qua form
  sửa, chỉ qua `extend/`.
- Gia hạn (`extend_job_deadline`): không rút ngắn hạn; tin hết hạn chỉ gia hạn
  được trong 30 ngày sau hạn cũ; hạn mới không vượt anchor +
  `JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS` (90), không vượt cuối cửa sổ hiển thị,
  và nếu thuộc chiến dịch thì chiến dịch phải `active` và hạn không sau
  `target_date`.

## 7. Pipeline hồ sơ ứng tuyển

| Mã | Nhãn recruiter | Nhãn ứng viên |
| --- | --- | --- |
| `submitted` | Mới / Tiếp nhận | Tiếp nhận |
| `viewed` | Đã xem | Nhà tuyển dụng đã xem hồ sơ |
| `considering` | Cân nhắc | Hồ sơ đang được xem xét |
| `shortlisted` | Phù hợp | Hồ sơ đang được xem xét |
| `interviewed` | Phỏng vấn | Phỏng vấn |
| `accepted` | Đã tuyển / Đã nhận offer | Đã nhận offer |
| `rejected` | Từ chối | Chưa phù hợp |

- Đồ thị chuyển hợp lệ ở `ALLOWED_STATUS_TRANSITIONS`
  (`applications/services/applications.py`): được bỏ qua bước trung gian,
  không lùi; `accepted` và `rejected` là trạng thái cuối.
- Mở snapshot CV lần đầu tự chuyển `submitted → viewed`.
- Ứng viên bị hạn chế tài khoản chỉ có thể bị chuyển sang `rejected`.
- `employer_rating` (1–5) và `employer_note` là dữ liệu nội bộ. Ứng viên chỉ
  nhận nhãn và timeline đã map, không thấy điểm, ghi chú hay khác biệt
  `considering`/`shortlisted`.
- Ứng tuyển chỉ vào tin đang công khai; mỗi ứng viên tối đa 3 lần cho một tin,
  cách nhau ít nhất 5 phút. Mỗi lần nộp lưu snapshot CV bất biến.
- **Tự động từ chối:** theo cấu hình của tin (`auto_reject_stale_applications`,
  `auto_reject_after_days` ∈ 14/21/28/42/56 ngày), hồ sơ ở `submitted`/`viewed`/
  `considering` không đổi trạng thái quá hạn được chuyển `rejected`. Recruiter
  nhận nhắc 3 ngày trước đó; ứng viên nhận email (`auto_rejection_email_body`)
  3 ngày sau khi bị từ chối. Trong 3 ngày này recruiter còn đổi lại được trạng
  thái.
- API: ứng viên `GET/POST /api/v2/applications/`; recruiter
  `/api/v2/recruiter/applications/` (list, `export/`, `{id}/` cập nhật, `{id}/cv/`,
  `{id}/history/`), luôn lọc `job__posted_by=request.user`.

## 8. Báo cáo và hậu kiểm của quản trị viên

Tin công khai ngay khi đăng; admin không duyệt trước mà xử lý sau khi có báo
cáo hoặc phát hiện vi phạm.

### Báo cáo của ứng viên

- `POST /api/jobs/{public_id}/report/`: chỉ ứng viên đăng nhập, chỉ tin đang
  công khai, mỗi người một báo cáo cho một tin (unique), có throttle theo tài
  khoản và IP. Lý do: `fake_company`, `scam`, `wrong_info`, `duplicate`,
  `expired`, `other`.
- Tin vẫn hiển thị trong lúc báo cáo `pending`.

### Xử lý báo cáo

| Thao tác | Endpoint | Quyền |
| --- | --- | --- |
| Hàng chờ | `GET /api/jobs/admin/reports/` | `job_moderation.view` |
| Kết luận `upheld`/`dismissed` | `POST admin/reports/{id}/resolve/` | `job_moderation.resolve_report` |
| Gỡ kết luận `upheld → dismissed` | `POST admin/reports/{id}/reverse/` | `job_moderation.resolve_report` |

- `upheld` bắt buộc ghi chú. Nếu lý do là `fake_company`, `scam` hoặc
  `wrong_info`: tin `active` tự bị tạm ẩn với `confirmed_violation`, và người
  đăng mất huy hiệu xác thực trên mọi tin.
- Gỡ kết luận bắt buộc lý do, khôi phục điều kiện huy hiệu nhưng **không** tự
  hiện lại tin; khôi phục hiển thị là quyết định riêng.
- Mọi kết luận ghi `JobReportResolutionEvent`.

### Tạm ẩn và khôi phục

- `POST /api/jobs/admin/moderation/{id}/decisions/` với `action=hide|restore`,
  quyền `job_moderation.enforce_visibility`.
- `hide` chỉ cho tin `active` chưa bị giữ; cần `reason_code`, ghi chú và mức giữ
  `manual_review` hoặc `confirmed_violation`; có thể gắn báo cáo nguồn.
  `restore` cần lý do và gỡ `moderation_hold`.
- Mỗi quyết định gửi `review_token`; nếu tin đã thay đổi từ lúc admin mở chi
  tiết, API trả `409 job_moderation_stale`.
- Tạm ẩn không đổi `status`. Mỗi quyết định ghi `JobModerationEvent` bất biến
  (người thao tác, lý do, ghi chú, hold trước/sau, fingerprint nội dung). Hai
  action `approve`/`reject` chỉ còn để đọc lịch sử cũ.
- Recruiter thấy tin đang bị tạm ẩn qua `visibility_hold` (loại, nhãn, thời
  điểm, nhóm lý do); ghi chú của admin không trả về vì có thể trích lời người
  báo cáo.

### Giữ do tài khoản và tuân thủ

- `policy_hold` (job/campaign) do luồng khóa/cấm tài khoản đặt và gỡ; khác
  `moderation_hold`.
- Verification compliance hold (ER-5) gắn theo recruiter và liên kết tới
  campaign/job; không đổi business status và không ghi đè hai loại hold trên.
  Xem [employer-remediation-decision-log.md](../02-tong-quan/employer-remediation-decision-log.md).
- Write transaction khóa theo thứ tự `User → Recruiter → Verification →
  Campaign → Job → Application`; nếu chiến dịch của tin đổi giữa lúc đọc và
  lúc khóa, service trả `RECRUITMENT_RESOURCE_CHANGED`.

## 9. Mô hình dữ liệu chính

| Model (bảng mặc định của Django) | Vai trò |
| --- | --- |
| `RecruitmentCampaign` (`employers_recruitmentcampaign`) | Chiến dịch, owner `RecruiterProfile`. |
| `CampaignActivity` (`employers_campaignactivity`) | Nhật ký hoạt động hiển thị cho recruiter. |
| `Job` (`jobs_job`) | Tin; `campaign_id` tùy chọn, hold, cửa sổ hiển thị, snapshot, cam kết. |
| `JobStatusHistory` (`jobs_jobstatushistory`) | Audit chuyển trạng thái tin. |
| `JobModerationEvent` (`jobs_jobmoderationevent`) | Quyết định tạm ẩn/khôi phục bất biến. |
| `JobReport`, `JobReportResolutionEvent` | Báo cáo và lịch sử kết luận. |
| `Application`, `ApplicationStatusHistory` | Hồ sơ ứng tuyển và timeline. |

Chi tiết cột ở [thiet-ke-database.md](../03-database/thiet-ke-database.md).
Nhãn hiển thị `tier`, `is_hot`, `is_urgent`, `has_flash_badge` vẫn do admin
gán, không gắn với gói dịch vụ nào.

## 10. Việc còn mở

- Workspace chưa có `CV đề xuất`, `CV tìm kiếm`, ứng viên đã xem tin, CV đang
  theo dõi; hai mục sidebar "Quản lý nhãn CV" và "Quản lý yêu cầu kết nối CV"
  hiển thị disabled cho tới khi có workflow thật.
- Chưa có timeline "các vòng đăng" của tin trong chiến dịch (dữ liệu đã có
  trong `JobStatusHistory`).
- Tạo tin bằng nhập tài liệu/mẫu ngoài chưa có workflow.

## 11. Hướng phát triển

Các ý tưởng dưới đây không phụ thuộc dịch vụ trả phí và chỉ được bật khi có dữ
liệu thật và tiêu chí giải thích được:

- **Phễu theo nguồn:** tách phễu chiến dịch theo `Application.source`
  (`applied`/`recommended`/`invited`).
- **Matching minh bạch hai chiều:** điểm khớp rule-based từ `JobSkill`, kinh
  nghiệm, học vấn, ngoại ngữ; cùng một engine và cùng phần giải thích cho ứng
  viên (trước khi nộp) và recruiter (trong pipeline).
- **Sức khỏe chiến dịch:** chỉ số giải thích được như tốc độ CV về, thời gian
  phản hồi `submitted → viewed`, tiến độ offer so với headcount và
  `target_date`; gợi ý tối ưu JD; benchmark lương chỉ hiển thị khi nhóm đủ
  ngưỡng mẫu.
- **Talent pool:** lưu ứng viên `rejected` theo vị trí chuyên môn để mời lại ở
  chiến dịch sau; cần consent riêng nếu phạm vi vượt quyền
  `recruiter_visibility` hiện có, và ứng viên phải rút khỏi pool được.
