# Hợp đồng API — Job lifecycle và Employer Services V2

**Trạng thái:** Runtime contract; compatibility fields vẫn còn
**ADR:** [ADR-0012](../02-tong-quan/adr-0012-job-services-architecture.md)

Tài liệu mô tả shape và semantics đang chạy sau feature flag. Khi thay đổi phải
cập nhật OpenAPI sinh từ code và contract tests; không sửa baseline OpenAPI thủ
công.

## 1. Quy ước chung

- Datetime là ISO 8601 UTC; date là `YYYY-MM-DD` theo Asia/Ho_Chi_Minh.
- Resource do public ID nhận diện, không lộ database ID.
- Error dùng `{code, detail, fields?, blockers?}`.
- Confirm activation bắt buộc header `Idempotency-Key` không rỗng, tối đa 100 ký
  tự theo data model.
- Preview chỉ tư vấn và không reserve unit; confirm luôn revalidate dưới lock.
- Các API `mine/*`, preview, confirm và action dịch vụ chỉ cho recruiter thao
  tác trên tin có `posted_by=request.user`. Cùng công ty không tạo quyền xem hoặc
  sử dụng dịch vụ của tin do recruiter khác sở hữu.
- API cũ tiếp tục hoạt động trong compatibility window.

## 2. Job lifecycle

### Employer job projection

API ghi/đọc job bổ sung:

```json
{
  "application_deadline": "2026-10-15",
  "requested_visibility_days": 30,
  "visibility_starts_at": "2026-08-12T03:00:00Z",
  "visibility_ends_at": "2026-09-11T03:00:00Z",
  "max_visibility_ends_at": "2026-11-10T03:00:00Z",
  "is_visibility_expired": false
}
```

- Trong expand release, `deadline` vẫn trả cùng giá trị với
  `application_deadline` và được đánh dấu deprecated.
- Employer chỉ gửi `application_deadline`; toàn bộ thời gian visibility là
  read-only và do lifecycle/service activation quản lý.
- Candidate API không cần trả internal maximum.

### `GET /api/jobs/mine/posting-context/`

Bổ sung:

```json
{
  "lifecycle_policy": {
    "mode": "legacy|shadow|enforce",
    "default_visibility_days": 30,
    "max_visibility_days": 90,
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "services": {
    "catalog_v2_enabled": false,
    "activation_enabled": false,
    "refresh_enabled": false,
    "alert_enabled": false,
    "metrics_enabled": false
  }
}
```

Không xóa ba field deadline policy cũ cho tới contract release riêng.

## 3. Candidate presentation

Mọi list/detail/preview serializer dùng cùng shape:

```json
{
  "presentation": {
    "sponsored": true,
    "card_tone": "amber|green|default",
    "labels": [
      {"code": "urgent", "text": "GẤP", "tone": "warning", "earned": false}
    ],
    "display_reason": {
      "code": "sponsored_relevant",
      "text": "Tài trợ · Phù hợp với tìm kiếm của bạn"
    },
    "active_until": "2026-08-26T03:00:00Z",
    "placement": "search_sponsored"
  }
}
```

Default an toàn khi presentation V2 tắt:

```json
{
  "sponsored": false,
  "card_tone": "default",
  "labels": [],
  "display_reason": null,
  "active_until": null,
  "placement": "organic"
}
```

`presentation` không chứa package name, price hoặc priority weight nội bộ.

## 4. Catalogue V2

### `GET /api/services/packages/`

Giữ fields marketing hiện tại và bổ sung `current_version`:

```json
{
  "slug": "featured",
  "name_vi": "Nổi bật",
  "price": "799000",
  "currency": "VND",
  "current_version": {
    "public_id": "spv_...",
    "version": 1,
    "activate_within_days": 90,
    "published_at": "2026-08-12T03:00:00Z",
    "items": [
      {
        "capability": "job.sponsored_distribution",
        "scope": "job",
        "quantity": 1,
        "run_duration_days": 14,
        "config": {}
      }
    ]
  }
}
```

Version draft và internal handler config không được trả public.

## 5. Employer inventory

### `GET /api/services/mine/inventory/`

Runtime trả một mảng các lượt được cấp cho công ty của recruiter, sắp theo hạn
kích hoạt. Endpoint này chưa phân trang và chưa nhận filter.

```json
[
  {
    "public_id": "seu_...",
    "package_name": "Nổi bật",
    "version_number": 1,
    "status": "available",
    "is_activatable": true,
    "activate_by": "2026-11-10T03:00:00Z",
    "items": [
      {"capability": "sponsored_placement", "name": "Vị trí tài trợ"}
    ]
  }
]
```

Status: `available`, `consumed`, `expired`, `revoked`. Expiry được xác định ngay
trong selector/service theo clock, không phụ thuộc background task để chặn
consume. Vì job là owner-only, có unit cùng công ty không cho recruiter kích
hoạt nó trên tin do đồng nghiệp sở hữu.

## 6. Employer activation và quản lý dịch vụ

### `POST /api/services/activations/preview/`

Request:

```json
{
  "unit_public_id": "seu_...",
  "job_public_id": "jb_..."
}
```

Response hợp lệ nhưng cần gia hạn:

```json
{
  "can_activate": true,
  "blockers": [],
  "starts_at": "2026-08-12T03:00:00Z",
  "ends_at": "2026-08-26T03:00:00Z",
  "current_application_deadline": "2026-08-22",
  "current_visibility_ends_at": "2026-08-22T03:00:00Z",
  "required_application_deadline": "2026-08-26",
  "deadline_extension_required": true,
  "extension_required": true,
  "required_visibility_days": 44,
  "visibility_extension_days": 14,
  "items": [
    {
      "capability": "sponsored_placement",
      "name": "Vị trí tài trợ",
      "quantity": 1,
      "duration_days": 14
    }
  ]
}
```

Response bị chặn:

```json
{
  "can_activate": false,
  "blockers": ["Quyền lợi “Vị trí tài trợ” đang chạy trong gói “Tăng tốc” đến 10/09/2026 15:56."],
  "conflicts": [
    {
      "capability": "sponsored_placement",
      "name": "Vị trí tài trợ",
      "active_activation_public_id": "jsa_...",
      "active_package_name": "Tăng tốc",
      "active_until": "2026-09-10T08:56:00Z"
    }
  ]
}
```

Preview trả message nghiệp vụ hiện hành trong `blockers`; client không được coi
chuỗi này là mã ổn định. `extension_required=true` là xung đột cần quyết định
tường minh: client phải mặc định giữ nguyên hạn và chỉ gửi xác nhận gia hạn từ
một hành động có nhãn rõ ràng. Preview không giữ chỗ và không cấp quyền vượt
owner.

`conflicts` luôn có trong response và rỗng khi không có overlap. Các capability
theo thời gian (`sponsored_placement`, `card_tone`, `urgent_label`,
`saved_remarketing`, `visibility_extension`) không được chồng cửa sổ trên cùng
một tin. Nếu một item xung đột, toàn bộ gói bị chặn và unit giữ nguyên
`available`. `job_refresh` và `job_alert` là số lượt cộng dồn nên không tham gia
overlap guard. Confirm tính lại conflict sau khi khóa job; kết quả preview không
được dùng để bỏ qua kiểm tra này.

### `POST /api/services/activations/`

Headers: `Idempotency-Key`, request auth. Body:

```json
{
  "unit_public_id": "seu_...",
  "job_public_id": "jb_...",
  "confirm_extension": true
}
```

Response `201` lần đầu, cùng key và cùng payload trả lại response canonical; cùng
key nhưng unit/job khác bị từ chối. `confirm_extension=true` là bắt buộc khi
preview yêu cầu tăng hạn nhận hồ sơ hoặc thời gian công khai. Bỏ trống hoặc gửi
`false` không thay đổi tin và không consume lượt dịch vụ.

```json
{
  "public_id": "jsa_...",
  "status": "active",
  "is_effective": true,
  "job_public_id": "jb_...",
  "job_title": "Backend Engineer",
  "campaign_public_id": "rc_...",
  "package_name": "Nổi bật",
  "starts_at": "2026-08-12T03:00:00Z",
  "ends_at": "2026-08-26T03:00:00Z",
  "items": [],
  "metrics": {
    "available": false,
    "impressions": 0,
    "views": 0,
    "saves": 0,
    "applies": 0
  }
}
```

Server khóa unit và job theo thứ tự cố định, revalidate state, rồi gia hạn,
consume, tạo activation và audit trong một transaction. Không phát event ra
broker trước commit; dùng `transaction.on_commit` hoặc outbox khi cần.

### `GET /api/services/mine/activations/`

- Filter tùy chọn: `job_public_id`, `campaign_public_id`.
- Trả mảng không phân trang, chỉ gồm activation có `status=active` và đang hiệu
  lực theo `starts_at <= now < ends_at`.
- Luôn lọc `job__posted_by=request.user`; activation của recruiter khác cùng
  công ty không xuất hiện.

### `GET /api/services/mine/activation-history/`

- Filter tùy chọn: `status`, `job_public_id`, `campaign_public_id`, `ordering`;
  dùng phân trang chuẩn với `page`, `page_size`.
- Trả cả `active`, `expired`, `terminated`. Field `is_effective` là kết quả theo
  clock tại thời điểm đọc; vì vậy bản ghi còn `status=active` nhưng đã qua
  `ends_at` được trình bày là đã kết thúc, không chờ worker đổi trạng thái.
- Mỗi activation trả thông tin tin/chiến dịch, snapshot quyền lợi và số lượng
  còn lại, thời gian chạy, lý do dừng và metrics.

Metrics `impressions`, `views`, `saves`, `applies` được gắn với activation tài
trợ tại thời điểm event. Đây là số liệu quy thuộc (attribution), không phải mức
tăng thuần so với organic. `metrics.available=false` nghĩa là chưa có bản ghi đo
lường; UI phải hiển thị `—`, không biến “chưa có dữ liệu” thành số 0.

### Action trên activation

- `POST /api/services/activations/{public_id}/refresh/`;
- `POST /api/services/activations/{public_id}/job-alerts/preview/`;
- `POST /api/services/activations/{public_id}/job-alerts/`.

Refresh và confirm Job Alert cần `Idempotency-Key`; mọi action đều recheck
activation đang hiệu lực, feature flag và quyền owner của tin.

### Giao diện employer

- `/tuyendung/app/services`: dashboard “Dịch vụ của tôi”, gồm `Đang chạy`,
  `Chưa sử dụng`, `Lịch sử` và các thẻ tổng hợp có chú thích attribution.
- Chi tiết tin có tab `Dịch vụ & hiệu quả`; workspace chiến dịch có tab `Dịch
  vụ`. Hai tab dùng filter theo public ID tương ứng và chỉ cho kích hoạt tại tin
  đang công khai.
- Tạm dừng chiến dịch hoặc làm tin tạm ẩn không dừng clock dịch vụ, không hoàn
  lượt và không tự gia hạn thời lượng. UI phải cảnh báo điều này trước thao tác.

## 7. Admin contracts

Namespace runtime:

- `GET|POST /api/services/admin/package-versions/`;
- `GET|PUT|DELETE /api/services/admin/package-versions/{pk}/` cho draft;
- `POST /api/services/admin/package-versions/{pk}/publish/`;
- `GET|POST /api/services/admin/entitlements/`;
- `POST /api/services/admin/entitlements/{public_id}/revoke/`;
- `GET /api/services/admin/audit/`;
- `GET /api/services/admin/activations/`;
- `GET /api/services/admin/activations/summary/`;
- `POST /api/services/admin/activations/{public_id}/terminate/`.

Published version từ chối mọi mutation theo validation contract. Revoke chỉ áp
dụng unit chưa consume; activation đã chạy dùng terminate/compensation workflow.

Danh sách activation phân trang, nhận `company_public_id`, `status`,
`job_public_id`, `campaign_public_id`, `ordering`. Summary nhận cùng scope trừ
`status` và trả:

```json
{
  "activation_counts": {
    "total": 12,
    "active": 4,
    "expired": 6,
    "terminated": 2
  },
  "active_total": 3,
  "metrics": {
    "available": true,
    "impressions": 25000,
    "views": 1800,
    "saves": 240,
    "applies": 75
  },
  "unit_counts": {
    "available": 8,
    "consumed": 12,
    "expired": 3,
    "revoked": 1
  }
}
```

`activation_counts.active` là trạng thái lưu trong DB; `active_total` chỉ đếm
activation còn hiệu lực theo clock. Terminate yêu cầu `reason` không rỗng, chỉ
áp dụng activation đang hiệu lực, ghi `terminated_at`, lý do và audit event.
Terminate không hoàn unit hoặc hoàn thời gian; nếu cần bù, admin cấp unit mới
với source `compensation` để giữ audit rõ ràng.

Tương tự, `unit_counts.available` là số theo trạng thái ledger, không thay cho
kiểm tra `activate_by`; endpoint inventory dùng `is_activatable` để trình bày
khả năng dùng tại thời điểm đọc. Admin activation APIs có phạm vi toàn hệ thống
theo permission, không bị owner-scope như employer APIs.

Admin UI đặt danh sách/thống kê/lọc/dừng tại tab `Dịch vụ đang chạy`, còn cấp,
thu hồi và audit tại `Kho lượt & lịch sử`. Read cần
`service_entitlement.view`; dừng cần `service_entitlement.manage`.

## 8. Compatibility và contract tests

- Field cũ chỉ bị xóa sau telemetry cho thấy không còn consumer.
- Serializer exact-field tests được cập nhật có chủ đích.
- OpenAPI validate trong CI; examples trên trở thành schema/example tests.
- Candidate presentation default phải ổn định khi services DB không có dữ liệu.
- Endpoint list giữ query count phẳng theo số row.

## 9. Job Alert và remarketing đã triển khai

- `POST /api/services/activations/{activation}/job-alerts/preview/` kiểm tra còn
  lượt và có ít nhất một Job Alert phù hợp.
- `POST /api/services/activations/{activation}/job-alerts/` consume idempotent
  một lượt, sau đó outbox chọn/gửi theo batch. Trước SMTP luôn kiểm tra lại trạng
  thái tin, email, auth revision, opt-out và Job Alert nguồn.
- `GET /api/jobs/remarketing/saved/` chỉ trả lane khi user là candidate đăng
  nhập, feature flag bật và signed consent cookie cho phép marketing.
- `POST /api/jobs/remarketing/saved/impressions/` ghi frequency cap; request gồm
  `job_public_id`, `activation_public_id`. Server revalidate saved state,
  application, availability và activation trong transaction.
- Remarketing chỉ dùng `SavedJob`; không dùng aggregate view count và không tạo
  lịch sử viewed-job ngầm.
