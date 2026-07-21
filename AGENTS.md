# Frontend implementation guide

Đọc `frontend/ARCHITECTURE.md` trước khi thêm hoặc sửa frontend. Tài liệu đó là
nguồn chi tiết; file này là checklist bắt buộc khi làm việc trong repository.

## Mục tiêu cấu trúc

```text
app → pages → widgets → features → entities → shared
```

- Chỉ import xuống layer thấp hơn. `features` không import feature khác.
- Import feature/entity/widget qua public `index.js`; không deep-import nội bộ
  slice khác.
- `shared` được import theo segment cụ thể, ví dụ `@/shared/api/client`.
- Trong cùng slice dùng import tương đối (`../model/use-foo`); alias `@/` chỉ
  dùng khi vượt slice/layer. Hook file đặt tên kebab-case.
- Không đổi URL, API payload, token/storage key hoặc role/guard nếu task không
  yêu cầu rõ ràng.

## Chọn nơi đặt code

| Nhu cầu                                        | Vị trí                                     |
| ---------------------------------------------- | ------------------------------------------ |
| Route-level composition theo portal            | `frontend/src/pages/{main,employer,admin}` |
| Provider, router, guard, layout, lazy registry | `frontend/src/app`                         |
| Hành động/workflow người dùng                  | `frontend/src/features/<action>`           |
| Domain model, API hoặc UI domain tái sử dụng   | `frontend/src/entities/<domain>`           |
| Khối UI lớn ghép nhiều domain                  | `frontend/src/widgets/<name>`              |
| UI nguyên tử hoặc hạ tầng không biết domain    | `frontend/src/shared`                      |

Không tạo `utils` chung không có owner. Component chỉ dùng một page/feature phải
đặt gần owner thay vì đưa vào `shared`.

## Khi thêm giao diện hoặc route

1. Xác định portal và owner bằng bảng trên trước khi tạo file.
2. Thêm page trong portal sở hữu; page chỉ compose UI và lấy route params.
3. Đặt action/domain/UI tái sử dụng vào feature, entity, widget hoặc shared.
4. Thêm dynamic loader tại `src/app/router/lazy/<portal>.pages.jsx`.
5. Đăng ký route ở `src/app/router/routes/<portal>.routes.jsx`; không import
   page trực tiếp vào `AppRouter`.
6. Protected route phải theo thứ tự `AuthGuard` rồi `RoleGuard`.
7. Bổ sung unit/regression test và E2E cho route hoặc workflow bị ảnh hưởng.

## Kiểm tra trước khi bàn giao

Chạy tại `frontend/` theo phạm vi thay đổi:

```bash
npm run lint
npm run check:architecture
npm run test:coverage
npm run build
npm run test:e2e:smoke
```

Không bỏ qua lỗi kiến trúc bằng alias sâu, shim vô thời hạn hoặc whitelist mới
nếu chưa có ADR và lý do cụ thể. Cập nhật `frontend/ARCHITECTURE.md` khi thêm
quy tắc, portal hoặc mô hình ownership có tác động lâu dài.

## Backend (ADR-0010)

Mọi Django app trong `backend/apps/` theo đúng một layout:

```text
<app>/api/{views,serializers}/ · models/ · services/ · selectors/ · tasks/ · tests/ · urls.py
```

- Chiều phụ thuộc: `api → services/selectors → models`; `tasks → services`.
  Enforce bằng `import-linter` (`backend/pyproject.toml`) — vi phạm fail CI.
- `services/` (ghi) và `selectors/` (đọc) KHÔNG import máy móc HTTP của DRF
  (serializers/views/generics/viewsets/response). Được phép:
  `rest_framework.exceptions`, `rest_framework_simplejwt`.
- Cross-app: chỉ import model của app khác hoặc hàm được re-export ở
  `<app>/services/__init__.py`; không deep-import nội bộ.
- Endpoint list phải giữ số query phẳng theo số bản ghi — xem
  `tests/test_query_budget.py`; tăng budget phải kèm giải thích trong PR.
- API: miền CV dùng tiền tố `/api/v2/`; app khác `/api/<app>/`. Không còn v1.

### Kiểm tra trước khi bàn giao (backend)

```bash
cd backend
ruff check . && ruff format --check .
lint-imports
python manage.py makemigrations --check --dry-run
pytest --cov --cov-fail-under=84
```

Hoặc một lệnh cho toàn repo: `./scripts/check_all.sh`.
