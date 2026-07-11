# Quy ước cấu trúc và clean code

Tài liệu này là tiêu chuẩn mặc định khi thêm hoặc refactor code trong dự án.

## Nguyên tắc chung

- Một module chỉ có một lý do chính để thay đổi. HTTP, truy vấn dữ liệu, nghiệp vụ và giao diện không đặt chung trong một hàm lớn.
- Chỉ đưa code vào `common`, `components` hoặc `hooks` cấp cao khi có ít nhất hai feature thực sự dùng chung. Code riêng của feature đặt cạnh feature đó.
- Ưu tiên hàm thuần cho parse, format và chuyển đổi tham số để có thể unit test không cần trình duyệt hay database.
- Không tạo file `helpers.js`, `utils.py` tổng hợp nhiều trách nhiệm. Tên file phải nói rõ phạm vi như `jobListParams.js`, `querysets.py`, `services.py`.
- Không giữ code comment-out, import không dùng, file build, credential hoặc dữ liệu tạm trong source.

## Giới hạn kích thước

Số dòng chỉ là tín hiệu để xem xét, không phải mục tiêu máy móc:

- Trên 300 dòng: kiểm tra xem file có đang chứa nhiều component, hook hoặc lớp trách nhiệm khác nhau không.
- Trên 500 dòng: phải tách, trừ file dữ liệu khai báo hoặc migration sinh tự động có lý do rõ ràng.
- Hàm trên khoảng 50 dòng: ưu tiên tách các bước có tên thể hiện nghiệp vụ.

Không tách component chỉ để giảm số dòng nếu component con không có ranh giới trách nhiệm rõ.

## Frontend

Một feature phức tạp đặt code liên quan cạnh nhau:

```text
pages/main/jobs/
  JobList.jsx              # điều phối trang và ghép các khối UI
  components/              # UI riêng của trang việc làm
  hooks/                   # tải dữ liệu và stateful logic riêng của feature
  utils/                   # hàm thuần parse/format tham số
```

- Page/component không gọi Axios trực tiếp; mọi request đi qua `src/api`.
- Hook chịu trách nhiệm vòng đời và state; component chịu trách nhiệm render và sự kiện UI.
- Dữ liệu cấu hình lớn như menu, option và mapping tách khỏi component render.
- Logic dùng chung toàn ứng dụng đặt ở `src/hooks`, `src/components` hoặc `src/constants` theo đúng loại.

## Backend

Mỗi Django app tự sở hữu nghiệp vụ của mình:

```text
apps/jobs/
  views.py       # HTTP, permission, serializer và response
  querysets.py   # xây dựng/filter/order QuerySet
  services.py    # phối hợp nghiệp vụ và tạo payload tổng hợp
  serializers.py
  models.py
```

- View không chứa chuỗi truy vấn dài hoặc thuật toán tổng hợp dữ liệu.
- `querysets.py` chỉ xây dựng truy vấn, không tạo HTTP response.
- `services.py` không phụ thuộc class-based view; nhận dữ liệu đầu vào rõ ràng và trả object miền nghiệp vụ/payload.
- `common/` chỉ dành cho hạ tầng dùng qua nhiều Django app, không đưa nghiệp vụ riêng của một app vào đó.
- Thay đổi schema phải đi kèm migration; không sửa migration đã chạy ở môi trường khác.

## Kiểm tra trước khi hoàn tất

```bash
# Backend
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test

# Frontend
cd frontend
npm run lint
npm test
npm run build
npm run test:e2e
```

Mỗi bug trong logic parse/format/hàm thuần nên có unit test hồi quy. Thay đổi responsive hoặc luồng tương tác quan trọng nên có E2E test ở desktop và mobile.
