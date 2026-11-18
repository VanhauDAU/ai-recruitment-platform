# ADR-0022: Cấu trúc backend Django REST — bố cục app, luật phụ thuộc, URL theo cổng

**Trạng thái:** Đã chấp nhận
**Ngày:** 19/11/2026
**Owner:** Backend
**Thay thế:** ADR-0010 (layout chuẩn Django app, 21/07/2026, đã gỡ khỏi `docs/` ở
commit `327ae807`; nội dung xem bằng
`git show 327ae807^:docs/adr/0010-canonical-backend-app-layout.md`)

## Bối cảnh

ADR-0010 dựng khung `api/ · models/ · services/ · selectors/ · tasks/ · tests/`
cho 16 app. Bốn tháng sau, backend có 18 app (~140 nghìn dòng, 1.654 test) và
khung bị lệch theo tốc độ thêm tính năng:

- khoảng 30 module "lạc" ở gốc app (`accounts/oauth.py`, `cvs/schemas.py`,
  `cv_templates/renderers.py`, `employers/page_registry.py`…), nằm ngoài contract
  layer của import-linter nên không bị kiểm;
- URL rải ở 7 kiểu file (`urls_v2`, `urls_admin`, `urls_seo`, `urls_public`,
  `urls_ai`, `urls_candidate`); tiền tố `/api/v2/` dùng cả cho app không thuộc
  miền CV; endpoint quản trị có 4 kiểu đường dẫn;
- `cvs ↔ cv_templates` import vòng; khoảng 45 deep-import chéo app; model chiến
  dịch nằm ở `employers` trong khi nghiệp vụ chiến dịch ở `campaigns`;
- view chứa ORM, `transaction`, `select_for_update`; không có exception handler
  chung; 109/281 view thiếu `@extend_schema`.

Luật của ADR-0010 đúng nhưng không đủ cụ thể (không nói URL, signal, module gốc,
`common/`) và chỉ một phần được CI kiểm.

## Quyết định

### 1. Bố cục một app

```text
apps/<app>/
  apps.py · admin.py · checks.py (chỉ Django system check, nếu có)
  api/
    urls/<cổng>.py         # public | candidate | employer | admin | auth | shared — chỉ cổng app phục vụ
    views/<cổng>.py        # tách thành views/<cổng>/<resource>.py khi > 400 dòng
    serializers/           # cùng quy tắc với views
    permissions.py         # permission riêng của app, nếu có
  seo/{urls.py,views.py}   # HTML shell + sitemap cho bot, không thuộc /api
  models/                  # model + QuerySet/Manager; __init__ re-export
  domain/                  # định nghĩa thuần (không ORM, không I/O): registry, hằng số, luật
  selectors/               # ĐỌC: truy vấn, read model, chống N+1
  services/                # GHI: đổi state, transaction, tích hợp ngoài, exception nghiệp vụ
  tasks/                   # Celery: chỉ điều phối, gọi services
  signals/__init__.py      # khai báo Signal công khai của app
  signals/receivers.py     # receiver: chỉ gọi services; connect trong apps.ready()
  management/commands/
  migrations/ · tests/
```

- `domain/` chứa thứ mà `models/` cũng cần (registry section/layout CV, registry
  trang công ty, chuẩn hóa số điện thoại, salt ký…). Nó không import ORM hay
  tầng nào khác của app, nên mọi tầng đều dùng được.
- Hàm dựng QuerySet dùng chung cho cả `services/` và `selectors/` (ví dụ
  `jobs/models/recommendation_queries.py`) đặt trong `models/`: hai tầng đó độc
  lập với nhau, không được import lẫn nhau.
- `urls/<cổng>.py` phân theo người dùng của endpoint: `auth` (chỉ accounts:
  đăng nhập, phiên, hồ sơ tài khoản), `shared` (cần đăng nhập, dùng ở nhiều cổng
  — ví dụ uploads), còn lại theo bốn cổng. Endpoint `AllowAny` nằm trong luồng
  của một cổng (đăng ký NTD) thuộc cổng đó.
- Không có module nghiệp vụ ở gốc app ngoài danh sách trên. Không đặt code trong
  `__init__.py` ngoài re-export.
- App CRUD thuần nhỏ (locations, skills) được bỏ `services/`/`selectors/` khi
  chưa có logic; `api/` và `models/` vẫn bắt buộc.
- Đặt tên module theo **cổng** (`public`, `candidate`, `employer`, `admin`) hoặc
  theo **tài nguyên** trong cổng; không đặt theo phiên bản API (`v2.py`).

### 2. Luật phụ thuộc

Trong một app:

```text
api → services | selectors → models → domain
tasks | signals.receivers → services
```

- `services/`, `selectors/` không import máy móc HTTP của DRF (`serializers`,
  `views`, `generics`, `viewsets`, `response`, `decorators`). Được phép
  `rest_framework.exceptions` và `rest_framework_simplejwt`.
- View không gọi `.delay()` trực tiếp; service xếp task qua
  `transaction.on_commit`.

Chéo app — app A chỉ được import từ app B:

| Được import | Ghi chú |
| --- | --- |
| `apps.B.models` | chỉ cấp package — model, choices, QuerySet, validate gắn với model |
| `apps.B.domain` | chỉ cấp package — định nghĩa thuần (registry, hằng số) |
| `apps.B.services` | chỉ cấp package — hàm được re-export ở `services/__init__.py` |
| `apps.B.selectors` | chỉ cấp package — hàm được re-export ở `selectors/__init__.py` |
| `apps.B.signals` | chỉ khai báo Signal |
| `apps.B.api.serializers` | chỉ cấp package, chỉ từ tầng `api` của A — serializer lồng (ví dụ CV trong hồ sơ ứng tuyển) |
| `apps.accounts.api.permissions` | lớp permission dùng chung toàn hệ thống |

- `common/` là hạ tầng không biết domain, dùng bởi ít nhất hai app; không import
  `apps`. Code chỉ một app dùng thì đặt trong app đó.
- `cv_templates` là "engine tài liệu CV": schema nội dung
  (`models/content_schema.py`), section/layout/renderer (`domain/`), ghép document
  (`services/composition.py`) và in PDF (`services/printing.py`, engine Chromium
  ở `common/pdf/browser.py`). `cvs` (CV của người dùng) gọi services của
  `cv_templates`; `cv_templates` chỉ đọc **model** `cvs.CvAsset` (ảnh nền
  catalogue đang lưu chung bảng với avatar) và không gọi services của `cvs`.
- Thao tác thuần trên một bản ghi là method/manager của model, không phải
  service, để app khác dùng mà không tạo vòng giữa các package services — ví dụ
  `CampaignActivity.objects.record(...)`, `RecruitmentCampaign.active_seconds()`,
  `CvAsset.storage()`.

### 3. URL theo cổng

Một phiên bản API duy nhất, không tiền tố version:

| Tiền tố | Nội dung |
| --- | --- |
| `/api/auth/` | đăng nhập, đăng ký, `me`, OAuth, mật khẩu |
| `/api/public/<resource>/` | dữ liệu công khai: việc làm, công ty, blog, trung tâm trợ giúp, landing chiến dịch, cấu hình site, địa điểm, kỹ năng, mẫu CV, consent |
| `/api/candidate/<resource>/` | cổng ứng viên |
| `/api/employer/<resource>/` | cổng nhà tuyển dụng |
| `/api/admin/<resource>/` | toàn bộ endpoint quản trị |
| `/api/uploads/`, `/api/health/` | hạ tầng dùng chung |

- `config/urls.py` ghép theo cổng; mỗi app khai `api/urls/<cổng>.py`. Mỗi cổng
  một router để không trùng API-root.
- URL SEO ngoài `/api` (`/viec-lam`, `/cong-ty`…) giữ ổn định vì đã được index.

### 4. Tầng HTTP

- Lỗi đi qua một `EXCEPTION_HANDLER`: Django `ValidationError` và exception
  nghiệp vụ được dịch tập trung; view không tự `try/except` để đổi kiểu lỗi.
- List tăng theo dữ liệu luôn phân trang, envelope `{count,next,previous,results}`.
- Mọi view DRF có `@extend_schema`; CI chặn warning của drf-spectacular.
- CRUD tài nguyên dùng `generics`/`ViewSet` + router; hành động dùng `APIView`.

### 5. Thuật ngữ

| Thuật ngữ | Nghĩa trong code |
| --- | --- |
| company | công ty — thực thể pháp lý, trang công ty |
| recruiter | người dùng làm tuyển dụng, thành viên của một company |
| employer | tên **cổng** (portal) và role `User.Role.EMPLOYER` |
| candidate | người dùng ứng viên, tên cổng ứng viên |

## Cách enforce

| Luật | Công cụ |
| --- | --- |
| layer trong app (`api → services/selectors → models → domain`), `common` ↛ `apps` | `lint-imports` (`backend/pyproject.toml`) |
| services/selectors/tasks/signals không dùng DRF HTTP | `scripts/check_backend_layering.sh` |
| import chéo app, module gốc app | `scripts/check_backend_imports.py` |
| schema OpenAPI hợp lệ, khớp `docs/04-api/openapi.yaml` | `scripts/check_openapi_schema.sh` |

Cả bốn chạy trong `backend-ci.yml` và `scripts/check_all.sh`. Trong GĐ0–GĐ1,
`check_backend_imports.py` dùng baseline chỉ được giảm (148 → 33 mục); GĐ2 đưa
về 0 và gỡ baseline, từ đó mọi vi phạm làm fail CI.

## Lộ trình

Áp dụng qua 7 giai đoạn, mỗi giai đoạn một PR về `dev`:

| GĐ | Nội dung |
| --- | --- |
| 0 | ADR này, cổng kiểm tra import/OpenAPI, tách `requirements-dev.txt`, settings an toàn |
| 1 | Chuẩn hóa bố cục từng app và `common/` (chỉ di chuyển); tên module/lớp `v2` đổi ở GĐ4 cùng URL |
| 2 | Ranh giới domain: chuyển model chiến dịch sang `campaigns` (migration chỉ đổi state), phá vòng `cvs ↔ cv_templates`, bỏ lazy export của accounts, baseline import về 0 rồi gỡ |
| 3 | Tầng API: exception handler, nghiệp vụ ra khỏi view/serializer, phân trang, `@extend_schema` |
| 4 | URL theo cổng (backend + frontend cùng PR) |
| 5 | Tách file lớn, gộp code trùng, gỡ legacy và lệnh chạy một lần |
| 6 | Baseline migration mới (chưa có production) |

## Hệ quả

- Mỗi module có một owner và một tầng; người mới tìm được chỗ đặt code bằng bảng
  ở mục 1.
- GĐ4 đổi URL API: frontend sửa cùng PR, không giữ alias cũ.
- GĐ6 làm mất lịch sử migration; DB local phải reset và seed lại.
