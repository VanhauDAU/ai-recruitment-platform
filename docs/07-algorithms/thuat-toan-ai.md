# Thuật toán AI của hệ thống

Tài liệu này là điểm vào cho phần AI của đồ án: hệ thống làm gì với CV, đối
sánh CV/nhu cầu với tin tuyển dụng ra sao, và AI sinh nội dung chạy qua runtime
nào. Nội dung bám code hiện tại; các tài liệu chi tiết được liên kết thay vì
lặp lại.

| Năng lực | Kỹ thuật | Code chính | Chi tiết |
| --- | --- | --- | --- |
| Import và cấu trúc hóa CV | Trích text + LLM structured JSON, fallback heuristic | `apps/cvs/tasks/exports.py`, `apps/ai_core/services/cv_import.py` | mục 1 |
| Điểm hoàn thiện CV | Rule có trọng số | `apps/cvs/services/completeness.py` | mục 2 |
| Đối sánh CV/nhu cầu – tin tuyển dụng | Rule-based có trọng số, giải thích được | `apps/jobs/models/recommendation_queries/` | mục 3, [`goi-y-viec-lam-ung-vien.md`](goi-y-viec-lam-ung-vien.md) |
| Tin tương tự tin đã lưu | Similarity pairwise rule-based | `apps/jobs/selectors/saved_recommendations.py` | [`goi-y-tu-viec-da-luu.md`](goi-y-tu-viec-da-luu.md) |
| AI tạo tin tuyển dụng | LLM structured output qua `ai_core` | `apps/jobs/services/ai_generation/` (chính sách: `apps/jobs/domain/ai_policy.py`) | mục 5, [`ai-tao-tin-tuyen-dung.md`](ai-tao-tin-tuyen-dung.md) |
| Chatbot FAQ ứng viên | Retrieval, không sinh LLM | — | [`chatbot-ung-vien-faq.md`](./chatbot-ung-vien-faq.md) |
| Đối sánh ngữ nghĩa CV–JD (đang xây) | Bi-encoder đa ngữ fine-tune local, chấm nhiều tiêu chí, vector trong pgvector | `apps/matching` (mới có schema) | mục 7 |

Chưa có mô hình ML tự huấn luyện nào chạy trong sản phẩm; module đối sánh ngữ
nghĩa ở mục 7 đang được xây.

## 1. Import và cấu trúc hóa CV

Ứng viên tải PDF/DOCX tại `POST /api/candidate/cvs/imports/` (multipart hoặc upload
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
4. Sắp xếp theo điểm, rồi lần đăng đầu (`listing_recency`), `pk`. Không có hạng
   trả phí hay nhãn gán tay nào chen vào thứ tự (ADR-0030).

`strategy` trả về: `profile-rule-v2` (by-cv) và
`candidate-preference-rule-v2` (feed). Lane inline hiển thị cho khoảng 40%
trang kết quả theo hash SHA-256 của `(user, ranking_seed, page)`, chọn 1–2 tin
từ top 8. Contract, trạng thái `preferences_required`/`consent_required` và
thao tác ẩn tin xem [`goi-y-viec-lam-ung-vien.md`](goi-y-viec-lam-ung-vien.md).

Gợi ý từ tin đã lưu (`by-saved`) dùng bảng trọng số khác, so từng cặp tin và
không cần consent: [`goi-y-tu-viec-da-luu.md`](goi-y-tu-viec-da-luu.md).

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
| `runtime_disabled`, `provider_not_configured`, `unsupported_provider_backend` | không | Cấu hình |

Lỗi của `result_validator` cũng tính là một attempt và theo cùng quy tắc retry.

### Quan sát, chi phí, retention

- `AiInvocation`: một row mỗi lần gọi với use case, provider/backend/model,
  prompt/schema version, **SHA-256** của prompt và schema (không lưu nội dung),
  trạng thái, attempt/retry, token, `cost_usd`, latency, `error_code`,
  `provider_request_id`, `finish_reason`.
- `AiUsageDaily`: tổng theo ngày × use case × provider × model, cộng nguyên tử
  bằng `F()`; thêm `quota_rejection_count` từ `record_ai_quota_rejection`.
- Chi phí = token vào/ra × giá trong `AI_MODEL_PRICING_USD` (USD/triệu token).
- `ai_usage_overview(days≤365)` cấp dữ liệu cho `GET /api/admin/ai/overview/`,
  gồm p95 latency chính xác trên invocation.
- Task `purge_expired_ai_metadata` (hằng ngày) xóa theo lô invocation và
  aggregate cũ hơn `AI_INVOCATION_METADATA_RETENTION_DAYS` (365).

## 5. AI tạo tin tuyển dụng

Use case `job_post_generation`, prompt/schema `job-post-v2`. Tóm tắt luồng:

1. NTD gửi `POST /api/employer/jobs/ai-generations/` ở mode `ai_brief` hoặc
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
[`ai-tao-tin-tuyen-dung.md`](ai-tao-tin-tuyen-dung.md); cờ và rollback xem
[`van-hanh-va-kill-switch.md`](../06-deployment/van-hanh-va-kill-switch.md).

## 5b. AI sinh nội dung CV mẫu (CVT-3)

Use case `cv_sample_content`, prompt `cv-sample-v1`, schema
`cv-sample-content-v1` (`apps/cv_templates/services/sample_generation.py`).

1. Admin gọi `POST /api/admin/cv-sample-contents/generate/` với vị trí ×
   ngôn ngữ × nhóm kinh nghiệm (≤ 16 tổ hợp, ≤ 16 lượt đang chạy; lượt treo quá
   10 phút bị đánh lỗi `stale`). Runtime phải bật và có credential, nếu không
   trả 503 trước khi tạo gì.
2. Mỗi tổ hợp là một `CvSampleGeneration`, task
   `generate_cv_sample_content` chạy trên queue `ai-generation` (85/90 giây).
   Prompt chỉ gồm tên vị trí, số năm theo nhóm, từ khóa và định nghĩa trường
   riêng — không có dữ liệu người dùng.
3. Schema phản hồi không có trường danh tính; `result_validator` từ chối mọi
   email, số điện thoại, liên kết (`personal_data_detected`, provider thử lại).
   Giá trị trường riêng được lọc theo kiểu và danh sách lựa chọn; AI không điền
   liên kết, số hay ngày.
4. Kết quả được dựng thành document chuẩn, validate rồi lưu thành
   `CvSampleContent` `in_review`, `origin=ai`. Không có gì được xuất bản nếu admin
   chưa duyệt; duyệt = publish, bản cũ cùng tổ hợp được lưu trữ.

Đo trên máy dev (Gemini flash-lite): 8 nội dung (1 vị trí × 4 nhóm × 2 ngôn
ngữ) xong trong ~13 giây, tất cả qua validator.

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

## 7. Đối sánh ngữ nghĩa CV–JD chạy local (đang xây)

Phần AI tự xây của đồ án: ứng viên chọn một CV và một tin để xem điểm phù hợp,
kỹ năng khớp/thiếu và gợi ý cải thiện CV. Mô hình chạy và fine-tune trên máy
local, không gọi API ngoài; phạm vi ở
[phân tích yêu cầu](../01-phan-tich/phan-tich-yeu-cau.md#phạm-vi-ai-đã-chốt),
trạng thái ở [tiến độ dự án](../TIEN-DO-DU-AN.md#aiml-chạy-local), nhật ký thực nghiệm từng giai đoạn ở [bản lưu trữ](../archive/snapshot/tien-do-den-2026-11-26.md#đối-sánh-ngữ-nghĩa-cvjd-chạy-local-2026-11-15).

Đã có:

- PostgreSQL chạy image `pgvector/pgvector:pg16-trixie`; migration
  `matching.0001` bật extension `vector`.
- Ba bảng của `apps/matching`: `MatchDocument` (hồ sơ đã chuẩn hóa và vector 768
  chiều của một phiên bản CV hoặc một nội dung tin), `MatchChunk` (vector từng
  đoạn), `MatchAnalysis` (một lần phân tích; khóa cache gồm phiên bản CV, tin,
  hash nội dung tin, phiên bản mô hình và phiên bản công thức chấm).
- Môi trường huấn luyện `ml/` chạy trên host bằng Apple MPS
  (`ml/requirements.txt`, `ml/scripts/smoke_mps.py`); mô hình nền là
  `intfloat/multilingual-e5-base`.

Trích xuất hồ sơ (`apps/matching/services/extraction/`, phiên bản `extract-v4`):
CV builder, CV tải lên và tin tuyển dụng đều thành `profile_json` gồm kỹ năng,
kinh nghiệm, học vấn, cấp bậc, ngoại ngữ, địa điểm và các chunk (đoạn văn để
tính vector). Cấu trúc của `profile_json` được mô tả bằng JSON Schema ở
`services/extraction/profile.schema.json`; test kiểm mọi hồ sơ trích ra đều hợp lệ.

| Tệp | Việc |
| --- | --- |
| `cvs/services/pdf_layout.py` | Thứ tự đọc của trang PDF dựng lại từ tọa độ ký tự: khe dọc giữa hai cột, dòng chạy ngang chia dải, cột ngày ghép vào dòng cùng hàng |
| `text.py` | NFC, tách câu, nối dòng PDF bị ngắt (không nối dòng bắt đầu bằng ngày), nhận diện ngôn ngữ (tỷ lệ chữ cái riêng của tiếng Việt) |
| `facts.py` | Khoảng ngày (03/2021, 2021-03, Sep 2021, T9/2021, "tháng 9 năm 2021", "Hiện tại", khoảng in thành hai dòng, khoảng chỉ ghi năm tính từ giữa năm), bậc học (từ chỉ bằng cấp trước tên trường, so theo ranh giới từ), cấp bậc (chỉ từ khóa chức danh rõ nghĩa), từ chỉ nghề để nhận chức danh, mức ngoại ngữ (từ chỉ mức, IELTS/TOEIC/JLPT…) |
| `cv_builder.py` | Đọc trường có cấu trúc của `content_json`; số tháng và bậc học dùng chung hàm với trường matching của CV |
| `cv_upload.py` | Chia mục theo dòng tiêu đề, nhận ra bố cục PDF bị đảo, tính số tháng theo bốn trường hợp (`experience.basis`), chức danh (`title`) từ đầu trang hoặc các việc, cấp bậc theo việc gần nhất |
| `job.py` | Trường có cấu trúc của tin; chunk là tên vị trí (tiêu đề đã bỏ lương, địa điểm, giới tính), từng câu yêu cầu, mô tả, tên kỹ năng |
| `services/skills.py` | Khớp tên và alias của danh mục kỹ năng, nguồn `declared`/`listed`/`text`/`job`; nhóm "Phẩm chất cá nhân" và "Tên vị trí" không được đếm |

Quy tắc chống bịa dữ liệu:

- Kỹ năng có `evidence` là câu nguyên văn trong CV kể việc đã làm; kỹ năng chỉ có
  trong danh sách thì `evidence` rỗng ("không minh chứng" theo rubric).
- Không xác định được thì để rỗng và ghi vào `quality.missing`; số tháng chỉ là 0
  khi CV ghi rõ không có kinh nghiệm (CV builder không có mục, PDF bố cục gọn
  không có mục và không có ngày đi làm), còn lại là `None`.
- Chunk bỏ email và số điện thoại; câu yêu cầu của tin về giới tính, tuổi, ngoại
  hình, hôn nhân không được đối sánh.

Đọc chữ PDF bằng `pypdfium2` rồi sắp lại theo vị trí; số liệu đo thư viện, độ chính
xác trích xuất (PDF bố cục lạ: kỹ năng 98,9%, kinh nghiệm 100%, học vấn 97%, ngoại
ngữ 94% trên những gì có in trong tệp) và baseline ở `ml/reports/`. Lệnh `matching_export_dataset` (chỉ đọc) xuất hồ sơ
cho các script ở `ml/`.

Gợi ý việc làm theo ngữ nghĩa (`semantic-v1`, `apps/matching/selectors/recommendations.py`,
kế hoạch bản 3 GĐ 4): vector toàn văn của CV mặc định được so với vector toàn văn của mọi tin
đang công khai mà ứng viên chưa ứng tuyển hay ẩn, bằng khoảng cách cosine của pgvector (tìm
chính xác, không dùng chỉ mục xấp xỉ). 100 tin gần nhất, cộng 50 tin gần CV nhất trong các vị
trí ứng viên khai là mong muốn, được xếp lại:

    điểm = 0,75 · mức liên quan + 0,25 · tỷ lệ kỹ năng của tin mà CV có + điểm cộng theo nhu cầu

Điểm cộng theo nhu cầu đã khai (`apps/jobs/selectors/recommendation_intent.py`): đúng vị trí
mong muốn +0,40, đúng tỉnh mong muốn +0,05, lương chạm mức mong muốn +0,03, số năm kinh
nghiệm đủ và không vượt quá hai bậc so với yêu cầu +0,03. CV kể ứng viên đã làm gì, nhu cầu
nói ứng viên muốn làm gì tiếp, nên tin đúng vị trí mong muốn không bị ngưỡng cắt và lý do
"Đúng vị trí bạn mong muốn" đứng đầu. Thứ tự theo điểm chưa chặn ở 100.

Mức liên quan là trung bình điểm toàn văn và điểm chức danh, quy đổi bằng đúng mốc hiệu
chuẩn của "Xem độ phù hợp". Tin dưới 30 điểm bị bỏ. Kết quả chỉ mang lý do bằng lời ("Trùng
kỹ năng: …", "Vị trí gần với CV của bạn"), không kèm điểm. Không cần nạp mô hình: vector đã
tính sẵn khi lưu CV và tin; chỉ dùng bản hiện hành (`MatchDocument.is_current`). Cờ tắt, chưa
đồng ý, CV chưa có vector hoặc không tin nào đủ gần thì dùng bộ gợi ý theo luật.

Đo trên nhãn yếu (100 CV tổng hợp × 100 tin thật, `ml/reports/recommendations.md`):

| Phương án | Tin neo ở hạng 1 | Trong top 10 | MRR | Precision@5 cùng vị trí | NDCG@10 cùng vị trí |
| --- | ---: | ---: | ---: | ---: | ---: |
| BM25 | 0,350 | 0,613 | 0,443 | 0,270 | 0,538 |
| Luật `profile-rule-v2` | 0,675 | 0,975 | 0,795 | 0,362 | 0,726 |
| `semantic-v1` (e5-base gốc) | 0,650 | 0,975 | 0,780 | 0,430 | 0,830 |

Ngang luật ở việc đưa đúng tin gốc của CV lên đầu, hơn ở việc gợi ý các tin cùng vị trí khác.
Với bi-encoder đã huấn luyện `e5-base-wise-v1` (chưa bật mặc định, xem cuối mục): tin neo ở
hạng 1 0,762, trong top 10 0,988, MRR 0,867, precision@5 0,490, NDCG@10 0,913, hơn luật ở mọi cột.

Mức cộng vị trí mong muốn chọn bằng mô phỏng trên cùng 100 CV (`--intent-study`):

| Điểm cộng | Khai đúng nghề cũ: MRR tin neo | NDCG@10 cùng vị trí | Đổi nghề: tin nghề mới trong top 10 (trần 36%) | NDCG@10 nghề mới | Tin nghề cũ còn trong top 10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Không khai | 0,776 | 0,832 | 3% | 0,043 | 25% |
| +0,20 | 0,826 | 0,961 | 20% | 0,326 | 24% |
| +0,40 (chọn) | 0,829 | 0,998 | 34% | 0,719 | 23% |
| +0,50 | 0,829 | 1,000 | 36% | 0,829 | 22% |

Mức +0,40 đưa gần hết tin nghề mới vào 10 gợi ý đầu mà vẫn giữ tin nghề cũ; mức cao hơn bắt
đầu đẩy tin nghề cũ ra.

Luồng phân tích (`apps/matching/services/`):

| Bước | Tệp | Việc |
| --- | --- | --- |
| 1 | `extraction/` | Hồ sơ `profile_json` (như trên) |
| 2 | `encoder.py` | Câu → vector 768 chiều: E5 (tiền tố `query:` cho tin, `passage:` cho CV) trong `ml-worker`; `hashing` tất định cho test/CI |
| 3 | `documents.py` | Lưu `MatchDocument`/`MatchChunk` theo (nguồn, hash nội dung, phiên bản trích xuất, phiên bản mô hình); vector tài liệu là vector toàn văn |
| 4 | `scoring/` | Công thức `hybrid-v3`: bảng `hybrid-v2` dưới đây cộng ba thay đổi ở phần "Đợt huấn luyện" cuối mục |
| 5 | `explain.py` | Câu tóm tắt từng tiêu chí và gợi ý theo luật, chỉ dạng "nếu bạn đã có…" |
| 6 | `analyses.py` | Cache theo khóa, task `run_analysis` ở queue `ai-matching`, phục hồi job treo |

Công thức `hybrid-v2` (từ 25/11; mỗi tiêu chí 0–100; tiêu chí thiếu dữ liệu hoặc
tin không yêu cầu bị loại, trọng số chuẩn hóa lại):

| Tiêu chí | Trọng số | Cách tính |
| --- | ---: | --- |
| Kỹ năng | 0,40 | `Σ(w·m)/Σw`, w = trọng số × (1 cần có / 0,5 nên có); m = 1 khi CV có kỹ năng theo danh mục. Khớp "viết khác tên" (câu CV có cosine ≥ τ_skill tới tên kỹ năng) đang tắt với mô hình chưa fine-tune. Tin có kỹ năng mà CV không thể hiện là 0 điểm |
| Kinh nghiệm | 0,30 | `0,4·Y·R/100 + 0,6·R`; Y theo số năm (đủ 100, thiếu 1 bậc 60, thiếu ≥ 2 bậc 20), R = mức liên quan = trung bình điểm hiệu chuẩn của cosine toàn văn và cosine chức danh |
| Học vấn | 0,10 | Đủ/vượt 100, thấp 1 bậc 50, thấp hơn 0 |
| Cấp bậc | 0,10 | Lệch 0/1/2/≥ 3 bậc: 100/70/40/10 |
| Ngoại ngữ | 0,10 | Đủ mức 100, thấp 1 bậc 50, không có 0; thiếu ngoại ngữ bắt buộc thì điểm tổng tối đa 64 |

**Hệ số liên quan.** Học vấn, cấp bậc, ngoại ngữ là điểm "đủ điều kiện chung": người
khác nghề vẫn đạt. Khi cộng vào điểm tổng, ba tiêu chí này được nhân với
`min(1, R/50)`. Điểm hiển thị của từng tiêu chí giữ giá trị thật ("đủ bậc học" vẫn
là 100) và phần tóm tắt ghi rõ tiêu chí chỉ được tính một phần; kết quả mang cờ
`flags.relevance_discount_applied` và `overall.relevance`. Mốc 50 là giữa thang hiệu
chuẩn (0 = trung vị cặp khác ngành, 100 = phân vị 90 cặp khớp mạnh).

**Khác `hybrid-v1`** (đo trên validation, bảng ở cuối mục):
- Bỏ tiêu chí địa điểm (trọng số 0,10): CV không mang địa điểm nên tiêu chí này
  chưa bao giờ chấm được, và rubric gán nhãn không xét địa điểm.
- Tắt khớp kỹ năng "viết khác tên": với mô hình zero-shot, ngưỡng 0,846 nhận nhầm
  phần lớn. Ở cặp khác ngành, 23/42 lượt khớp kỹ năng là khớp kiểu này; ở cặp nhãn
  3–4 chỉ 1/53. Ví dụ: "Phần mềm kế toán" khớp với câu "Sử dụng công cụ như Python, R
  để phân tích…". Cơ chế còn trong mã (`Calibration.semantic_skills`), chờ mô hình
  đủ chính xác.
- Thêm hệ số liên quan. Kế hoạch ban đầu là chặn trần điểm tổng theo R; đo cho thấy
  trần phải rất chặt mới hạ được điểm cặp khác ngành, và khi đó cắt cả cặp đúng nghề
  có R thấp. Giảm phần đóng góp của ba tiêu chí chung thì đạt được mà không mất độ
  chính xác xếp hạng.

Hai thay đổi so với kế hoạch, theo số đo (`ml/reports/calibration_e5-base-zs-v1.md`,
nhãn yếu, mô hình zero-shot):

- R không dùng MaxSim từng câu yêu cầu: phép đo này gần như không phân biệt cặp
  khớp và cặp khác ngành (AUC 0,588), trong khi cosine toàn văn đạt 0,899 và
  cosine chức danh 0,935. MaxSim chỉ còn dùng để chỉ câu bằng chứng cho từng
  yêu cầu (`met`/`partial` khi vượt phân vị 95/80 của cặp khác ngành).
- Y nhân R/100: năm làm việc khác nghề không đem lại điểm số năm.

Mốc hiệu chuẩn (cosine → 0–100) theo phiên bản mô hình nằm ở
`domain/calibration.py` (`CALIBRATIONS`). Mô hình gốc đo bằng `ml/scripts/calibrate.py`
(nhãn yếu); mô hình đã huấn luyện đo bằng `calibrate_labeled.py` và `calibrate_scale.py`
trên tập hiệu chỉnh có nhãn. Mức: ≥ 80 Rất phù hợp, 65–79 Phù hợp, 50–64 Tương đối
phù hợp, < 50 Chưa phù hợp. Độ tin cậy giảm khi có tiêu chí thiếu dữ liệu hoặc
số tháng kinh nghiệm chỉ ước lượng từ PDF bố cục đảo.

API `/api/candidate/matching/analyses/` (xem [tài liệu API](../04-api/tai-lieu-api.md)),
cờ `ai_job_match_enabled`. Vector tính sẵn khi CV có phiên bản mới hoặc tin
đang mở được lưu (signal, sau commit). Đo trên máy dev (e5-base, CPU trong
container): chấm một cặp đã có vector khoảng 10 ms, p95 tổng 25 ms; CV vừa sửa
0,5–0,7 s; RAM `ml-worker` 1,7 GB.

Giao diện: thẻ "Xem độ phù hợp" ở cột phải trang chi tiết tin, hộp thoại kết quả (feature `analyze-job-fit`, xem `frontend/ARCHITECTURE.md`).

**Đo lường (20/11, kế hoạch bản 3 GĐ 1).** Lệnh `matching_evaluate` chạy trong
`ml-worker`, chấm các cặp của tập vàng bằng đúng bước trích xuất, mã hóa và
`score_match` ở trên (không ghi DB); `ml/scripts/evaluate.py` tính
chỉ số. Tập vàng có 30 tin × 10 CV (validation 10 tin, test 20 tin; nhãn do Claude
gán theo rubric, đợt 2 do hai lượt độc lập gán với kappa 0,979). Trên validation
(100 cặp, 10 tin):

| Phương án | Spearman | NDCG@5 |
| --- | ---: | ---: |
| TF-IDF | 0,278 | 0,640 |
| BM25 | 0,216 | 0,679 |
| Luật `profile-rule-v2` (bộ gợi ý hiện có) | 0,628 | 0,874 |
| Bi-encoder `e5-base-zs-v1`, cosine toàn văn | 0,550 | 0,758 |
| `hybrid-v1` | 0,603 | 0,815 |
| `hybrid-v2`, bật lại khớp kỹ năng viết khác tên | 0,626 | 0,821 |
| `hybrid-v2`, bỏ hệ số liên quan | 0,692 | 0,857 |
| **`hybrid-v2`** | **0,699** | **0,857** |

Xếp ngẫu nhiên cho NDCG@5 = 0,445 vì mỗi tin chỉ có 10 CV. Bộ gợi ý theo luật
ngang hoặc nhỉnh hơn `hybrid-v1` (khoảng tin cậy chồng nhau): điểm của luật chỉ
gồm số kỹ năng trùng, chức danh khớp tiêu đề tin và số năm, nên cặp khác ngành gần
0 điểm; `hybrid-v1` cộng thêm học vấn, cấp bậc, ngoại ngữ bất kể CV có đúng nghề
hay không, nên cặp khác ngành vẫn lên tới 65 điểm. `hybrid-v2` sửa đúng hai chỗ đó:

| Thang điểm (33 cặp nhãn 0, khác ngành) | Kappa mức hiển thị | Trung vị | Cao nhất | Từ 50 điểm |
| --- | ---: | ---: | ---: | ---: |
| `hybrid-v1` | 0,511 | 28 | 65 | 6 cặp |
| `hybrid-v2`, bật lại khớp kỹ năng viết khác tên | 0,535 | 17 | 57 | 5 cặp |
| `hybrid-v2`, bỏ hệ số liên quan | 0,672 | 27 | 48 | 0 |
| **`hybrid-v2`** | **0,663** | **11** | **46** | **0** |

Tắt khớp kỹ năng viết khác tên đem lại gần hết phần tăng về xếp hạng; hệ số liên quan
đưa điểm cặp khác ngành về gần 0 mà không đổi thứ hạng. Khoảng tin cậy của `hybrid-v2`:
Spearman 0,54 đến 0,82, NDCG@5 0,76 đến 0,94 (10 tin nên còn rộng). Các dòng "bật
lại"/"bỏ" đo bằng `matching_evaluate --ablation` (`evaluate.py --ablation`), tức cùng
mã sản phẩm với một thay đổi bị tắt. Chi tiết ở `ml/reports/eval_validation.md`. Phần
test chỉ chạy một lần ở giai đoạn nghiệm thu.

**Xếp hạng hồ sơ ứng tuyển cho nhà tuyển dụng (25/11).** Cùng bộ máy, khác đầu vào và cách
chạy (`services/application_ranking.py`):

- Chỉ chấm hồ sơ hiện hành mà ứng viên đồng ý (`Application.allow_ai_analysis`), trên bản
  chụp CV đã nộp (`submitted_cv_version`; CV tải lên đọc tệp đã nộp, không đọc tệp hiện tại
  trong thư viện).
- Chạy nền ở queue `ai-matching-batch` trên cùng `ml-worker`: khi hồ sơ được tạo, khi tin đổi
  nội dung (chỉ các hồ sơ chưa có kết quả với nội dung mới), và bằng
  `matching_backfill --only applications`. Kết quả là `MatchAnalysis` với
  `purpose = application_ranking`; ứng viên không xem được bản này.
- Danh sách hồ sơ của NTD lấy điểm bằng truy vấn con (số truy vấn không tăng theo số hồ sơ);
  sắp xếp mặc định vẫn là mới nhất, "Phù hợp nhất" là lựa chọn. Hồ sơ không có điểm luôn kèm
  lý do. Không nơi nào đổi trạng thái hồ sơ theo điểm.

**Tìm CV (25/11).** Nhà tuyển dụng chọn một tin đang tuyển; hệ thống xếp các CV đang bật "cho
phép NTD tìm kiếm" (mỗi ứng viên một CV) theo mức phù hợp (`services/candidate_search.py`):

1. Lọc theo hồ sơ trích xuất (kỹ năng, số tháng kinh nghiệm, học vấn, ngoại ngữ, từ khóa chức
   danh) bằng tra cứu JSON trên `MatchDocument.profile_json`.
2. Lấy 200 CV gần vector của tin nhất bằng pgvector (tìm chính xác).
3. Chấm từng CV bằng `score_match` (`hybrid-v3`, không cross-encoder). Vector đã tính sẵn nên tiến trình web không
   cần mô hình; chỉ truyền chunk chức danh, vì phần so từng câu yêu cầu không ảnh hưởng điểm.
4. Bỏ CV dưới 30 điểm (cặp khác ngành có trung vị 11 điểm), ẩn danh kết quả: hồ sơ qua danh
   sách trắng `domain/profile_view.py` (nội dung từng mục của CV, không email, số điện thoại,
   phần đầu trang, mục "Thông tin thêm"; họ tên trong câu văn bị che), kết quả chấm không kèm
   câu trích.

**Hồ sơ trích xuất để hiển thị (`extract-v4`).** Ngoài các trường dùng để chấm, `profile_json`
có `sections`: nội dung đầy đủ từng mục của CV. `chunks` (đầu vào của bước chấm, tối đa 40 câu)
không đổi nên điểm không đổi. Với PDF tải lên, thứ tự đọc và việc chia mục dựa trên luật
(`apps/cvs/services/pdf_layout.py`, `cv_document.py`, `extraction/cv_upload.py`): tìm khe giữa
hai cột, ghép phần tiếp của một cột qua trang theo vị trí ngang, nhận tiêu đề mục theo bảng từ
khóa (kể cả tiêu đề ngắt hai dòng), coi dòng cùng mục dưới một tiêu đề là nội dung. Giới hạn:
ô quá hẹp khiến tệp ngắt giữa từ, tiêu đề lạ không có trong bảng từ khóa.

Không tìm bằng câu tự do: so ngữ nghĩa một câu truy vấn cần mã hóa nó bằng mô hình, mà tiến
trình web không có mô hình; tin tuyển dụng là "câu truy vấn" đã được mã hóa sẵn. Đo trên DB
dev với 100 CV tổng hợp bật tìm kiếm: một lượt tìm khoảng 0,02–0,06 giây.

**Đợt huấn luyện 26–27/11: `hybrid-v3`, `e5-base-wise-v1`, `req-ce-v1`.** Mã đã có trong
`apps/matching`; cấu hình mặc định của sản phẩm **vẫn là mô hình gốc** `e5-base-zs-v1`, không
cross-encoder. Bật mô hình mới theo [vận hành](../06-deployment/van-hanh-va-kill-switch.md#đối-sánh-cvtin-chạy-local).

Ba thay đổi của công thức `hybrid-v3` so với `hybrid-v2` (`services/scoring/`):

| Thay đổi | Cách làm | Cần mô hình mới |
| --- | --- | --- |
| Nhóm kỹ năng thay thế (`skill_groups.py`) | Các kỹ năng danh mục cùng nằm trong một câu yêu cầu có từ lựa chọn ("hoặc", "một trong", "như", "or", "such as"…) thành một nhóm; CV có một kỹ năng là đạt cả nhóm. 72/100 tin thật có câu dạng này. Điểm kỹ năng tính theo đơn vị (nhóm hoặc kỹ năng lẻ), ghi ở `detail.units` | Không |
| Phán từng yêu cầu bằng cross-encoder (`requirements.py`, `services/reranker.py`) | Mỗi câu yêu cầu loại kỹ năng: bi-encoder chọn 3 câu CV gần nhất, cross-encoder cho xác suất "câu này đáp ứng yêu cầu", lấy cao nhất; tối đa 90 cặp một lượt. Trạng thái `met` / `partial` / `unmet` theo hai ngưỡng của `RERANKER_THRESHOLDS` | `req-ce-v1` |
| Nhận kỹ năng qua câu chứng minh | Kỹ năng tin cần mà CV không ghi theo danh mục: cross-encoder so câu "Có kinh nghiệm làm việc với {tên kỹ năng}." với các câu CV; vượt ngưỡng "đạt" thì tính là có, kèm câu trích. Thay cho khớp gần nghĩa bằng bi-encoder đã tắt ở `hybrid-v2` | `req-ce-v1` |

Độ phủ yêu cầu (trung bình xác suất của các câu yêu cầu) được tính và trả ở `overall.coverage`
nhưng **không** vào điểm: đưa vào mức liên quan làm Spearman giảm 0,822 → 0,802 vì câu yêu
cầu chung chung kéo trung bình xuống. Khóa cache của `MatchAnalysis` là
`scoring_cache_version()`: `hybrid-v3` hoặc `hybrid-v3+req-ce-v1`, nên bật/tắt cross-encoder
không trả nhầm kết quả cũ. `result_json` bản 3 thêm `overall.coverage`, `flags.reranker_used`,
`meta.reranker_version`.

Hai mô hình (script ở `ml/scripts/`, mô hình ở `ml/models/`, không commit):

- **Bi-encoder `e5-base-wise-v1`.** Fine-tune `multilingual-e5-base` bằng
  `CachedMultipleNegativesRankingLoss` hai chiều (tin ↔ CV), 512 token, 3 epoch, 93 phút trên
  MPS, trên 5.936 bộ ba (tin, CV đúng, CV sai khó): 1.436 bộ từ 649 CV tổng hợp neo vào 56 tin
  thật ngoài tập vàng, 3.000 từ VietJobs, 1.500 từ resume-job-description-fit. Bản fine-tune
  (`e5-base-ft-v1`) rồi được **nội suy trọng số** với mô hình gốc (WiSE-FT, 70% fine-tune +
  30% gốc, `interpolate_model.py`): giữ phần tăng trên dữ liệu của đề tài mà ít lệch khỏi mô
  hình gốc hơn. Lượt huấn luyện thứ hai (thêm âm khó khai thác bằng mô hình và bộ ba thứ bậc)
  không hơn nên không dùng.
- **Cross-encoder `req-ce-v1`.** Fine-tune `mmarco-mMiniLMv2-L12-H384-v1` bằng
  `BinaryCrossEntropyLoss`, nhãn 1 / 0,5 / 0, 160 token mỗi cặp, trên 5.473 cặp (câu yêu cầu,
  câu CV) từ 1.070 câu yêu cầu thật; câu đáp ứng và câu gần đáp ứng do mô hình ngôn ngữ chạy
  local (Ollama `qwen2.5:7b`) viết. Kiểm tra rò rỉ "chỉ nhìn câu CV" cho AUC 0,500 trên cặp máy viết.

Chống rò rỉ: 30 tin vàng và 100 CV của tập vàng không có trong huấn luyện; 144 tin VietJobs
giống một tin vàng bị loại; 14 tin của tập hiệu chỉnh và CV neo vào chúng giữ riêng.

Mốc quy đổi và ngưỡng đo trên **tập hiệu chỉnh**: 14 tin ngoài tập vàng, 321 cặp nhãn 0–4
theo rubric (`ml/labeling/calibration_labels.json`), không dùng để huấn luyện. `low` là trung
vị cosine của cặp nhãn 0, `high` là phân vị 90 của cặp nhãn 3–4; hai ngưỡng cross-encoder
(0,853 và 0,063) chọn trên 358 cặp yêu cầu–câu CV thật sao cho precision của "đạt" từ 0,85.

Kết quả trên validation của tập vàng (100 cặp, 10 tin; `ml/reports/eval_validation.md`):

| Cấu hình | Spearman | NDCG@5 | Kappa mức hiển thị | Nhãn 0: trung vị / cao nhất |
| --- | ---: | ---: | ---: | ---: |
| Luật `profile-rule-v2` | 0,628 | 0,874 | – | – |
| `hybrid-v2`, mô hình gốc | 0,698 | 0,857 | 0,663 | 11 / 46 |
| `hybrid-v3`, mô hình gốc (đang chạy) | 0,705 | 0,870 | 0,697 | 13 / 47 |
| `hybrid-v3`, `e5-base-wise-v1` | 0,815 | 0,874 | 0,708 | 6 / 36 |
| **`hybrid-v3`, `e5-base-wise-v1` + `req-ce-v1`** | **0,822** | **0,921** | **0,733** | **6 / 36** |

Hiệu số Spearman của cấu hình cuối so với `hybrid-v3` mô hình gốc là +0,117, khoảng tin cậy
95% theo bootstrap ghép cặp theo tin 0,030 đến 0,212 (không chứa 0). Cặp tin tiếng Anh – CV
tiếng Việt và ngược lại: 0,834. Điểm trung bình tăng dần theo nhãn 0 → 4.

Các phép đo khác:

| Phép đo | Kết quả | Báo cáo |
| --- | --- | --- |
| Tập hiệu chỉnh, 321 cặp | Spearman 0,842, NDCG@5 0,935, kappa 0,83; có hay không cross-encoder gần như nhau vì CV tổng hợp ghi kỹ năng đúng tên danh mục | `eval_calibration.md` |
| Cross-encoder trên 358 cặp thật (phần validation) | AUC đạt so với không đạt 0,956 (cosine của mô hình gốc 0,802; cross-encoder chưa huấn luyện 0,909); precision của "đạt" 0,947, recall 0,562 | `reranker_eval.md` |
| Chuẩn ngoài resume-job-description-fit, 1.759 cặp tiếng Anh | Spearman 0,211 → 0,336, AUC 0,639 → 0,706 | `eval_public.md` |
| Gợi ý việc làm, nhãn yếu | Tin neo ở hạng 1 0,650 → 0,762, MRR 0,776 → 0,867 (luật 0,795), NDCG@10 cùng vị trí 0,832 → 0,913 | `recommendations_e5-base-wise-v1.md` |
| Ngưỡng 30 điểm của gợi ý và Tìm CV | Không cắt cặp khớp mạnh nào; kết quả không liên quan vượt ngưỡng giảm (Tìm CV 741 → 605 lượt) nên giữ nguyên ngưỡng | `score_floor.md` |
| Kiểm chứng nhãn tập vàng | Người chấm mù 50/300 cặp, kappa có trọng số 0,915 so với nhãn của mô hình ngôn ngữ | `label_agreement.md` |

Bộ nhớ và độ trễ (máy dev, CPU trong container): `ml-worker` nạp bi-encoder và cross-encoder
đạt đỉnh 2,05–2,14 GB khi chấm; chỉ bi-encoder 1,48 GB. Chạy được 40 cặp dưới giới hạn
1.792 MB của production mà không bị dừng, nhưng sát trần, nên bật cross-encoder thì nâng
`mem_limit` lên 2.304 MB. Cross-encoder thêm khoảng 0,6 giây mỗi cặp. Tiến trình web không nạp
mô hình: gợi ý việc làm và Tìm CV chỉ đổi theo vector và mốc quy đổi mới; Tìm CV không truyền
câu yêu cầu nên không có cross-encoder và chưa dùng nhóm kỹ năng thay thế.

Chặn cấu hình sai: phiên bản mô hình chưa có mốc trong `CALIBRATIONS` hoặc cross-encoder chưa
có ngưỡng thì `manage.py check` báo lỗi (`apps/matching/checks.py`); lúc nạp, `model_card.json`
trong thư mục mô hình phải ghi đúng `MATCHING_MODEL_VERSION`, sai thì dừng. Trước đây đổi đường
dẫn mà quên đổi phiên bản sẽ lưu vector mới dưới tên mô hình cũ.

Giới hạn phải nêu khi báo cáo: nhãn của tập vàng, tập hiệu chỉnh và cặp yêu cầu–câu CV do mô
hình ngôn ngữ gán (có 50 cặp người chấm đối chiếu); CV đánh giá và CV huấn luyện do cùng một
mô hình sinh viết nên số trên tập vàng có thể lạc quan (vì vậy có chuẩn ngoài); ở chuẩn ngoài,
CV của phần test xuất hiện trong phần train (tin thì không); validation chỉ có 10 tin nên
khoảng tin cậy rộng; tiêu chí học vấn gần như không mang tín hiệu (Spearman −0,04).

Chưa làm: chạy tập test một lần (27/12/2026, `evaluate.py --split test --final`); lượt huấn
luyện chỉ dùng dữ liệu công khai để tách phần đóng góp của CV tổng hợp; lượt gán nhãn thứ hai
cho tập hiệu chỉnh; Tìm CV dùng nhóm kỹ năng thay thế.

## Việc còn mở

- Import CV đã dùng runtime `ai_core` (hard switch, invocation log); còn thiếu quota
  theo người dùng ngoài throttle `cv_import`.
- Chưa có trích xuất kỹ năng tự động vào `CvSkill` và OCR cho PDF scan. Hai Site Setting không có code đọc
  (`ai_cv_review_enabled`, `ai_daily_request_limit`) đã được gỡ theo ADR-0026.
- Đối sánh ngữ nghĩa (mục 7) đang chạy bằng mô hình gốc; hai mô hình đã huấn luyện
  (`e5-base-wise-v1`, `req-ce-v1`) chưa bật trong cấu hình mặc định và tập test chưa chạy.
