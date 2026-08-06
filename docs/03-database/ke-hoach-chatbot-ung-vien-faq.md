# Đặc tả chatbot ứng viên — FAQ tìm việc (retrieval)

> Trạng thái: **CB-P0 — Đặc tả đã chốt hướng triển khai**
>
> Phạm vi ưu tiên: **Cổng ứng viên / public MainLayout; chỉ FAQ tìm việc & ứng tuyển**
>
> Ngày lập: **2026-08-06**
>
> Phiên bản quyết định: **1.0**
>
> Nguồn nền: [FAQ/hướng dẫn](ke-hoach-faq-huong-dan.md) (KB-P0…KB-P6 **đã hoàn tất**),
> [hợp đồng nâng cấp chatbot/RAG — mục 20](ke-hoach-faq-huong-dan.md#20-hợp-đồng-nâng-cấp-sang-chatbotrag),
> UI sẵn có `widgets/candidate-assistant`
>
> Biên bản quyết định session: [chatbot-local-decision-log.md](../02-tong-quan/chatbot-local-decision-log.md)

Tài liệu này mở epic **chatbot ứng viên** sau khi Help Center/FAQ đã có nguồn
kiến thức đã kiểm duyệt. Mục tiêu release đầu: **trả lời bằng retrieval** từ
FAQ publish (semantic search), **không** sinh câu trả lời tự do bằng LLM.

---

## 1. Hiện trạng (đã có)

| Thành phần | Trạng thái |
| --- | --- |
| Help Center public `/tro-giup` | Đã ship (`apps.knowledgebase`, KB-P0…P6) |
| Public search FAQ | `search_q` (unaccent) trên title/body publish |
| UI trợ lý | `widgets/candidate-assistant` (launcher, panel, mascot, progressive text, TTS) |
| Logic trả lời | Kịch bản keyword tĩnh trong `model/assistant-script.js` — **chưa gọi API** |
| Architecture note | Panel lazy-load; phase 1 hiện tại “không gọi API chatbot” (cần cập nhật khi ship CB-P2) |
| Embedding / pgvector / Ollama | **Chưa có** trong repo |
| App `chatbot` backend | **Chưa có** |

### 1.1. Nguồn FAQ liên quan tìm việc (scope MVP)

Whitelist category slug (seed knowledgebase):

| Slug | Tên | Lý do thuộc MVP |
| --- | --- | --- |
| `tim-viec-va-goi-y-viec-lam` | Tìm việc và gợi ý việc làm | Core tìm việc |
| `ung-tuyen-va-theo-doi-ho-so` | Ứng tuyển và theo dõi hồ sơ | Core ứng tuyển |
| `tim-viec-an-toan` | Tìm việc an toàn | An toàn khi tìm việc |

**Ngoài whitelist MVP (không retrieve):**

- `tai-khoan-va-dang-nhap`
- `bao-mat-va-quyen-rieng`
- `cv-va-mau-cv`
- `lien-he-ho-tro` — vẫn có thể gợi ý CTA Zalo/hotline khi fallback, nhưng không
  embed/retrieve body category này trong MVP

Mở rộng whitelist sau phải cập nhật doc + env/setting allowlist + reindex nếu cần.

---

## 2. Mục tiêu MVP

1. Ứng viên (và khách chưa đăng nhập) hỏi bằng ngôn ngữ tự nhiên về **tìm việc /
   ứng tuyển / tìm việc an toàn**.
2. Backend **truy xuất** đoạn FAQ đã publish phù hợp nhất (semantic), trả:
   - câu trả lời ngắn ghép từ chunk/excerpt đã kiểm duyệt;
   - 1–3 nguồn (title + URL canonical `/tro-giup/...`);
   - quick actions điều hướng (Việc làm, Việc đã lưu, …) khi phù hợp.
3. **Không** gọi cloud LLM; **không** sinh nội dung ngoài corpus FAQ.
4. **Không** lưu transcript hội thoại trên server.
5. Khi Ollama/index lỗi hoặc không đủ điểm: fail-closed sang
   `search_q` lexical (cùng whitelist) → rồi kịch bản tĩnh/fallback CTA.
6. Help Center vẫn chạy độc lập khi chatbot tắt.

### 2.1. Ngoài phạm vi MVP

- LLM generate / tool-calling / multi-turn agent.
- Chat cho nhà tuyển dụng hoặc admin.
- Cá nhân hóa theo CV, matching score, lịch sử ứng tuyển.
- Lưu chat history, analytics query thô chứa PII.
- Live chat / ticket support.
- RAG sinh câu mới ngoài excerpt chunk.
- Deep-link “apply hộ” hoặc thao tác ghi (mutate) từ chatbot.

---

## 3. Quyết định công nghệ đã chốt (session 2026-08-06)

| Hạng mục | Quyết định | Ghi chú |
| --- | --- | --- |
| Chiến lược trả lời | **Retrieval FAQ** (không generate) | An toàn, bám nội dung đã duyệt |
| Semantic index | **pgvector** trên PostgreSQL hiện tại | Vector cùng DB, không service search riêng |
| Embedding model | **`qwen3-embedding:0.6b` qua Ollama** (local) | Khớp hợp đồng FAQ mục 20 |
| Lexical fallback | `common.db.search.search_q` | Khi Ollama down hoặc điểm thấp |
| UI | Giữ `widgets/candidate-assistant` | Thay script tĩnh bằng hook gọi API |
| Backend app | `apps.chatbot` trong monolith | ADR-0010; không microservice |
| Nguồn kiến thức | Chỉ revision **APPROVED + published** + category active | Re-export từ `knowledgebase.services` |
| Auth | `AllowAny` + throttle IP | Khách + ứng viên |
| Transcript | Chỉ memory UI (session panel) | Không bảng chat message |
| TTS | Giữ `useAssistantVoice` hiện có | Đọc text trả về (đã có) |

### 3.1. Vì sao không generate LLM ở MVP

- FAQ đã là câu trả lời đã review; generate dễ lệch quy trình/UI thật.
- Đồ án ưu tiên local, kiểm soát chi phí và không phụ thuộc API key.
- Retrieval + cite source đủ cho use case “hướng dẫn tìm việc”.
- Phase sau (CB-AI-gen) mới cân nhắc LLM local nếu retrieval không đủ.

### 3.2. Stack chi tiết đề xuất

```text
Browser (candidate-assistant)
    POST /api/chatbot/candidate/ask/
Django apps.chatbot (api → services)
    ├─ embed query → Ollama /api/embeddings (qwen3-embedding:0.6b)
    ├─ vector search KnowledgeChunk (pgvector) — filter category whitelist
    ├─ fallback search_q public articles (cùng whitelist)
    └─ compose AnswerDTO (text + sources + actions)
PostgreSQL 16 + pgvector
Ollama (dev: docker/service local; optional prod)
Celery: reindex chunk khi publish/rollback/archive FAQ
```

**Dependencies mới (backend):**

- extension PostgreSQL `vector` (image/dev setup)
- Python: `pgvector` (Django field) hoặc raw SQL có kiểm soát
- HTTP client gọi Ollama (có thể dùng `requests` sẵn có)
- **Không** thêm OpenAI SDK

**Ollama:**

- Model: `qwen3-embedding:0.6b` (hoặc tag pin cụ thể trong settings)
- Timeout ngắn; single-flight embed nếu cần
- Capability switch: `CHATBOT_CANDIDATE_ENABLED`, `CHATBOT_EMBEDDING_ENABLED`

---

## 4. Kiến trúc & ranh giới layer

### 4.1. Backend (ADR-0010)

```text
apps/chatbot/
  api/{views,serializers}/
  models/          # KnowledgeChunk (hoặc đặt chunk trong knowledgebase — xem 4.2)
  services/        # ask, embed client, compose answer
  selectors/       # vector retrieve (read)
  tasks/           # reindex idempotent
  tests/
  urls.py
```

**Cross-app contract (bắt buộc):**

- `chatbot` **không** deep-import `knowledgebase.models` / selectors nội bộ.
- `knowledgebase.services.__init__` re-export hàm public read cho index:
  - list published articles in category slugs
  - get published body plain text + metadata (title, slugs, content_hash, public_id)
  - hook/signal-friendly: sau publish/rollback/archive gọi task reindex
- Chunk gắn `revision_public_id` + `content_hash` + `embedding_model` +
  `chunk_algo_version` để rebuild/dedupe.

### 4.2. Ownership model chunk

**Khuyến nghị (chốt trong CB-P0):** model `KnowledgeChunk` nằm trong
**`apps.knowledgebase`** (domain kiến thức), còn **`apps.chatbot`** chỉ:

- gọi service re-export để đọc chunk/search;
- sở hữu endpoint ask, throttle, compose answer, kill switch chatbot.

Lý do: chunk là dẫn xuất của revision FAQ; reindex theo lifecycle publish thuộc
knowledgebase. Chatbot là “consumer + UX API”.

Nếu implementation thấy coupling ngược, có thể đảo — nhưng phải cập nhật doc
trước khi code lệch.

### 4.3. Frontend (FSD)

```text
widgets/candidate-assistant     # UI panel, mascot, voice (giữ)
  → features/ask-candidate-assistant   # send message, map DTO → messages
  → entities/chatbot                   # API client, types, query keys
  → entities/knowledgebase             # (tuỳ chọn) deep-link helper /tro-giup
```

- Widget **không** gọi Axios trực tiếp; qua feature/entity.
- Giữ script tĩnh làm **offline/fallback client** khi API 503 hoặc capability off.
- Cập nhật `frontend/ARCHITECTURE.md` ownership map khi CB-P2 merge.

---

## 5. Hợp đồng dữ liệu

### 5.1. KnowledgeChunk (dẫn xuất)

| Trường | Ý nghĩa |
| --- | --- |
| `public_id` | opaque id chunk |
| `article_public_id` | article ổn định |
| `revision_public_id` | revision đang (hoặc đã) index |
| `category_slug` | denormalize để filter nhanh |
| `chunk_index` | thứ tự trong article |
| `text` | plain text chunk (đã strip HTML) |
| `token_estimate` | ước lượng độ dài |
| `content_hash` | hash text chunk hoặc revision |
| `embedding` | vector (dimension theo model — ghi rõ khi pin model) |
| `embedding_model` | vd. `qwen3-embedding:0.6b` |
| `chunk_algo_version` | vd. `faq-chunk-v1` |
| `is_active` | false khi archive/unpublish |
| `indexed_at` | thời điểm embed |

**Chunking MVP (`faq-chunk-v1`):**

- Nguồn: `body_plain_text` (+ title prepend vào chunk 0).
- Tách theo đoạn/`\n\n` / heading; gộp đoạn ngắn; max ~400–600 ký tự/chunk;
  overlap ~40–80 ký tự nếu cắt cứng.
- Bỏ chunk rỗng / chỉ whitespace.
- Chỉ index article thuộc whitelist category + active + published approved.

### 5.2. API ask (đề xuất)

`POST /api/chatbot/candidate/ask/`

**Auth:** AllowAny  
**Throttle:** IP scope riêng, khởi điểm đề xuất `30/min` (chặt hơn public KB vì
có gọi embed).

Request:

```json
{
  "message": "Làm sao để lưu việc làm?",
  "locale": "vi"
}
```

- `message`: trim, min 2, max 500 ký tự.
- Không nhận history multi-turn trong MVP (mỗi lượt độc lập).
- Không log raw message; chỉ length bucket + latency + hit/miss.

Response 200:

```json
{
  "answer_text": "Bạn bấm biểu tượng trái tim hoặc nút Lưu tin…",
  "emotion": "happy",
  "mode": "semantic",
  "sources": [
    {
      "title": "Tìm kiếm, lưu và xem việc làm phù hợp",
      "url": "/tro-giup/tim-viec-va-goi-y-viec-lam/tim-kiem-luu-va-xem-viec-lam-phu-hop",
      "category_slug": "tim-viec-va-goi-y-viec-lam",
      "score": 0.82
    }
  ],
  "actions": ["savedJobs", "findJobs"],
  "disclaimer": null
}
```

`mode`: `semantic` | `lexical` | `fallback`

Khi không khớp:

```json
{
  "answer_text": "Mình chưa tìm thấy hướng dẫn đủ sát…",
  "emotion": "thinking",
  "mode": "fallback",
  "sources": [],
  "actions": ["findJobs", "openHelp"],
  "disclaimer": "Câu trả lời mẫu / gợi ý nhanh"
}
```

Thêm action id `openHelp` → `/tro-giup` (bổ sung `ASSISTANT_ACTIONS`).

### 5.3. Capability / site settings

Backend settings:

| Setting | Mặc định dev | Mặc định prod đề xuất |
| --- | --- | --- |
| `CHATBOT_CANDIDATE_ENABLED` | true sau CB-P2 | false tới readiness |
| `CHATBOT_EMBEDDING_ENABLED` | true nếu Ollama up | false nếu chưa có Ollama |
| `CHATBOT_CATEGORY_ALLOWLIST` | 3 slug ở mục 1.1 | same |
| `CHATBOT_SEMANTIC_MIN_SCORE` | TBD sau benchmark | pin sau CB-P1 |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | internal URL |
| `CHATBOT_EMBEDDING_MODEL` | `qwen3-embedding:0.6b` | pin revision |

Public site-settings capability:

- `chatbot_candidate_enabled` — frontend ẩn/disable input API path nếu false,
  quay script tĩnh.

Kill switch tắt chatbot **không** tắt Help Center.

---

## 6. Luồng xử lý ask (service)

```text
1. Validate message + kill switch
2. Nếu CHATBOT_EMBEDDING_ENABLED:
     embed(message) → vector search top_k=5, filter allowlist + is_active
     nếu best_score >= MIN_SCORE → compose từ top chunks (cùng article gộp)
3. Else / miss:
     lexical public_articles_queryset(q=message, categories=allowlist) top 3
     nếu có hit → compose excerpt title + đoạn đầu body_plain
4. Else:
     fallback canned (map keyword nhẹ hoặc DEFAULT_REPLY) + actions help/jobs
5. Map actions heuristic (keyword/category → ASSISTANT_ACTIONS ids)
6. Metrics PII-free; return DTO
```

**Compose answer (không LLM):**

- Ưu tiên 1–2 câu từ chunk điểm cao nhất (cắt an toàn độ dài UI ~400–600 ký tự).
- Luôn kèm ít nhất một source URL khi mode ≠ fallback.
- Không trả HTML thô; plain text + link riêng trong `sources`.
- Không lộ `source_reference`, review note, actor admin.

---

## 7. Reindex lifecycle

| Sự kiện knowledgebase | Hành vi index |
| --- | --- |
| publish revision mới | Celery task: deactivate chunk revision cũ, chunk+embed revision mới |
| rollback | tương tự theo revision được publish lại |
| archive / category deactivate | `is_active=false` mọi chunk article |
| restore + publish | reindex |
| đổi allowlist | command rebuild filter; chunk ngoài list `is_active=false` |

Task **idempotent** theo `(revision_public_id, chunk_algo_version, embedding_model)`.
Lỗi embed **không** rollback publish FAQ; đánh dấu article “index stale” qua
metric/log, retry có backoff.

Management commands:

- `rebuild_chatbot_faq_index --categories=... --force`
- `check_chatbot_readiness --json` (Ollama ping, chunk count, allowlist coverage)

---

## 8. Bảo mật & privacy

- Throttle IP; payload size limit.
- Sanitize/normalize input; chống prompt injection **không** phải priority vì
  không generate — nhưng vẫn không đưa raw message vào log.
- Không truy cập DB hồ sơ/CV/ứng tuyển từ chatbot MVP.
- CORS/CSRF theo policy API public hiện có (JWT optional, không bắt buộc).
- Production: Ollama không expose public internet; chỉ backend gọi internal.
- Rate limit chặt hơn nếu embed tốn CPU.

---

## 9. UX trên UI hiện có

Giữ nguyên:

- Launcher + greeting bubble + lazy `AssistantPanel`
- Mascot emotion / talking
- Progressive reply + TTS (`useAssistantVoice`)
- Quick actions

Thay đổi:

| Hạng mục | Hành vi mới |
| --- | --- |
| Gửi tin | `features/ask-candidate-assistant` → API; typing state theo request |
| Nguồn | Bubble bot hiển thị link “Xem hướng dẫn” tới `/tro-giup/...` |
| Mode fallback | Badge/text nhẹ “Gợi ý nhanh” (không hứa AI) khi `mode=fallback` |
| Capability off | Script tĩnh như hiện tại; không spam lỗi |
| Lỗi mạng | Toast ngắn + fallback script 1 lần |
| Welcome | Có thể thêm chip: “Tìm việc”, “Ứng tuyển”, “Lưu tin”, “Tìm việc an toàn” |

**Không** mở panel trên employer/admin layout; chỉ `MainLayout` như hiện tại.

---

## 10. Lộ trình triển khai (phase nhỏ, review độc lập)

| Phase | Kết quả bàn giao | Điều kiện qua phase |
| --- | --- | --- |
| **CB-P0** | Đặc tả này + decision log; chốt scope/tech/API/UI | **Đang làm — doc merge** |
| **CB-P1** | pgvector + `KnowledgeChunk` + chunker + Ollama embed client + reindex task + command rebuild; **chưa** đổi UI | pytest index/retrieve; Ollama optional skip trong CI nếu không có service |
| **CB-P2** | `POST /api/chatbot/candidate/ask/` + kill switch + throttle + metrics; wire `candidate-assistant` + entity/feature; fallback chain | unit/integration + Vitest panel; E2E smoke 1 luồng hỏi FAQ |
| **CB-P3** | Hardening: readiness command, runbook, score threshold từ benchmark, bundle/architecture update, content coverage whitelist | `check_chatbot_readiness`; rollout/rollback rehearsal |
| **CB-AI-gen** (sau) | Tùy chọn: LLM local tóm tắt multi-chunk | Chỉ khi retrieval đo được hạn chế thực tế |

Mỗi phase một (hoặc vài) PR nhỏ; không gộp P1+P2 nếu diff quá lớn.

### 10.1. Việc làm ngay sau khi merge CB-P0

1. Xác nhận dimension vector của `qwen3-embedding:0.6b` trên máy dev (pin vào settings).
2. Chọn image Postgres: `pgvector/pgvector:pg16` hoặc cài extension trên image hiện tại.
3. Thêm service `ollama` (optional profile) vào `docker-compose.yml` **hoặc**
   document chạy Ollama host — quyết định trong CB-P1 PR description.
4. Seed/đảm bảo ≥1 bài publish mỗi category whitelist (đã có từ KB-P5).

---

## 11. Kiểm thử bắt buộc

### Backend

- Chunker deterministic + content_hash.
- Chỉ index article public đúng whitelist.
- Publish → task tạo chunk; archive → inactive.
- Vector search trả đúng thứ tự khi fixture embedding cố định (mock embed).
- Ask: semantic / lexical / fallback; throttle; kill switch.
- Không rò field admin/internal.
- Query budget endpoint ask (số query phẳng).

### Frontend

- Hook gửi API map sources/actions.
- Capability off → script tĩnh.
- Lỗi 429/503 → fallback không crash.
- E2E: mở assistant → hỏi “làm sao lưu việc” → thấy link `/tro-giup/...` (mock API nếu cần ổn định CI).

### CI

- Unit test mock Ollama (không bắt buộc Ollama trên GitHub runner ở P1).
- Optional job có Ollama khi self-hosted sau này.

---

## 12. Observability

Metrics/label PII-free:

- `chatbot_ask_total{mode,status}`
- `chatbot_ask_latency_ms`
- `chatbot_embed_latency_ms` / `chatbot_embed_errors`
- `chatbot_index_chunks_active`
- `chatbot_index_stale_articles`

Không dùng raw `message` làm label.

---

## 13. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Ollama nặng RAM trên máy dev | Profile compose optional; lexical fallback |
| Embedding quality tiếng Việt yếu | Benchmark 20 câu hỏi thật; chỉnh chunk/threshold |
| Trả lời lạc category | Whitelist chặt + min score |
| Index lệch sau publish | Task + readiness + metric stale |
| Abuse embed | Throttle 30/min + max length |
| User kỳ vọng “AI chat tự do” | Copy UX: trợ lý FAQ tìm việc; cite source |

---

## 14. Definition of Done — CB-P0

- [x] Đặc tả phạm vi, tech, API, phase, security
- [x] Decision log cập nhật quyết định session
- [x] Liên kết từ `docs/README.md`
- [ ] Review chủ dự án: confirm whitelist 3 category + không generate LLM
- [ ] Sau approve: mở CB-P1 (infra index), không code UI trước khi index ổn

---

## 15. Phụ lục — map quick action hiện có

Giữ ids trong `ASSISTANT_ACTIONS`; bổ sung:

| id | label | to / kind |
| --- | --- | --- |
| `openHelp` | Trung tâm trợ giúp | `/tro-giup` |
| `safeJobHelp` | Tìm việc an toàn | `/tro-giup/tim-viec-an-toan` (hoặc bài cụ thể) |

Heuristic map category → actions (gợi ý):

- `tim-viec-va-goi-y-viec-lam` → `findJobs`, `matchingJobs`, `savedJobs`
- `ung-tuyen-va-theo-doi-ho-so` → `findJobs`, `profile` / applied jobs nếu đã có route action
- `tim-viec-an-toan` → `safeJobHelp`, `openHelp`

---

## 16. Tham chiếu code hiện tại

- UI: `frontend/src/widgets/candidate-assistant/`
- Script tĩnh: `.../model/assistant-script.js`, `use-assistant-script.js`
- Layout mount: `frontend/src/app/layouts/MainLayout.jsx`
- KB public read: `backend/apps/knowledgebase/selectors/public.py`
- KB contract chatbot: FAQ doc mục 20
- Architecture: `frontend/ARCHITECTURE.md` (ownership mascot/assistant)
