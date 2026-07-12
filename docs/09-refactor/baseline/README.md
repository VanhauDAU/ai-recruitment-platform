# Giai đoạn 0 — Báo cáo khóa baseline

**Ngày:** 2026-07-13
**Nhánh:** `feature/restructuring`
**Tag rollback:** `baseline-refactor-start` → commit `bb1bfed` (Merge PR #23)

Tài liệu chốt trạng thái repo TRƯỚC khi tái cấu trúc, làm mốc so sánh và điểm quay về.

## 1. Baseline git

| Mục | Giá trị |
|---|---|
| Nhánh làm việc | `feature/restructuring` |
| HEAD | `bb1bfed` (Merge #23) |
| Tag rollback | `baseline-refactor-start` |
| Working tree | Sạch (0 file chưa commit) |

> **Lệch cần hòa hợp (không chặn Giai đoạn 0):** kế hoạch lấy baseline là `origin/main` = `d52883e` (Merge #24), nhưng nhánh này rẽ trước #24 (điểm chung `bb1bfed`) nên đang thiếu 12 commit của #24. Phải merge/rebase `origin/main` vào trước khi đưa refactor về `main` ở cuối epic. Các module gần đây (blog, candidate account, 2FA) đã có đầy đủ và committed trong nhánh này.

## 2. Backend quality suite — ✅ XANH

| Kiểm tra | Kết quả |
|---|---|
| `manage.py check` | 0 issue |
| `makemigrations --check --dry-run` | No changes detected (không migration treo) |
| `manage.py test` | **74/74 pass** (5.7s) |

**Lỗi nền cần biết:** `InsecureKeyLengthWarning` — JWT HMAC signing key ở dev < 32 byte. Không làm hỏng test; xử lý ở Giai đoạn 7 (tách settings production/dev) nếu cần siết.

## 3. Frontend quality suite — ✅ XANH

| Kiểm tra | Kết quả |
|---|---|
| `npm run lint` (oxlint) | 0 lỗi |
| `npx vitest run` | **31/31 pass** (8 file test) |
| `npm run build` (vite) | Thành công, 81 chunk |

> E2E Playwright chưa chạy trong đợt baseline này (giữ nhanh); sẽ đưa vào CI ở Giai đoạn 1 và chạy cho luồng bị ảnh hưởng khi refactor auth.

## 4. Bundle report

Chi tiết: [`bundle-report.txt`](./bundle-report.txt). Các chunk lớn nhất (gzip) làm mốc "initial bundle không được tăng":

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry) | 474.9 kB | 148.0 kB |
| `react-*.js` (vendor React core) | 232.6 kB | 74.5 kB |
| `Settings-*.js` (route admin) | 148.0 kB | 47.1 kB |
| `useSize-*.js` | 120.8 kB | 46.3 kB |
| `index-*.css` | 129.7 kB | 19.9 kB |

## 5. Inventory hotspot

Sinh bằng `python scripts/codebase_inventory.py --out docs/09-refactor/baseline/inventory.md` (chạy lại được). Chi tiết: [`inventory.md`](./inventory.md).

- Tổng file quét: **383**
- File ≥ 500 dòng: **1** (`backend/apps/accounts/tests.py` — 520)
- File 300–499 dòng: **11** (home components, `jobs.py` serializer 380, `settings.py` 376, `JobList.jsx` 365...)
- Import nội bộ nóng nhất: `common.media_storage` (19), `@/hooks/useAuth` (13), `@/api/jobService` (13), `apps.accounts.permissions` (12).

Những điểm này định hướng thứ tự tách: `settings.py` (GĐ7), serializer/service jobs (GĐ5), `api/*` hạ tầng (GĐ2), auth/account (GĐ3).

## 6. Điều kiện kết thúc Giai đoạn 0 — ĐẠT

- [x] Có commit/tag baseline quay lại được (`baseline-refactor-start`).
- [x] Biết rõ lỗi nền (JWT key warning) vs lỗi mới (chưa có).
- [x] Có danh sách file >300/>500 dòng và import nóng (inventory.md).
- [x] Baseline build được (BE test + FE build đều xanh) → đủ điều kiện bắt đầu di chuyển source.
