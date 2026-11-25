# Kế hoạch chuẩn bị deploy procv.site

Bảo mật · lộ dữ liệu · hiệu năng · chịu tải · backup · khôi phục. Duyệt 25/11/2026.

## Bối cảnh
Bộ file production đã nằm trên `dev` (docker-compose.prod.yml, frontend/docker/nginx, scripts/deploy/*, runbook `docs/06-deployment/huong-dan-deployment.md`). Ba đợt rà soát (bảo mật, hiệu năng, vận hành/backup) cho thấy cấu hình nền đã tốt (production.py fail-fast, IDOR chặn bằng queryset theo phạm vi, DOMPurify, throttle cho login/OTP/upload, không lộ secret trong git), nhưng còn các lỗ hổng sẽ gây sự cố ngay khi chạy thật:

- **Không khôi phục được hoàn toàn**: `backend/.env` (Fernet key, SECRET_KEY, JWT key) không có bản sao ngoài VPS → mất VPS là mất khả năng giải mã cột mã hóa. Backup DB không mã hóa, không kiểm tra, không báo lỗi; token R2 trên VPS xóa được mọi bản backup; bucket CV riêng không được sao lưu.
- **Mù khi có lỗi**: không có `LOGGING`, không Sentry, `ADMINS` rỗng → traceback 500 bị bỏ; `/api/health/` trả tĩnh.
- **Bảo mật**: Django 5.1.5 hết hỗ trợ (CVE chưa vá); LibreOffice chuyển DOCX→PDF đồng bộ trong gunicorn, ẩn danh gọi được qua link chia sẻ CV, kế thừa toàn bộ secret qua env; admin không MFA; origin 80/443 mở cho mọi IP (Docker bỏ qua ufw) → vượt Cloudflare; tài khoản demo mật khẩu công khai (`AdminDemo123!`, `demo12345`, repo public) có thể theo dump dev lên prod; OAuth state không gắn trình duyệt; chưa có CSP cho SPA.
- **Chịu tải**: backend chỉ 8 slot đồng thời; `/api/public/jobs/stats/` ~235 truy vấn/lần, không cache, gọi từ trang chủ → nghẽn đầu tiên ở ~200 người. Redis dùng chung cache + broker + channel layer với `noeviction 256mb` → đầy là sập toàn bộ. `CONN_MAX_AGE=0`. Tổng mem_limit ~9,3 GB trên máy 8 GB; ml-worker không giới hạn CPU. File lịch beat trong `/tmp` → job dọn dữ liệu hằng ngày không chạy nếu deploy >1 lần/ngày.

**Quyết định đã chốt (25/11):** tải mục tiêu ~200 người đồng thời, p95 < 800 ms, lỗi < 1%; Sentry free + UptimeRobot free; mã hóa backup DB + sync bucket CV hằng ngày, khóa giải mã giữ ngoài VPS; rehearsal trên chính VPS trước khi mở DNS.

**Cách làm:** mỗi giai đoạn code = một nhánh từ `dev` (`git checkout -b <nhánh> dev`) → một PR base `dev`, chạy đủ CI trước khi tạo PR, cập nhật `docs/TIEN-DO-DU-AN.md` + runbook ngay trong PR đó. GĐ 0 và GĐ 6 là việc của user/vận hành, không phải PR.

---

## GĐ 0 — Việc phía user (song song, không code)
1. **Ký gửi secret**: lưu `backend/.env`, `frontend/.env`, origin cert, khóa riêng `age` (giải mã backup) vào password manager; ghi rõ "không có = không khôi phục được".
2. **Cloudflare**: Access policy (email OTP) cho `procv.site/admin*` và `procv.site/api/admin/*`; rate-limit rule cho `/api/` (vd 300 req/phút/IP, chặt hơn cho `/api/auth/*`); bật Authenticated Origin Pulls; Cache Rule cho `/sitemap*.xml`.
3. **R2**: bucket `procv-backups` (DB) + `procv-backups-files` (bản sao CV) bật **Bucket Lock** (retention 30 ngày); token VPS chỉ *Object Write* (không xóa); token đọc giữ ngoài VPS.
4. **Tài khoản giám sát**: Sentry (2 project: backend, frontend), UptimeRobot (monitor `https://procv.site/api/health/ready/` + `/`), healthchecks.io (2 check: backup DB, backup file) — báo qua email/Telegram.
5. **Pháp lý**: viết DPA của ProCV thay mẫu TopCV; nội dung Điều khoản + Chính sách quyền riêng tư cho ứng viên.

## GĐ 1 — Bảo mật ứng dụng (PR `feat/predeploy-security`)
> Trạng thái 25/11: đã làm (xem `docs/TIEN-DO-DU-AN.md`). Khác kế hoạch ban đầu: pip-audit
> lộ thêm CVE nên nâng luôn DRF, simplejwt, cryptography, Pillow, daphne/twisted…;
> CSP ở chế độ Report-Only, bật chặn ở bước rehearsal (GĐ 6); `check --deploy` chạy
> qua `scripts/check_production_settings.py` trong `security-ci.yml`.
- **Nâng phụ thuộc**: `backend/requirements.txt` Django 5.1.5 → 5.2 LTS, `pypdf` → 6.x, `requests` → bản vá; chạy đủ test.
- **LibreOffice** (`backend/common/files/office_preview.py`): `subprocess.run(..., env={'HOME': tmp, 'PATH': ...})`; cache PDF đã render theo storage key + phiên bản file (private storage); throttle `CvSharedSourceFileView` (`apps/cvs/api/views/shares.py`), CV source view (`cvs.py:165`), và các view tài liệu công ty.
- **Seed demo**: chặn `seed_demo_jobs` và `seed_admin_account_demo` khi `IS_PRODUCTION` (bỏ đường `--force`); thêm lệnh `purge_demo_accounts` (xóa/khóa `@demo.local`) và gọi trong runbook sau khi restore dump dev.
- **OAuth state** (`apps/accounts/services/oauth.py`, `api/views/oauth.py`): gắn state với cookie HttpOnly (lưu hash), so khớp ở callback.
- **Nhỏ**: throttle `PasswordChangeView` + login_guard; captcha/throttle chặt hơn cho `RegisterEmailAvailabilityView`; `production.py` bắt buộc `API_DOCS_ENABLED=False`; reCAPTCHA kiểm `hostname`; throttle admin invitation.
- **nginx** (`frontend/docker/nginx/snippets/security-headers.conf`, `procv.conf`): CSP cho HTML (script-src self + google/gstatic cho reCAPTCHA, img-src self media.procv.site data:, connect-src self wss:, frame-ancestors none), Permissions-Policy, COOP, HSTS includeSubDomains; `location ~ /\.` deny (chặn `/.vite/manifest.json`); nâng `nginx:1.27-alpine`; `client_max_body_size` khớp `UPLOAD_MAX_BYTES`. `frontend/.dockerignore` thêm `.env.*`. Sửa canonical `procv.vn` → `procv.site` trong `frontend/index.html`.
- **CI** (`.github/workflows/backend-ci.yml`): `pip-audit`, `gitleaks`, `shellcheck scripts/deploy/*.sh`, `python manage.py check --deploy` với settings production + env giả; thêm `.github/dependabot.yml` (pip, npm, docker, actions).
- Kiểm chứng: test mới cho throttle/OAuth state/seed guard; e2e smoke đăng nhập OAuth không vỡ; build web rồi `curl -I` kiểm header CSP và trang có reCAPTCHA vẫn chạy.

## GĐ 2 — Hạ tầng, giám sát, chịu lỗi (PR `feat/predeploy-ops`)
> Trạng thái 25/11: đã làm (xem `docs/TIEN-DO-DU-AN.md`). Khác kế hoạch ban đầu:
> frontend dùng `@sentry/browser` thay `@sentry/react` (bản react làm rolldown chia lại
> chunk khởi tạo +1,2 KiB); khóa origin dùng `ssl_verify_client optional` + 403 để
> deploy.sh vẫn gọi thử từ chính VPS; nginx dùng `server ... resolve` trong upstream
> (nginx 1.28) thay cho biến trong `proxy_pass`, giữ keepalive và URI; CA Authenticated
> Origin Pulls tải trên VPS theo runbook, không commit.
- **Redis tách 2 instance** (`docker-compose.prod.yml`, `config/settings/components/tasks.py`): `redis-broker` (noeviction, AOF — Celery + channel layer) và `redis-cache` (`allkeys-lru`/`volatile-lru`, 384 MB, không AOF). Thêm `SOCKET_TIMEOUT`/`SOCKET_CONNECT_TIMEOUT` cho django_redis; `expires` cho mọi entry beat.
- **Beat**: lịch lưu trên volume; chuyển job hằng ngày sang `crontab()` giờ thấp điểm, so le; thêm `flushexpiredtokens`, purge `AuthSession` cũ, purge outbox `AuthEmailJob`, `clearsessions`. Chuyển `recover-stale-job-ai-generations` sang queue `default` + `expires`.
- **Tài nguyên**: ml-worker `cpus: 2` + `OMP_NUM_THREADS=2`/`MKL_NUM_THREADS=2`, đo RAM thật rồi hạ `mem_limit` (~2 GB); cân lại tổng ≤ ~7 GB; sửa bảng RAM trong runbook. gunicorn `--worker-tmp-dir /dev/shm`. Healthcheck `celery inspect ping` cho worker/ai-worker/ml-worker.
- **Logging + Sentry**: `LOGGING` (console, JSON, INFO; `django.request` ERROR) trong `config/settings/components/`; `sentry-sdk` backend (Django + Celery, `send_default_pii=False`, scrub body/cookie/Authorization, sample traces 0.05) và `@sentry/react` frontend (lazy, chỉ khi có DSN); tắt access log gunicorn (nginx đã ghi).
- **Health**: `/api/health/` giữ nguyên cho liveness; thêm `/api/health/ready/` kiểm DB + 2 Redis (dùng cho UptimeRobot và deploy.sh).
- **Khóa origin**: nginx `ssl_verify_client` với CA Authenticated Origin Pulls của Cloudflare (cert công khai đặt trong `deploy/certs`); `bootstrap_vps.sh` thêm rule `DOCKER-USER` chỉ cho dải IP Cloudflare vào 80/443, `PermitRootLogin no` + `AllowUsers deploy`, unattended-upgrades tự reboot 04:30, `live-restore: true`, không restart Docker nếu daemon.json không đổi.
- **Chống nhầm dev/prod**: `docker-compose.yml` thêm `name: ai-recruitment-platform` (giữ đúng tên project hiện tại — tên khác sẽ đổi tên volume, mất DB local); thay lệnh `docker compose` trần trong `van-hanh-va-kill-switch.md` bằng `scripts/deploy/compose.sh`.
- **nginx**: `resolver 127.0.0.11 valid=10s` + biến upstream để không trỏ IP container cũ sau deploy; trang bảo trì tĩnh `50x.html` cho 502/503/504; `location ^~ /images/` cache 1 ngày.
- Kiểm chứng: `docker compose -f docker-compose.prod.yml config` hợp lệ; dựng stack prod cục bộ (env giả) → mọi service healthy; ném lỗi thử thấy trên Sentry; `redis-cli info memory` hai instance; xem log beat đăng ký đủ lịch.

## GĐ 3 — Backup & khôi phục (PR `feat/predeploy-backup`)
- **`scripts/deploy/backup_db.sh`**: `flock`; `trap` xóa `.tmp`; kiểm dung lượng trống; tên file có giây; `pg_restore --list` + ngưỡng kích thước; mã hóa `age -r <public key>` trước khi đẩy R2; giữ 7 bản ngày + 4 bản tuần + 6 bản tháng (cục bộ chỉ bản mã hóa); ping healthchecks.io khi thành công/thất bại; xoay `backup.log`.
- **Mới `scripts/deploy/backup_files.sh`**: `rclone sync` bucket `procv-private-files` → `procv-backups-files` (có Bucket Lock) + ping healthchecks; cron 03:30.
- **Mới `scripts/deploy/backup_secrets.sh`**: đóng gói `backend/.env`, `frontend/.env`, `deploy/certs` → `age` → R2 (chạy khi đổi env, ghi trong runbook).
- **`scripts/deploy/restore_db.sh`**: giải mã `.age` nếu cần; dump an toàn DB hiện tại trước; bật trang bảo trì (web vẫn chạy); `dropdb`/`createdb` thay `--clean`; `pg_restore --exit-on-error`; FLUSHALL redis-cache + redis-broker; `up -d`, chờ `/api/health/ready/`; chạy `reconcile_account_status_holds`, `purge_demo_accounts` (nếu dump từ dev), nhắc `matching_backfill`.
- **Mới `scripts/deploy/restore_files.sh`**: rclone ngược từ bucket backup về bucket private.
- **`scripts/deploy/deploy.sh`**: `flock`; tự chạy `backup_db.sh` khi có migration mới (`showmigrations --plan` so sánh); gắn tag image theo commit (`procv-backend:<sha>` + `:prod`), giữ 3 bản gần nhất → rollback = `--skip-build <sha>` không cần build lại; `docker builder prune --keep-storage 10GB`; ghi cả lần thất bại vào `history.log`; build trước, chỉ checkout ref khi build xong.
- **Runbook mới** `docs/06-deployment/sao-luu-va-khoi-phuc.md`: RPO 24 h (DB) / 24 h (file), RTO mục tiêu 2 h; quy trình khôi phục toàn phần lên VPS mới từng bước; lịch diễn tập hàng quý trên VPS tạm (không kéo PII về laptop); xử lý từng kịch bản (xóa nhầm dữ liệu, migration hỏng, mất VPS, lộ key R2). Cập nhật `huong-dan-deployment.md` mục 7–8.
- Kiểm chứng: chạy backup → restore trên stack prod cục bộ, so số dòng các bảng chính; thử rollback bằng tag image; `shellcheck` sạch.

## GĐ 4 — Hiệu năng & chịu tải (PR `feat/predeploy-performance`)
- **`apps/jobs/selectors/stats.py`**: viết lại `_category_demand` thành một truy vấn gộp (dựng cây danh mục một lần + `values().annotate(Count)`), `_growth_series`/`_salary_demand` dùng `Count(filter=Q(...))`; cache cả payload 5 phút trong redis-cache (lưu key media, không URL); `Cache-Control: public, max-age=60`; thêm vào `test_query_budget.py` (mục tiêu ≤ 6 truy vấn).
- **DB** (`config/settings/components/core.py`): `CONN_MAX_AGE=60`, `CONN_HEALTH_CHECKS=True`; `statement_timeout=15s` + `idle_in_transaction_session_timeout=30s` cho tiến trình web (worker/migrate không giới hạn). Postgres trong compose: `shared_preload_libraries=pg_stat_statements`, `random_page_cost=1.1`, `log_min_duration_statement=500`.
- **Tìm kiếm việc làm**: cột `title_search` (gấp dấu) + GIN trigram, giống `company_name_search` ở `employers/models/company.py`; `JobSuggestView` giới hạn trong SQL `[:50]` + throttle.
- **Job impression** (`apps/jobs/services/engagement.py`): gom ghi một batch bằng một `UPDATE ... FROM (VALUES ...)` + bulk upsert bảng theo ngày thay vì ~4 câu/job.
- **Throttle công khai**: `AnonRateThrottle` chung cho `/api/public/*` (vd 600/phút/IP) cộng rule Cloudflare.
- **Cache ngắn** (60–120 s) cho homepage best jobs/locations, featured companies, catalog danh mục/địa điểm, sitemap.
- **PDF báo cáo chiến dịch** (`apps/campaigns/api/views/health.py`): chuyển sang queue `cv-export` + polling như xuất CV, bỏ Chromium khỏi gunicorn.
- **Worker email riêng**: tách `auth-email,auth-sms` sang worker nhỏ concurrency 1 để email xác thực không chờ sau PDF (bù RAM bằng phần hạ của ml-worker).
- **Frontend**: WebP cho `phone-verify-banner.png` (1,19 MB) và `job-preference-banner.png` (565 KB) qua `<picture>`.
- **Load test** `scripts/loadtest/` (k6): kịch bản trộn — trang chủ + stats, danh sách/tìm kiếm việc, chi tiết việc (SEO HTML + API), suggest, impression batch, login/refresh, gợi ý việc, việc gần tôi, danh sách ứng viên NTD, WebSocket connect. Ngưỡng: 200 VU, p95 < 800 ms, lỗi < 1%. Hướng dẫn chạy với throttle nới tạm (biến env) và bật `pg_stat_statements`.
- Kiểm chứng: pytest query budget; chạy k6 trên stack prod cục bộ để so trước/sau cho stats + job list.

## GĐ 5 — Pháp lý & dữ liệu cá nhân (PR `feat/predeploy-privacy`)
- Trang Điều khoản + Chính sách quyền riêng tư ứng viên (theo cấu hình `legal_terms_url`/`legal_privacy_url`, nội dung qua site content); gỡ file mẫu TopCV khỏi `frontend/public/documents/`.
- Yêu cầu xóa tài khoản / xuất dữ liệu (Nghị định 13/2023): tối thiểu nút "Yêu cầu xóa tài khoản" → hàng chờ admin xử lý ẩn danh hóa; tự phục vụ đầy đủ để sau.
- Gemini: dùng tier trả phí (không dùng dữ liệu để huấn luyện) — ghi vào runbook.

## GĐ 6 — Rehearsal trên VPS & go-live (vận hành, không PR)
1. Bootstrap VPS bằng script mới; deploy theo runbook; truy cập qua `/etc/hosts` (hoặc DNS chưa proxied tạm, chặn bằng Cloudflare Access toàn site).
2. Nạp dữ liệu (DB trống + seed nền, hoặc dump dev → `purge_demo_accounts`); tạo superuser mới, mật khẩu mạnh.
3. Checklist mục 6 runbook + kiểm: header CSP/HSTS, `/.vite/manifest.json` 404, truy cập IP VPS trực tiếp bị từ chối, Sentry nhận lỗi thử, UptimeRobot xanh, healthchecks nhận ping backup.
4. Chạy k6 200 VU từ máy ngoài (qua Cloudflare); đọc `pg_stat_statements`, `docker stats`, Redis memory; chỉnh gunicorn workers nếu RAM còn dư.
5. **Diễn tập khôi phục**: restore bản backup mã hóa vào VPS tạm theo runbook, đo RTO thực tế, ghi vào runbook.
6. Go-live: bật proxied DNS công khai, gỡ Access toàn site (giữ cho /admin), theo dõi Sentry/log 48 h đầu, đóng băng tính năng mới 1 tuần.

## Để sau go-live (ghi vào docs, không chặn)
WAL archiving (wal-g → R2) nếu cần RPO < 24 h; MFA TOTP cho admin trong app (Cloudflare Access thay tạm); HNSW cho tìm ứng viên khi CV > ~50k; cột `lifecycle_recency` có index cho sắp xếp việc làm; build image trong CI + GHCR; Trivy quét image; tự phục vụ xuất/xóa dữ liệu đầy đủ.

## Kiểm chứng chung mỗi PR (AGENTS.md)
- Backend: `ruff check . && ruff format --check .`, `lint-imports`, `bash ../scripts/check_backend_layering.sh`, `python ../scripts/check_backend_imports.py`, `python manage.py makemigrations --check --dry-run`, `bash ../scripts/check_openapi_schema.sh`, `pytest --ds=config.settings.test --cov --cov-fail-under=84` (qua docker exec, không chạy manage.py trên host).
- Frontend: `npm run lint`, `npm run check:architecture`, `npm run test:coverage`, `npm run build` (ngân sách CSS/JS khởi tạo), `npm run test:e2e:smoke`.
- Stack prod: `scripts/deploy/compose.sh config` + dựng thử cục bộ với env giả, mọi service healthy.
- Cập nhật `docs/TIEN-DO-DU-AN.md` và runbook trong cùng PR.
