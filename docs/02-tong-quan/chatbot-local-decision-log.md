# Biên bản quyết định — Chatbot AI local (ứng viên)

> Tài liệu sống: mỗi quyết định đã xác nhận được ghi ngày, phạm vi và hệ quả.
> Đặc tả triển khai: [ke-hoach-chatbot-ung-vien-faq.md](../03-database/ke-hoach-chatbot-ung-vien-faq.md)
> Nguồn kiến thức: [ke-hoach-faq-huong-dan.md](../03-database/ke-hoach-faq-huong-dan.md) (KB-P6 hoàn tất)

## Nguyên tắc nền (đã khẳng định qua FAQ)

1. Chatbot **không** phụ thuộc cloud LLM (OpenAI / Gemini / Anthropic) cho MVP.
2. Help Center/FAQ chạy độc lập khi Ollama hoặc chatbot tắt.
3. Nguồn chuẩn duy nhất cho câu trả lời FAQ: revision **approved + published**.
4. App chatbot không deep-import nội bộ knowledgebase; chỉ dùng re-export service.
5. Embedding local đã định hướng: **`qwen3-embedding:0.6b` qua Ollama**, vector
   trên **PostgreSQL/pgvector** (phase KB-AI / CB-P1).

---

## Session 2026-08-06 — Chatbot candidate FAQ (CB-P0)

### Bối cảnh

- UI `widgets/candidate-assistant` đã có launcher/panel/mascot/TTS và kịch bản
  keyword tĩnh.
- Knowledgebase public đã ship; epic FAQ không gồm chatbot.
- Cần kế hoạch module chatbot **chỉ ứng viên**, liên quan **tìm việc / FAQ**.

### Quyết định đã xác nhận với chủ dự án

| # | Hạng mục | Quyết định |
| --- | --- | --- |
| D1 | Chiến lược MVP | **Retrieval FAQ** — không generate bằng LLM |
| D2 | Phạm vi nội dung | Chỉ tìm việc / ứng tuyển (+ tìm việc an toàn trong allowlist) |
| D3 | Semantic retrieval | **pgvector + qwen3-embedding (Ollama)** |
| D4 | Đối tượng dùng | Khách + ứng viên (`AllowAny` + rate limit) |
| D5 | Lịch sử chat | **Không lưu server** — chỉ state panel UI |
| D6 | Bước đầu | Viết đặc tả docs (**CB-P0**) trước khi code |

### Hệ quả kỹ thuật

- Phase 1 không gọi cloud API; không thêm SDK OpenAI.
- Câu trả lời = excerpt/chunk đã duyệt + URL `/tro-giup/...`.
- Fallback: lexical `search_q` → kịch bản tĩnh khi Ollama/index miss.
- Transcript/analytics raw query: **out of scope** (privacy).
- Category whitelist MVP:
  - `tim-viec-va-goi-y-viec-lam`
  - `ung-tuyen-va-theo-doi-ho-so`
  - `tim-viec-an-toan`
- CV, tài khoản, bảo mật, liên hệ: **chưa** retrieve trong MVP.

### Việc làm tiếp theo

1. Review/merge đặc tả CB-P0.
2. **CB-P1**: chunk + embed + reindex (chưa bắt buộc đổi UI).
3. **CB-P2**: endpoint ask + nối `candidate-assistant`.
4. **CB-P3**: readiness, runbook, benchmark ngưỡng điểm.

### Chưa chốt (mở cho CB-P1)

- Dimension vector chính xác của model pin (đo khi pull Ollama).
- Ollama trong Docker Compose vs cài host dev.
- Ngưỡng `CHATBOT_SEMANTIC_MIN_SCORE` (cần 15–20 câu benchmark).
- Image Postgres: chuyển hẳn `pgvector/pgvector:pg16` hay cài extension tay.

---

## Lịch sử tham chiếu

| Ngày | Nội dung |
| --- | --- |
| 2026-08-05 | FAQ chốt hợp đồng KB-AI: chunk/embed/pgvector/Ollama; chatbot sau KB-P6 |
| 2026-08-06 | CB-P0: retrieval-only, allowlist tìm việc, no server history, docs-first |
