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

Bố cục, luật phụ thuộc và URL theo cổng là quyết định của
[ADR-0022](../adr/adr-0022-backend-structure.md). Tóm tắt:

```text
apps/jobs/
  api/urls/<cổng>.py     # route REST theo cổng public/candidate/employer/admin
  api/views/             # HTTP: parse request → gọi selector/service → response
  api/serializers/       # validate input, định hình output
  seo/                   # HTML shell và sitemap ngoài /api
  models/                # model, choices, QuerySet/Manager
  domain/                # định nghĩa thuần (registry, hằng số) mà models cũng dùng
  selectors/             # đọc: truy vấn, read model, chống N+1
  services/              # ghi: transaction, tích hợp ngoài, exception nghiệp vụ
  tasks/                 # Celery: chỉ gọi services
  signals/               # khai báo Signal + receivers (chỉ gọi services)
```

- View không chứa truy vấn ORM, `transaction` hay thuật toán tổng hợp dữ liệu.
- `selectors/` chỉ đọc, không tạo HTTP response; GET không được ghi DB.
- `services/` không phụ thuộc class-based view hay serializer; nhận dữ liệu đầu
  vào rõ ràng, trả object miền nghiệp vụ, báo lỗi bằng exception nghiệp vụ.
- App khác chỉ dùng `models`, `services`, `selectors` (cấp package) và
  `signals`; `common/` chỉ dành cho hạ tầng dùng qua nhiều Django app.
- Thay đổi schema phải đi kèm migration; không sửa migration đã chạy ở môi trường khác.

### Thư mục và file phụ được phép

ADR-0022 liệt kê bố cục chính. Các phần sau cũng hợp lệ, vì có lý do riêng và
`scripts/check_backend_imports.py` không chặn chúng:

| Ở đâu | Dùng cho | App đang dùng |
| --- | --- | --- |
| `templates/<app>/` | Template email và HTML in PDF | applications, campaigns, candidates, jobs, messaging |
| `locale/en/LC_MESSAGES/` | Bản dịch tiếng Anh của chuỗi `gettext` (ADR-0023) | app có chuỗi trả về người dùng |
| `seed_data/` | JSON và module dữ liệu cho lệnh `seed_*`, không chạy lúc import app | cv_templates, jobs, locations, sitecontent |
| `domain/*.json` | Registry tĩnh đọc trong `domain/` | cv_templates |
| `api/authentication.py`, `api/schema.py` | Lớp xác thực DRF và extension OpenAPI | accounts |
| `api/exceptions.py` | Exception HTTP riêng của app (mã lỗi API) | cvs, employers |
| `api/middleware.py` | Middleware chạy trên request HTTP | sitecontent (chế độ bảo trì) |
| `api/consumers.py`, `api/routing.py` | WebSocket consumer và route ASGI | realtime |

App thiếu tầng chính, có chủ đích: `ai_core` không có `api/` (runtime cho app
khác gọi); `dashboard` không có `models/` (chỉ đọc số liệu của app khác);
`realtime` không có `models/`, `selectors/` (chỉ đẩy sự kiện qua channel layer).

## Kiểm tra trước khi hoàn tất

```bash
# Backend (đủ bước xem AGENTS.md)
cd backend
ruff check . && ruff format --check . && lint-imports
python manage.py makemigrations --check --dry-run
pytest --cov --cov-fail-under=84

# Frontend
cd frontend
npm run lint
npm test
npm run build
npm run test:e2e
```

Mỗi bug trong logic parse/format/hàm thuần nên có unit test hồi quy. Thay đổi responsive hoặc luồng tương tác quan trọng nên có E2E test ở desktop và mobile.
