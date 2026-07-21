# ADR 0010 — Layout chuẩn duy nhất cho Django app

- **Trạng thái**: Accepted (2026-07-21)
- **Mở rộng**: ADR-0003 (backend service/selectors)
- **Bối cảnh**: Audit 2026-07 phát hiện 3 thế hệ layout cùng tồn tại trong
  `backend/apps/`: (A) `jobs`/`employers` có `api/` + `services/` + `selectors/`;
  (B) `cvs`/`applications`/`cv_templates` có `views.py` + `api_v2_views.py` song
  song; (C) 6 app legacy có `views.py`/`serializers.py` phẳng, business logic
  nằm trong view. Không có "chỗ đúng" để đặt code mới.

## Quyết định

Mọi app trong `backend/apps/` theo đúng một layout (chuẩn hóa từ thế hệ A):

```text
backend/apps/<app>/
├── api/
│   ├── serializers/        # tách theo resource khi > 300 dòng; luôn là package
│   └── views/              # chỉ HTTP: parse request -> gọi service/selector -> response
├── urls.py                 # ở gốc app (convention thế hệ A); import từ .api.views
├── models/                 # package; tách file khi > 300 dòng; __init__ re-export
├── services/               # GHI: mọi thao tác đổi state; giữ transaction boundary
├── selectors/              # ĐỌC: truy vấn phức tạp; tối ưu N+1 tại đây
├── tasks/                  # Celery: chỉ orchestrate, gọi vào services/
├── tests/
│   ├── test_api.py         # tầng HTTP
│   ├── test_services.py    # tầng nghiệp vụ
│   └── test_selectors.py   # tầng truy vấn
├── admin.py
└── apps.py
```

App CRUD thuần quá nhỏ (locations, skills) được phép bỏ `services/`/`selectors/`
khi chưa có logic ghi/đọc phức tạp — nhưng `api/` và `models/` là bắt buộc để
mọi app trông giống nhau.

## Quy tắc phụ thuộc (enforce bằng import-linter)

```text
api/ → services/ → models/
api/ → selectors/ → models/
tasks/ → services/
```

- `api/` không import model cho logic (chỉ type hint / `Meta.model`).
- `services/`, `selectors/` không import `api/` và không import máy móc HTTP
  của DRF (`serializers`, `views`, `generics`, `viewsets`, `response`).
  Được phép: `rest_framework.exceptions` (dịch sẵn sang HTTP 400) và
  `rest_framework_simplejwt` (hạ tầng token). Gác bằng
  `scripts/check_backend_layering.sh` + import-linter trong CI.
- App không import `services`/`selectors` **nội bộ** của app khác; giao tiếp
  cross-app qua hàm được re-export tại `<app>/services/__init__.py`.
- `common/` không import từ `apps/`.

## Hệ quả

- `views.py`, `serializers.py` phẳng ở cấp app bị xóa dần (P2), `*_v2_*.py` bị
  gộp khi thanh lý API v1 (P3).
- `import-linter` chạy trong CI, vi phạm = fail build — tương đương
  dependency-cruiser phía frontend.
