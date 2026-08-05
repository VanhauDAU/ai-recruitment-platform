# Runbook rollout và rollback Help Center

Runbook này áp dụng cho FAQ/hướng dẫn `/tro-giup`. Hai cấu hình backend là nguồn
chuẩn và phải được thay đổi theo đúng thứ tự:

- `KNOWLEDGEBASE_PUBLIC_ENABLED`: mở API, SEO shell và entry point frontend;
- `KNOWLEDGEBASE_SEARCH_INDEX_ENABLED`: cho phép `index, follow` và thêm
  `/sitemaps/knowledgebase.xml` vào sitemap index.

Index switch không thể vượt qua public switch hoặc global site setting
`seo_robots_index`. Frontend nhận hai capability tính toán từ
`GET /api/site/settings/`; không có env flag frontend tương ứng.

## 1. Tiền kiểm

1. Sao lưu PostgreSQL và media cùng một mốc. Không reverse data migration
   knowledgebase khi rollback.
2. Deploy code/migration với cả hai switch `false` ở production.
3. Chạy migration và gate:

   ```bash
   cd backend
   python manage.py migrate
   python manage.py check_knowledgebase_readiness --json
   ```

4. Chỉ tiếp tục khi command exit `0`, `ready=true`, đủ category active, không có
   bài quá hạn, link lạ, metadata thiếu hoặc media/alt lỗi. Command đối chiếu link
   nội bộ với registry route canonical; chỉ kiểm file tồn tại với ảnh thuộc media
   storage nội bộ, còn ảnh HTTPS không cần media record.
5. Xác nhận admin `/admin/app/knowledgebase` đọc được danh sách, revision, audit
   và filter hạn review.

## 2. Mở public nhưng chưa index

1. Đặt `KNOWLEDGEBASE_PUBLIC_ENABLED=true` và giữ
   `KNOWLEDGEBASE_SEARCH_INDEX_ENABLED=false`; restart backend theo quy trình
   deploy của môi trường.
2. Kiểm tra:

   ```bash
   curl -i https://<host>/api/knowledgebase/categories/
   curl -i 'https://<host>/api/knowledgebase/articles/?q=bao%20mat'
   curl -i https://<host>/tro-giup
   curl -i https://<host>/sitemaps/knowledgebase.xml
   ```

3. Kỳ vọng API `200`, cache/ETag có mặt; shell trả `X-Robots-Tag: noindex,
   nofollow`; sitemap knowledgebase rỗng và sitemap index chưa chứa nó.
4. Smoke bằng guest và candidate: browse → lọc cục bộ → category → detail → link
   kế tiếp; kiểm tra 320 px, mobile, tablet và desktop. Direct URL draft/slug sai
   phải trả HTTP `404` thật.
5. Theo dõi metric `knowledgebase_public_request`,
   `knowledgebase_public_latency_ms`, error status, search `result_bucket=zero`
   và metric admin. Metric chỉ có endpoint/status/category bucket/type/query
   length bucket; không được có raw search, title, body, email hoặc review note.

## 3. Bật index

Chỉ thực hiện sau khi public smoke ổn định và gate readiness vẫn pass:

1. Đặt `KNOWLEDGEBASE_SEARCH_INDEX_ENABLED=true`, restart backend.
2. Xác nhận home/category/detail trả `index, follow` khi global
   `seo_robots_index=true`.
3. Xác nhận `/sitemap.xml` chứa `/sitemaps/knowledgebase.xml`; sitemap riêng chỉ
   chứa home, category có bài public và article approved/published. Draft,
   rejected, archived và category inactive không được xuất hiện.
4. Kiểm tra canonical tuyệt đối, Open Graph, `Article` và `BreadcrumbList`;
   không phát `FAQPage` schema.

## 4. Rollback và kill-switch rehearsal

Thứ tự giảm ảnh hưởng:

1. Tắt `KNOWLEDGEBASE_SEARCH_INDEX_ENABLED` trước để metadata trở lại `noindex`
   và gỡ sitemap khỏi index.
2. Tắt `KNOWLEDGEBASE_PUBLIC_ENABLED`; xác nhận public API và `/tro-giup` trả
   `404`/`noindex`, entry point biến mất sau khi site-settings refresh.
3. Xác nhận admin workspace vẫn hoạt động và số category/article/revision không
   đổi. Không chạy reverse migration xóa nội dung.
4. Nếu cần, rollback code ứng dụng theo release tooling của môi trường.
5. Diễn tập bật lại public switch và so sánh cùng public ID trước/sau; danh sách
   và detail phải trở lại mà không tạo hay mất revision.

Regression `test_kill_switch_rehearsal_preserves_and_restores_the_same_public_data`
thực hiện chuỗi bật → đọc → tắt → 404 → bật lại → so sánh ID. Trước mỗi lần bật
production vẫn cần chạy rehearsal HTTP theo môi trường vì proxy/CDN không nằm
trong Django test.

## 5. Ngưỡng theo dõi

Chưa đặt alert cứng trước khi có baseline production. Trong 24 giờ đầu ghi lại
p50/p95 latency, error rate, zero-result rate và volume theo endpoint; sau đó
đặt alert theo baseline thực tế. Bất kỳ dấu hiệu lộ draft, lỗi media hàng loạt,
5xx tăng đột biến hoặc canonical sai đều yêu cầu tắt index ngay; tắt public nếu
ảnh hưởng người dùng hoặc tính đúng của nội dung.
