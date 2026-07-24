# Giai đoạn 4 — Backend refactor report

> Thực hiện ngày 2026-07-24. Phạm vi là bốn lát cắt có bằng chứng và regression
> rõ; không refactor toàn bộ backend trong một lượt.

## 1. Phạm vi và contract

Đã xử lý:

1. Cache invalidation sau commit cho `services` và `sitecontent`.
2. N+1/query growth ở blog home, service-category count và dynamic link groups.
3. Read/command boundary cùng race initial recruitment need.
4. Stale-state race ở job moderation/posting và application status/auto-view.

Không đổi URL, request/response payload, permission/role, state graph, cache key,
TTL, model, migration hoặc dữ liệu production. Auth, authorization, CV version,
snapshot và storage proposal vẫn được giữ ngoài phạm vi.

## 2. Cache transaction boundary

| Domain | Trước | Sau | Regression |
| --- | --- | --- | --- |
| Public service packages | Signal xóa cache ngay trong `post_save/post_delete` | Đăng ký `cache.delete` bằng `transaction.on_commit` | Cache còn trước commit, mất sau callback; rollback giữ cache |
| Public site settings | Tương tự | Tương tự | Bao phủ save, delete và rollback |

Nếu transaction rollback, cache committed hiện tại không còn bị xóa. Nếu commit,
delete lặp từ nhiều signal vẫn idempotent và giữ nguyên cache key/TTL.

## 3. Read model và query budget

| Read model | Trước | Sau | Contract được khóa |
| --- | ---: | ---: | --- |
| Blog home sections | `N + 2` query với `N` category | 3 query | Featured scope cũ; chỉ active section; tối đa 4 post/section |
| Admin service categories | `1 + N` do `packages.count()` | 1 query bằng `Count('packages')` | Đếm cả package inactive; create/detail giữ `packages_count` |
| Public link groups | `2 + manual + location + category groups` | Tối đa 4 query | Active/manual ordering, dynamic URL/label và limit từng group |

Blog dùng sliced `Prefetch`; Django/PostgreSQL sinh window partition theo
category. Link groups evaluate group một lần, prefetch active manual items một
lần và lấy location/category tối đa một lần cho mỗi source type.

## 4. Recruitment-need command

Luồng onboarding trước đây làm `exists()` rồi `serializer.save()` tại HTTP view.
Hai request đồng thời có thể cùng vượt check vì recruiter là FK và endpoint
general cố ý cho phép nhiều nhu cầu.

Luồng mới:

```text
HTTP validation
→ atomic service
→ select_for_update(RecruiterProfile)
→ authoritative exists check
→ create initial RecruitmentNeed
```

- Early check trong view vẫn được giữ để bảo toàn error precedence/message.
- Domain exception được map về cùng HTTP 400 hiện tại.
- Endpoint general `/recruitment-needs/` vẫn cho phép tạo nhu cầu thứ hai.
- Selector initial need preload `position_category`; GET initial và list đều có
  budget 2 query khi authentication được `force_authenticate`.

## 5. Job và application state

| Workflow | Lock/re-check | Kết quả |
| --- | --- | --- |
| Approve/reject job | `select_for_update(Job)` | Chỉ một review từ `pending`; history tuyến tính |
| Publish job | Lock order `RecruiterProfile → Job` | Quota và trạng thái canonical cùng được kiểm trong transaction |
| Close/reopen/extend job | `select_for_update(Job)` | Instance cũ không thể ghi đè transition đã hoàn tất |
| Update application status | Lock `Application`, rebind serializer | Transition được xét từ DB status mới nhất; timestamp/history chỉ ghi một lần |
| Auto mark viewed | Lock/re-read `Application` | Không reopen terminal status, không tạo duplicate viewed history |

Test hai worker khóa ba race: initial recruitment need, double moderation và hai
terminal application transitions. Stale-instance tests bổ sung cho job actions,
application terminal transition và auto-view.

## 6. Kiểm chứng

| Gate | Kết quả |
| --- | --- |
| Focused integration suite | 80/80 pass, gồm 3 concurrency tests PostgreSQL |
| Query budgets | Blog 3; service category 1; link groups ≤4; recruitment reads 2 |
| Ruff format/check, import-linter, backend layering | Pass; 423 file formatted, 2 import contract giữ nguyên |
| Django check, migration state | Pass; không có system issue mới hoặc migration drift |
| Full backend coverage suite | 372/372 pass; 85,74% coverage; 2 warning migration lịch sử |

Lần chạy suite đầu phát hiện ba class mới cùng dùng `serialized_rollback`, làm
fixture system content type bị deserialize lặp khi chạy chung. Cờ này không cần
trên PostgreSQL và đã được bỏ; cùng 80 test sau đó pass. Đây là test-isolation
fix, không che failure nghiệp vụ.

Full suite tiếp tục phát hiện teardown của application migration test chỉ khôi
phục đến migration `0009`, thấp hơn schema hiện tại `0011`; vì vậy test chạy sau
có thể thiếu cột runtime. Teardown hiện khôi phục toàn bộ leaf của migration
graph; nhóm 13 migration/service test theo đúng thứ tự gây lỗi đã pass trước
khi full suite 372 test pass.

## 7. Rủi ro và debt còn lại

- Employer job PATCH vẫn validate/save nested fields trên serializer instance;
  draft delete còn nằm ở view. Cần command DTO và locked delete riêng.
- Application service vẫn nhận serializer compatibility object; bước sau có thể
  nhận primitive fields/ID sau characterization API.
- `candidate_profile_for_user` và job-preference selector còn `get_or_create`;
  bỏ write khỏi GET cần preflight/backfill, nên không làm khi chưa có migration plan.
- Template version number `Max+1` chưa được serialize; đây là nửa còn lại của
  `CONC-003` và thuộc CV/template scope.
- Company/membership/verification command extraction đụng tenant ownership và
  assurance policy; chưa thay đổi khi chưa có proposal authorization.

Rollback code không cần migration: revert từng commit sẽ khôi phục query/service
cũ. Cache rollback chỉ làm invalidation quay lại trước-commit; không làm mất dữ
liệu. Row-lock rollback chỉ bỏ serialization mới, không cần data repair.
