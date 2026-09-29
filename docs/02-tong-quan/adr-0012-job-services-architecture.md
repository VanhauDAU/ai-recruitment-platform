# ADR-0012: Vòng đời tin và dịch vụ gia tăng tuyển dụng

**Trạng thái:** Đã chấp nhận; đang triển khai theo feature flag
**Ngày:** 12/08/2026  
**Owner:** Jobs, Employer Services, Candidate Discovery  
**Nhánh:** `docs/job-services-architecture`

## 1. Bối cảnh

`Job.deadline` hiện đồng thời quyết định hạn nhận hồ sơ và khả năng xuất hiện
trước ứng viên. `published_at` vừa là mốc duyệt, mốc sắp xếp vừa được dùng để
giới hạn gia hạn. Các cờ `tier`, `is_hot`, `is_urgent`, `has_flash_badge` được
admin gán trực tiếp, không có nguồn cấp, thời hạn hoặc audit nghiệp vụ. Catalogue
`ServicePackage` chỉ là nội dung marketing và chưa cấp quyền thực thi.

Hệ quả hiện tại:

- thời gian chờ duyệt làm giảm số ngày hiển thị thực tế;
- sửa, duyệt lại hoặc đóng rồi mở lại có thể làm mới `published_at`;
- `ordering=urgent` đang ưu tiên flash badge thay vì nhãn GẤP;
- cùng một tin có màu và badge khác nhau giữa các candidate surface;
- không thể xác định quyền lợi còn hạn, đã dùng hoặc thuộc đơn hàng nào;
- không thể dùng aggregate view count để remarketing theo người xem.

## 2. Quyết định

### 2.1. Ba đồng hồ độc lập

| Đồng hồ | Nguồn dữ liệu canonical | Quy tắc |
| --- | --- | --- |
| Nhận hồ sơ | `application_deadline` | Ngày cuối NTD chấp nhận hồ sơ |
| Công khai tin | `visibility_starts_at`, `visibility_ends_at` | Bắt đầu từ lần duyệt đầu; mặc định 30 ngày, một public cycle tối đa 90 ngày |
| Dịch vụ | `activate_by`, `activation_starts_at`, `activation_ends_at` | Lượt phải bắt đầu trước `activate_by`; khi đã bắt đầu được chạy đủ duration |

Các timestamp thương mại lưu UTC. Quy tắc theo ngày như hạn nhận hồ sơ được
diễn giải theo `Asia/Ho_Chi_Minh`. Tin chỉ public khi thỏa đồng thời status,
policy/moderation hold, campaign, hạn nhận hồ sơ và hạn hiển thị.

`deadline` được giữ trong compatibility window và ánh xạ thành
`application_deadline`; không đổi tên hoặc xóa cột trong release expand.

### 2.2. Public cycle của tin

- Lần duyệt đầu tạo anchor bất biến của public cycle.
- Sửa, duyệt lại, đóng và mở lại không đổi anchor, không reset recency và không
  tạo refresh miễn phí.
- Tin cơ bản tự chạy 30 ngày từ lần duyệt đầu; NTD không chọn hoặc chỉnh
  `visibility_ends_at` trong form tạo/sửa để tránh nhầm với hạn nhận hồ sơ.
- Gia hạn visibility chỉ do activation dịch vụ hoặc nghiệp vụ quản trị thực hiện,
  không vượt anchor + 90 ngày,
  campaign end hoặc hạn nhận hồ sơ đã được NTD xác nhận.
- Tin hết hạn bị loại khỏi mọi candidate surface nhưng giữ job, application và
  audit. Public cycle mới sau khi cycle cũ kết thúc là nghiệp vụ riêng của lượt
  đăng tin, không được giả lập bằng `close -> reopen`.
- NTD tự đóng hoặc sửa làm tin tạm ẩn không pause dịch vụ trả phí. Hệ thống cảnh
  báo trước thao tác. Gián đoạn do nền tảng được bù bằng entitlement có audit.

### 2.3. Catalogue, entitlement và activation

`ServicePackage` là danh tính marketing. Mọi quyền lợi bán được phải đi qua:

```text
ServicePackage
  -> immutable ServicePackageVersion
  -> ServicePackageVersionItem
  -> ServiceEntitlementUnit
  -> JobServiceActivation
```

- Package version đã publish là bất biến và chỉ được archive.
- Add-on là package/version có một capability, không có ledger riêng.
- Một entitlement unit chỉ được consume một lần và gắn với một job.
- Package có số lượng N tạo N unit độc lập.
- `activate_by` mặc định 90 ngày nhưng cấu hình theo version.
- Activation ngày cuối vẫn chạy đủ duration nếu job đủ điều kiện.
- Capability theo lượt không khai báo duration riêng sẽ kế thừa thời hạn của
  activation. Với add-on chỉ có lượt, activation kéo dài đến cuối public cycle
  hiện tại của tin và không tự gia hạn vòng đời tin.
- Preview không giữ chỗ; confirm luôn revalidate trong transaction, khóa unit và
  job, đồng thời dùng idempotency key.
- Capability theo thời gian là độc quyền theo `(job, capability, time window)`:
  một gói có bất kỳ item nào chồng với activation đang chạy sẽ bị chặn toàn bộ,
  không consume unit. `job_refresh` và `job_alert` là quyền lợi theo lượt nên
  được phép cộng dồn qua nhiều activation.
- Không hard-delete catalogue/version/unit/activation đã được tham chiếu.

### 2.4. Capability registry

Capability code do codebase đăng ký và có handler được whitelist. Admin chỉ cấu
hình capability có sẵn, không nhập code thực thi tùy ý.

| Code | Scope | Loại | Giai đoạn đầu |
| --- | --- | --- | --- |
| `sponsored_placement` | job | duration | Có |
| `card_tone` | job | duration | Có; tone thuộc allowlist |
| `job_refresh` | job | quantity | Có |
| `job_alert` | job | quantity | Có |
| `urgent_label` | job | duration | Có |
| `saved_remarketing` | job | duration | Có; lane riêng + consent |
| `visibility_extension` | job | duration | Có; chỉ lifecycle handler |
| `placement.banner` | placement | duration | Epic riêng |
| `company.career_page` | company | duration | Epic riêng |

Không phải capability thương mại:

- title tối đa 255 ký tự;
- ba lý do nên ứng tuyển;
- HOT do hệ thống tính;
- huy hiệu phản hồi nhanh do SLA thực tế;
- nhãn RED.

### 2.5. Presentation và ranking

Candidate clients chỉ đọc projection ổn định từ backend:

```text
presentation = {
  sponsored,
  card_tone,
  labels,
  display_reason,
  active_until,
  placement
}
```

Frontend không suy presentation từ package slug, package name hoặc các cờ
legacy. Relevance là điều kiện đầu vào của sponsored distribution; thanh toán
không biến một tin không phù hợp thành kết quả phù hợp. Tất cả tin trả phí có
disclosure bằng chữ “Tài trợ”, không truyền nghĩa chỉ bằng màu.

Với dữ liệu legacy đã có overlap, backend chọn hiệu ứng theo capability thay vì
tên/giá gói: `best_jobs_eligible > search_sponsored > organic`, sau đó
`green_strong > green > orange > neutral`, rồi ưu tiên activation có thời điểm
kết thúc muộn hơn và ID mới hơn để tie-break ổn định. Presentation và attribution
metrics phải dùng cùng thứ tự này. Chính sách này chỉ để đọc dữ liệu legacy;
activation mới vẫn bị overlap guard chặn.

### 2.6. Ownership và dependency

- `apps.jobs`: public lifecycle, availability, job content và candidate query.
- `apps.services`: catalogue/version, entitlement, activation, grant và audit.
- Cross-app write đi qua hàm được export từ `services/__init__.py`; không
  deep-import nội bộ, tuân ADR-0010.
- Frontend đặt projection và presentation UI tái sử dụng ở `entities/job`;
  workflow kích hoạt ở feature riêng; page chỉ compose.

## 3. Permission và audit contract

Permission đích:

| Permission | Ý nghĩa |
| --- | --- |
| `service_catalog.view` | Xem catalogue/version |
| `service_catalog.draft_manage` | Tạo và sửa draft |
| `service_catalog.publish` | Publish/archive version |
| `service_entitlement.view` | Xem kho lượt và activation |
| `service_entitlement.grant` | Cấp/gia hạn ngoại lệ |
| `service_entitlement.revoke` | Thu hồi lượt chưa dùng |
| `service_audit.view` | Xem audit nghiệp vụ |

`service_catalog.manage` hiện tại được giữ trong compatibility window và map cho
manager; không tự động cấp các quyền grant/revoke mới chỉ vì có quyền cũ.

Audit event bắt buộc:

- `package_version.published`, `package_version.archived`;
- `entitlement.granted`, `entitlement.extended`, `entitlement.revoked`,
  `entitlement.expired`, `entitlement.compensated`;
- `activation.started`, `activation.ended`, `activation.terminated`;
- `job.visibility_extended`, `job.refresh_consumed`.

Event lưu actor, company, subject, source version/unit/activation, before/after
an toàn, reason code, idempotency key hash và timestamp; không lưu dữ liệu thẻ
thanh toán hoặc PII không cần thiết.

## 4. Feature flags và rollback

| Setting | Giá trị ban đầu | Vai trò |
| --- | --- | --- |
| `JOB_LIFECYCLE_V2_MODE` | `legacy` | `legacy`, `shadow`, `enforce` |
| `JOB_PRESENTATION_V2_ENABLED` | `false` | Bật projection mới |
| `SERVICE_CATALOG_V2_ENABLED` | `false` | Bật versioned catalogue |
| `SERVICE_ACTIVATION_ENABLED` | `false` | Cho NTD consume unit |
| `SPONSORED_JOB_DISTRIBUTION_ENABLED` | `false` | Kill switch phân tầng trả phí |
| `JOB_PROMOTION_REFRESH_ENABLED` | `false` | Kill switch refresh |
| `JOB_PROMOTION_ALERT_ENABLED` | `false` | Kill switch Job Alert |
| `SAVED_JOB_REMARKETING_ENABLED` | `false` | Kill switch remarketing |

Rollback application bằng flag; không reverse-delete schema hoặc ledger. Các
worker và API phải đọc cùng nguồn setting. Production fail startup nếu giá trị
enum không hợp lệ.

## 5. Hệ quả

Ưu điểm: hợp đồng thương mại bất biến, lifecycle kiểm chứng được, ranking minh
bạch, rollback không mất dữ liệu và có đường mở rộng payment/banner/brand page.

Chi phí: thêm schema, migration nhiều release, admin workflow và observability.
Trong compatibility window phải duy trì dual-read/shadow compare; không được
dual-write không có reconciliation.

## 6. Tiến độ triển khai đối chiếu ngày 13/08/2026

| Giai đoạn | Trạng thái code | Ghi chú rollout |
| --- | --- | --- |
| 0. Contract/architecture | Hoàn tất | ADR, API, policy, runbook đã có |
| 1. Lifecycle V2 | Hoàn tất sau flag | Không có input “Thời gian hiển thị” trên form |
| 2. Presentation | Hoàn tất sau flag | Projection dùng chung candidate surfaces |
| 3. Commercial core | Hoàn tất | Version/unit/activation/audit bất biến |
| 4. Admin pilot | Hoàn tất | Draft/publish/grant/revoke/audit |
| 5. Employer activation | Hoàn tất | Preview và gia hạn atomic |
| 6. Sponsored distribution | Hoàn tất code | Có refresh, metrics và Job Alert outbox |
| 7. Saved remarketing | Hoàn tất code | Consent, 1/ngày, 3/7 ngày, retention 90 ngày |
| 8. Hardening/cutover | Đang thực hiện | Cần Docker PostgreSQL, load/query-budget và staging rehearsal |

Catalogue release đầu chỉ còn: Ưu tiên, Nổi bật, Tăng tốc, Nhãn GẤP, Làm mới
tin và Remarketing tin đã lưu. TOP MAX/TOP ECO, combo mẫu, AI credits, banner và
branded page cũ không thuộc release lõi; migration xóa bản ghi chưa tham chiếu và
chỉ vô hiệu hóa bản ghi đã có lịch sử để bảo toàn audit.
