# Announcement AN-P5 — rollout, monitoring và rollback

**Cập nhật:** 2026-07-29

## 1. Mục tiêu và nguyên tắc an toàn

Runbook này áp dụng cho dải thông báo dưới header ở bốn surface:

1. `admin_workspace`;
2. `employer_marketing`;
3. `employer_workspace`;
4. `candidate`.

Hai lớp điều khiển độc lập:

- `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES` là compatibility gate lúc build frontend.
  Surface chưa có trong danh sách tiếp tục dùng banner cũ.
- `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES` là kill switch runtime của backend.
  Surface bị tắt trả `remote_enabled=false`, `items=[]` và không query bảng
  announcement. Frontend bỏ mọi remote item nếu cờ response thiếu hoặc false.

Kill switch remote không tắt label system code-owned như xác thực email, DPA
hoặc nhắc nhu cầu công việc. Error boundary của strip trả về banner legacy nếu
runtime render lỗi. Không reverse migration và không xóa dữ liệu để rollback.

## 2. Điều kiện trước deploy

```bash
git status --short
./scripts/check_all.sh

cd backend
./venv/bin/python manage.py check
./venv/bin/python manage.py makemigrations --check --dry-run
./venv/bin/python manage.py showmigrations accounts sitecontent
./venv/bin/python manage.py announcement_rollout_preflight --json
```

Go/no-go:

- workspace sạch, full gate xanh và OpenAPI đã validate;
- migration `accounts.0019` và `sitecontent.0016` đã applied;
- Redis, PostgreSQL, backend và frontend health check xanh;
- không có critical đang live mà thiếu `ends_at`;
- tài khoản smoke có đúng quyền `announcement.view/manage/publish`;
- dashboard/log collector nhận được logger `product.metrics`;
- có người trực rollback trong toàn bộ rollout window.

AN-P5 không có migration hoặc permission mới. Không seed dữ liệu demo trên
staging/production.

## 3. Cấu hình khởi đầu

Deploy backend trước với remote feed tắt:

```dotenv
ANNOUNCEMENT_REMOTE_ENABLED_SURFACES=
```

Build frontend đầu tiên chỉ bật Admin:

```dotenv
VITE_ANNOUNCEMENT_ROLLOUT_SURFACES=admin_workspace
```

Sau mỗi lần đổi biến backend phải rolling restart web process để Django đọc
setting mới. Đổi biến Vite bắt buộc build/deploy lại frontend; không sửa bundle
đã build.

Production fail-fast nếu kill switch chứa surface không hợp lệ. Giá trị hợp lệ
là danh sách phân tách dấu phẩy; không dùng `all` hoặc `none` ở backend.

## 4. Chuẩn bị dữ liệu staging có xung đột

Tạo bằng workspace quản trị, không dùng SQL trực tiếp:

1. một security item priority 20;
2. hai info item cùng priority 80 để kiểm tra rotation deterministic;
3. một maintenance item có `starts_at` trong tương lai;
4. một critical item có `ends_at` ngắn để kiểm tra boundary;
5. target route include/exclude khác nhau và ít nhất một CTA nội bộ, một HTTPS.

Mỗi item dùng prefix `[STAGING AN-P5]` trong internal name và archive sau smoke.
Trước khi mở từng surface, chạy:

```bash
python manage.py announcement_rollout_preflight \
  --require-live-surface admin_workspace \
  --json
```

Command chỉ đọc. `status=error` chặn rollout. `rotation_groups` phải liệt kê
đúng hai info item; feed thực tế vẫn chỉ trả tier cao nhất. Lưu JSON output,
commit SHA, build ID và thời gian kiểm tra vào deployment ticket; không đưa
token/cookie vào evidence.

## 5. Rollout tuần tự

Chỉ chuyển bước sau khi surface trước ổn định tối thiểu 30 phút:

| Bước | Frontend compatibility gate | Backend remote kill switch |
| --- | --- | --- |
| 1 | `admin_workspace` | `admin_workspace` |
| 2 | thêm `employer_marketing` | thêm `employer_marketing` |
| 3 | thêm `employer_workspace` | thêm `employer_workspace` |
| 4 | thêm `candidate` | thêm `candidate` |

Tại mỗi bước:

1. chạy preflight với `--require-live-surface` cho surface sắp bật;
2. deploy/restart đúng lớp cấu hình;
3. gọi active feed và xác nhận `remote_enabled=true`;
4. smoke desktop `1440x900`, tablet `834x1112`, mobile `390x844`;
5. kiểm tra label system, priority, rotation, CTA, dismiss/snooze, reduced
   motion, tab hidden, route include/exclude và locale fallback;
6. kiểm tra không có page error, console error, overflow, header overlap;
7. theo dõi ngưỡng ở mục 7 trước khi mở surface kế tiếp.

Ví dụ public feed:

```bash
curl --fail-with-body --silent \
  'https://<staging-api>/api/site/announcements/active/?surface=candidate&path=%2F&locale=vi'
```

Không lưu header authorization hoặc cookie vào log/ticket.

## 6. Failure injection trên staging

Chỉ thực hiện trên staging:

1. bỏ surface đang kiểm khỏi `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES`, rolling
   restart backend, xác nhận response false/empty và label system vẫn còn;
2. chặn request active feed trong DevTools, xác nhận header/layout không hỏng
   và event `announcement_runtime{event=feed_error}` xuất hiện best-effort;
3. dùng build test làm component strip ném lỗi, xác nhận error boundary trả
   banner legacy và ghi `render_error` không kèm stack/message;
4. tạm ngắt Redis staging, gửi analytics event, xác nhận CTA không chờ, request
   vẫn 202, aggregate không tăng và có `reason=redis_error`;
5. gửi revision token cũ, payload thiếu quyền và burst event để xác nhận lần
   lượt 409, 403 và 429; không thử brute force trên production.

Khôi phục Redis/cấu hình ngay sau từng case và chạy smoke lại. Mọi injected
failure phải có thời điểm bắt đầu/kết thúc rõ ràng để loại khỏi SLO release.

## 7. Monitoring và ngưỡng dừng

Nguồn quan sát:

- HTTP access log: feed 5xx/latency, admin 403/409, event 429;
- product metrics PII-free:
  `announcement_feed_latency_ms`, `announcement_runtime`,
  `announcement_analytics`, `announcement_event_batch_size`,
  `announcement_throttle`;
- browser/E2E: `pageerror`, console error, overflow và layout overlap.

Dừng mở surface mới và rollback surface vừa bật nếu:

- feed 5xx > 1% trong 5 phút hoặc có chuỗi 5xx liên tục;
- feed p95 > 500 ms trong 10 phút;
- `render_error` hoặc `contract_error` > 0 sau khi loại injected event;
- Redis failure kéo dài quá 5 phút hoặc event drop tăng liên tục;
- admin 403 tăng bất thường sau deploy;
- 409 > 5% mutation trong 10 phút;
- 429 > 1% event request trong 10 phút;
- có mất label xác thực/DPA, CTA bị chặn, header overlap hoặc horizontal overflow.

Metric runtime chỉ nhận enum `surface/event/reason`, throttle 60 request/giờ và
không nhận path, error message, stack, IP, user-agent hoặc identifier.
Hai endpoint telemetry announcement fail-open riêng ở lớp throttle khi cache
không khả dụng để không biến tracking best-effort thành lỗi UX. Mỗi lần
fail-open phát
`announcement_throttle{event=fail_open,reason=cache_error,scope=...}`;
analytics dedupe vẫn fail-closed và không tăng aggregate khi Redis lỗi.

## 8. Rollback

### Tắt một remote surface ngay

1. bỏ surface khỏi `ANNOUNCEMENT_REMOTE_ENABLED_SURFACES`;
2. rolling restart backend;
3. gọi active feed xác nhận `remote_enabled=false`, `items=[]`;
4. xác nhận system security/compliance label vẫn hiển thị.

Không cần rebuild frontend, không archive announcement và không xóa metric.

### Trả toàn bộ surface về banner legacy

1. tắt toàn bộ remote backend;
2. build/deploy frontend với
   `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES=none`;
3. smoke bốn portal và xác nhận banner legacy;
4. revert application release nếu lỗi không thuộc cấu hình.

Không reverse schema `sitecontent.0016`, permission `accounts.0019`, user state,
revision, audit hoặc daily metric. AN-P6 chỉ xóa compatibility path sau ít nhất
một release ổn định và có bằng chứng telemetry.

## 9. Mẫu evidence bàn giao

```text
Commit/build:
Surface:
Thời gian mở:
Preflight JSON:
Desktop/tablet/mobile:
Feed status + p95:
403 / 409 / 429:
Redis failure/drop:
Client error:
Kill-switch rehearsal:
Người xác nhận:
Quyết định go/no-go:
```

Bằng chứng rehearsal gần nhất:
[staging cô lập ngày 2026-07-29](./announcement-staging-evidence-2026-07-29.md).
