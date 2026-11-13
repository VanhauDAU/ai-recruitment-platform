# Thuật toán AI của hệ thống

Tài liệu này là điểm vào cho phần AI của đồ án: hệ thống làm gì với CV, đối
sánh CV/nhu cầu với tin tuyển dụng ra sao, và AI sinh nội dung chạy qua runtime
nào. Nội dung bám code hiện tại; các tài liệu chi tiết được liên kết thay vì
lặp lại.

| Năng lực | Kỹ thuật | Code chính | Chi tiết |
| --- | --- | --- | --- |
| Import và cấu trúc hóa CV | Trích text + LLM structured JSON, fallback heuristic | `apps/cvs/tasks.py`, `apps/ai_core/services/cv_import.py` | mục 1 |
| Điểm hoàn thiện CV | Rule có trọng số | `apps/cvs/services/completeness.py` | mục 2 |
| Đối sánh CV/nhu cầu – tin tuyển dụng | Rule-based có trọng số, giải thích được | `apps/jobs/models/recommendation_queries.py` | mục 3, [`candidate-job-recommendations.md`](./candidate-job-recommendations.md) |
| Tin tương tự tin đã lưu | Similarity pairwise rule-based | `apps/jobs/selectors/saved_recommendations.py` | [`saved-job-recommendations.md`](./saved-job-recommendations.md) |
| AI tạo tin tuyển dụng | LLM structured output qua `ai_core` | `apps/jobs/services/ai_generation.py` | mục 5, [`ai-job-post-generation.md`](./ai-job-post-generation.md) |
| Chatbot FAQ ứng viên | Retrieval, không sinh LLM | — | [`chatbot-ung-vien-faq.md`](./chatbot-ung-vien-faq.md) |

Không có model ML tự train trong production.

## 1. Import và cấu trúc hóa CV

Ứng viên tải PDF/DOCX tại `POST /api/v2/cvs/imports/` (multipart hoặc upload
session đã scan `clean`; xem [`van-hanh-va-kill-switch.md`](../06-deployment/van-hanh-va-kill-switch.md)).
Service `queue_cv_import` kiểm tra magic bytes, giới hạn 5 MB, tạo `UserCv`
và `CvImportJob` (`queued`) với `source_expires_at = now +
CV_IMPORT_SOURCE_RETENTION_DAYS` (mặc định 30). Task `process_cv_import_job`
(queue `cv-export`) chạy:

1. **Trích text**: PDF qua `pypdf` (tối đa 20 trang), DOCX qua `python-docx`
   (đoạn văn + ô bảng). Không có OCR.
2. **Kiểm tra text**: PDF < 40 ký tự → `scanned_pdf_ocr_unavailable`; < 10 ký
   tự → `insufficient_text`; > 100.000 ký tự → `text_too_long`.
3. **Cấu trúc hóa** (`structure_cv_text`):
   - Site Setting `ai_enabled=false` → `ai_disabled`.
   - Provider theo Site Setting `ai_provider` (`gemini` | `openai` |
     `anthropic`) và `ai_model` (mặc định `gemini-2.0-flash`); khóa đọc từ env
     (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). Prompt yêu cầu
     JSON theo schema cố định (`personal_info`, `summary`, `experiences`,
     `education`, `skills`, `projects`), `temperature=0`, cấm bịa dữ liệu.
   - Không có khóa → **heuristic**: dòng đầu là họ tên, regex email/số điện
     thoại, 7 dòng tiếp theo làm tóm tắt; các section khác rỗng.
   - Validate kiểu dữ liệu; lỗi parse/HTTP/schema được thử lại một lần, lần hai
     thất bại → `ai_provider_failed` hoặc `invalid_ai_schema`.
4. **Chuẩn hóa** sang content V2 (`empty_content(locale)`): giới hạn độ dài
   từng trường, tối đa 20 item mỗi section, 50 kỹ năng, ngày chỉ nhận `YYYY-MM`,
   mô tả thành `rich_text_v1`. Tiêu đề section theo `vi-VN`/`en-US`.
5. Điền thông tin tài khoản vào ô còn trống (`overlay_actor_identity`, chỉ fill),
   ghép template, tạo version `imported`, đặt CV `analyzed` và xóa
   `raw_text`/`normalized_text`.

Lỗi bất kỳ chuyển job và CV sang `failed` với `failure_code`; metric
`cv_import_failure`, `cv_import_duration_ms`. Log không chứa text CV hay phản hồi
provider. Bước import không ghi `CvSkill`; model này có `source=ai_extracted` và
`confidence_score` nhưng hiện chỉ được ghi tay (Django admin).

**Lưu ý kiến trúc:** import CV gọi REST provider trực tiếp, chưa đi qua runtime
`ai_core` ở mục 4, nên không bị `AI_RUNTIME_ENABLED` chặn, không ghi
`AiInvocation`/`AiUsageDaily` và không có quota.

## 2. Điểm hoàn thiện CV

`cv_completion_score` (0–100) tính từ version mới nhất; CV upload có file luôn
được 100. Serializer V2 trả `completion_score` và `is_complete`
(`completion_score >= COMPLETION_THRESHOLD = 70`).

| Thành phần | Điểm |
| --- | ---: |
| Họ tên | 15 |
| Email / Số điện thoại | 10 / 10 |
| Headline / Địa chỉ | 5 / 5 |
| Tóm tắt | 15 |
| Kinh nghiệm hoặc dự án | 15 |
| Học vấn | 10 |
| Kỹ năng | 10 |
| Chứng chỉ, ngôn ngữ hoặc giải thưởng | 5 |

Section bị tắt (`enabled=false`) hoặc chỉ chứa id/thứ tự không được tính.

## 3. Đối sánh với tin tuyển dụng

Toàn bộ đối sánh là rule-based, tất định và giải thích được. Mỗi kết quả trả
`match_score` (0–100), `match_details` (`code`, `label`, `points`) và
`match_reasons` (câu hiển thị); serializer công khai thêm
`is_high_match = match_score >= 70`.

### Đầu vào

- **Feed `for-me`, lane inline, email digest**: chỉ `CandidateJobPreference`
  (vị trí taxonomy + vị trí tự nhập, kỹ năng ưu tiên, lương VND, kinh nghiệm,
  tỉnh/thành, sẵn sàng chuyển nơi). Không đọc CV hay lịch sử tìm kiếm.
- **`by-cv/{cv_public_id}`** (sau khi lưu CV): đọc đúng CV của owner. Vị trí lấy
  theo thứ tự `position` của CV → headline → tiêu đề CV dạng "CV <vị trí>" →
  nhu cầu công việc. Kỹ năng gộp `CvSkill` và section `skills` của content.
  Lương, kinh nghiệm, địa điểm vẫn lấy từ nhu cầu công việc.

Mọi luồng cá nhân hóa yêu cầu `CandidateConsent(ai_recommendation)=granted`;
`by-cv` kiểm consent trước khi đọc nội dung CV.

### Chấm điểm (`_score_job`)

| `code` | Điểm | Điều kiện |
| --- | ---: | --- |
| `category` | 38 | Specialization chính của tin thuộc tập vị trí và tiêu đề có token chung với tên category (bỏ stop word) |
| `position` | 24 | Tiêu đề (bỏ dấu) chứa hoặc nằm trong một vị trí |
| `skills` | 6/kỹ năng, tối đa 24 | Giao tên kỹ năng đã bỏ dấu |
| `location` / `relocation` | 10 / 3 | Tỉnh của tin trùng tỉnh mong muốn / ứng viên sẵn sàng chuyển nơi |
| `experience` | 6 | Bậc kinh nghiệm ứng viên ≥ yêu cầu |
| `salary` | 8 | Lương VND không thỏa thuận, khoảng lương giao `[0,8 × mong muốn; 1,25 × mong muốn]` |

Điểm chặn 100; dưới `MIN_RECOMMENDATION_SCORE = 20` bị loại. So khớp văn bản
dùng `fold_accents` (bỏ dấu tiếng Việt, chữ thường).

### Chọn ứng viên và xếp hạng

1. Prefilter tin active (`active_jobs_queryset`) có ít nhất một tín hiệu mạnh:
   category, skill id, tên kỹ năng (tối đa 20) hoặc vị trí khớp tiêu đề (tìm
   kiếm không dấu). Không có tín hiệu → danh sách rỗng, không lấp tin ngẫu nhiên.
2. Loại tin đã ứng tuyển và tin ứng viên đã ẩn; email loại thêm tin đã lưu, đã
   gửi hoặc đang nằm trong digest chưa gửi xong.
3. Lấy tối đa `MAX_SCORING_CANDIDATES = 500` tin mới nhất, chấm điểm trong bộ
   nhớ.
4. Sắp xếp theo điểm, rồi `tier` (`top` > `featured`), thời điểm đăng, `pk`.
   `tier` là nhãn admin gán, chỉ dùng làm tie-break, không cộng điểm.

`strategy` trả về: `profile-rule-v2` (by-cv) và
`candidate-preference-rule-v2` (feed). Lane inline hiển thị cho khoảng 40%
trang kết quả theo hash SHA-256 của `(user, ranking_seed, page)`, chọn 1–2 tin
từ top 8. Contract, trạng thái `preferences_required`/`consent_required` và
thao tác ẩn tin xem [`candidate-job-recommendations.md`](./candidate-job-recommendations.md).

Gợi ý từ tin đã lưu (`by-saved`) dùng bảng trọng số khác, so từng cặp tin và
không cần consent: [`saved-job-recommendations.md`](./saved-job-recommendations.md).

Phía nhà tuyển dụng hiện **không** có chấm điểm hồ sơ ứng tuyển hay đối sánh
JD → CV.

## 4. Runtime AI dùng chung (`apps/ai_core`)

`ai_core` cung cấp một API trung lập provider cho mọi use case sinh nội dung có
cấu trúc; prompt, schema và policy thuộc app sử dụng (hiện chỉ `jobs`).

- `generate_structured(use_case, prompt, response_schema, prompt_version,
  schema_version, system_instruction, result_validator, model, correlation_key)`
  trả `StructuredGenerationResult` (data, usage, cost, latency, attempts).
- Cấu hình `AiRuntimeConfig.from_django_settings()` đọc env, không đọc bảng
  domain. `validate()` từ chối khi `AI_RUNTIME_ENABLED` tắt
  (`runtime_disabled`), backend không hỗ trợ hoặc thiếu credential.
- Provider duy nhất `GeminiStructuredOutputProvider` (SDK `google-genai`) phục
  vụ cả hai backend: `gemini_developer` (API key) và `vertex` (project,
  location, ADC). Không có fallback model/provider ngầm.
- Gọi model với `temperature=0`, `response_mime_type=application/json` và
  `response_json_schema`; parse `parsed` hoặc JSON text, rồi chạy
  `result_validator` của use case.
- Retry tối đa `AI_PROVIDER_MAX_ATTEMPTS` (≤ 2), backoff
  `AI_PROVIDER_RETRY_BASE_SECONDS × 2^(n-1)`; timeout `AI_PROVIDER_TIMEOUT_SECONDS`.

### Lỗi chuẩn hóa

`AiGenerationError` chỉ mang `code`, không mang text provider hay prompt:

| Code | Retry | Nguyên nhân |
| --- | --- | --- |
| `provider_timeout` | có | Timeout |
| `rate_limited` | có | HTTP 429 |
| `provider_unavailable` | có | 408/409/425/5xx |
| `empty_response`, `invalid_response` | có | Không có/không parse được JSON object |
| `content_blocked` | không | Provider chặn prompt |
| `provider_authentication_failed` | không | 401/403 |
| `model_not_found` | không | 404 |
| `invalid_provider_request` | không | 4xx khác |
| `provider_failed` | không | Lỗi không phân loại |
| `runtime_disabled`, `provider_not_configured`, `unsupported_provider_backend`, `provider_sdk_unavailable` | không | Cấu hình |

Lỗi của `result_validator` cũng tính là một attempt và theo cùng quy tắc retry.

### Quan sát, chi phí, retention

- `AiInvocation`: một row mỗi lần gọi với use case, provider/backend/model,
  prompt/schema version, **SHA-256** của prompt và schema (không lưu nội dung),
  trạng thái, attempt/retry, token, `cost_usd`, latency, `error_code`,
  `provider_request_id`, `finish_reason`.
- `AiUsageDaily`: tổng theo ngày × use case × provider × model, cộng nguyên tử
  bằng `F()`; thêm `quota_rejection_count` từ `record_ai_quota_rejection`.
- Chi phí = token vào/ra × giá trong `AI_MODEL_PRICING_USD` (USD/triệu token).
- `ai_usage_overview(days≤365)` cấp dữ liệu cho `GET /api/ai/admin/overview/`,
  gồm p95 latency chính xác trên invocation.
- Task `purge_expired_ai_metadata` (hằng ngày) xóa theo lô invocation và
  aggregate cũ hơn `AI_INVOCATION_METADATA_RETENTION_DAYS` (365).

## 5. AI tạo tin tuyển dụng

Use case `job_post_generation`, prompt/schema `job-post-v2`. Tóm tắt luồng:

1. NTD gửi `POST /api/jobs/mine/ai-generations/` ở mode `ai_brief` hoặc
   `jd_text` kèm `idempotency_key`. Input được sanitize (loại liên hệ/PII);
   cùng key và cùng hash input trả lại generation cũ, khác hash → 409.
2. Policy `job_ai_policy(company)`: hard switch env AND soft switch Site
   Setting AND (công ty trong allowlist hoặc bucket SHA-256 của `public_id` <
   rollout percent). Quota theo NTD/ngày (`quota_day`), vượt → 429 và ghi quota
   rejection; throttle 3/phút.
3. Task trên queue `ai-generation` dựng prompt gồm context công ty đã duyệt
   (không liên hệ), catalog taxonomy tin cậy và input không tin cậy; gọi
   `generate_structured`; resolve category/kỹ năng/phúc lợi deterministic về
   catalog hiện có, loại giá trị ngoài allowlist.
4. Trạng thái `queued → processing → completed | failed | cancelled` với phase
   chi tiết; lease 85 giây, beat thu hồi job stale mỗi 5 giây. NTD poll, hủy và
   gửi feedback qua các endpoint `.../{public_id}/`, `cancel/`, `feedback/`.
5. Kết quả chỉ là gợi ý; không tự lưu hay đăng `Job`. Nội dung sanitized giữ
   `AI_JOB_GENERATION_CONTENT_RETENTION_DAYS` (90).

Hợp đồng output, trường cấm và tiêu chí train model xem
[`ai-job-post-generation.md`](./ai-job-post-generation.md); cờ và rollback xem
[`van-hanh-va-kill-switch.md`](../06-deployment/van-hanh-va-kill-switch.md).

## 6. Chế độ lỗi và hành vi suy giảm

| Tình huống | Hành vi |
| --- | --- |
| PDF scan/ảnh | Import thất bại `scanned_pdf_ocr_unavailable`; ứng viên dùng builder |
| Không có khóa provider cho import | Heuristic tạo bản nháp tối thiểu, không báo lỗi |
| Provider import lỗi hai lần | `ai_provider_failed`, có endpoint retry import |
| Chưa khai báo nhu cầu / thiếu consent | `preferences_required` / `consent_required`, danh sách rỗng; `by-cv` trả 403 khi thiếu consent |
| Không tin nào đạt 20 điểm | Danh sách rỗng (riêng `by-saved` có fallback tin mới nhất) |
| Runtime AI tắt hoặc ngoài rollout | Tạo tin AI trả 503; form nhập tay vẫn dùng được |
| Provider tạo tin lỗi/timeout | Generation `failed` với error code chuẩn hóa; không trừ thêm quota khi retry nội bộ |

## Việc còn mở

- Đưa import CV vào runtime `ai_core` để dùng chung hard switch, invocation log
  và quota; hiện import vẫn dùng adapter REST riêng theo Site Setting.
- Chưa có trích xuất kỹ năng tự động vào `CvSkill`, OCR cho PDF scan, đối sánh
  phía nhà tuyển dụng hay mô hình học máy; các Site Setting `ai_cv_review_enabled`,
  `ai_job_match_enabled`, `ai_daily_request_limit` được seed nhưng chưa có code
  đọc.
- Đối sánh văn bản là so khớp token/chuỗi con, chưa có embedding hay độ tương
  đồng ngữ nghĩa.
