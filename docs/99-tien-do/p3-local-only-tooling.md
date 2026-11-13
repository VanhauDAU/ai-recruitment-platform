# P3 Chuyển tooling về local-only

P3 chạy trên nhánh `chore/local-only-tooling`, bắt đầu từ `dev` tại commit
`587306b9`. Trước khi bỏ cấu hình deploy, checkpoint có thể phục hồi
`procv-pre-local-only-2026-09-27` đã được tạo và đẩy lên remote tại cùng commit.
Phạm vi chỉ thay đổi tooling, tài liệu và hợp đồng tên Celery task; không đổi
schema, migration, URL, API payload, UI, role hoặc storage key.

## Cấu hình đã bỏ và phần được giữ

Các file chỉ phục vụ deploy production đã được xóa khỏi nhánh hiện tại:

- `docker-compose.prod.yml`;
- `deploy/nginx/procv.conf`;
- `frontend/Dockerfile`;
- `frontend/nginx.conf`.

`docker-compose.yml`, `backend/Dockerfile`, Django production settings, ASGI và
WSGI vẫn được giữ. README và tài liệu Compose đã chuyển sang hướng dẫn local;
runbook storage dùng lệnh Compose local. Detector CI vẫn chủ ý nhận diện tên các
file production đã xóa để một diff xóa/đổi tên tiếp tục được phân loại đúng.
Inventory P0 giữ tên và Git blob lịch sử, không phải consumer runtime.

## Hợp đồng worker phát hiện khi smoke

Beat và routing dùng ba tên package-boundary `apps.uploads.tasks.*`, nhưng task
được Celery tự đặt tên theo module nội bộ `apps.uploads.tasks.scanning.*`. Worker
vì vậy từng loại bỏ message cũ là unregistered task. P3 gắn tên ổn định tường
minh cho ba task upload và thêm regression test xác nhận registry:

- `apps.uploads.tasks.scan_upload_session`;
- `apps.uploads.tasks.dispatch_pending_upload_scans`;
- `apps.uploads.tasks.expire_and_clean_upload_sessions`.

Đây là khôi phục hợp đồng task đã có, không thêm workflow hay lịch tác vụ mới.

## Gate P3

- `docker compose config --quiet` đạt; danh sách service local gồm DB, Redis,
  backend, frontend, worker, beat, AI worker, media init và ClamAV.
- DB, Redis, backend, frontend và worker chạy; API `/api/health/` trả
  `{"status":"ok"}`, frontend cổng 5173 trả HTTP 200.
- Worker ping đạt, lắng nghe queue `upload-scan`; task đại diện
  `dispatch_pending_upload_scans` được nhận và hoàn tất thành công với kết quả 0.
- Regression test hợp đồng deployment upload đạt 3/3.
- Full backend suite đạt 1.262 pass, 2 skip theo marker môi trường và coverage
  87,60%, cao hơn ngưỡng 84%; Ruff/format, import-linter, Django system check và
  migration dry-run đều đạt.
- Frontend lint, architecture, build và bundle budget đạt; bundle ban đầu
  317,4 KiB JavaScript và 37,4 KiB CSS, dưới budget hiện hành.
- Markdown link check đạt trên 83 file với 228 đích nội bộ; Git diff check đạt.

P3 chỉ chuyển sang `Verified` sau khi PR được squash merge vào `dev`.
