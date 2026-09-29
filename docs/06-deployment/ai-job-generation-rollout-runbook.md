# AI tạo tin tuyển dụng — deployment, rollout và rollback

**Cập nhật:** 2026-08-12  
**Owner:** Backend `ai_core` + `jobs`; frontend Employer; vận hành Platform.

## 1. Ranh giới an toàn

- `AI_RUNTIME_ENABLED` là hard switch. Site Setting không thể vượt qua.
- Generation chỉ tạo suggestion; không lưu hoặc publish `Job` tự động.
- AI không nhận contact/candidate PII, không ghi raw prompt vào log và không
  điền lương, địa điểm, lịch, deadline, số lượng, campaign, thông tin nhận hồ
  sơ, auto-reject, tuổi hoặc giới tính.
- Provider cố định cho mỗi invocation; không fallback model/provider ngầm.
- Nội dung sanitized giữ 90 ngày; aggregate invocation/usage giữ 365 ngày.

Rollback là tắt switch, không reverse migration và không xóa generation.

## 2. Cấu hình

Backend `.env`:

```dotenv
AI_RUNTIME_ENABLED=False
AI_PROVIDER_BACKEND=gemini_developer
AI_JOB_GENERATION_MODEL=gemini-3.5-flash-lite
AI_JOB_GENERATION_MODEL_ALLOWLIST=gemini-3.5-flash-lite
AI_JOB_GENERATION_DAILY_LIMIT=10
AI_JOB_GENERATION_CONTENT_RETENTION_DAYS=90
AI_INVOCATION_METADATA_RETENTION_DAYS=365
AI_JOB_GENERATION_LEASE_SECONDS=85
AI_PROVIDER_TIMEOUT_SECONDS=40
AI_PROVIDER_MAX_ATTEMPTS=2
AI_PROVIDER_RETRY_BASE_SECONDS=0.5
AI_PROVIDER_API_VERSION=v1
AI_MODEL_PRICING_USD={"gemini-3.5-flash-lite":{"input":"<USD/M token>","output":"<USD/M token>"}}
GEMINI_API_KEY=
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=global
```

`gemini_developer` yêu cầu `GEMINI_API_KEY`. Chuyển sang `vertex` yêu cầu ADC
hoặc service account của workload, `GOOGLE_CLOUD_PROJECT` và location. Không
đưa key vào Site Setting, frontend, log hoặc deployment evidence.
Giá token phải lấy từ bảng giá provider ở thời điểm deploy; production từ chối
bật runtime nếu model đang dùng thiếu giá, tránh dashboard hiển thị chi phí 0
do cấu hình thiếu.

Tab Admin Settings / AI có sáu policy runtime:

- `ai_job_generation_enabled`;
- active model và model allowlist (chỉ được thu hẹp env allowlist);
- daily limit (tối đa bằng env cap 10);
- rollout percent 0–100;
- company public-id allowlist.

Công ty đủ điều kiện nếu nằm trong allowlist hoặc thuộc deterministic rollout
bucket. Burst vẫn là 3/phút và quota là 10 generation mới/ngày/NTD; retry nội
bộ của cùng generation không trừ lượt mới.

## 3. Preflight deploy

```bash
./scripts/check_all.sh
cd backend
./venv/bin/python manage.py check
./venv/bin/python manage.py makemigrations --check --dry-run
./venv/bin/python manage.py showmigrations ai_core jobs sitecontent
docker compose config --quiet
```

Go/no-go:

- migration applied; Redis/PostgreSQL/backend/beat/`ai-worker` healthy;
- `ai-worker` chỉ nghe queue `ai-generation`, concurrency đúng 2;
- production fail-fast chấp nhận provider, credential, model/retention/timeout;
- admin overview không lộ prompt/input/result và nhận metric PII-free;
- OpenAPI, tenant-isolation, quota/idempotency/cancel/recovery test xanh;
- hard switch và soft switch đều đang tắt trước deploy.

## 4. Eval bắt buộc trước pilot

Chạy tập 150 case tiếng Việt đã được duyệt, gồm brief ngắn/dài, JD dán, ký tự
Unicode, prompt injection, taxonomy mơ hồ, nội dung có contact/candidate PII và
case thiếu dữ liệu. Dataset không chứa dữ liệu cá nhân thật.

Gate:

| Chỉ số | Ngưỡng |
| --- | ---: |
| Structured schema success | ≥ 99% |
| PII outbound / catalog ID giả / trường cấm bị điền | 0 |
| Chất lượng đạt ít nhất 4/5 | ≥ 80% case |
| Provider completion | ≥ 98% |
| End-to-end p95 | < 30 giây |
| Chi phí mỗi generation thành công | ≤ USD 0,01 |

Giữ model/prompt/schema version và hash dataset trong evidence; không lưu raw
prompt production. Mọi thay đổi prompt/schema/model phải chạy lại cùng holdout.

## 5. Rollout

| Bước | Policy | Điều kiện sang bước kế |
| --- | --- | --- |
| Nội bộ | allowlist tài khoản/công ty test, 0% | đạt toàn bộ gate |
| Pilot | allowlist 5–10 công ty, 0% | ≥7 ngày hoặc ≥200 generation |
| 10% | bỏ dần allowlist, rollout 10 | ≥7 ngày hoặc ≥200 generation |
| 50% | rollout 50 | ≥7 ngày hoặc ≥200 generation |
| 100% | rollout 100 | ≥7 ngày hoặc ≥200 generation |

Ở mỗi bước kiểm tra desktop/tablet/mobile, direct URL ba mode, giữ `campaign`,
reload/resume, cancel, provider failure → manual fallback, save draft và
reduced motion. Không bật bước tiếp theo khi chưa đạt ít nhất một trong hai gate
ổn định của bước đó: 7 ngày hoặc 200 generation.

## 6. Quan sát và ngưỡng dừng

Theo dõi queue depth/oldest age, success/error, p50/p95 latency, provider
attempt, input/output token, estimated cost, quota rejection, cancel, stale
recovery và apply rate (`Job` lưu với generation provenance).

Dừng rollout khi có một trong các điều kiện:

- outbound PII, trường cấm bị điền, taxonomy ID không tồn tại hoặc cross-tenant;
- provider completion <98%, schema success <99% hoặc p95 ≥30 giây trong cửa sổ
  đủ mẫu;
- generation không terminal trong 90 giây hoặc stale recovery tăng liên tục;
- cost > USD 0,01/success, quota/idempotency có dấu hiệu double-charge;
- 5xx >1% trong 10 phút, queue oldest age >90 giây hoặc manual fallback hỏng.

Metric/log chỉ dùng enum, version, model, token/cost/latency và public aggregate;
không tag user/company/generation id, contact, input, output hay error message.

## 7. Rollback và sự cố

1. Đặt `ai_job_generation_enabled=false` để dừng use case ngay; nếu nghi rò rỉ
   dữ liệu/credential, đặt thêm `AI_RUNTIME_ENABLED=false` và rolling restart
   backend + `ai-worker`.
2. Giữ worker chạy trong thời gian drain/cancel nếu sự cố không liên quan dữ
   liệu; nếu provider nguy hiểm, dừng `ai-worker` sau khi hard switch tắt.
3. Xác nhận create mới fail-closed, generation đang poll đi terminal/error và
   form thủ công vẫn lưu draft được.
4. Rotate/revoke credential nếu có khả năng lộ; không đưa secret vào ticket.
5. Không xóa DB row hoặc reverse migration. Chạy retention task theo lịch sau
   khi incident evidence đã được phê duyệt.

Chỉ bật lại sau root-cause, regression/eval đầy đủ và một vòng nội bộ mới.

## 8. Tầm nhìn sau pilot

CV import chỉ migrate sang `ai_core` sau pilot ổn định. Fine-tuning Vertex chỉ
được đánh giá khi có ít nhất 300 cặp input/output opt-in đã review, split theo
công ty để tránh leakage, có holdout bất biến và chứng minh tăng chất lượng
hoặc giảm chi phí/latency so với prompt + structured output. Không fine-tune để
vá taxonomy, policy hoặc validation vốn phải deterministic trong code.
