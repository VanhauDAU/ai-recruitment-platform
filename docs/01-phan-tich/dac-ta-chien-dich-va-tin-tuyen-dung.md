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

Chiến dịch là một **đợt tuyển** riêng của recruiter: khoảng thời gian, ngân
sách, các tin tuyển dụng và phễu hồ sơ của chúng. Mỗi tin là một vị trí với
cấp bậc và số lượng tuyển riêng, nên một chiến dịch có thể tuyển cùng lúc giám
đốc và nhân viên. Chỉ tiêu của chiến dịch là tổng `number_of_vacancies` của các
tin (`headcount` trong API), không nhập tay (chốt với user 18/11/2026).

- Liên kết `Job.campaign` là **tùy chọn**; một tin thuộc tối đa một chiến dịch,
  một chiến dịch có thể chứa nhiều tin (ràng buộc một tin/chiến dịch cũ đã bị
  gỡ ở migration `jobs.0028`).
- "Thêm chiến dịch mới" mở thẳng wizard `/tuyendung/app/campaigns/new`: bước
  Thông tin lưu lần đầu mới tạo chiến dịch ở **`draft`** rồi chuyển sang bước
  chọn tin, nên không còn nháp rỗng và không còn hộp "nhập tên" riêng
  (2026-11-18). Không cần liên kết công ty hay hoàn tất xác thực; `company` lấy
  theo recruiter và có thể rỗng. Ngoại lệ: tạo nhanh ngay trong form đăng tin gửi
  `activate=true` để chiến dịch chạy luôn, vì tin sắp đăng cần chiến dịch
  `active`. Điều kiện xác thực chỉ được kiểm tra khi đăng tin (mục 4).
- Thông tin của chiến dịch (ghi được qua API từ 2026-11-18):
  - `start_date`/`target_date` hoặc `is_continuous`;
  - ngân sách min/max và nguồn;
  - ghi chú (`description`);
  - truy ngược `source_need` (nhu cầu tư vấn).
  Ba trường vị trí chuyên môn, cấp bậc, `headcount_target` (thừa hưởng từ nhu
  cầu tuyển dụng khi đăng ký, chỉ chứa được một vị trí) đã bị gỡ ở migration
  `employers.0066`.
- Ràng buộc (kiểm ở serializer, service và CheckConstraint):
  - `target_date ≥ start_date`, `budget_max ≥ budget_min`;
  - chỉ đổi `start_date` khi còn `draft`/`scheduled`;
  - không rút `target_date` xuống trước hạn nộp của tin đang tuyển;
  - chiến dịch đã kết thúc không sửa được.
- Thời gian chạy thật được ghi lại để chỉ số sức khỏe chia theo số ngày thực sự
  chạy:
  - `first_activated_at`, `activated_at`;
  - `active_seconds_accumulated` (không tính thời gian dừng);
  - `ended_at`, `ended_by` (`user`/`system`).
  API trả thêm `active_days`.
- Tin chỉ gắn được vào chiến dịch của chính recruiter, không bị `policy_hold`
  và chưa `completed`/`cancelled`.

### Thiết lập và kích hoạt (wizard)

Trang `/tuyendung/app/campaigns/:id/setup?step=` có ba bước:

Bên trái là thanh lộ trình. Mỗi bước hiện trạng thái suy ra từ dữ liệu, không
theo thứ tự bước: "Đến 31/12, ngân sách tối đa …", "Chưa chọn tin nào", "2 tin
sẽ đăng, tuyển 4 người", "Còn 1 điều kiện chưa đạt". Bước xong có dấu xanh, bước
cần làm có vòng hổ phách. Bấm vào bước nào thì chuyển sang bước đó.

1. **Thông tin**: thời gian (có ngày kết thúc / tuyển liên tục), ngân sách, ghi
   chú.
2. **Tin tuyển dụng**: chọn tin nháp của chiến dịch để *đăng* khi kích hoạt,
   hoặc tin đang hiển thị (chưa thuộc chiến dịch nào còn chạy) để *gắn*. Tin
   đang hiển thị chưa được gắn ngay, vì gắn vào chiến dịch chưa chạy sẽ làm tin
   bị ẩn. Lựa chọn lưu ở `CampaignLaunchPlan`/`CampaignLaunchJob`
   (`apps.campaigns`). Khối "Tạo tin mới cho chiến dịch" mở form đăng tin với
   `?campaign=…&return=setup` và nhắc bấm **Lưu nháp**; lưu xong thì quay lại
   bước này. Mỗi tin hiện số người cần tuyển, hạn nộp, và cảnh báo nếu hạn nộp
   sau ngày kết thúc chiến dịch. Thanh dưới cùng ghi "Đã chọn N tin, tuyển tổng
   M người".
3. **Xem lại & kích hoạt**: checklist từ `GET /launch/`:
   - ngày kết thúc từ hôm nay trở đi hoặc tuyển liên tục;
   - có ít nhất một tin;
   - tin nháp đủ nội dung và hạn nộp không sau `target_date`;
   - tài khoản đủ điều kiện đăng tin (cùng điều kiện với `publish_job`);
   - còn lượt đăng.

   Màn hình mở đầu bằng "Còn N việc trước khi kích hoạt". Mỗi việc có nút đưa
   về đúng bước cần sửa; các điều kiện đã đạt gom vào một dòng thu gọn. Dòng
   "Khi kích hoạt, hệ thống sẽ đăng X tin nháp và gắn Y tin" nói trước kết quả.
   Nút bị khóa thì luôn ghi lý do.

   NTD chấp nhận cam kết chịu trách nhiệm rồi chọn một trong hai cách:
   - **Kích hoạt ngay**: chuyển sang `active`, đăng mọi tin nháp đã chọn và gắn
     các tin đã chọn. Tất cả hoặc không gì cả: một tin lỗi thì không có gì thay
     đổi và API trả lỗi từng tin. Nếu `start_date` rỗng hoặc ở tương lai thì
     đặt bằng hôm nay.
   - **Lên lịch** (cần `start_date` sau hôm nay): chuyển sang `scheduled`; lưu
     phiên bản cam kết đã chấp nhận để dùng lúc tự kích hoạt.

Bước "Kênh phân phối" (không bắt buộc, GĐ2) nằm giữa bước Tin và Kích hoạt;
thêm kênh sau khi chiến dịch chạy cũng được.

### Phân phối đa kênh và ghi nhận nguồn (GĐ2, 2026-11-18)

- **Kênh** (`CampaignChannel`) là một nơi NTD đăng tuyển: fanpage, nhóm
  Facebook, LinkedIn, Zalo, TikTok, email, website công ty, tờ rơi/QR, khác.
  - Mỗi kênh có một **link theo dõi** `/r/<code>` (8 ký tự ngẫu nhiên) và mã QR
    tải được.
  - Link dẫn tới trang tuyển dụng của chiến dịch hoặc một tin trong chiến dịch.
- **Nội dung đăng**:
  - "Soạn bằng AI" gọi runtime `ai_core` (Gemini, use case
    `campaign_channel_post`), văn phong theo loại kênh, chỉ dùng dữ liệu công
    khai của tin; link chèn bằng `{link}`;
  - AI tắt, lỗi hoặc thiếu `{link}` thì dùng mẫu cố định;
  - tối đa 20 lượt/ngày/người;
  - NTD sửa tay được, sao chép nội dung đã thay sẵn link;
  - đăng tay rồi đánh dấu "Đã đăng" (kèm link bài, không bắt buộc). Đăng tự
    động lên Facebook Page là GĐ3.
- **Chi phí** nhập tay theo kênh (quảng cáo, in ấn...); không thanh toán trong
  hệ thống.
- **Đếm lượt bấm** (`/r/<code>`):
  - không cookie, không lưu IP;
  - đếm theo kênh và ngày: tổng lượt, người bấm (khử trùng trong ngày bằng hash
    có salt chỉ nằm trong Redis), lượt xem trước của crawler mạng xã hội, lượt
    bấm khi chiến dịch không chạy.
- **Chuyển hướng**:
  - chiến dịch đang chạy và kênh trỏ tới tin còn công khai thì đi tới
    `/viec-lam/<slug>`;
  - còn lại đi tới `/tuyen-dung/<slug>`, nơi trang tự hiện trạng thái tạm dừng /
    sắp bắt đầu / đã kết thúc kèm việc làm khác của công ty;
  - luôn kèm `?ref=` ký bằng `TimestampSigner`, hạn 30 ngày.
- **Ghi nhận nguồn khi ứng tuyển**:
  - frontend đọc `?ref=` rồi xóa khỏi URL;
  - có consent Analytics thì nhớ 30 ngày (lần bấm cuối thắng), không có thì chỉ
    nhớ trong phiên;
  - gửi `campaign_ref` cùng đơn ứng tuyển; backend kiểm chữ ký, hạn và việc
    kênh thuộc đúng chiến dịch của tin, rồi ghi `Application.campaign_channel` và
    `acquisition_channel`;
  - ref sai không bao giờ chặn việc nộp, chỉ tính là tự nhiên;
  - NTD thấy "Nguồn hồ sơ: Kênh chiến dịch: <tên>" ở hồ sơ.
- **Tab "Kênh & nguồn"** của trang chi tiết:
  - bảng so sánh từng kênh: người bấm, hồ sơ, tỷ lệ nộp, trúng tuyển, đã chi,
    chi phí/hồ sơ, chi phí/trúng tuyển;
  - ba nguồn tự nhiên: mời từ kho ứng viên, gợi ý của ProCV, tự tìm thấy;
  - dòng tổng có % ngân sách đã dùng;
  - bên dưới là thẻ từng kênh.
- **Trang tuyển dụng công khai** `/tuyen-dung/<slug>`:
  - nội dung: tên đợt tuyển, công ty (logo, ảnh bìa), khoảng thời gian, lời giới
    thiệu, danh sách tin đang tuyển (`/api/jobs/?campaign=`);
  - slug sinh từ tên + mã, đổi theo tên cho tới lần chạy đầu rồi đóng băng;
  - NTD tắt được trang;
  - vỏ SEO trả 404/410/noindex theo trạng thái.

### Đăng tự động lên Facebook Page (GĐ3, 2026-11-18)

- **Kết nối Fanpage**: Cài đặt tài khoản → "Kết nối mạng xã hội" → OAuth của
  Facebook → chọn Fanpage. Chỉ lưu Page token, mã hóa. Ngắt kết nối thì hủy các
  bài đang hẹn trên Fanpage đó.
- **Hẹn đăng**:
  - kênh loại "Fanpage Facebook" có khối "Đăng tự động lên Fanpage", gồm hẹn
    đăng ngay hoặc theo giờ, nội dung lấy từ bài đã soạn (có link theo dõi), và
    sửa được trước khi hẹn;
  - bài của chiến dịch nháp hoặc đã lên lịch được đăng ngay khi chiến dịch chạy.
- **Theo trạng thái chiến dịch**:
  - tạm dừng: bài hẹn chuyển "Hoãn", bài đã đăng giữ nguyên;
  - mở lại: bài hoãn còn hạn tự về "Đã hẹn giờ", bài quá giờ cần "Đăng lại ngay";
  - hoàn tất/hủy: gỡ bài đã đăng, hủy bài chưa đăng; gỡ không được thì báo NTD
    kèm link bài.
- **Lỗi**:
  - lỗi tạm thời được thử lại (1/5/15/60 phút), có kiểm tra bài trùng trước khi
    đăng lại;
  - token hết hạn thì kết nối chuyển "Hết hạn" và NTD được báo.
- **Đăng thành công**: kênh tự đánh dấu "Đã đăng" (kèm link bài) và ghi
  `CampaignActivity`.
- **Môi trường**: `CAMPAIGN_SOCIAL_PROVIDER=fake` chạy toàn bộ luồng không cần
  Meta. Đăng thật theo `docs/06-deployment/facebook-page-integration.md`.

### Trạng thái chiến dịch

```text
draft ──launch(now)──> active ⇄ paused
  │  └─launch(later)─> scheduled ──(beat: start_date)──> active
  │                     └─hủy lịch──> draft
  └──> cancelled <── scheduled/active/paused ──> completed
                                   (NTD, hoặc hệ thống sau target_date)
```

| Từ | NTD chuyển qua `status/` | Hệ thống / luồng kích hoạt |
| --- | --- | --- |
| `draft` | `cancelled` | `active`, `scheduled` (qua `launch/`) |
| `scheduled` | `draft`, `cancelled` | `active` (beat vào `start_date`) |
| `active` | `paused`, `completed`, `cancelled` | `completed` (qua `target_date`) |
| `paused` | `active`, `completed`, `cancelled` | `completed` (qua `target_date`) |
| `completed`, `cancelled` | — (trạng thái cuối) | — |

- `status/` từ chối `draft|scheduled → active` với `CAMPAIGN_LAUNCH_REQUIRED`;
  muốn kích hoạt phải qua `launch/`. Mở lại chiến dịch đã qua `target_date`
  (không tuyển liên tục) bị từ chối cho tới khi gia hạn ngày kết thúc.
- **Kết thúc chiến dịch đóng tin:** khi chiến dịch sang `completed` hoặc
  `cancelled` (NTD bấm, hoặc hệ thống tự kết thúc), mọi tin `active` của nó
  chuyển `closed`, ghi `JobStatusHistory` (`note=campaign_ended`, actor
  `system` khi tự động), rồi áp luật tin ngừng tuyển. Hiệu ứng này chạy qua
  signal `campaign_status_changed` (`employers/signals.py` → `jobs/signals.py`)
  để `employers` không import service của `jobs`.
- **Lịch chạy:** Celery beat `run_campaign_schedule` chạy 5 phút một lần, theo
  ngày giờ Việt Nam, idempotent:
  - `scheduled` tới `start_date`: kích hoạt bằng cam kết đã lưu. Nếu phiên bản
    cam kết đã đổi, có blocker hoặc tin lỗi thì vẫn giữ `scheduled`, ghi
    `CampaignLaunchPlan.last_error`, và báo `campaign_activation_failed` một
    lần cho mỗi loại lỗi.
  - `active`/`paused` không tuyển liên tục đã qua `target_date`: chuyển
    `completed` (`ended_by=system`) và báo `campaign_auto_completed`.
  - Còn 3 ngày tới `target_date`: báo `campaign_ending_soon`.
  - Bỏ qua chiến dịch đang `policy_hold`.

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

- Danh sách (làm lại 18/11):
  - **dải trạng thái có số đếm**: Tất cả, Đang chạy, Tạm dừng, Đã lên lịch,
    Nháp, Đã kết thúc (`status=ended` gộp hoàn tất và đã hủy);
  - mặc định **sắp theo trạng thái** (`ordering=status`: đang chạy → tạm dừng →
    đã lên lịch → nháp → hoàn tất → đã hủy, rồi theo hoạt động gần nhất); vẫn
    chọn được sắp theo hoạt động, mới/cũ, tên;
  - tìm theo tên/mã, lọc `scope` = `open`, `needs_review`, `active_jobs`,
    `expired_jobs`;
  - mỗi dòng: tên, trạng thái, khoảng thời gian, "N tin, tuyển M người", ứng
    viên, hoạt động gần nhất, và **một** nút việc tiếp theo ("Thiết lập" cho
    nháp/đã lên lịch, "Xem N CV mới" khi có CV chưa xem, còn lại "Mở");
  - bỏ công tắc bật/tắt và các nút hiện khi rê chuột; bảng từ 1024px, thẻ ở màn
    hẹp hơn.
- Đầu trang chi tiết (làm lại 18/11):
  - một nút chính theo trạng thái: "Tiếp tục thiết lập" / "Xem lịch kích hoạt"
    (nháp, đã lên lịch), "Đăng thêm tin" (đang chạy), "Mở lại chiến dịch" (tạm
    dừng);
  - "Sửa thông tin" (ẩn khi đã kết thúc);
  - menu "Thao tác khác" gom Dừng, Hoàn tất, Hủy, Hủy lịch; mỗi mục có hộp xác
    nhận nói rõ tin sẽ bị ẩn hoặc đóng;
  - dải bốn thông tin: Chỉ tiêu, Thời gian, Ngân sách, Đã chạy;
  - tab Tổng quan gom năm chỉ số vào một dải chung thay cho năm thẻ rời.
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

- Cửa sổ hiển thị luôn chặn công khai cùng hạn nhận hồ sơ (cờ
  `JOB_LIFECYCLE_V2_MODE` đã gỡ, xem
  [ADR-0019](../02-tong-quan/adr-0019-job-effective-state.md)).
- Anchor chu kỳ (`first_approved_at`, `visibility_starts_at`) bất biến: đóng/mở
  lại không reset. Tin đã đăng không đổi `requested_visibility_days` qua form
  sửa, chỉ qua `extend/`.
- Gia hạn (`extend_job_deadline`): không rút ngắn hạn; tin hết hạn chỉ gia hạn
  được trong 30 ngày sau hạn cũ; hạn mới không vượt anchor +
  `JOB_POSTING_MAX_PUBLIC_LIFETIME_DAYS` (90), không vượt cuối cửa sổ hiển thị,
  và nếu thuộc chiến dịch thì chiến dịch phải `active` và hạn không sau
  `target_date`.

## 7. Pipeline hồ sơ ứng tuyển

| Mã | Nhãn recruiter | Nhãn ứng viên | Ai đặt |
| --- | --- | --- | --- |
| `submitted` | Mới | Đã nộp hồ sơ | Hệ thống |
| `viewed` | Đã xem | Nhà tuyển dụng đã xem hồ sơ | Hệ thống, khi NTD mở CV lần đầu |
| `shortlisted` | Phù hợp | Hồ sơ phù hợp | NTD |
| `interviewed` | Phỏng vấn | Mời phỏng vấn | NTD |
| `accepted` | Trúng tuyển (cuối) | Trúng tuyển | NTD, có xác nhận |
| `rejected` | Không phù hợp (cuối) | Chưa phù hợp | NTD, có xác nhận |

- Bỏ `considering` (2026-11-15): trùng nghĩa "chưa phản hồi" với `viewed`;
  migration `applications/0013` gộp dữ liệu cũ vào `viewed`. Không phù hợp
  không yêu cầu lý do.
- Đồ thị chuyển hợp lệ ở `ALLOWED_STATUS_TRANSITIONS`
  (`applications/services/status.py`): NTD chỉ chọn trong
  `Application.DECISION_STATUSES`, được bỏ qua bước, không lùi; API trả sẵn
  `available_decisions` cho từng hồ sơ.
- Mở snapshot CV lần đầu tự chuyển `submitted → viewed` và báo ứng viên ngay
  (email theo tùy chọn `employer_viewed_cv`).
- **Thông báo quyết định có cửa sổ hoàn tác:** mỗi quyết định tạo một
  `CandidateNotification` hẹn giao sau `CANDIDATE_STATUS_NOTIFICATION_DELAY`
  (mặc định 5 phút). Quyết định mới hơn trên cùng hồ sơ hủy thông báo chưa giao
  (bấm nhanh nhiều trạng thái thì ứng viên chỉ nhận trạng thái cuối). Người vừa
  quyết định được hoàn tác khi thông báo chưa giao; trang của ứng viên chỉ thấy
  trạng thái đã được báo.
- NTD tải PDF đúng bản CV đã nộp; mỗi lần xem/tải ghi `CvAccessLog`, ứng viên
  được báo một lần cho mỗi hồ sơ.
- Nộp hồ sơ thành công: ứng viên nhận ngay thông báo "Hồ sơ đã được tiếp nhận" và
  email "Chúc mừng bạn đã ứng tuyển thành công vị trí …" kèm tối đa 5 việc làm
  tương tự (tính từ chính tin vừa nộp, không dùng hồ sơ cá nhân), theo cài đặt
  nhận thông báo của ứng viên.
- **Mời đánh giá nội bộ:** NTD tạo link có hạn (3–30 ngày), thu hồi được, cho
  người không có tài khoản (vd. trưởng bộ phận) xem CV đã ẩn thông tin liên hệ
  và ảnh rồi gửi phiếu (đề xuất, điểm 1–5, điểm mạnh, băn khoăn). NTD được báo
  và xem tổng hợp phiếu trong workspace.
- **Danh sách đen:** NTD chặn ứng viên (lý do, thời hạn 30/90/180 ngày hoặc vô
  thời hạn, tùy chọn từ chối hồ sơ đang chờ); ứng viên bị chặn không nộp được
  vào tin của NTD đó và chỉ thấy thông báo chung. Workspace cảnh báo khi một ứng
  viên nộp ≥ 5 tin của NTD trong 14 ngày.
- **Kho ứng viên tiềm năng:** NTD lưu ứng viên (ghi chú, nhãn); ứng viên được
  báo, xem được NTD nào đang lưu và rút hồ sơ; mục hết hạn sau 12 tháng. Khi
  chọn một tin, hệ thống xếp hạng người trong kho theo độ tương đồng giữa tin
  họ từng nộp và tin mới (có lý do) và cho mời ứng tuyển một lần mỗi tin.
- Ứng viên bị hạn chế tài khoản chỉ có thể bị chuyển sang `rejected`.
- `employer_rating` (1–5) và `employer_note` là dữ liệu nội bộ, lưu qua PATCH
  riêng; không bao giờ xuất hiện trong thông báo, email hay API ứng viên.
- Ứng tuyển chỉ vào tin đang công khai; mỗi ứng viên tối đa 3 lần cho một tin,
  cách nhau ít nhất 5 phút. Mỗi lần nộp lưu snapshot CV bất biến.
- **Tự động từ chối:** theo cấu hình của tin (`auto_reject_stale_applications`,
  `auto_reject_after_days` ∈ 14/21/28/42/56 ngày), hồ sơ ở `submitted`/`viewed`
  không đổi trạng thái quá hạn được chuyển `rejected`. Recruiter nhận nhắc 3
  ngày trước đó; ứng viên nhận email (`auto_rejection_email_body`) và thông báo
  trong chuông 3 ngày sau khi bị từ chối. Trong 3 ngày này recruiter còn đổi lại
  được trạng thái (thông báo tự bị thay thế).
- API: ứng viên `GET/POST /api/v2/applications/`; recruiter
  `/api/v2/recruiter/applications/` (list, `export/`, `{id}/` ghi chú/điểm,
  `{id}/status/`, `{id}/status/undo/`, `{id}/cv/`, `{id}/cv/exports/`,
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
  phản hồi `submitted → viewed`, tiến độ trúng tuyển so với tổng số lượng tuyển
  của các tin và
  `target_date`; gợi ý tối ưu JD; benchmark lương chỉ hiển thị khi nhóm đủ
  ngưỡng mẫu.
- **Talent pool:** lưu ứng viên `rejected` theo vị trí chuyên môn để mời lại ở
  chiến dịch sau; cần consent riêng nếu phạm vi vượt quyền
  `recruiter_visibility` hiện có, và ứng viên phải rút khỏi pool được.
