# Frontend implementation guide

Đọc `frontend/ARCHITECTURE.md` trước khi thêm hoặc sửa frontend. Tài liệu đó là
nguồn chi tiết; file này là checklist bắt buộc khi làm việc trong repository.

## Mục tiêu cấu trúc

```text
app → pages → widgets → features → entities → shared
```

- Chỉ import xuống layer thấp hơn. `features` không import feature khác, kể cả
  cùng cổng và module.
- Import feature/entity/widget qua public `index.js`; không deep-import nội bộ
  slice khác.
- `shared` được import theo segment cụ thể, ví dụ `@/shared/api/client`.
- Trong cùng slice dùng import tương đối (`../model/use-foo`); alias `@/` chỉ
  dùng khi vượt slice/layer. Hook file đặt tên kebab-case.
- Không đổi URL, API payload, token/storage key hoặc role/guard nếu task không
  yêu cầu rõ ràng.

## Chọn nơi đặt code

| Nhu cầu                                        | Vị trí                                                |
| ---------------------------------------------- | ----------------------------------------------------- |
| Route-level composition theo portal            | `frontend/src/pages/<cổng>/<mục>`                     |
| Provider, router, guard, layout, lazy registry | `frontend/src/app`                                    |
| Hành động/workflow người dùng                  | `frontend/src/features/<cổng>/<module>/<action>`      |
| Domain model, API hoặc UI domain tái sử dụng   | `frontend/src/entities/<domain>/<entity>`             |
| Khối UI lớn ghép nhiều domain                  | `frontend/src/widgets/<cổng>/<name>`                  |
| UI nguyên tử hoặc hạ tầng không biết domain    | `frontend/src/shared`                                 |

`<cổng>` là `main`, `employer`, `admin` hoặc `common` (chỉ khi từ hai cổng trở
lên dùng); `<module>` là danh từ nghiệp vụ đã có (`job`, `cv`, `campaign`…).
Page/widget chỉ dùng feature/widget cùng cổng hoặc `common`. Chi tiết ở mục
"Tổ chức thư mục trong từng layer" của `frontend/ARCHITECTURE.md`.

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

## Agent skills (`.claude/skills/`, khóa ở `skills-lock.json`)

Cài bằng `npx skills add <repo> --skill <name> -a claude-code -y`; cập nhật bằng
`npx skills update -p`. Áp dụng theo stack thực tế (Vite SPA + React 19 + antd
6 + Tailwind 4 + TanStack Query), không phải Next.js:

| Skill                         | Khi nào dùng                                                                                                                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vercel-react-best-practices` | Viết/review/refactor component. Ưu tiên `async-*`, `bundle-*`, `rerender-*`, `rendering-*`, `js-*`. Bỏ `server-*`, RSC/hydration; `next/dynamic` → `React.lazy` + lazy registry; `client-swr-dedup` → dùng TanStack Query sẵn có. `bundle-barrel-imports` không áp cho public `index.js` của slice. |
| `web-design-guidelines`       | Audit UI/a11y trước khi bàn giao màn hình mới hoặc khi được yêu cầu review. Bỏ quy tắc "Title Case" (UI tiếng Việt viết hoa đầu câu); ngày/số dùng `Intl.*` locale `vi-VN`.                                                                                                                         |
| `frontend-design`             | Chỉ cho trang mới cần bản sắc riêng (landing, marketing, onboarding). Màn hình trong cổng ứng viên/NTD/quản trị giữ ngôn ngữ thiết kế hiện có (antd + Tailwind, admin gọn).                                                                                                                         |
| `find-skills`                 | Khi cần năng lực chưa có skill; chỉ đề xuất nguồn uy tín, cài mức project.                                                                                                                                                                                                                          |

Skill không thay thế các quy tắc trong file này hay `frontend/ARCHITECTURE.md`;
khi mâu thuẫn, tài liệu của repo thắng.

## Kiểm tra trước khi bàn giao

Chạy tại `frontend/` theo phạm vi thay đổi:

```bash
npm run lint
npm run check:architecture
npm run test:coverage
npm run build
npm run test:e2e:smoke
```

Viết test và chọn lệnh chạy theo [tiêu chuẩn kiểm thử](docs/05-huong-dan/tieu-chuan-kiem-thu.md):
ngân sách thời gian được CI kiểm, test viết nhanh trên antd, tag `@responsive` cho
E2E. Khi đang sửa, chạy `npm run test:related <file>` thay vì cả bộ.

Không bỏ qua lỗi kiến trúc bằng alias sâu, shim vô thời hạn hoặc whitelist mới
nếu chưa có ADR và lý do cụ thể. Cập nhật `frontend/ARCHITECTURE.md` khi thêm
quy tắc, portal hoặc mô hình ownership có tác động lâu dài.

## Backend (ADR-0022)

Nguồn chi tiết: `docs/02-tong-quan/adr-0022-backend-structure.md`. Mọi Django
app trong `backend/apps/` theo đúng một layout:

```text
<app>/api/{urls,views,serializers}/ · seo/ · models/ · domain/ · selectors/ · services/ · tasks/ · signals/ · tests/
```

- Chiều phụ thuộc: `api → services/selectors → models → domain` (`domain/`: định
  nghĩa thuần không ORM mà models cũng dùng);
  `tasks | signals.receivers → services`. Không đặt module nghiệp vụ ở gốc app
  hay code trong `__init__.py` ngoài re-export.
- `services/` (ghi) và `selectors/` (đọc) KHÔNG import máy móc HTTP của DRF
  (serializers/views/generics/viewsets/response). Được phép:
  `rest_framework.exceptions`, `rest_framework_simplejwt`.
- Cross-app: chỉ import cấp package `apps.X.{models,domain,services,selectors,signals}`,
  `apps.accounts.api.permissions`, và từ tầng `api` thì thêm
  `apps.X.api.serializers` (serializer lồng); không deep-import module nội bộ.
  Thao tác thuần trên một bản ghi đặt ở method/manager của model để tránh vòng
  giữa các package services. `common/` không biết domain, không import `apps`.
- Endpoint list phải giữ số query phẳng theo số bản ghi — xem
  `apps/<app>/tests/test_query_budget.py`; tăng budget phải kèm giải thích trong PR.
- API view mới bắt buộc có `@extend_schema`; cổng OpenAPI chặn mọi lỗi/cảnh báo.
- Chuỗi trả về người dùng bọc `gettext`/`gettext_lazy` (msgid tiếng Việt) rồi
  chạy `docker compose exec -T backend python -m common.i18n_catalog update apps/<app>`
  và dịch `msgstr` tiếng Anh; email/thông báo render trong
  `common.i18n.recipient_language(người_nhận)` (ADR-0023).
- Pytest trong container phải thêm `--ds=config.settings.test`: container đặt
  `DJANGO_SETTINGS_MODULE` dev nên ghi đè giá trị trong `pyproject.toml`.
- Service báo lỗi bằng `ValidationError` hoặc `DomainError` (`common/errors.py`,
  handler ở `common/api/exceptions.py`); view không `try/except` chỉ để đổi kiểu lỗi.
  Cờ query đọc bằng `common.api.params.parse_bool`.

### Kiểm tra trước khi bàn giao (backend)

```bash
cd backend
ruff check . && ruff format --check .
lint-imports
bash ../scripts/check_backend_layering.sh
python ../scripts/check_backend_imports.py
python manage.py makemigrations --check --dry-run
bash ../scripts/check_openapi_schema.sh
pytest --cov --cov-fail-under=84
```

Hoặc một lệnh cho toàn repo: `./scripts/check_all.sh`.
