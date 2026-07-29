# AN-P5 — bằng chứng diễn tập staging cô lập ngày 2026-07-29

## 1. Phạm vi và kết luận

Đợt này diễn tập rollout trên một Docker Compose project cô lập với stack dev
đang chạy:

- project: `procv-anp5-staging`;
- frontend: `http://localhost:55173`;
- backend: `http://localhost:58000`;
- PostgreSQL, Redis và volume riêng, không expose cổng database/cache ra host;
- base code: `dev@641afcef`;
- nhánh vá phát sinh: `fix/announcement-redis-resilience`.

Kết quả:

- bốn surface đã mở tuần tự và smoke đạt trên desktop, tablet, mobile;
- priority giữa critical, DPA, xác thực email, nhu cầu công việc và remote info
  đúng contract;
- candidate kill switch giữ nguyên system reminder và không làm hỏng layout;
- failure injection Redis tìm thấy một lỗi HTTP 500 ở throttle, đã được vá và
  chạy lại đạt HTTP 202;
- không có migration hoặc permission mới.

Đây là bằng chứng rehearsal trên staging cục bộ cô lập, không thay thế rollout
trên môi trường staging dùng hạ tầng thật hoặc thời gian theo dõi 30 phút cho
mỗi surface. Vì vậy AN-P5 vẫn ở trạng thái 🟡 cho tới khi bản vá được merge,
deploy và đạt soak window; AN-P6 chưa đủ điều kiện bắt đầu.

## 2. Dữ liệu và preflight

Dữ liệu được tạo qua Admin API với prefix `[STAGING AN-P5]`, gồm security,
rotation cùng hạng, maintenance scheduled, critical có thời gian kết thúc và
item cho từng surface. Không dùng SQL để tạo announcement.

Preflight sau khi mở đủ bốn surface:

```json
{
  "enabled_surfaces": [
    "admin_workspace",
    "candidate",
    "employer_marketing",
    "employer_workspace"
  ],
  "ended_announcements": 0,
  "errors": [],
  "live_by_surface": {
    "admin_workspace": 4,
    "candidate": 1,
    "employer_marketing": 1,
    "employer_workspace": 2
  },
  "published_announcements": 9,
  "rotation_groups": [
    {
      "priority": 80,
      "surface": "admin_workspace",
      "tier": 6
    }
  ],
  "scheduled_by_surface": {
    "admin_workspace": 1,
    "candidate": 0,
    "employer_marketing": 0,
    "employer_workspace": 0
  },
  "status": "ok",
  "warnings": []
}
```

Migration `accounts.0019` và `sitecontent.0016` đã applied. `manage.py check`
không có lỗi và `makemigrations --check --dry-run` trả `No changes detected`.

## 3. Smoke theo surface và viewport

| Surface | Nguồn hiển thị | Desktop `1440x900` | Tablet `834x1112` | Mobile `390x844` | Console/page error |
| --- | --- | --- | --- | --- | --- |
| Admin workspace | Remote security | Cao 41 px; header bottom = strip top 76 px | Cao 41 px; khớp 76 px | Cao 41 px; khớp 76 px | Không |
| Employer marketing | Remote info | Cao 45 px; khớp header 65 px | Cao 45 px; khớp 65 px | Cao 72,95 px; khớp 65 px | Không |
| Employer workspace | Remote critical | Cao 41 px; khớp header 56 px | Cao 41 px; khớp 56 px | Cao 72,95 px; khớp 56 px | Không |
| Candidate `/viec-lam` | Remote info hoặc system reminder theo phiên | Cao 45 px; khớp header 65 px | Cao 45 px; khớp 65 px | Cao 72,95 px; khớp 65 px | Không trên tab sạch |

Mọi case trong bảng có horizontal overflow bằng `0`. Mobile tự tăng chiều cao
để chứa tối đa hai dòng; không dùng phép trừ viewport hard-code và không đè
header.

## 4. Priority và fallback

Các case đã quan sát bằng phiên thật:

1. employer chưa hoàn tất DPA + remote critical: critical được hiển thị, nguồn
   `remote`, vượt đúng compliance system label;
2. candidate `email_verified=false`,
   `job_preferences_configured=false` + remote info: nhãn “Tài khoản của bạn
   chưa được xác thực email” được hiển thị;
3. cùng candidate sau khi `email_verified=true`: nhãn “Hãy chia sẻ nhu cầu
   công việc để nhận gợi ý việc làm tốt nhất” được hiển thị;
4. candidate kill switch tắt: API trả
   `{"items":[],"next_transition_at":null,"remote_enabled":false}`, system
   reminder vẫn hiển thị, `data-announcement-source=system`, không tràn và
   không có console error trên tab sạch;
5. bật lại surface: feed trả `remote_enabled=true` và item candidate như cũ.

Case 2 và 3 xác nhận xác thực email luôn ưu tiên hơn nhắc nhu cầu công việc;
remote info không vượt hai system label này.

## 5. Failure injection Redis và bản vá

Lần chạy đầu:

- analytics consent hợp lệ;
- Redis staging tạm dừng;
- `POST /api/site/announcements/events/` trả HTTP 500;
- nguyên nhân: `ScopedRateThrottle` truy cập Redis trước khi service analytics
  có thể áp dụng cơ chế best-effort.

Bản vá:

- hai endpoint telemetry announcement dùng throttle fail-open khi cache lỗi;
- throttle vẫn áp giới hạn bình thường khi cache hoạt động;
- failure phát metric PII-free
  `announcement_throttle{event=fail_open,reason=cache_error,scope=...}`;
- analytics dedupe tiếp tục fail-closed, không tăng aggregate khi Redis lỗi.

Lần chạy lại với Redis vẫn dừng:

```text
HTTP 202
{"accepted":true}
```

Redis được bật lại ngay sau case; health `healthy` và active feed candidate trả
HTTP 200 với `remote_enabled=true`.

## 6. Test evidence của bản vá

```text
sitecontent tests: 55 passed
announcement analytics tests: 13 passed
ruff check: pass
ruff format --check: pass
import-linter: 2 contracts kept, 0 broken
Django check: pass
makemigrations --check --dry-run: no changes
real Redis-down request: 202 {"accepted":true}
```

Full gate của AN-P5 trước rehearsal: 615 backend test, coverage 86,12%; 666
frontend test; architecture/OpenAPI/bundle gate sạch; 153 smoke E2E đạt.

## 7. Rủi ro còn lại và go/no-go

| Hạng mục | Trạng thái |
| --- | --- |
| Code merge vào `dev` | Chờ merge nhánh `fix/announcement-redis-resilience` |
| Staging cô lập bốn surface | Đạt |
| Kill-switch rehearsal | Đạt |
| Redis failure/drop rehearsal | Đạt sau bản vá |
| Staging hạ tầng thật + p95/5xx telemetry | Chưa có môi trường cấu hình trong repository |
| Soak tối thiểu 30 phút mỗi surface | Chưa thực hiện |
| Release ổn định để mở AN-P6 | Chưa có |

Quyết định hiện tại: **go cho review/merge bản vá; no-go cho rollout production
và AN-P6** cho tới khi deploy lên staging hạ tầng thật, theo dõi đủ cửa sổ và
không vượt ngưỡng dừng trong runbook.
