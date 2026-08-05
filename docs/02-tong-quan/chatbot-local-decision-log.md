# Biên bản quyết định chatbot local

> Trạng thái: đang phân tích, chưa triển khai và chưa thay đổi mã nguồn.
>
> Ngày xác nhận: 2026-08-05.

Tài liệu này ghi lại từng quyết định đã được chủ dự án xác nhận. Mỗi quyết định
mới chỉ được bổ sung sau khi đã thảo luận và xác nhận rõ ràng.

Phần FAQ/hướng dẫn đã được tách thành
[đặc tả chức năng riêng](../03-database/ke-hoach-faq-huong-dan.md) để triển khai
và kiểm duyệt độc lập trước khi tích hợp RAG/chatbot. Đặc tả FAQ phiên bản 1.0
đã hoàn tất `KB-P0` ngày 2026-08-05; nếu biên bản này mô tả field FAQ ở mức cũ,
đặc tả riêng là nguồn chuẩn chi tiết hơn.

## Những quyết định đã chốt

### 1. Phạm vi hạ tầng AI

- Mô hình AI chạy hoàn toàn trên máy local.
- Không gọi dịch vụ AI cloud và không sử dụng API key của OpenAI, Gemini,
  Anthropic hoặc nhà cung cấp tương tự.
- Django được phép giao tiếp với tiến trình mô hình trên cùng máy qua
  `localhost`.
- Dữ liệu CV và nội dung hội thoại không được gửi ra Internet trong quá trình
  suy luận.

### 2. Phạm vi MVP

- Chatbot MVP chỉ phục vụ cổng ứng viên.
- Các nhóm nhu cầu ban đầu gồm: hướng dẫn sử dụng hệ thống, tìm việc, tạo CV và
  hướng dẫn quy trình ứng tuyển.
- MVP chỉ đọc và hướng dẫn; chatbot chưa tự sửa dữ liệu, chưa tự lưu việc và
  chưa tự nộp hồ sơ.
- Chatbot cho nhà tuyển dụng và quản trị viên nằm ngoài phạm vi MVP.

### 3. Bộ máy chạy mô hình

- Sử dụng Ollama chạy native trên macOS.
- Ollama chạy thành một tiến trình local độc lập với Django.
- Không chạy Ollama trong Docker trên máy Mac hiện tại.
- Không tạo repository hoặc project chatbot riêng ở giai đoạn này.

### 4. Mô hình nền

- Mô hình chuẩn để bắt đầu đánh giá là `qwen3.5:9b`.
- Chỉ xem xét hạ xuống `qwen3.5:4b` nếu benchmark thực tế chứng minh bản 9B gây
  thiếu bộ nhớ hoặc có độ trễ không chấp nhận được trên máy hiện tại.

### 5. Kho kiến thức dành cho ứng viên

- Dự án sẽ xây mới một kho kiến thức dành cho ứng viên, gồm FAQ và hướng dẫn
  sử dụng hệ thống.
- Chatbot chỉ được đọc những nội dung đã qua kiểm duyệt và được đánh dấu là đã
  duyệt.
- Kịch bản trả lời mẫu hiện có ở frontend và tài liệu kỹ thuật nội bộ không được
  mặc nhiên xem là nguồn kiến thức đã kiểm duyệt.
- Django app sở hữu dữ liệu, quy trình duyệt và cấu trúc model sau đó đã được
  chốt trong đặc tả FAQ riêng.

### 6. Nguồn dữ liệu gốc của kho kiến thức

- FAQ và hướng dẫn sử dụng được lưu trong database của Django; database là
  nguồn nội dung gốc duy nhất.
- Không dùng file Markdown/JSON trong repository làm nguồn nội dung chính thức.
- Embedding và chỉ mục tìm kiếm, nếu được bổ sung về sau, là dữ liệu dẫn xuất
  từ các nội dung đã duyệt và phải có khả năng tạo lại.
- Cấu trúc model và quy trình kiểm duyệt sau đó đã được chốt trong đặc tả FAQ.

### 7. Module sở hữu kho kiến thức

- Tạo Django app `knowledgebase` trong backend hiện tại để sở hữu FAQ và hướng
  dẫn sử dụng.
- `knowledgebase` là một module của Django monolith hiện tại, không phải
  repository, project triển khai hay service chạy độc lập.
- App phải tuân theo layout backend của ADR-0010:
  `api/{views,serializers}/`, `models/`, `services/`, `selectors/`, `tasks/`,
  `tests/` và `urls.py`.
- Phần chatbot về sau chỉ đọc nội dung đã duyệt thông qua public interface của
  `knowledgebase`, không truy cập sâu vào cấu trúc nội bộ của app.

### 8. Mô hình nội dung cơ sở

- FAQ và hướng dẫn sử dụng dùng chung một model tên `KnowledgeArticle`.
- Model có loại nội dung để phân biệt ít nhất `FAQ` và `GUIDE`.
- Hai loại nội dung dùng chung cơ chế kiểm duyệt, xuất bản và tạo dữ liệu tìm
  kiếm/embedding.
- Không tạo hai hệ thống model và quy trình riêng biệt cho FAQ và hướng dẫn.
- Danh sách trường cụ thể và quy trình trạng thái được khóa tại `KB-P0` trong
  đặc tả FAQ riêng.

### 9. Quản lý phiên bản nội dung

- `KnowledgeArticle` giữ danh tính ổn định và metadata chung của một bài viết.
- `KnowledgeArticleRevision` lưu từng phiên bản nội dung của bài viết.
- Khi tạo hoặc chỉnh sửa một revision mới, revision đang xuất bản vẫn tiếp tục
  phục vụ người dùng và chatbot cho tới khi bản mới được duyệt và xuất bản.
- Chatbot không được đọc revision nháp hoặc revision đang chờ duyệt.
- `KnowledgeArticleRevision` là model hỗ trợ lịch sử phiên bản, không phải một
  loại nội dung độc lập bên cạnh FAQ và hướng dẫn.
- Quyền chuyển trạng thái sau đó đã được chốt tại mục 11 và đặc tả FAQ.

### 10. Quy trình kiểm duyệt và xuất bản

- Revision đi theo luồng `DRAFT` → `IN_REVIEW` → `APPROVED` hoặc `REJECTED`.
- Chỉ revision có trạng thái `APPROVED` mới đủ điều kiện được xuất bản.
- Revision đã duyệt không được sửa trực tiếp; mọi thay đổi phải tạo revision
  mới để giữ lịch sử và phải đi qua kiểm duyệt lại.
- Thao tác xuất bản chọn một revision đã duyệt làm revision hiện hành của
  `KnowledgeArticle`.
- `KnowledgeArticle` có thể được chuyển sang `ARCHIVED` để ngừng hiển thị và
  ngừng cung cấp cho chatbot.
- Chatbot chỉ đọc revision hiện đang được xuất bản của article chưa bị lưu trữ.
- Quyền tạo, gửi duyệt, duyệt, từ chối, xuất bản và lưu trữ được tách theo hệ
  thống RBAC như quyết định tiếp theo.

### 11. Phân quyền quản lý kho kiến thức

- Tái sử dụng hệ thống RBAC hiện có của cổng quản trị, không tạo cơ chế phân
  quyền riêng cho `knowledgebase`.
- Sử dụng bốn permission:
  - `knowledgebase.view`: xem nội dung và lịch sử phiên bản;
  - `knowledgebase.manage`: tạo article, tạo/sửa nháp và gửi duyệt;
  - `knowledgebase.review`: duyệt hoặc từ chối revision;
  - `knowledgebase.publish`: publish/rollback revision đã duyệt, archive/restore
    article và đổi trạng thái public của category.
- Chỉ tài khoản thuộc cổng quản trị mới có thể được cấp các quyền trên; ứng viên
  và nhà tuyển dụng không được truy cập API quản trị kho kiến thức.
- Trong giai đoạn chạy local, một tài khoản admin có thể được cấp cả bốn quyền.
  Thiết kế vẫn cho phép tách vai trò biên tập, kiểm duyệt và xuất bản về sau.
- Role mặc định thuộc department `content-cv`: staff có `view/manage`, manager
  có cả `view/manage/review/publish`.

### 12. Trường dữ liệu của `KnowledgeArticle`

- `KnowledgeArticle` chỉ giữ danh tính, metadata ổn định, trạng thái vòng đời và
  revision hiện hành; không lưu trực tiếp tiêu đề hoặc nội dung bài viết.
- Các trường đã chốt:
  - `public_id`: ID public ổn định prefix `kba`, sinh bằng helper chung của dự
    án; không lộ database PK;
  - `category`: đúng một `KnowledgeCategory`, dùng `PROTECT`;
  - `slug`: unique trong category; category/slug/type khóa sau lần publish đầu;
  - `article_type`: loại nội dung `FAQ` hoặc `GUIDE`;
  - `order`: thứ tự trong category;
  - `lifecycle_state`: trạng thái đang hoạt động hoặc `ARCHIVED`;
  - `published_revision`: revision hiện đang xuất bản, được phép để trống;
  - `revision_token`: khóa phiên bản để phát hiện cập nhật đồng thời và tránh
    quản trị viên ghi đè thay đổi của nhau;
  - `review_due_at`: hạn xác minh lại nội dung;
  - `created_by`, `archived_by`;
  - `created_at`, `updated_at`, `first_published_at`, `current_published_at`,
    `archived_at`.
- Tiêu đề, câu hỏi, câu trả lời và nội dung hướng dẫn thuộc
  `KnowledgeArticleRevision`.

### 13. Trường dữ liệu của `KnowledgeArticleRevision`

- Các trường đã chốt:
  - `article`: liên kết đến `KnowledgeArticle`;
  - `number`: số phiên bản, duy nhất trong phạm vi một article;
  - `status`: `DRAFT`, `IN_REVIEW`, `APPROVED` hoặc `REJECTED`;
  - `title`: câu hỏi đối với FAQ hoặc tiêu đề đối với hướng dẫn;
  - `body`: sanitized HTML canonical;
  - `body_plain_text` và `content_hash`: dữ liệu dẫn xuất, client không sửa;
  - `change_summary`: mô tả ngắn nội dung thay đổi;
  - `source_reference`: nguồn hoặc căn cứ nội bộ; bắt buộc trước khi submit;
  - `review_note`: nhận xét kiểm duyệt, bắt buộc khi từ chối;
  - `created_by`, `submitted_by`, `reviewed_by`, `first_published_by`;
  - các mốc thời gian tạo, cập nhật, gửi duyệt, kiểm duyệt và xuất bản.
- Mỗi article chỉ có một revision mở; approved/rejected immutable và có thể
  rollback bằng cách publish lại revision approved cũ.
- Media, search, RBAC, API, SEO và rollout được chốt đầy đủ trong đặc tả FAQ.

### 14. Luồng tích hợp chatbot cốt lõi

- Luồng xử lý là: frontend → API nội bộ Django → tầng điều phối chatbot →
  Ollama trên `localhost`.
- Frontend không gọi trực tiếp Ollama.
- Django chịu trách nhiệm xác thực người dùng, quản lý hội thoại, lấy dữ liệu
  cần thiết, xây dựng ngữ cảnh/prompt và kiểm soát phản hồi.
- Django gọi Ollama qua giao tiếp HTTP trên máy local; đây là giao tiếp nội bộ,
  không phải API AI cloud.
- Không gửi nội dung hội thoại, CV hoặc dữ liệu tuyển dụng tới dịch vụ AI bên
  ngoài.
- Luồng này nằm trong backend/project hiện tại, không tách thành service triển
  khai độc lập.

### 15. Module sở hữu phần chạy chatbot

- Tạo Django app `chatbot` trong backend hiện tại.
- `chatbot` sở hữu API chat, conversation/message, điều phối luồng xử lý,
  prompt, chính sách phản hồi và kết nối tới Ollama.
- `knowledgebase` chỉ sở hữu FAQ/hướng dẫn cùng quy trình kiểm duyệt và xuất
  bản; không chứa logic chạy hội thoại.
- `chatbot` chỉ lấy nội dung đang xuất bản từ public interface của
  `knowledgebase`.
- `chatbot` và `knowledgebase` là hai module trong cùng Django monolith, không
  phải hai repository hoặc service triển khai riêng.
- App `chatbot` phải tuân theo layout backend của ADR-0010.

### 16. Đối tượng được sử dụng chatbot MVP

- Chatbot không bắt buộc người dùng đăng nhập.
- Khách chưa đăng nhập và ứng viên đã đăng nhập trên cổng ứng viên đều được sử
  dụng chatbot.
- Cả hai nhóm chỉ được hỏi nội dung FAQ/hướng dẫn đã xuất bản và tìm kiếm việc
  làm công khai trong MVP.
- Chatbot MVP không đọc CV, hồ sơ cá nhân, việc làm đã lưu hoặc trạng thái ứng
  tuyển, kể cả khi người dùng đã đăng nhập.
- Không hiển thị hoặc cung cấp chatbot MVP cho cổng nhà tuyển dụng và cổng quản
  trị.

### 17. Lưu trữ hội thoại

- Conversation và message được lưu trong database của Django.
- Việc lưu trữ phục vụ ngữ cảnh nhiều lượt, khôi phục sau khi tiến trình khởi
  động lại, điều tra lỗi và đánh giá chất lượng chatbot.
- Conversation của ứng viên đăng nhập được liên kết với tài khoản ứng viên.
- Khách chưa đăng nhập được nhận diện bằng mã phiên ẩn danh ngẫu nhiên; không
  dùng địa chỉ IP làm danh tính người dùng.
- Chatbot không được suy diễn rằng hai phiên khách là cùng một người chỉ dựa
  trên IP hoặc thông tin thiết bị.
- Thời hạn lưu, cơ chế xóa và cấu trúc bảng conversation/message chưa được chốt.

### 18. Mô hình dữ liệu hội thoại tổng thể

- App `chatbot` sử dụng hai model chính: `ChatConversation` và `ChatMessage`.
- `ChatConversation` đại diện cho một cuộc hội thoại và liên kết với một ứng
  viên đăng nhập hoặc một phiên khách ẩn danh.
- `ChatMessage` đại diện cho từng tin nhắn có thứ tự trong conversation.
- Vai trò message tối thiểu gồm `USER`, `ASSISTANT` và `TOOL` để hỗ trợ luồng
  truy xuất dữ liệu/tool calling về sau mà không đổi cấu trúc tổng thể.
- Trường dữ liệu chi tiết của hai model được để lại cho giai đoạn thiết kế sau,
  tránh đi sâu vào database trước khi chốt luồng xử lý chatbot.

### 19. Kiến trúc xử lý kết hợp

- Chatbot không dựa vào LLM đơn lẻ để tự nghĩ ra mọi câu trả lời.
- Câu hỏi FAQ/hướng dẫn được truy xuất từ các revision đang xuất bản của
  `knowledgebase` bằng tìm kiếm embedding/RAG.
- Yêu cầu tìm việc sử dụng selector và bộ lọc có cấu trúc trên database Django;
  không dùng embedding để tìm việc trong MVP.
- Chào hỏi hoặc giải thích thông thường được Ollama xử lý trực tiếp nhưng vẫn
  phải tuân theo phạm vi và chính sách chatbot.
- Với câu hỏi ngoài phạm vi hoặc không có đủ dữ liệu, chatbot phải nói rõ giới
  hạn và không tự tạo thông tin.
- Khi dùng FAQ/hướng dẫn hoặc tin tuyển dụng, phản hồi phải có khả năng chỉ ra
  nguồn dữ liệu tương ứng.
- Ollama làm nhiệm vụ hiểu ngôn ngữ và tổng hợp câu trả lời; dữ liệu nghiệp vụ
  thật vẫn do Django cung cấp và kiểm soát.

### 20. Ranh giới thực thi tool

- Ollama không được kết nối trực tiếp database, tự chạy SQL hoặc truy cập tùy ý
  vào model Django.
- Django sở hữu danh sách tool nội bộ được cho phép và là bên duy nhất kiểm tra,
  thực thi các tool đó.
- Danh sách tool ban đầu gồm `search_knowledge` và `search_public_jobs`; đây là
  các hàm nghiệp vụ nội bộ, không phải quyền truy cập database tổng quát.
- Django phải kiểm tra schema, giá trị đầu vào, quyền và giới hạn kết quả trước
  khi thực thi tool.
- Kết quả tool được trả lại cho Ollama để diễn đạt thành câu trả lời; Django lưu
  message cùng nguồn tham chiếu cần thiết.
- Kiến trúc cho phép bổ sung tool mới về sau nhưng mỗi tool phải được khai báo
  và cho phép rõ ràng; LLM không được tự tạo khả năng mới.

### 21. Cơ chế điều phối tool

- Dùng native tool calling của Ollama làm cơ chế điều phối chính.
- Django gửi danh sách tool cùng JSON Schema của tham số cho Ollama.
- Ollama chỉ đề xuất tên tool và tham số; Django kiểm tra schema, quyền và giới
  hạn trước khi quyết định thực thi.
- Dùng schema/Pydantic ở phía Django để kiểm tra tham số; tool call không hợp lệ
  phải bị từ chối an toàn và không được cố thực thi.
- Kết quả tool được đưa lại vào hội thoại với role `TOOL` để Ollama tổng hợp câu
  trả lời cuối cùng.
- Không dùng bộ phân tích JSON tự viết hoặc router từ khóa làm cơ chế điều phối
  chính. Có thể bổ sung fallback an toàn sau benchmark nếu cần.
- Căn cứ kỹ thuật tại thời điểm chốt:
  [Ollama Tool calling](https://docs.ollama.com/capabilities/tool-calling) và
  [Qwen 3.5 trên Ollama](https://ollama.com/library/qwen3.5:4b).

### 22. Streaming phản hồi

- Chatbot MVP sử dụng streaming để người dùng thấy phản hồi dần trong khi model
  local đang sinh câu trả lời.
- Trong thời gian thực thi tool, frontend chỉ hiển thị trạng thái thân thiện như
  “Đang tìm thông tin…”; không hiển thị raw tool call hoặc dữ liệu kỹ thuật.
- Chỉ nội dung trả lời cuối cùng được stream tới giao diện.
- Không gửi hoặc hiển thị phần suy luận/thinking nội bộ của model.
- Sự kiện nguồn tham chiếu, hoàn tất và lỗi phải được truyền riêng với phần nội
  dung để frontend xử lý rõ ràng.
- Giao thức streaming giữa frontend và Django chưa được chốt ở bước này.

### 23. Giao thức streaming frontend–Django

- Dùng HTTP streaming theo định dạng Server-Sent Events (SSE), frontend đọc
  stream bằng `fetch`.
- Frontend gửi request `POST` tới Django và giữ kết nối mở để nhận các sự kiện
  trong cùng một lượt chat.
- Các loại sự kiện tối thiểu gồm `status`, `delta`, `sources`, `done` và
  `error`.
- Chưa dùng WebSocket hoặc Django Channels trong MVP.
- Chỉ xem xét WebSocket khi có nhu cầu hai chiều realtime thực sự, chẳng hạn
  hội thoại giọng nói trực tiếp hoặc nhiều loại sự kiện đồng thời phức tạp.

### 24. Mô hình embedding chuẩn

- Dùng `qwen3-embedding:0.6b` chạy local qua Ollama làm model embedding chuẩn
  cho FAQ/hướng dẫn.
- Phải pin chính xác tag `0.6b`, không dùng tag `latest` để tránh vô tình tải
  hoặc chuyển sang model lớn hơn.
- Không gọi embedding API cloud và không dùng API key.
- Vector do model tạo ra là dữ liệu dẫn xuất; khi đổi model hoặc phiên bản phải
  có khả năng tạo lại từ revision đang xuất bản.
- Chưa bổ sung reranker trong MVP; chỉ xem xét sau benchmark chất lượng truy
  xuất tiếng Việt.
- Căn cứ kỹ thuật tại thời điểm chốt:
  [Qwen3 Embedding trên Ollama](https://ollama.com/library/qwen3-embedding) và
  [công bố của Qwen](https://qwenlm.github.io/blog/qwen3-embedding/).

### 25. Nơi lưu và tìm kiếm vector

- Dùng extension `pgvector` trong PostgreSQL hiện tại; không dựng Chroma,
  Qdrant, Pinecone hoặc vector database riêng trong MVP.
- Django dùng thư viện Python `pgvector` và `VectorField` 1024 chiều, tương ứng
  với output chuẩn của `qwen3-embedding:0.6b`.
- Độ tương đồng sử dụng cosine distance.
- Với quy mô FAQ/hướng dẫn MVP, dùng tìm kiếm chính xác trước và chưa tạo chỉ
  mục approximate HNSW.
- Chỉ bổ sung HNSW khi benchmark trên dữ liệu thực chứng minh truy vấn chính xác
  không còn đáp ứng ngưỡng hiệu năng.
- Khi triển khai phải dùng PostgreSQL 16 có extension `vector`; thay đổi image,
  dependency và migration chỉ thực hiện sau khi được xác nhận riêng.
- Căn cứ kỹ thuật:
  [pgvector-python](https://github.com/pgvector/pgvector-python) và
  [pgvector](https://github.com/pgvector/pgvector).

## Nguyên tắc làm việc đã chốt

- Tiến hành từng bước nhỏ.
- Trước mỗi quyết định hoặc hành động triển khai phải giải thích, hỏi và nhận
  xác nhận từ chủ dự án.
- Không cài đặt công cụ, tải mô hình hoặc sửa code trước khi bước tương ứng được
  xác nhận.

## Những nội dung chưa chốt

- Tiêu chí benchmark và ngưỡng chấp nhận cho model.
- Giới hạn context và cấu hình suy luận.
- Trường chi tiết của conversation/message và chính sách lưu/xóa.
- Hình thức API nội bộ giữa frontend và Django, gồm streaming và hợp đồng dữ
  liệu.
- Cấu trúc module backend/frontend chi tiết.
- Tool calling, RAG, embedding và vector database.
- Định dạng nội dung, phân loại và API quản trị của kho kiến thức.
- Streaming, TTS và lộ trình nâng cấp về sau.
