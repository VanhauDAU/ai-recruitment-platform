# Baseline đo lường — Audit & Refactor 2026-07

> Đo ngày 2026-07-21 trên `main` (12f536c8). Mọi số ở đây là mốc so sánh cho
> [kế hoạch audit & refactor](./audit-refactor-plan-2026-07.md). Chỉ được cập
> nhật phần "Theo dõi hàng tuần" — phần baseline giữ nguyên vĩnh viễn.

## Quy mô

| Hạng mục | Baseline |
| --- | --- |
| Backend Python (trừ migrations) | ~29.300 dòng, 16 app |
| Frontend JS/JSX | ~37.300 dòng |
| Endpoint API (OpenAPI paths) | **170** — snapshot: `docs/04-api/openapi-baseline-2026-07.yaml` |
| Lỗi schema drf-spectacular khi generate | 252 (53 unique) + 387 warning |

## Test & coverage

| Hạng mục | Baseline |
| --- | --- |
| Backend test | 280 test, **OK** (sau fix `manage.py` chọn settings test) |
| Thời gian suite backend | ~46s (serial; `--parallel` lỗi pickle — cần điều tra ở P2) |
| Coverage backend | **85%** (10.759 stmts — đo sau AR-P2, gate CI 84%) |
| Coverage frontend **thật** (toàn `src/`) | **Statements 33.99% · Branches 29.90% · Functions 28.40% · Lines 36.08%** |
| Coverage frontend theo allowlist cũ (11 đường dẫn) | 84.65/67.36/85.33/89.52 — con số này KHÔNG đại diện toàn repo |

## Bundle frontend

| Hạng mục | Baseline | Budget |
| --- | --- | --- |
| Initial JS (gzip) | 279.1 KiB | 320 KiB |
| Initial CSS (gzip) | 31.5 KiB | 35 KiB |
| Chunk lớn nhất | `RichTextEditorImpl` 120.35 KiB gzip | — |

## Nhánh git

- Trước triage: 32 nhánh local, "15 chưa merge vào main" — thực chất `main`
  local đi sau 107 commit; **mọi nhánh đều đã merge lên `origin/main`**.
- Sau triage: còn `main`, `dev` (+2 nhánh `feature/frontend-job-pages`,
  `feature/send-mail-register` đã merge 100%, chờ xóa thủ công:
  `git branch -D feature/frontend-job-pages feature/send-mail-register`).
- Rác local đã dọn: `celerybeat-schedule*`, `dump.rdb` (đều untracked).

## Phát hiện trong lúc đo (đã sửa ngay)

1. **Test isolation bug**: `manage.py test` local dùng settings development →
   `.env` có R2 credentials làm 4 test media fail; CI pass vì set
   `DJANGO_SETTINGS_MODULE=config.settings.test` tường minh. Fix: `manage.py`
   tự chọn `config.settings.test` khi lệnh là `test`.

## Việc tồn cho các phase sau

- [ ] `manage.py test --parallel` lỗi `cannot pickle 'traceback'` (P2, khi
      chuyển pytest sẽ thay bằng `pytest-xdist`).
- [ ] 248 lỗi schema spectacular (52 unique — toàn bộ là APIView thiếu serializer_class/@extend_schema; annotate dần).
- [ ] Squash migrations các app >15 migration (chưa làm — chỉ khi chưa có prod).

## Theo dõi hàng tuần

| Tuần | App chưa khớp layout | File >300 dòng (BE/FE) | Coverage (BE/FE stmts) | Vi phạm import | Suite (BE/FE) | Nhánh chưa merge |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-07-21 (baseline) | 13/16 | 24 / 22 | — / 33.99% | chưa có tool | 46s / — | 2 (chờ xóa) |
| 2026-07-21 (sau AR-P2) | 0/16 | 11 / 22 | 85% / 33.99% | 0 (2 contract KEPT) | 55s / — | 2 (chờ xóa) |
| 2026-07-21 (sau AR-P3) | 0/16 | 9 / 22 | 84.5% / 33.99% | 0 | 51s / e2e 63 pass | 2 (chờ xóa) |
