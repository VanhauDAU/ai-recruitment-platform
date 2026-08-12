# Hợp đồng API dự kiến — Job lifecycle và Employer Services V2

**Trạng thái:** Design-first, chưa phải API runtime  
**ADR:** [ADR-0012](../02-tong-quan/adr-0012-job-services-architecture.md)

Tài liệu khóa shape và semantics trước khi tạo model. Khi triển khai phải cập
nhật OpenAPI sinh từ code và contract tests; không sửa baseline OpenAPI thủ công.

## 1. Quy ước chung

- Datetime là ISO 8601 UTC; date là `YYYY-MM-DD` theo Asia/Ho_Chi_Minh.
- Resource do public ID nhận diện, không lộ database ID.
- Error dùng `{code, detail, fields?, blockers?}`.
- Confirm activation bắt buộc header `Idempotency-Key` 16–128 ký tự.
- Preview chỉ tư vấn và không reserve unit; confirm luôn revalidate dưới lock.
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
    "activation_enabled": false
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

Filters: `status`, `capability`, `job`, cursor pagination.

```json
{
  "results": [
    {
      "public_id": "seu_...",
      "package": {"slug": "featured", "name": "Nổi bật"},
      "package_version": "spv_...",
      "capabilities": ["job.sponsored_distribution", "job.card_tone_green"],
      "status": "available",
      "activate_by": "2026-11-10T03:00:00Z",
      "granted_at": "2026-08-12T03:00:00Z",
      "source": "manual_grant"
    }
  ],
  "next": null
}
```

Status: `available`, `consumed`, `expired`, `revoked`. Expiry được xác định ngay
trong selector theo clock, không phụ thuộc background task để chặn consume.

## 6. Activation preview và confirm

### `POST /api/services/activations/preview/`

Request:

```json
{
  "entitlement_unit": "seu_...",
  "job": "jb_...",
  "proposed_application_deadline": "2026-09-01"
}
```

Response hợp lệ nhưng cần gia hạn:

```json
{
  "eligible": true,
  "preview_token": "opaque-short-lived-token",
  "preview_expires_at": "2026-08-12T03:05:00Z",
  "job": "jb_...",
  "activation_starts_at": "2026-08-12T03:00:00Z",
  "activation_ends_at": "2026-08-26T03:00:00Z",
  "current_visibility_ends_at": "2026-08-22T03:00:00Z",
  "required_visibility_ends_at": "2026-08-26T03:00:00Z",
  "required_application_deadline": "2026-08-26",
  "changes": ["extend_visibility", "extend_application_deadline"],
  "warnings": ["Dịch vụ vẫn tiếp tục nếu bạn tự đóng hoặc sửa tin."]
}
```

Response bị chặn:

```json
{
  "eligible": false,
  "preview_token": null,
  "blockers": [
    {"code": "VISIBILITY_MAX_EXCEEDED", "detail": "Tin không thể hiển thị đủ 14 ngày."}
  ]
}
```

Blocker codes tối thiểu:

- `UNIT_NOT_AVAILABLE`, `UNIT_EXPIRED`, `UNIT_COMPANY_MISMATCH`;
- `JOB_NOT_ACTIVE`, `JOB_COMPANY_MISMATCH`, `JOB_HELD`;
- `APPLICATION_DEADLINE_TOO_SHORT`, `VISIBILITY_MAX_EXCEEDED`;
- `CAMPAIGN_END_EXCEEDED`, `CAPABILITY_NOT_SUPPORTED`.

### `POST /api/services/activations/`

Headers: `Idempotency-Key`, request auth. Body:

```json
{
  "preview_token": "opaque-short-lived-token",
  "confirm_application_deadline": "2026-09-01"
}
```

Response `201` lần đầu, cùng key và cùng payload trả lại response canonical; cùng
key khác payload trả `409 IDEMPOTENCY_KEY_REUSED`.

```json
{
  "public_id": "jsa_...",
  "status": "active",
  "job": "jb_...",
  "starts_at": "2026-08-12T03:00:00Z",
  "ends_at": "2026-08-26T03:00:00Z",
  "visibility_ends_at": "2026-08-26T03:00:00Z",
  "application_deadline": "2026-09-01"
}
```

Server khóa unit trước rồi job theo thứ tự cố định, revalidate token và state,
gia hạn + consume + activation + audit trong một transaction. Không phát event
ra broker trước commit; dùng `transaction.on_commit` hoặc outbox khi cần.

## 7. Admin contracts

Namespace dự kiến:

- `GET|POST /api/services/admin/package-versions/`;
- `GET|PATCH /api/services/admin/package-versions/{public_id}/` cho draft;
- `POST /api/services/admin/package-versions/{public_id}/publish/`;
- `POST /api/services/admin/entitlements/grant/`;
- `POST /api/services/admin/entitlements/{public_id}/revoke/`;
- `GET /api/services/admin/audit-events/`.

Published version rejects mutation with `409 VERSION_IMMUTABLE`. Revoke chỉ áp
dụng unit chưa consume; activation đã chạy dùng terminate/compensation workflow.

## 8. Compatibility và contract tests

- Field cũ chỉ bị xóa sau telemetry cho thấy không còn consumer.
- Serializer exact-field tests được cập nhật có chủ đích.
- OpenAPI validate trong CI; examples trên trở thành schema/example tests.
- Candidate presentation default phải ổn định khi services DB không có dữ liệu.
- Endpoint list giữ query count phẳng theo số row.
