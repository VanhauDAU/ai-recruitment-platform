# Giai đoạn 1 — Kiến trúc đích thực tế

## 1. Nguyên tắc

- Giữ modular monolith, Django/DRF và FSD hiện tại.
- Giữ URL, payload, token/cookie/storage key và role contract nếu chưa có kế
  hoạch migration được test.
- Kiến trúc đích là siết boundary và transaction của code đang có, không thêm
  repository/use-case/interface máy móc.
- App/feature nhỏ được phép không có đủ mọi folder nếu không có workflow thật.
- Auth, DB invariant, autosave và snapshot chỉ triển khai sau proposal riêng.

## 2. Backend target

```text
api (HTTP parse/auth/permission/serialization)
  ├── command service (write + transaction + on_commit side effect)
  └── selector (read-only query + prefetch/annotate/pagination)
          ↓
       models / persistence

tasks → public idempotent service
```

### Contract bắt buộc

1. API không chứa transaction/workflow/query orchestration.
2. Service nhận primitive/ID/domain object, không nhận DRF Request/Response.
3. Selector không ghi DB; shell record được tạo trong registration/service hoặc
   data migration.
4. Cross-app chỉ được import model hoặc public facade:

```python
from apps.cvs.services import create_application_snapshot
```

   Cấm import `apps.<other>.api.*`, private `_function` hoặc
   `apps.<other>.services.<module>` từ production code.
5. Task giữ tên/queue hiện tại nhưng chỉ load input, gọi service idempotent, ghi
   durable success/failure và để retry policy quyết định exception.

### State-transition template

```text
validate input → atomic → select_for_update(row)
→ validate current transition → mutate
→ append history/outbox → transaction.on_commit(side effect)
```

Áp dụng trước cho phone OTP, job moderation/posting, application status và
template/recruitment-need version creation.

### CV/template dependency

- `cvs` sở hữu canonical document, draft/version, asset và lifecycle.
- `cv_templates` sở hữu catalogue, published renderer metadata và template
  snapshot.
- Pure document/schema/renderer contract không được phụ thuộc ORM app theo cả
  hai chiều. Tách contract xuống module thấp hơn chỉ khi đã có characterization
  tests; không di chuyển đồng loạt.

## 3. API target

- OpenAPI là executable contract và phải generate không error:
  - custom JWT security scheme;
  - request/response cho mọi operation;
  - typed filter/query serializer;
  - enum override ổn định;
  - schema regression trong CI.
- Pagination dùng một envelope chuẩn cho list không bounded:

```json
{
  "count": 123,
  "next": "...",
  "previous": null,
  "results": []
}
```

- Frontend entity giữ nguyên envelope. UI cần toàn bộ dữ liệu phải dùng endpoint
  aggregate/status riêng hoặc fetch page có giới hạn rõ, không âm thầm lấy page 1.
- Error target là `{code, detail, fields}` nhưng chỉ migrate theo compatibility
  window; frontend mapper phải hỗ trợ cả shape cũ và mới cho tới khi contract test
  xác nhận không còn consumer cũ.
- CSV/blob/private endpoints vẫn có schema content type và cache policy rõ.

## 4. Database target

- Invariant quan trọng được enforce ở DB sau data audit: snapshot provenance,
  owner-kind, range/order, soft-delete timestamp.
- Không sửa/squash migration cũ. Mọi constraint mới theo thứ tự:

```text
audit dữ liệu → backfill/repair → additive constraint → verify → cleanup sau
```

- Index chỉ thay đổi dựa trên PostgreSQL catalog/EXPLAIN production; drop index
  dùng migration an toàn, không suy ra chỉ từ model source.
- Cache invalidation và task enqueue chạy bằng `transaction.on_commit()`.
- List/read-model quan trọng có query-budget test để query count không tăng theo
  số record.

## 5. Authentication và authorization target

Target cần một khái niệm session assurance duy nhất:

```text
primary authentication (password/OAuth)
  → optional/required MFA challenge
  → AuthSession { portal, auth_assurance, mfa_completed_at, reauthenticated_at }
  → endpoint policy { role, object scope, required assurance, max age }
```

- OAuth không được mặc định coi là đã qua account MFA.
- Candidate PII, CV snapshot, export và legal document dùng authorization matrix
  có step-up/assurance rõ.
- Django Admin production phải dùng cùng account-access policy và MFA/SSO/network
  boundary, hoặc bị tắt.
- Email verification token bind user + normalized email + generation và consume
  atomic; đổi email/gửi token mới vô hiệu token cũ.
- Frontend có một `auth-expired` coordinator theo portal: terminal 401/403 mới
  clear user/query cache và redirect với safe return URL; network/5xx không giả
  thành logout. Refresh single-flight phải keyed theo portal.

Các điểm trên là thay đổi high-risk; cần proposal, rollout và regression riêng.

## 6. Frontend target

```text
app       router, provider, auth-expiry coordinator, layouts
pages     route params + composition + URL state
widgets   workspace/large cross-domain composition
features  user workflow, mutation, optimistic/cache policy
entities  domain DTO/API/query keys/page envelope/domain UI
shared    HTTP/token/error infrastructure + domain-agnostic UI
```

### Portal và navigation

- Mọi employer/admin path đi qua `employerAppPath`, `employerMarketingPath` hoặc
  `adminPath`; không hardcode same-host base path.
- `returnUrl` được validate một lần, truyền xuyên login/onboarding và chỉ consume
  sau gate cuối.
- Protected route giữ `AuthGuard → RoleGuard`; backend permission luôn là nguồn
  sự thật. Wrong-role UX chỉ thay đổi sau quyết định sản phẩm.

### Server state

- Mỗi entity export query-key factory canonical. Cùng endpoint không có hai key.
- List state luôn phân biệt loading, empty, error/retry và partial page.
- Manual request có abort/signal hoặc request identity; ưu tiên TanStack Query
  cho status/page filter.
- Page lớn được tách controller/workflow theo owner, không chia presentation nhỏ
  nếu không giảm dependency/trạng thái.

### Performance

- Giữ route/layout/editor lazy loading hiện tại.
- Bundle gate tiếp tục initial JS/CSS và thêm report/budget theo lazy chunk trước
  khi quyết định split vendor/component.
- CSS 95% budget là cảnh báo thay đổi, không phải lý do mass cleanup.

## 7. CV Builder target

### Autosave state machine

```text
local edit → dirty revision
→ debounce
→ one in-flight CAS autosave
→ drain every queued revision
→ explicit operation barrier
→ save/publish/switch/sample
```

- Mọi explicit server action dùng cùng drain barrier, mutex và lock signature.
- Save-version có idempotency key/commit token hoặc CAS làm request lặp trả cùng
  result; double click không tạo version thứ hai.
- Offline/error/conflict vẫn hiển thị như hiện tại; không tự merge tài liệu.

### Snapshot và provenance

- Application snapshot content và pointer đều append-only.
- Admin không được sửa provenance; DB/model/service kiểm candidate/CV/version-kind.
- Hard delete không làm mất source public ID/hash cần audit. Retention/archive và
  restore phải có product/legal policy trước migration.
- Restore historical version tạo draft/version mới; không mutate version cũ.

### Import/export boundary

- AI import yêu cầu consent/transparency và audit provider processing; hỗ trợ
  local-only khi policy yêu cầu.
- Parser chạy với ZIP/page/pixel/time/memory budget, private quarantine và malware
  scanning phù hợp.
- Bearer/private CV response đặt `Cache-Control: private, no-store` và proxy log
  redaction.

## 8. Enforcement target

- Backend: import-linter + script gác cross-app public facade, OpenAPI validation,
  query budgets và concurrency tests.
- Frontend: dependency-cruiser thêm no-cycle, portal-page isolation và rule
  cross-entity phù hợp; giữ API/feature boundary scripts.
- CI: path-aware nhưng final required gate luôn xuất hiện; không chạy duplicate
  push/PR; job cũ bị cancel; build và bundle budget cùng một heavy job.

## 9. Lộ trình incremental

| Wave | Phạm vi | Điều kiện hoàn thành |
| --- | --- | --- |
| 1 | CI feedback, OpenAPI auth/schema, employer path | Không đổi runtime contract; focused tests + schema green |
| 2 | Pagination/error/query keys/N+1/cache on-commit | Migrate từng domain; query/API regression |
| 3 | Job/application/OTP concurrency | Proposal transaction + TransactionTestCase trước code |
| 4 | Page/service/task extraction và cross-app facade | Không đổi route/payload/task name; boundary gate mới |
| 5 | Auth assurance, autosave/idempotency, snapshot provenance | Proposal được duyệt, rollout/migration/rollback rõ |
| 6 | DB constraints/index, AI/upload hardening | Data audit + production catalog/legal policy |

Không coi target hoàn tất chỉ vì folder đúng; hành vi, contract và enforcement
test mới là tiêu chí nghiệm thu.

## 10. Tiến độ hiện thực hóa sau Giai đoạn 4

| Target | Đã triển khai | Enforcement | Phần còn lại |
| --- | --- | --- | --- |
| Cache side effect sau commit | `services` và `sitecontent` dùng `transaction.on_commit(cache.delete)` | Save/delete/rollback regression | Audit các cache signal mới khi thêm domain |
| Read model có query phẳng | Blog sliced prefetch; service category `Count`; site link-group batch theo source | Budget lần lượt 3, 1 và tối đa 4 query | Mở rộng budget cho các list tải cao khác |
| Command initial recruitment need | View chỉ validate/map lỗi; service khóa parent recruiter, re-check và create; selector đọc record đầu tiên | Sequential + 2-thread PostgreSQL race, GET/list budget 2 | General CRUD vẫn dùng serializer persistence; template `Max+1` chưa xử lý |
| State transition canonical | Job moderation/posting và application status/mark-viewed re-read row có lock trước khi kiểm state | Stale-instance tests và race tests hai worker | Job PATCH nested data, draft delete và serializer command DTO |

Các lát cắt trên giữ nguyên URL, payload, permission, state graph và schema DB.
Chưa triển khai các target auth/authorization/CV/production-data cần proposal.
