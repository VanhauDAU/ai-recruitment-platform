# ADR-0012: Vòng đời tin và dịch vụ gia tăng tuyển dụng

**Trạng thái:** Đề xuất để review  
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
- NTD chọn thời lượng 1–90 ngày; UI đề xuất 30 ngày.
- Gia hạn chỉ được tăng `visibility_ends_at`, không vượt anchor + 90 ngày,
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
- Preview không giữ chỗ; confirm luôn revalidate trong transaction, khóa unit và
  job, đồng thời dùng idempotency key.
- Không hard-delete catalogue/version/unit/activation đã được tham chiếu.

### 2.4. Capability registry

Capability code do codebase đăng ký và có handler được whitelist. Admin chỉ cấu
hình capability có sẵn, không nhập code thực thi tùy ý.

| Code | Scope | Loại | Giai đoạn đầu |
| --- | --- | --- | --- |
| `job.sponsored_distribution` | job | duration | Có |
| `job.card_tone_amber` | job | duration | Có |
| `job.card_tone_green` | job | duration | Có |
| `job.best_jobs_eligible` | job | duration | Có |
| `job.refresh` | job | quantity | Có |
| `job.alert_delivery` | job | quantity | Có |
| `job.label_urgent` | job | duration | Có |
| `job.remarketing_saved` | job | duration | Sau distribution |
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
| `SPONSORED_JOB_DISTRIBUTION_ENABLED` | `false` | Kill switch slot tài trợ |
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

## 6. Điều kiện chuyển sang Giai đoạn 1

- ADR, API contract, promotion policy và runbook được review.
- Mọi capability/permission/event/flag có owner rõ ràng.
- Baseline legacy được xuất trên môi trường có DB bằng truy vấn trong runbook.
- Không còn quyết định sản phẩm chưa khóa cho lifecycle expand migration.
