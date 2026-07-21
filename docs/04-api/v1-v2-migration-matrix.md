# Ma trận thanh lý API v1 → v2 (AR-P3, 2026-07-21)

Nguồn đối chiếu: `openapi-baseline-2026-07.yaml` (170 endpoint) → sau AR-P3
(163 endpoint). Frontend đã **không còn** gọi bất kỳ endpoint v1 nào trước khi
xóa (kiểm bằng grep toàn `frontend/src`).

## Endpoint v1 đã xóa và đích thay thế

| v1 (đã xóa) | Thay thế | Ghi chú |
| --- | --- | --- |
| `GET/POST /api/cvs/` | `GET/POST /api/v2/cvs/` | contract v2 (canonical document) |
| `POST /api/cvs/upload/` | `POST /api/v2/cvs/imports/` | import kèm AI structuring + idempotency |
| `GET/PATCH/DELETE /api/cvs/{id}/` | `/api/v2/cvs/{public_id}/` | |
| `GET /api/cvs/{id}/content/{kind}/` | `/api/v2/cvs/assets/{id}/content/` + `/api/v2/cvs/{id}/exports/{id}/download/` | file gốc phục vụ qua asset/export v2 |
| `GET /api/cv-templates/` | `GET /api/v2/cv-templates/` | |
| `GET /api/cv-templates/{slug}/` | `GET /api/v2/cv-templates/{slug}/` | |
| `GET/POST /api/applications/` | `GET/POST /api/v2/applications/` | |
| `GET /api/applications/employer/` | `GET /api/v2/recruiter/applications/` | **PORT** — chưa có v2, chuyển nguyên trạng (AR-P3) |
| `PATCH /api/applications/employer/{id}/` | `PATCH /api/v2/recruiter/applications/{public_id}/` | **PORT** — như trên |

## Đã xóa kèm theo

- `common/api_deprecation.py` (`LegacyApiDeprecationMixin`) — không còn nơi dùng.
- Biến env `LEGACY_CV_API_DEPRECATION_AT`, `LEGACY_CV_API_SUNSET_AT` (settings +
  `.env.example`).
- `apps/{cvs,cv_templates}/api/{views,serializers}/legacy.py`, `urls.py` v1 của
  3 app, mount v1 trong `config/urls.py`.
- 6 test chỉ chạm endpoint v1 (test service giữ nguyên, tách sang
  `test_document_services.py` / `test_services.py`).

## Quyết định versioning (ADR-0011)

Giữ tiền tố `/api/v2/` cho miền CV (cvs, cv-templates, applications) — đây là
contract frontend đang dùng, đổi sang không-version bắt sửa cả hai phía mà không
thêm giá trị. Các app còn lại giữ `/api/<app>/` không version. Khi API ổn định
sau đồ án, có thể gộp về một tiền tố duy nhất trong một đợt breaking change có
kiểm soát.
