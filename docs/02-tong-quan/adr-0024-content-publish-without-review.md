# ADR-0024: Nội dung admin tự soạn đi thẳng Nháp → Xuất bản

**Trạng thái:** Đã chấp nhận
**Ngày:** 20/11/2026
**Owner:** Content (FAQ/hướng dẫn, blog)

## Bối cảnh

FAQ/hướng dẫn (`knowledgebase`) đi bốn bước `DRAFT → IN_REVIEW → APPROVED/REJECTED
→ publish`, blog đi `draft → pending → published`. Hai luồng này được thiết kế
cho phân quyền người soạn/người duyệt (`knowledgebase.manage/review/publish`,
`blog.can_publish_post`). [ADR-0018](./adr-0018-remove-admin-rbac.md) đã gỡ phân
quyền đó: mọi admin dùng được mọi chức năng nội dung. Kết quả là một người tự
gửi duyệt, tự duyệt rồi tự xuất bản bài của chính mình.

Hệ quả thấy được:

- Sửa một FAQ đang công khai cần sáu thao tác (tạo revision → sửa → lưu → gửi
  duyệt → duyệt → xuất bản), bốn trong đó là hộp thoại xác nhận.
- Trạng thái sai nghĩa: sau khi xuất bản, revision vẫn hiện "Đã duyệt — sẵn sàng
  để người có quyền xuất bản"; nút xuất bản ở header có thể trỏ tới bản đã duyệt
  cũ trong khi đã có bản nháp mới hơn.
- Revision bị từ chối không sửa được; revision mới lại sao chép từ bản đang
  công khai nên mất phần sửa dở.
- Dashboard, sidebar và chuông có hai hàng chờ giả ("FAQ & hướng dẫn chờ duyệt",
  "Bài viết chờ duyệt", SLA 72 giờ) chỉ chứa việc của chính người vừa gửi.

## Quyết định

1. **FAQ/hướng dẫn:** revision chỉ còn `DRAFT` và `PUBLISHED`.
   - Mỗi bài tối đa một bản nháp. Bài đang công khai vẫn sửa thẳng trong editor;
     lần lưu đầu tạo bản nháp mới sao chép từ revision mới nhất, bản công khai
     giữ nguyên tới khi xuất bản.
   - `publish` nhận bản nháp (thành `PUBLISHED`, bất biến) hoặc một revision
     `PUBLISHED` cũ (rollback). Sửa bài đã từng công khai bắt buộc
     `change_summary` lúc xuất bản.
   - Bản nháp của bài đã công khai hủy được (`.../revisions/{n}/discard/`, xóa hẳn
     vì chưa từng public); bản nháp duy nhất của bài chưa xuất bản thì lưu trữ bài.
   - Gỡ `review_note`, `submitted_by/at`, `reviewed_by/at` và endpoint
     `submit/approve/reject`.
2. **Blog:** `Post.status` còn `draft/published/archived`; bản sửa của bài đang
   public là working copy nháp. Xuất bản thẳng từ nháp hoặc từ working copy. Gỡ
   endpoint `submit/return`, `submitted_at`, trạng thái của working copy và quyền
   Django `blog.can_publish_post`.
3. Gỡ hàng chờ `knowledge_reviews` và `blog_reviews` khỏi dashboard, sidebar và
   chuông. **Giữ** hàng chờ "FAQ quá hạn rà soát" (`review_due_at`): đó là kiểm
   tra độ tươi nội dung định kỳ, không phải bước duyệt.
4. **Giữ nguyên:** lịch sử phiên bản và so sánh với bản công khai, rollback,
   lưu trữ/khôi phục, optimistic lock (`revision_token`, `edit_revision`), audit
   mọi thao tác qua `record_admin_action`.

## Hệ quả

- Migration `knowledgebase.0003/0004`: revision từng công khai → `PUBLISHED`;
  revision chưa công khai mới nhất, mới hơn bản công khai → `DRAFT`; các revision
  chưa từng công khai còn lại (bị từ chối, đã duyệt nhưng bị thay) bị **xóa**,
  rồi gỡ cột. `blog.0003/0004`: bài/bản sửa `pending` → `draft`, rồi gỡ cột.
  Chạy `pg_dump` trước vì container backend tự migrate khi khởi động.
- Audit log cũ vẫn giữ các mã `knowledge_revision_in_review/approved/rejected`,
  `blog_submit/return`; frontend giữ nhãn để đọc lịch sử.
- Kiểm tra sẵn sàng (`check_knowledgebase_readiness`) bỏ lỗi
  `safety_content_not_reviewed`: xuất bản giờ chính là bước xác nhận nội dung.
- Không có duyệt bốn mắt. Nếu sau này cần (nhiều biên tập viên), thêm lại như
  một bước tùy chọn có bật/tắt, không khôi phục trạng thái `IN_REVIEW` mặc định.
