# ADR-0026: Hợp đồng cấu hình hệ thống (SiteSetting)

**Trạng thái:** Đã chấp nhận
**Ngày:** 21/11/2026
**Owner:** Nội dung site (`apps.sitecontent`)
**Kế hoạch:** [ke-hoach-cau-hinh-he-thong.md](../archive/ke-hoach/ke-hoach-cau-hinh-he-thong.md)

## Bối cảnh

Rà soát ngày 21/11/2026 cho thấy trang Cấu hình hệ thống không phản ánh đúng hệ thống.

- DB local có 120 key; khoảng 60 key không được code nào đọc. Trong số đó có cả nhóm
  thanh toán (đã gỡ theo ADR-0015), bảo mật, upload và tin tuyển dụng.
- 8 key có giá trị seed nói ngược với code. Ví dụ: seed tắt "bắt buộc xác thực email"
  nhưng code luôn bắt; seed ghi CV tối đa 10 MB nhưng code giới hạn 5 MB.
- Giá trị thật của các thông số bảo mật/hạ tầng nằm ở `.env`/Django. Các row
  SiteSetting trùng tên với chúng chỉ là bản sao sai.
- Default nằm rải rác ở tham số gọi hàm và lệch với seed. Có 4 helper đọc setting
  trùng nhau, helper nào cũng truy vấn DB mỗi lần gọi.
- Server không kiểm tra URL/email/JSON. Upload ảnh không ghi audit. Django admin sửa
  được giá trị mà không qua kiểm tra hay audit.

## Quyết định

1. **SiteSetting chỉ chứa cấu hình vận hành admin chỉnh được, và key nào cũng phải có
   code đọc thật.**
   - Test `apps/sitecontent/tests/test_settings_contract.py` quét mã nguồn backend và
     frontend để kiểm tra hai chiều.
   - Key chờ nối vào code phải đánh dấu `options.pending` và nằm trong danh sách
     `PENDING_CONSUMERS`. Danh sách này chỉ được thu hẹp.
2. **`seed_data/settings.json` là nguồn duy nhất của metadata và default.**
   - Mỗi key có nhóm (17 nhóm, thuộc 3 khu), `section`, `description`, `help` (nội dung
     nút "?") và `options`.
   - `options` gồm các ràng buộc kiểu dữ liệu, cùng `applies_to`, `depends_on`, `risky`
     và `schema` cho trang quản trị.
   - `get_setting()` trả default của seed khi row chưa tồn tại.
3. **Secret và giới hạn bảo mật/hạ tầng thuộc `.env`/code.** Admin xem giá trị đang áp
   dụng qua bảng chỉ đọc `GET /api/admin/site/system-parameters/`. Secret chỉ báo
   "đã/chưa cấu hình". Kiểu `env` của SiteSetting bị gỡ.
4. **Một bộ đọc duy nhất:** `apps.sitecontent.selectors` (`get_setting` và các hàm theo
   kiểu).
   - Ngoài transaction: map key → value được cache và bị xoá sau commit.
   - Trong transaction: đọc thẳng DB, để thấy được thay đổi chưa commit của chính
     transaction đó.
5. **Chỉ ghi qua `update_site_settings`.**
   - Kiểm tra theo kiểu và `options`: min/max/integer, `max_length`, URL http(s) hoặc
     `/...`, email, JSON `schema`.
   - Mọi thay đổi đều ghi audit, kể cả upload ảnh.
   - Django admin chỉ còn quyền xem.
6. **Gỡ key** bằng data migration xoá row và giữ danh sách key đã gỡ. **Chuyển một giá
   trị từ env sang SiteSetting** thì migration khởi tạo `value` bằng giá trị env đang
   áp dụng; env/code giữ trần an toàn nếu có (mẫu `jobs/domain/ai_policy.py`).

## Hệ quả

- Migration `sitecontent.0004` xoá 46 key. Các key bảo mật/upload sẽ hiển thị ở bảng
  thông số chỉ đọc. Các nhóm cũ được map sang nhóm mới, và link `?group=` cũ vẫn mở
  đúng nhóm.
- Từ nay thêm key nghĩa là phải viết code đọc key đó trong cùng PR; nếu không, CI đỏ.
- `apps.sitecontent.services` import `apps.accounts.services.admin_audit` (module hẹp)
  thay vì cả gói `accounts.services`. Lý do: gói `accounts.services` đọc cấu hình qua
  `sitecontent.selectors`, nên import cả gói tạo vòng giữa hai layer cùng cấp.
- Các bước tiếp theo (giao diện mới, nối các key `pending`, các bộ setting mới) đi theo
  kế hoạch, mỗi giai đoạn một PR.
