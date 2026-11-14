# ADR-0017: Trang công ty công khai và quyền biên tập trang

**Trạng thái:** Đã chấp nhận  
**Ngày:** 14/11/2026  
**Owner:** Employers, Candidate Discovery

## Bối cảnh

[ADR-0013](./adr-0013-public-companies-api.md) đã mở danh bạ công ty công khai,
nhưng thẻ công ty chỉ dẫn về tìm việc theo tên dạng văn bản
(`/viec-lam?search=<tên>&search_by=company`). Chưa có trang chi tiết, và nhà
tuyển dụng không có nơi trình bày thương hiệu ngoài form hồ sơ pháp lý.

Hai ràng buộc có sẵn định hình lời giải:

- `Company` không có vòng đời xác thực (ER-D52). Tư cách đại diện chỉ suy từ
  `EmployerVerificationCase` của từng nhà tuyển dụng.
- Mọi thay đổi hồ sơ công ty đi qua `CompanyUpdateRequest` chờ quản trị viên
  duyệt, và `Company.updated_at` là mốc chống ghi đè của luồng đó.

## Quyết định

1. **Một route, một read model.** Trang công ty nằm tại `/cong-ty/:slug`, đọc
   từ `GET /api/companies/<slug>/`. Response là danh sách khối có kiểu
   (`sections[].type`) do một builder duy nhất ở backend sinh ra; frontend không
   suy luận từ tên cột của `Company`. Xem trước của nhà tuyển dụng và của quản
   trị viên dùng lại đúng builder đó.
2. **Tin của công ty lọc theo mã, không theo tên.** `GET /api/jobs/` nhận
   `company=<company_public_id>`; DTO tin trả `company_slug` để mọi liên kết
   công ty trỏ về trang chi tiết.
3. **Kiểm duyệt lai.** Nội dung (chữ, ảnh, video, liên kết, văn phòng) đi qua
   `CompanyUpdateRequest`. Bố cục (bật/tắt khối, thứ tự, màu nhấn, tin ghim)
   áp dụng ngay vì không đưa nội dung mới lên trang; bố cục lưu ở bảng riêng để
   không chạm `Company.updated_at`, và mỗi thay đổi ghi vào nhật ký
   chỉ-ghi-thêm.
4. **Quyền biên tập là chính sách suy ra, không phải vai trò mới.** Người biên
   tập là owner đủ điều kiện đại diện, hoặc member đủ điều kiện đại diện được
   owner cấp quyền. Điều kiện đại diện dùng chung một predicate ở tầng models
   (`employers/models/representation.py`) cho cả selector lẫn service, vì
   import-linter không cho hai tầng này gọi nhau. Quyền được tính tại thời điểm
   request nên hồ sơ xác thực hết hiệu lực là mất quyền ngay.
5. **Trang cho mọi công ty, index có điều kiện.** Mọi công ty không bị tạm ẩn
   đều có trang. Chỉ công ty có người đại diện hợp lệ, có lĩnh vực, và có mô tả
   hoặc tin đang tuyển mới được index và vào sitemap. Tạm ẩn trả HTTP 404 thật.
6. **Địa chỉ công khai qua một điểm duy nhất.** `Company.public_headquarters`
   chỉ trả địa chỉ của doanh nghiệp; hộ kinh doanh luôn trả chuỗi rỗng. Mọi bề
   mặt công khai (danh bạ, chi tiết tin, trang công ty, JSON-LD) đọc thuộc tính
   này thay vì `address`.
7. **Slug dành riêng.** `tim-kiem` không được dùng làm slug công ty vì
   `/cong-ty/tim-kiem` là route tìm kiếm của danh bạ.

Không hiển thị huy hiệu xác thực cấp công ty và không có gói trả phí
([ADR-0015](./adr-0015-remove-commercial-services.md)).

## Hệ quả

- Chi tiết tin (`GET /api/jobs/<slug>/`) không còn trả địa chỉ của hộ kinh
  doanh trong `company_address`.
- Luật cũ của hồ sơ công ty giữ nguyên: mọi member vẫn gửi được yêu cầu sửa các
  trường đã có (ER-D05). Quyền biên tập chỉ ràng buộc bố cục và các trường nội
  dung mới.
- Việc bổ sung điều kiện "không bị tạm ẩn" vào featured và search là thay đổi
  so với ADR-0013, được ghi khi giai đoạn CP-1 triển khai.

Lộ trình, mô hình dữ liệu và kiểm chứng từng giai đoạn nằm tại
[kế hoạch trang công ty](../01-phan-tich/ke-hoach-trang-cong-ty.md).
