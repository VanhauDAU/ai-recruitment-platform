# Kết quả Audit & Refactor AR-P0 → AR-P6 (2026-07-21)

Kế hoạch: [audit-refactor-plan-2026-07.md](./audit-refactor-plan-2026-07.md) ·
Baseline chi tiết: [baseline-2026-07.md](./baseline-2026-07.md)

## Trước / Sau

| Chỉ số | Trước (baseline) | Sau |
| --- | --- | --- |
| App backend khớp layout chuẩn | 3/16 (3 thế hệ layout chồng nhau) | **16/16** (ADR-0010) |
| Enforce kiến trúc backend | không có | **import-linter 2 contract + layering gate trong CI** |
| Vi phạm ruff | 206 (chưa có linter) | **0** — gate CI |
| Coverage backend | không đo được | **84.5%**, gate CI `--cov-fail-under=84` |
| Coverage frontend (cách đo) | 84% trên allowlist **11 file** | **33.95% đo toàn `src/`** — ratchet gate |
| API surface | 170 endpoint, v1+v2 song song | **163 endpoint, chỉ v2** (ma trận: `docs/04-api/v1-v2-migration-matrix.md`) |
| File backend > 400 dòng (trừ test/seed) | 11 | 9 |
| `views.py`/`serializers.py` phẳng | 13 app | **0** |
| Docker | không có | Compose dev + prod (nginx, worker, beat) |
| Env quản trị | 97 biến, 7 biến code đọc mà không khai | fail-fast + `check_env_sync.sh` trong CI |
| Nhánh local | 32 (main tụt 107 commit) | 4 |
| Test backend | 280 (4 fail trên máy dev do rò `.env`) | 278 pass + 2 query-budget + isolation fix |
| Lỗi schema OpenAPI | 52 (endpoint không có schema trong Swagger) | **0** |
| Operation thiếu response schema | 76/233 | **16/233** — toàn bộ là DELETE 204 (đúng thiết kế) |
| Operation thiếu requestBody | 36 | **14** |

## Bug thật phát hiện & sửa trong quá trình dọn

1. `except UserCv.DoesNotExist` / `RecruitmentNeed.DoesNotExist` với model chưa
   import → NameError 500 thay vì 404/400 (ruff F821).
2. `manage.py test` local dùng settings development → R2 credentials trong
   `.env` rò vào test, kết quả khác CI.
3. `client.js` fallback `localhost:8000` ở build production khi thiếu env —
   giờ throw ngay khi load.
4. Layer: model `cv_templates` gọi lên service; service `accounts` import
   serializer; service `captcha` import DRF serializers — cả 3 đã gỡ.

## Nợ ghi nhận (có chủ ý, chưa làm)

- 9 file frontend > 300 dòng (oxlint `max-lines` warn — nâng error khi tách hết).
- `accounts/tests/test_all.py` 1.611 dòng — tách theo tầng + factory-boy.
- Squash migrations (chỉ làm khi chắc chắn chưa có production DB).
- Email đồng bộ trong request ở 2FA/reset/welcome (xem
  `docs/07-algorithms/flow-audit-2026-07.md`).
- Build Docker image chưa verify trên máy dev (daemon tắt) — cần
  `docker compose build` một lần.
