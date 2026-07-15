# CV Builder rollout runbook

**Cập nhật:** 2026-07-15

## Thứ tự triển khai

1. Backup PostgreSQL và media/object storage; xác nhận worker hiện tại đã xử lý
   hết export job pending.
2. Deploy code + dependency đã pin (`WeasyPrint`, `pypdfium2`, `pypdf`,
   `python-docx`) trước khi chạy worker mới.
3. Chạy `python manage.py migrate`. Các migration locale là expand/backfill;
   không xóa compatibility column và có thể deploy cùng client cũ.
   Chính sách CV mới dùng hard-delete. Các row archive mềm tồn tại từ release
   cũ không được purge tự động: đếm, backup và chỉ purge sau xác nhận riêng vì
   thao tác này không thể hoàn tác.
4. Chạy `python manage.py check` và smoke public catalogue/preview.
5. Restart web, Celery worker và Celery beat. Worker phải có quyền ghi media và
   Fontconfig cache (`XDG_CACHE_HOME` hoặc cache directory tương đương).
6. Regenerate snapshot theo template từ admin hoặc gọi task bulk sau khi worker
   ổn định. Asset cũ chỉ bị thay pointer khi cả thumbnail/preview mới đã ghi.
7. Bật AI provider bằng admin setting và secret environment tương ứng. Secret
   trong `backend/.env` được đọc qua `python-decouple`; không lưu vào database.
   Badge Admin chỉ báo trạng thái boolean bằng cùng resolver, không trả secret.

## Kiểm tra sau deploy

```bash
cd backend
./venv/bin/python manage.py check
./venv/bin/python manage.py showmigrations sitecontent jobs cv_templates cvs

cd ../frontend
npm run test:e2e:smoke
```

Quan sát các metric PII-free: `cv_preview_latency_ms`,
`cv_preview_cache_hit`, `cv_autosave_conflict`, `cv_import_duration_ms`,
`cv_import_failure`, `cv_snapshot_duration_ms`, `cv_snapshot_failure`.

## Ngưỡng cảnh báo khởi điểm

- Preview p95 > 800 ms trong 10 phút hoặc cache-hit < 60%.
- Autosave conflict > 2% request draft write.
- Import failure > 15% (tách theo `failure_code`; scan PDF không tính lỗi hệ thống).
- Snapshot failure > 5% hoặc duration p95 > 30 giây.
- Queue import/export pending lâu hơn 5 phút.

## Rollback

- Có thể rollback web/frontend về release trước vì API thay đổi additive và
  compatibility fields vẫn còn.
- Không reverse migration sau khi đã có locale/import job production; giữ bảng
  mới, rollback application code và điều tra.
- Dừng worker import/snapshot nếu provider/render runtime lỗi; draft/version cũ
  và public asset cũ không bị thay đổi.
- Không drop `locale`, `cv_data`, `style_config` hoặc endpoint V1 trong rollout
  này. Contract cleanup chỉ thực hiện ở release riêng sau telemetry ổn định.
