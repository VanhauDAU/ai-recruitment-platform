# Đặc tả trung tâm trợ giúp (FAQ & hướng dẫn)

Trung tâm trợ giúp là kho FAQ/hướng dẫn đã kiểm duyệt cho khách và ứng viên,
do app Django `apps.knowledgebase` sở hữu. Nó chạy trong monolith, dùng chung
RBAC admin, audit, site settings và media storage; không cần Ollama, Internet
hay API key ngoài. Nội dung tự biên soạn theo hành vi thật của ProCV; không
sao chép nội dung website khác.

Ngoài phạm vi hiện tại: chatbot/RAG/embedding, help center cho nhà tuyển dụng
hoặc quản trị viên, cá nhân hóa theo hồ sơ, bình luận, đánh giá "bài viết có
hữu ích không", ticket/live chat và tự động xuất bản nội dung do AI sinh.

## 1. Bề mặt sử dụng

| Bề mặt | URL | Ghi chú |
| --- | --- | --- |
| Trang help center | `/tro-giup` | Sidebar chuyên mục + danh sách câu hỏi |
| Danh sách chuyên mục | `/tro-giup/:categorySlug` | URL là nguồn chuẩn cho category và `page` |
| Chi tiết bài | `/tro-giup/:categorySlug/:articleSlug` | Breadcrumb, nội dung, trước/sau, liên quan |
| Workspace quản trị | `/admin/app/knowledgebase` | Mọi admin (ADR-0018) |
| Tạo bài | `/admin/app/knowledgebase/new` | Mọi admin |
| Editor/lịch sử | `/admin/app/knowledgebase/:publicId` | Mọi admin |

Không đặt dưới `/blog` vì đây là nội dung hỗ trợ sản phẩm, khác cẩm nang nghề
nghiệp. Ba route public nằm trong `MainLayout`, lazy-load và có trạng thái
loading/empty/error (có nút thử lại)/404 riêng.

Điểm vào từ cổng ứng viên (chỉ hiện khi capability
`knowledgebase_public_enabled` là `true`):

- `FloatingActions`: "Các câu hỏi thường gặp" → `/tro-giup`; "Hướng dẫn tìm
  việc an toàn" → `/tro-giup/tim-viec-an-toan`
  (`widgets/main/floating-actions/knowledgebase-support-links.js`);
- header: "Hướng dẫn viết CV" → `/tro-giup/cv-va-mau-cv`
  (`widgets/main/header/header-navigation-config.jsx`, cờ
  `requiresKnowledgebase`).

### 1.1. Trang danh sách

- Desktop hai cột: trái là danh sách chuyên mục có active state, phải là tiêu
  đề và danh sách bài. Tablet/mobile một cột, không tràn ngang.
- Chỉ có **một ô tìm kiếm** ở cột phải. Ô này debounce 250 ms, gửi `q` mà **bỏ
  filter category** để luôn tìm trên mọi chuyên mục; `q` không ghi vào URL.
  Không có bộ lọc loại bài, card chủ đề hay counter.
- Khi có từ khóa: hiện "Tìm thấy N kết quả cho …" (N lấy từ API), mỗi kết quả có
  nhãn chuyên mục phía trên tiêu đề và excerpt một dòng; phần khớp trong
  tiêu đề/excerpt được highlight, không phân biệt hoa thường và dấu.

### 1.2. Trang chi tiết

Breadcrumb `Trang chủ › Trung tâm trợ giúp › Chuyên mục › Tiêu đề`, nhãn loại
bài (FAQ/Hướng dẫn), `h1`, "Cập nhật …" theo `updated_at`, body đã sanitize,
liên kết bài trước/sau và khối "Nội dung liên quan" (tối đa 6 bài cùng chuyên
mục). Sidebar giữ thứ tự bài như danh sách public; chọn bài chỉ đổi active
state. Không bao giờ hiện revision nháp, ghi chú duyệt, `source_reference` hay
thông tin tài khoản quản trị.

## 2. Mô hình dữ liệu

Category 1–n Article (`PROTECT`); Article 1–n Revision (`CASCADE`) và trỏ tới
0..1 `published_revision`. Mọi model có `public_id` bất biến
(`generate_public_id`, prefix `kbc`, `kba`, `kbr`, `kbm`); API admin dùng public
ID, public API đọc bài bằng cặp slug, không lộ PK.

| Model | Trường chính và ràng buộc |
| --- | --- |
| `KnowledgeCategory` | `name` ≤120, `slug` unique toàn bảng ≤160, `description` ≤300, `order` ≥0, `is_active`, `review_interval_days` 30–365, `seo_title/description`, `revision_token`. Phẳng, không có `parent` |
| `KnowledgeArticle` | `category` (bắt buộc), `slug` unique theo `(category, slug)`, `article_type` `FAQ`/`GUIDE`, `order`, `lifecycle_state` `ACTIVE`/`ARCHIVED`, `published_revision` (`SET_NULL`), `revision_token`, `review_due_at`, `first_published_at`, `current_published_at`, `archived_at/by` |
| `KnowledgeArticleRevision` | `number` unique theo article, `status`, `title` ≤240, `body` (sanitized HTML canonical), `body_plain_text` và `content_hash` do backend sinh, `seo_title/description`, `status` `DRAFT`/`PUBLISHED`, `change_summary`, `source_reference` (bắt buộc), actor/timestamp created/first published |
| `KnowledgeMediaAsset` | `storage_key` unique, metadata upload, `width/height` đã xác minh, `default_alt_text`, `uploaded_by` |

Bất biến:

- Mỗi article có tối đa **một bản nháp** (`DRAFT`) — partial unique constraint
  `uq_kb_revision_open_article`. `number` cấp trong
  transaction có `select_for_update` trên article.
- `published_revision` phải thuộc chính article và đang `PUBLISHED`; kiểm ở
  service trong transaction. Revision `PUBLISHED` bất biến.
- Tiêu đề/body/SEO chỉ nằm ở revision, không lặp ở article.
- Không có hard-delete article, category hay media qua API. Category được tắt
  bằng `is_active`; article được archive. Ngoại lệ duy nhất: hủy bản nháp của bài
  đã công khai xóa hẳn revision nháp đó (chưa từng public).

### 2.1. Taxonomy

Migration `0002_seed_knowledgebase` seed bảy chuyên mục (idempotent, không ghi
đè tên/thứ tự admin đã sửa):

| # | Slug | Phạm vi | Chu kỳ xác minh |
| ---: | --- | --- | ---: |
| 1 | `tai-khoan-va-dang-nhap` | đăng ký, xác thực email, đăng nhập, quên mật khẩu, social login | 180 ngày |
| 2 | `bao-mat-va-quyen-rieng` | đổi mật khẩu, bảo mật, quyền riêng tư | 90 ngày |
| 3 | `tim-viec-va-goi-y-viec-lam` | tìm kiếm, bộ lọc, lưu việc, việc phù hợp | 180 ngày |
| 4 | `ung-tuyen-va-theo-doi-ho-so` | ứng tuyển, chọn CV, việc đã ứng tuyển | 180 ngày |
| 5 | `cv-va-mau-cv` | chọn mẫu, tạo, sửa, xem, chia sẻ CV | 180 ngày |
| 6 | `tim-viec-an-toan` | dấu hiệu bất thường, bảo vệ thông tin | 90 ngày |
| 7 | `lien-he-ho-tro` | hotline, Zalo, kênh hỗ trợ đã cấu hình | 90 ngày |

Migration `0003_seed_verified_help_content` thêm một bài đã xuất bản cho
mỗi chuyên mục, đã đối chiếu route/component thật. Migration dùng public ID ổn
định, chỉ thêm (không ghi đè bài cùng slug) và không xóa khi reverse.

## 3. Quy tắc nội dung

- Bài mô tả đúng hành vi đang chạy, dùng tên nút/route như giao diện, có
  `source_reference` trỏ tới route, đặc tả, test hoặc owner đã kiểm chứng; không
  chứa dữ liệu người dùng thật. Bài an toàn phải nêu ProCV không yêu cầu ứng
  viên chuyển tiền để ứng tuyển.
- FAQ trả lời một vấn đề ngắn; GUIDE dùng khi cần nhiều bước hoặc ảnh.
- Slug sinh từ tiêu đề revision đầu (bỏ dấu), trùng thì thêm `-2`, `-3`.
- **Khóa sau lần publish đầu:** `category`, `slug`, `article_type` của article.
  Slug category bị khóa khi category đã có bài từng publish. Chỉ `order`,
  lifecycle và revision tiếp tục thay đổi.
- Sửa bài đã publish luôn tạo bản nháp mới; xuất bản bản nháp đó bắt buộc
  `change_summary`.

### 3.1. Sanitize và ảnh

`normalize_revision_content` (service) sanitize body bằng
`common/html/content.py` trước khi ghi, rồi sinh `body_plain_text` và
`content_hash` (SHA-256 của title + body đã sanitize) từ chính kết quả đó.
Allowlist gồm `h2`–`h4`, đoạn văn, nhấn mạnh, danh sách, blockquote, code/pre,
bảng, figure/caption, liên kết và ảnh; `h1` thuộc page. Liên kết chỉ nhận đường
dẫn nội bộ `/…`, `https`, `mailto`, `tel`.

Ảnh có thể là media nội bộ, đường dẫn `/…` hoặc URL HTTPS không chứa
credentials; không bắt buộc upload trước. Mọi ảnh phải có `alt`, trừ ảnh đánh
dấu `data-decorative="true"`. Upload vào media library (tùy chọn) đi qua
`common.storage.media.save_image_upload`, thư mục `knowledgebase/content`, chỉ
JPEG/PNG/WebP, tối đa 5 MB, resize trong 1600×1600; vượt dung lượng trả `413`.

Frontend sanitize lần nữa bằng `@/shared/lib/sanitize-html` trong renderer
`KnowledgeArticleContent` của entity (preview admin dùng chung).

## 4. Vòng đời và quyền

Nội dung do admin tự soạn nên không có bước gửi duyệt/duyệt
([ADR-0024](../02-tong-quan/adr-0024-content-publish-without-review.md)).

```text
Revision: DRAFT ──xuất bản──► PUBLISHED (bất biến; publish lại bản cũ = rollback)
          DRAFT ──hủy──► (xóa, chỉ khi bài đã có bản công khai)
Article:  ACTIVE ⇄ ARCHIVED              (archived luôn bị ẩn public)
```

Mọi admin (`AdminPortalPermission`, [ADR-0018](../02-tong-quan/adr-0018-remove-admin-rbac.md))
dùng được mọi thao tác dưới đây. Backend là nguồn kiểm quyền cuối.

Quy tắc chuyển trạng thái (`services/articles.py`):

- Tạo bài sinh article + bản nháp r1. Bài đang công khai vẫn sửa được: lần lưu
  đầu gọi `POST …/revisions/` tạo bản nháp mới sao chép từ revision mới nhất
  (hoặc nội dung client gửi), bản công khai giữ nguyên tới khi xuất bản.
- Chỉ `DRAFT` được sửa (`PATCH …/revisions/:number/`).
- Publish nhận `revision_number` tường minh: bản nháp (→ `PUBLISHED`; bài đã
  từng công khai thì bắt buộc `change_summary`) hoặc revision `PUBLISHED` cũ
  (rollback, audit `rollback: true`). Publish bản đang công khai trả `409`.
  Article đang archived phải restore trước.
- Hủy bản nháp (`POST …/revisions/:number/discard/`) chỉ cho bài đã có bản
  công khai; bản nháp duy nhất của bài chưa xuất bản thì archive bài.
- Khi publish: lần đầu đặt `first_published_at`; mỗi lần đặt
  `current_published_at` và `review_due_at` = now + `review_interval_days` của
  category (người publish được chọn hạn sớm hơn, không muộn hơn).
- Archive chỉ ẩn public, giữ pointer; restore làm revision đã publish trước đó
  xuất hiện lại, không tạo hay chọn revision mới.
- Quá hạn `review_due_at` **không** tự ẩn bài; chỉ hiện cảnh báo/filter ở admin
  và hàng chờ "FAQ quá hạn rà soát".

Mọi mutation tăng `revision_token` và nhận token hiện tại. Token cũ, revision mở
đã tồn tại, transition sai hoặc publish bài archived trả `409` với `code`
(`knowledgebase_revision_stale`, `knowledgebase_open_revision_exists` kèm
`open_revision`, `knowledgebase_revision_not_editable`,
`knowledgebase_revision_not_found`, `knowledgebase_revision_already_public`,
`knowledgebase_draft_is_only_revision`, `knowledgebase_article_archived`, …).
Frontend không tự retry; giữ nội dung editor để người dùng tải lại/đối chiếu.
Validation sai trả `400`.

Mọi mutation ghi audit qua `apps.accounts.services.record_admin_action`
(action `knowledge_*`, public ID, số revision, metadata nhỏ); không ghi body
hay query tìm kiếm.

## 5. API

Tiền tố `/api/public/knowledgebase/`. Chi tiết field nằm trong
[`openapi.yaml`](../04-api/openapi.yaml).

**Public** (`AllowAny`, throttle `knowledgebase_public` 120/phút theo client IP):

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| `GET` | `categories/` | Category active kèm `article_count` public |
| `GET` | `articles/` | List/search; query `category`, `type` (`faq`/`guide`), `q` (2–120 ký tự), `page`, `page_size` ≤60 |
| `GET` | `articles/:categorySlug/:articleSlug/` | Chi tiết + `previous_article`, `next_article`, `related_articles` |

Selector public (`PUBLIC_ARTICLE_FILTER`) fail-closed: article `ACTIVE`,
category active, `published_revision` khác null và `PUBLISHED`. Category chỉ
hiện khi active. Mọi thứ không public trả cùng `404`. Tìm kiếm dùng
`common.db.search.search_q` (unaccent, theo token) trên `title` và
`body_plain_text` của revision đang publish; sắp xếp xác định theo
`category.order`, `article.order`, tiêu đề, `public_id` — không xếp theo độ liên
quan. `excerpt` cắt 180 ký tự từ plain text. `published_at` là lần xuất bản đầu;
`updated_at` là `updated_at` của revision đang publish (thực tế là lúc duyệt).

Response 200 có `Cache-Control: public, max-age=60, stale-while-revalidate=300`
và `ETag` tính từ payload + generation cache; khớp `If-None-Match` trả `304`.
Mọi mutation ảnh hưởng public tăng generation
(`invalidate_knowledge_public_cache`); cache lỗi không chặn đọc hay ghi.

**Admin** (`AdminPortalPermission` — mọi admin, ADR-0018; luôn `private, no-store`):

| Endpoint | Method |
| --- | --- |
| `admin/categories/` | GET, POST |
| `admin/categories/reorder/` | POST (đủ toàn bộ ID) |
| `admin/categories/:publicId/` | GET, PATCH |
| `admin/categories/:publicId/activate/`, `deactivate/` | POST |
| `admin/articles/` | GET, POST (tạo article + revision 1) |
| `admin/articles/summary/` | GET (KPI tổng/published/drafts/overdue theo filter) |
| `admin/articles/reorder/` | POST (đủ ID trong một category) |
| `admin/articles/:publicId/` | GET, PATCH (không nhận title/body) |
| `admin/articles/:publicId/revisions/` | GET, POST |
| `admin/articles/:publicId/revisions/:number/` | GET, PATCH (chỉ `DRAFT`) |
| `…/revisions/:number/discard/` | POST (hủy bản nháp) |
| `admin/articles/:publicId/publish/`, `archive/`, `restore/` | POST |
| `admin/media/` | GET, POST multipart |


Admin list nhận `category`, `type`, `lifecycle`, `revision_status`,
`review_due` (`overdue` hoặc `due_soon` = 30 ngày tới), `q`, `ordering`
(whitelist `ARTICLE_ORDERING`, có dạng `-`), `page`, `page_size`; giá trị ngoài
whitelist trả `400`.

## 6. Workspace quản trị

Widget `admin-knowledgebase-management` ghép các feature
`edit-knowledge-revision`, `publish-knowledge-article`,
`manage-knowledge-categories` trên `entities/content/knowledgebase`: bảng bài
filter/sort/pagination server-side (URL là nguồn chuẩn, reorder kéo thả trong
một category, KPI "Có bản nháp"), drawer chuyên mục, editor
`shared/ui/rich-text/RichTextEditor` lưu tường minh (không autosave, cảnh báo rời trang,
giữ bản nhập tạm trong `localStorage` khi lưu lỗi). Header hiện trạng thái
("Đang công khai r2 · Bản nháp r3") và nút **Xuất bản** (lưu thay đổi trước rồi
mới mở hộp thoại chọn ngày rà soát), **Hủy bản nháp**, Lưu trữ/Khôi phục. Thẻ
**Phiên bản** so sánh plain text bản nháp với bản công khai và cho **Công khai
lại** một bản cũ.

## 7. SEO, kill switch và vận hành

| Setting | Mặc định | Tác dụng |
| --- | --- | --- |
| `KNOWLEDGEBASE_PUBLIC_ENABLED` | `true` ngoài production, `false` ở production | Tắt: public API và SEO shell trả 404/noindex, frontend ẩn ba điểm vào và route trực tiếp ra NotFound. Admin và dữ liệu giữ nguyên |
| `KNOWLEDGEBASE_SEARCH_INDEX_ENABLED` | `false` | Chỉ cho index khi cả cờ này, cờ public và site setting `seo_robots_index` cùng bật |

Public site settings trả `knowledgebase_public_enabled` và
`knowledgebase_search_index_enabled` (tính sẵn) để frontend không cần env riêng.

Backend phục vụ SEO shell cho `/tro-giup`, category và detail (`apps/knowledgebase/seo/urls.py`):
canonical tuyệt đối, Open Graph, `BreadcrumbList`, 404 HTTP thật kèm noindex, và
sitemap `/sitemaps/knowledgebase.xml`. Mặc định `noindex, nofollow` cho tới khi
bật index. Không dùng schema `FAQPage`.

`python manage.py check_knowledgebase_readiness --json` (read-only) fail khi:
chuyên mục bắt buộc chưa active, chuyên mục active không có bài public, tiêu đề
trùng trong chuyên mục, thiếu `source_reference` hoặc `seo_description`, bài quá
hạn xác minh, link ngoài không an toàn hoặc link nội bộ
không tồn tại, ảnh lỗi/thiếu alt. Chỉ bật index sau khi lệnh này pass.

Metric PII-free qua `common.metrics.record_metric`:
`knowledgebase_public_request`, `knowledgebase_public_latency_ms` (tag endpoint,
status, failure code; list thêm bucket độ dài query và có/không kết quả) và
`knowledgebase_admin_request`, `knowledgebase_admin_latency_ms`. Không bao giờ
dùng query thô, tiêu đề hay body làm tag.

Rollback ưu tiên tắt switch và quay code; không reverse migration có nguy cơ
mất dữ liệu. Quy trình bật/tắt nằm ở
[vận hành và kill switch](../06-deployment/van-hanh-va-kill-switch.md).

## 8. Việc còn mở

- **Chatbot/RAG (`KB-AI`):** chưa có chunk, embedding hay read function cho
  chatbot; widget trợ lý kịch bản tĩnh `candidate-assistant` đã gỡ
  (2026-11-14), cổng ứng viên hiện không có UI chatbot. Hợp đồng đã
  chốt: chỉ dùng revision đang publish của article active trong
  category active, gắn chunk với revision public ID + `content_hash`, re-export
  read function qua `apps.knowledgebase.services`, không lộ `source_reference`
  hay actor. Xem [chatbot ứng viên](../07-algorithms/chatbot-ung-vien-faq.md) và
  [biên bản quyết định](../02-tong-quan/chatbot-local-decision-log.md).
- **Phản hồi người đọc:** chưa có endpoint/UI "bài viết có hữu ích không".
- **Duyệt bốn mắt:** đã bỏ bước duyệt theo ADR-0024. Nếu sau này có nhiều biên
  tập viên, thêm lại như bước tùy chọn có bật/tắt.
- **Dọn media:** chưa có job xóa asset không còn revision nào tham chiếu.
- **CTA liên hệ hỗ trợ trên trang chi tiết:** chưa có; người đọc dùng chuyên mục
  `lien-he-ho-tro`.
- **Tìm kiếm:** chưa có full-text/trigram/xếp hạng độ liên quan; chỉ nâng cấp
  khi có bộ truy vấn benchmark.
