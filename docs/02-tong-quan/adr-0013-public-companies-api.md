# ADR-0013: API công khai cho danh bạ công ty

**Trạng thái:** Đã chấp nhận  
**Ngày:** 14/08/2026  
**Owner:** Employers, Candidate Discovery

## Bối cảnh

Ứng dụng đã dùng `/api/employer/` cho các workflow riêng tư của nhà tuyển dụng.
Endpoint tìm công ty trong namespace này phục vụ onboarding, yêu cầu tài khoản
employer và trả dữ liệu nhận diện pháp lý không phù hợp với một danh bạ công
khai. Dùng `/api/employers/` sẽ chỉ khác namespace hiện tại một ký tự, dễ gây
nhầm lẫn trong client, log và tài liệu API.

## Quyết định

Danh bạ công ty công khai dùng prefix theo tài nguyên:

```text
GET /api/companies/
```

Prefix `/api/companies/` là ngoại lệ có chủ đích so với quy ước `/api/<app>/`
của ADR-0010: app `employers` tiếp tục sở hữu model và read model, còn HTTP
namespace phân biệt rõ catalogue công khai với cổng employer riêng tư.

Endpoint cho phép truy cập anonymous và có hai chế độ trên cùng một URL:

- Không có `q` (hoặc `q` chỉ có khoảng trắng): trả tối đa 18 công ty nổi bật
  trong envelope `{next: null, previous: null, results}`. Một công ty chỉ vào
  pool khi đồng thời có ít nhất một recruiter còn truy cập được, case
  `approved` khớp công ty và đủ giấy tờ `current + approved` đúng phương thức
  xác thực; logo và ảnh bìa không rỗng; có ít nhất một lĩnh vực; và có ít nhất
  một tin thỏa predicate công khai canonical của app `jobs`. Pool được xếp theo
  `active_public_job_count DESC`, `latest_public_job_at DESC`, `company_name`, `id`,
  cắt 18 rồi mới `shuffle` trong bộ nhớ. Response đặt `Cache-Control: no-store`
  để refresh thực sự có thể đổi thứ tự; không dùng random ở SQL và không cấp
  cursor cho danh sách hữu hạn này.
- Có `q` khác rỗng: tìm không dấu trên `company_name` và `trade_name`, tối đa
  120 ký tự. Search trả **mọi** bản ghi `Company` khớp tên, không áp dụng điều
  kiện đại diện/xác thực, placeholder, logo, ảnh bìa, lĩnh vực, completeness hay
  tin public của featured. Kết quả dùng cursor 18 bản ghi theo `slug` duy nhất,
  ổn định; client luôn đi tiếp bằng URL `next`. Hai tên được
  materialize thành dạng chữ thường đã bỏ dấu và có GIN `gin_trgm_ops`; model
  cập nhật các cột nội bộ này cùng source field để truy vấn `%token%` không
  buộc quét tuần tự toàn catalogue ở production scale.
  Trang search đầu tiên (không có `cursor`) trả envelope
  `{count, next, previous, results}`; `count` là tổng chính xác trên toàn bộ tập
  Company khớp từ khóa, không chỉ số item của trang. Các trang có
  `cursor` bỏ key và query `count`; client giữ total từ trang đầu. Featured
  không chạy count và tiếp tục không có key này.

`company_name_search` và `trade_name_search` là derived-data invariant: mọi
đường ghi tên công ty phải đi qua `Company.save()` (kể cả
`save(update_fields=...)`). Không dùng `QuerySet.update`, `bulk_update` hoặc
`bulk_create` cho hai source field nếu không đồng thời tự tính các field search.
Migration 0046 add/backfill dữ liệu; rollout phải tạm dừng ghi tên bằng phiên
bản app cũ trong cửa sổ backfill (hoặc chạy lại backfill trước khi mở traffic),
sau đó migration 0047 tạo hai GIN index bằng `CREATE INDEX CONCURRENTLY` để
không khóa bảng lâu.

Vì đây là endpoint `AllowAny` có search database, mọi request dùng throttle
`public_companies = 120/min` theo IP client đã kiểm chứng (không tin
`X-Forwarded-For` do client tự khai). Giới hạn đủ rộng cho gõ tìm kiếm/infinite
scroll bình thường nhưng chặn một IP phát truy vấn vô hạn.

Trong pool featured, điều kiện case/giấy tờ chứng minh một recruiter được phép
đại diện công ty; nó không tạo verification lifecycle hay badge cấp `Company`.
Phương thức
`business_registration` cần đúng một giấy đăng ký doanh nghiệp current đã
duyệt. Phương thức `authorization_and_id` cần cả giấy ủy quyền và giấy tờ định
danh current đã duyệt trên cùng case. Mọi trạng thái/phương thức khác fail
closed.

Hai chế độ chỉ trả projection public-safe. DTO có
`active_public_job_count`, được tính từ cùng predicate canonical với danh sách
tin ứng viên nhìn thấy nên không đếm tin hết hạn hoặc đang bị hold. DTO cũng có
`headquarters`: chỉ trả `Company.address` đã trim khi `business_type=enterprise`;
với `household` luôn trả chuỗi rỗng để không lộ địa chỉ nhà của người đại diện.
Projection không được chứa field thô `address`, mã số thuế, email, số điện
thoại, người tạo hoặc danh tính recruiter.

## Hệ quả

- Infinite scroll chỉ áp dụng khi search và đi theo URL `next`; danh sách nổi
  bật mặc định là một tập hữu hạn, `next` luôn `null`. Trang search đầu trả exact
  `count` bằng một query bổ sung; các trang cursor sau trở lại 3 query. Tổng
  budget vẫn không vượt 5 query.
- Search rộng không đồng nghĩa mở rộng dữ liệu: nó vẫn dùng serializer
  public-safe, không trả MST/email/phone/raw address/recruiter; địa chỉ hộ kinh
  doanh luôn bị redact. Eligibility chặt chỉ thuộc featured mặc định.
- Serializer public tách khỏi serializer onboarding/admin để việc thêm field nội
  bộ sau này không vô tình mở rộng contract công khai.
- Selector vẫn nằm trong `apps.employers/selectors`; view chỉ compose selector,
  pagination và serializer theo ADR-0010.
- Predicate visibility của tin vẫn thuộc app `jobs`. Cross-app consumer gọi
  `Job.publicly_available_queryset()` qua public model API; không deep-import
  hoặc sao chép `status=active` thành một predicate yếu hơn.
- Featured chạy một aggregate canonical theo `company_id`, xếp hạng/cắt 18 rồi
  mới fetch projection. Search chỉ aggregate `active_public_job_count` trong một
  query cho tối đa 18 company của trang cursor đã chọn. Cách hai pha này giữ số query tối đa 5,
  đồng thời tránh ORM nhân bản các correlated subquery `count/latest/where`
  trên toàn tập featured eligible trước `LIMIT`.
- Mọi thay đổi projection phải có contract test chặn field nhạy cảm và query
  budget riêng cho featured/search phải phẳng theo số bản ghi. Test budget còn
  đếm số lần bảng job xuất hiện trong SQL để không bỏ sót nhiều canonical
  subplan nằm trong cùng một ORM query.
