# 06 - Deployment production (procv.site)

Runbook triển khai ProCV lên **một VPS** (BKNS MMO7: 8 vCPU, 8 GB RAM, 80 GB SSD,
Ubuntu 24.04) bằng Docker Compose, sau Cloudflare, media trên Cloudflare R2.
Dev vẫn dùng `docker-compose.yml` ([docker-compose.md](docker-compose.md)); file
này chỉ nói về production.

## Kiến trúc

```text
Trình duyệt ──https──> Cloudflare (proxied, SSL Full strict)
                         │ media.procv.site ──> R2 bucket procv-public-media
                         ▼ procv.site :443 (chỉ IP Cloudflare + chứng chỉ client AOP)
                 web (nginx, IP nội bộ 172.28.0.10)
                   ├─ /api, /r/*, route SEO, robots, sitemap ──> backend (gunicorn :8000)
                   ├─ /assets/* (cache 1 năm), còn lại ──> SPA index.html
                   └─ :8080 nội bộ: dist thuần cho Django lấy SEO shell
                       và Chromium của worker mở cv-print.html
   backend · realtime · worker · ai-worker · ml-worker · beat
       ──> db (pgvector) · redis-broker (Celery + WebSocket) · redis-cache (cache)
```

Một domain, ba cổng theo đường dẫn: ứng viên `/`, nhà tuyển dụng `/tuyendung`,
quản trị `/admin`. Không tách frontend sang Vercel vì Django dựng SEO shell từ
`index.html` và worker in CV mở `cv-print.html` qua mạng nội bộ.

| File | Vai trò |
| --- | --- |
| `docker-compose.prod.yml` | Stack production; giá trị cố định theo domain nằm ở `x-prod-env` |
| `frontend/Dockerfile` | Build Vite rồi phục vụ bằng nginx (image `procv-web:prod`) |
| `frontend/docker/nginx/` | `procv.conf` (định tuyến) + snippets (proxy, header, IP thật Cloudflare) |
| `backend/Dockerfile` | Target `runtime` (gunicorn + Chromium) và `ml` (torch) — dùng chung với dev |
| `scripts/deploy/compose.sh` | `docker compose` đã nạp `backend/.env` + `frontend/.env`; mọi lệnh prod đi qua đây |
| `scripts/deploy/deploy.sh` | Lấy code, build, migrate, khởi động lại, kiểm tra sức khỏe |
| `scripts/deploy/backup_db.sh`, `restore_db.sh` | Sao lưu (mã hóa `age`, đẩy R2)/khôi phục PostgreSQL |
| `scripts/deploy/backup_files.sh`, `restore_files.sh`, `backup_secrets.sh` | Sao lưu bucket file riêng tư và gói bí mật — [sao-luu-va-khoi-phuc.md](sao-luu-va-khoi-phuc.md) |
| `scripts/deploy/bootstrap_vps.sh` | Khởi tạo VPS mới (Docker, user, firewall, swap) |
| `scripts/deploy/sync_ml_models.sh` | Đẩy mô hình đối sánh từ máy dev lên VPS |

### Ngân sách tài nguyên

| Service | Giới hạn RAM | Ghi chú |
| --- | --- | --- |
| `db` | 1,25 GB | `shared_buffers=512MB` |
| `redis-broker` | 256 MB | `maxmemory 192mb`, `noeviction`, AOF — hàng đợi Celery + channel layer WebSocket |
| `redis-cache` | 448 MB | `maxmemory 384mb`, `allkeys-lru`, không lưu đĩa — cache, token xác thực, throttle |
| `backend` | 1 GB | gunicorn 4 worker × 2 thread |
| `realtime` | 256 MB | daphne, chỉ `/ws/` |
| `worker` | 1,125 GB | concurrency 3: `default`, `cv-export` (Chromium xuất PDF CV + báo cáo chiến dịch), `upload-scan`, `candidate-email` |
| `email-worker` | 256 MB | concurrency 1: `auth-email`, `auth-sms` — OTP/đặt lại mật khẩu không chờ sau PDF |
| `ai-worker` | 512 MB | queue `ai-generation` |
| `ml-worker` | 1,75 GB | e5-base nằm sẵn trong RAM (~0,9 GB lúc rảnh); `cpus: 2`, `OMP/MKL_NUM_THREADS=2` |
| `beat`, `web` | 256 MB, 128 MB | |

Tổng trần ~7,2 GB (gồm `email-worker`) trên máy 8 GB, chừa ~0,8 GB cho
hệ điều hành, Docker và page cache; bootstrap tạo thêm 4 GB swap. Đo trên stack
prod cục bộ lúc rảnh (25/11): backend ~515 MB, worker ~340 MB, ai-worker ~245 MB,
ml-worker ~920 MB, beat/realtime ~140 MB, mỗi lần healthcheck `celery inspect
ping` thêm ~75 MB trong vài giây. **Đo lại khi rehearsal** (`docker stats
--no-stream` lúc chạy k6 và `matching_backfill`) rồi chỉnh `mem_limit` — nhất là
`ml-worker`, `worker` (nhiều PDF cùng lúc) và `backend`. ClamAV (3–4 GB) **không
chạy**: `UPLOAD_QUARANTINE_ENABLED=False`.
Ổ đĩa: image backend + ml ~6 GB, nhân 3 vì deploy.sh (GĐ 3) giữ 3 tag
`procv-*:<sha12>` mỗi image để rollback; mô hình 1,1 GB; DB; tối đa ~17 bản dump DB
đã mã hóa trên VPS (7 ngày + 4 tuần + 6 tháng).

## 1. Chuẩn bị Cloudflare và R2

1. **DNS** (zone `procv.site`): bản ghi `A @` và `A www` trỏ IP VPS, bật
   *Proxied* (đám mây cam). Không cần `AAAA`: Cloudflare nối origin qua IPv4.
2. **SSL/TLS** → *Full (strict)*; *Edge Certificates* → bật *Always Use HTTPS*.
3. **Origin Certificate**: SSL/TLS → Origin Server → Create Certificate
   (`procv.site`, `*.procv.site`, 15 năm). Lưu certificate thành
   `deploy/certs/origin.pem`, private key thành `deploy/certs/origin.key` trên VPS.
4. **Authenticated Origin Pulls** (khóa origin): SSL/TLS → Origin Server → bật
   *Authenticated Origin Pulls* (mức zone). Cloudflare khi đó trình chứng chỉ
   client cho origin; nginx (`snippets/origin-pull.conf`) trả 403 cho request
   không có chứng chỉ đó, kể cả khi ai đó biết IP VPS. Trên VPS, tải CA công khai
   của Cloudflare vào đúng tên file nginx đọc (thiếu file thì container `web`
   không khởi động):

   ```bash
   curl -fsSL https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem -o deploy/certs/cloudflare-origin-pull-ca.pem
   ```

   ```bash
   openssl x509 -in deploy/certs/cloudflare-origin-pull-ca.pem -noout -subject -enddate
   ```

   Subject phải là CA của Cloudflare (`origin-pull.cloudflare.net`) và còn hạn.
   Đường dẫn tải lấy từ tài liệu *Authenticated Origin Pulls → Zone-level* của
   Cloudflare; đối chiếu lại ở đó trước khi tải. **Bật AOP ở Cloudflare trước
   khi mở DNS**: chưa bật thì mọi request qua Cloudflare đều nhận 403.
5. **R2**: ba bucket `procv-public-media` (custom domain `media.procv.site`),
   `procv-private-files`, `procv-upload-quarantine`, mỗi bucket một API token
   riêng chỉ có quyền trên bucket đó — production từ chối khởi động nếu dùng chung
   bucket hoặc credential ([cloudflare-r2-media.md](cloudflare-r2-media.md)).
   Bucket quarantine bắt buộc có dù chưa bật ClamAV.
6. **Backup**: thêm bucket `procv-backups` (DB, gói bí mật), `procv-backups-files`
   (bản sao file riêng tư) và `procv-backups-public-media` (bản sao media công khai),
   bật Bucket Lock + lifecycle, mỗi bucket một token *Object Read & Write* riêng — chi
   tiết ở [sao-luu-va-khoi-phuc.md](sao-luu-va-khoi-phuc.md).
7. **Cloudflare Access cho cổng quản trị** (Zero Trust → Access → Applications →
   *Self-hosted*): một application với hai đường dẫn `procv.site/admin*` và
   `procv.site/api/admin/*`, policy *Allow* chỉ email quản trị, đăng nhập bằng
   *One-time PIN* (email OTP), session 24 h. Access chặn ở edge trước khi request tới
   origin, bù cho việc admin chưa có MFA trong ứng dụng (TOTP để sau go-live). Không
   đưa `/api/auth/*`, `/api/health/*` hay `/ws/*` vào application: cổng ứng viên/NTD
   dùng chung các đường đó.
8. Đăng ký domain `procv.site` ở reCAPTCHA admin; thêm callback OAuth:
   - Google/Facebook/LinkedIn đăng nhập: `https://procv.site/oauth/callback` và
     `https://procv.site/tuyendung/app/oauth/callback`;
   - đăng bài mạng xã hội (nếu bật):
     `https://procv.site/api/employer/social/{facebook,threads,linkedin}/callback/`.

## 2. Khởi tạo VPS

```bash
scp scripts/deploy/bootstrap_vps.sh root@<ip-vps>:
```

```bash
ssh root@<ip-vps> bash bootstrap_vps.sh
```

Script cài Docker + Compose (`live-restore`: container sống qua lần khởi động lại
dockerd), tạo user `deploy` (chép SSH key của root, sudo không mật khẩu). Khi
`deploy` đã có key: SSH chỉ còn `deploy` bằng key (`PermitRootLogin no`,
`AllowUsers deploy`) — phiên root đang chạy không bị ngắt, nhưng từ đó chạy lại
script bằng `ssh deploy@<ip-vps> sudo bash bootstrap_vps.sh`. Tường lửa: ufw chỉ
mở 22; cổng 80/443 do Docker publish (đi vòng qua ufw) được unit systemd
`procv-cloudflare-firewall` chặn ở chain `DOCKER-USER`, chỉ chừa dải IPv4 của
Cloudflare, áp lại mỗi khi Docker khởi động. Thêm fail2ban, tự cài bản vá bảo mật
và tự khởi động lại lúc 04:30 khi cần, swap 4 GB, múi giờ Việt Nam. Dải IP
Cloudflare nằm ở hai nơi — script này và `cloudflare-realip.conf` — đổi thì đổi
cả hai rồi chạy lại script. Sau đó đăng nhập bằng `deploy`:

```bash
git clone https://github.com/VanhauDAU/ai-recruitment-platform.git /srv/procv
```

Repo private thì tạo *deploy key* chỉ đọc trên GitHub cho VPS.

## 3. Cấu hình môi trường

Production dùng đúng hai file env của repo, chỉ tồn tại trên VPS:

```bash
cd /srv/procv && cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env && chmod 600 backend/.env frontend/.env
```

**Không cần sửa** các khóa có trong `x-prod-env` của `docker-compose.prod.yml`
(`ENVIRONMENT`, `DEBUG`, `ALLOWED_HOSTS`, CORS/CSRF, `*_FRONTEND_URL`,
`FRONTEND_SHELL_URL`, `CV_PRINT_URL`, callback OAuth, cờ HTTPS/cookie secure,
`TRUSTED_PROXY_IPS`, `DB_HOST`, `REDIS_URL` (redis-cache), `CELERY_BROKER_URL` +
`CHANNEL_LAYER_REDIS_URL` (redis-broker), `R2_PUBLIC_BASE_URL`, media root,
`UPLOAD_QUARANTINE_ENABLED`, `MATCHING_*`): compose ghi đè giá trị trong `.env`.

**Phải điền trong `backend/.env`:**

| Khóa | Giá trị |
| --- | --- |
| `SECRET_KEY`, `JWT_SIGNING_KEY` | Hai chuỗi khác nhau: `openssl rand -base64 48` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Ví dụ `procv` / `procv` / `openssl rand -hex 24` (không dùng `postgres`, tránh ký tự `$`) |
| `EMAIL_HOST*`, `EMAIL_FROM_ADDRESS`, `DEFAULT_FROM_EMAIL` | SMTP thật (ví dụ Gmail app password) |
| `RECAPTCHA_SECRET_KEY` | Secret key của site đã đăng ký `procv.site` |
| `R2_ENDPOINT_URL`, 3 cặp `R2_*_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, 3 `R2_*_BUCKET` | Theo bước 1.5 |
| `GEMINI_API_KEY`, `AI_JOB_GENERATION_MODEL*` | Key AI Studio của project **đã bật thanh toán** (tier trả phí): Google không dùng prompt/kết quả để huấn luyện; tier miễn phí thì có, không dùng cho dữ liệu tin tuyển dụng/CV thật |
| `AI_MODEL_PRICING_USD` | **Giá thật** của model đang bật — mẫu `0/0` làm production từ chối khởi động |
| `EMPLOYER_DPA_POLICY_VERSION`, `EMPLOYER_DPA_DOCUMENT_URL`, `EMPLOYER_DPA_DOCUMENT_SHA256` | Văn bản DPA **của ProCV** (mẫu thông báo NTD gửi ứng viên giờ là `procv-mau-thong-bao-xu-ly-dlcn-ung-vien.docx`, key `employer_dpa_template_url`; DPA giữa ProCV và NTD vẫn là văn bản riêng), URL HTTPS, `sha256sum` lowercase của đúng file ([employer-dpa-evidence-rollout.md](employer-dpa-evidence-rollout.md)) |
| `EMPLOYER_SMS_OTP_ENABLED` | Giữ `False` khi chưa có nhà cung cấp SMS — bật lên thì production đòi đủ `EMPLOYER_SMS_*` |
| `REQUIRE_APPROVED_EMPLOYER_VERIFICATION` | Mẫu đặt `False`. Chỉ đổi điều kiện bước "Hoàn tất xác thực" trong checklist onboarding NTD (cộng dồn với site setting `employer_require_approved_verification`); đăng tin công khai **luôn** cần hồ sơ xác thực đã duyệt + DPA hiện hành, bất kể khóa này |
| `OAUTH_*_CLIENT_ID/SECRET` | Nếu bật đăng nhập mạng xã hội |
| `CAMPAIGN_SOCIAL_*`, `FACEBOOK_APP_*`, `THREADS_*`, `LINKEDIN_SOCIAL_*` | Nếu bật đăng bài; `CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY` là Fernet key riêng |
| `SENTRY_DSN` (+ `SENTRY_RELEASE` tùy chọn) | DSN project Sentry **backend**; trống = không gửi lỗi. Không gửi PII, body, query, cookie, header xác thực; đo hiệu năng 5% request |

Sinh Fernet key (chạy sau khi đã build image ở bước 5, hoặc trên máy dev):

```bash
scripts/deploy/compose.sh run --rm --no-deps backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Phải điền trong `frontend/.env`:** `VITE_RECAPTCHA_SITE_KEY` (site key public);
nên điền `VITE_SENTRY_DSN` (DSN project Sentry **frontend**; SDK chỉ nạp lười khi có).
Cùng DSN đó, lúc build image `web` nginx dựng endpoint báo cáo CSP của Sentry
(`report-uri` + `report-to`, mục 9).
`VITE_API_BASE_URL` và `VITE_PUBLIC_ASSET_BASE_URL` do compose đặt sẵn
(`/api`, `https://media.procv.site`). Mọi `VITE_*` bị nhúng vào JS lúc build:
đổi giá trị thì phải build lại image `web`.

Đặt chứng chỉ origin:

```bash
chmod 600 deploy/certs/origin.key
```

## 4. Đồng bộ mô hình đối sánh

`ml/models` bị gitignore. Chạy trên **máy dev**:

```bash
scripts/deploy/sync_ml_models.sh deploy@<ip-vps>
```

## 5. Deploy lần đầu

```bash
scripts/deploy/deploy.sh
```

Script fetch `origin/main`, build image (`procv-backend`, `procv-ml-worker`,
`procv-web`), chạy service `migrate`, khởi động stack, chờ `backend` (healthcheck
là `/api/health/ready/`: DB + 2 Redis) và `web` healthy rồi gọi thử
`/api/health/ready/` và `/viec-lam` qua nginx từ chính VPS. `production.py` gom
mọi lỗi cấu hình thành một thông báo — xem bằng
`scripts/deploy/compose.sh logs migrate`.

**Dữ liệu ban đầu** — chọn một:

- *Mang dữ liệu từ dev*: trên máy dev dump DB trong container (không chạy
  `pg_dump` trên host, sẽ vào nhầm Postgres local):

  ```bash
  docker compose exec -T db pg_dump -U postgres -d ai_career_coach -Fc > procv-initial.dump
  ```

  chép lên VPS rồi `scripts/deploy/restore_db.sh procv-initial.dump`. Media
  public đã nằm sẵn trên R2 nên không cần chép. **Bắt buộc** dọn tài khoản demo
  (`@demo.local`, mật khẩu nằm trong repo công khai, có cả một superuser):

  ```bash
  scripts/deploy/compose.sh exec backend python manage.py purge_demo_accounts --confirm
  ```
- *DB trống*: chạy lần lượt các seed nền giống `scripts/reset_local_db.sh`:

  ```bash
  for cmd in seed_skills seed_locations seed_province_merges seed_location_coordinates seed_job_categories seed_sitecontent seed_cv_catalog seed_cv_templates; do scripts/deploy/compose.sh exec backend python manage.py "$cmd"; done
  ```

Việc làm gần tôi (ADR-0029): khi DB đã có tin (khôi phục từ dump), chạy một lần
`seed_location_coordinates` rồi `refresh_job_coordinates` để gán tọa độ cho nơi làm
việc cũ. Đặt `GEOCODING_PROVIDER=vietmap` + `GEOCODING_API_KEY` trong `backend/.env`
và site setting `map_style_url` (style VietMap kèm key tile giới hạn domain procv.site).

```bash
scripts/deploy/compose.sh exec backend python manage.py seed_location_coordinates
scripts/deploy/compose.sh exec backend python manage.py refresh_job_coordinates
```

Tài khoản quản trị đầu tiên:

```bash
scripts/deploy/compose.sh exec backend python manage.py createsuperuser
```

Admin tiếp theo tạo bằng `create_admin_user <email> --actor-email <admin>`.
Sau khi có dữ liệu, tính embedding cho tin/CV sẵn có:

```bash
scripts/deploy/compose.sh exec ml-worker python manage.py matching_backfill --inline
```

## 6. Kiểm tra sau deploy

- `https://procv.site` hiển thị trang chủ; *View source* của `/viec-lam`,
  `/cong-ty/<slug>`, `/blog/<slug>` có `<title>`/meta riêng (đi qua Django).
- `/tuyendung`, `/tuyendung/app/login`, `/admin/login` mở được; đăng nhập đủ ba cổng.
- Upload avatar/logo → ảnh có URL `https://media.procv.site/...`.
- Đăng ký tài khoản mới nhận được email xác thực.
- Xuất PDF một CV thành công (worker → `http://web:8080/cv-print.html`).
- Danh sách thiết bị đăng nhập hiện **IP thật** của bạn, không phải `172.28.0.10`.
- `https://procv.site/robots.txt`, `/sitemap.xml` trả nội dung của Django.
- `curl -sI https://procv.site/viec-lam` có `Content-Security-Policy-Report-Only`,
  `Strict-Transport-Security`, `Permissions-Policy`; `/.vite/manifest.json` trả 404.
- `curl -s https://procv.site/api/health/ready/` trả
  `{"status": "ok", "checks": {"database": "ok", "cache": "ok", "broker": "ok"}}`;
  một phụ thuộc lỗi thì 503 với `"error"` ở mục đó (chi tiết trong log backend).
- **Khóa origin:** từ máy ngoài, `curl -k --resolve procv.site:443:<ip-vps> https://procv.site/`
  phải timeout (DOCKER-USER chặn IP không phải Cloudflare); trên VPS,
  `sudo iptables -S DOCKER-USER` có hai rule nhảy sang `PROCV-CLOUDFLARE`.
- Redis đúng vai trò:
  `scripts/deploy/compose.sh exec redis-cache redis-cli config get maxmemory-policy`
  ra `allkeys-lru`, `redis-broker` ra `noeviction`.
- `scripts/deploy/compose.sh ps` thấy `worker`, `ai-worker`, `ml-worker` *healthy*
  (`celery inspect ping`); `logs beat` liệt kê lịch, file lịch nằm trên volume
  `beat_schedule` nên deploy lại không làm lỡ job hằng ngày.
- **CSP:** mở đủ ba cổng (đăng nhập, đăng tin, xem CV, bản đồ, reCAPTCHA, video
  nhúng) với DevTools mở; khi console và mục *Security* của project Sentry frontend
  không còn vi phạm CSP, đổi `Content-Security-Policy-Report-Only` thành
  `Content-Security-Policy` trong `frontend/docker/nginx/snippets/csp.conf` rồi deploy
  lại để bắt đầu chặn. Có `VITE_SENTRY_DSN` thì
  `curl -sI https://procv.site/viec-lam` phải thấy `report-uri https://<host>/api/<id>/security/...`
  cuối header CSP và `Reporting-Endpoints: csp-endpoint="..."`.
- **Cloudflare Access (admin):** cửa sổ ẩn danh mở `https://procv.site/admin/login`
  phải hiện trang đăng nhập Access (email OTP) trước trang của ProCV;
  `curl -sI https://procv.site/api/admin/` trả 302/403 từ Access, không phải JSON của
  Django. Sau khi qua Access, đăng nhập admin và kiểm **thông báo realtime** chạy
  (DevTools → *Network* → *WS*: `wss://procv.site/ws/notifications/` ở trạng thái 101,
  thông báo mới hiện không cần tải lại). `/ws/*` nằm ngoài Access nên WebSocket không
  bị chặn; nếu sau này đưa `/ws/*` vào Access thì phải kiểm lại vì cookie
  `CF_Authorization` khi đó là bắt buộc cho cả cổng ứng viên/NTD.
- **Site settings:** sau mỗi deploy có sửa `backend/apps/sitecontent/seed_data/settings.json`
  chạy `scripts/deploy/compose.sh exec backend python manage.py seed_sitecontent` —
  lệnh idempotent, đồng bộ nhãn/mô tả/nút "?" (`label`, `description`, `help`,
  `options`…) của key đã có nhưng **không** ghi đè giá trị admin đã chỉnh.

## 7. Sao lưu

Toàn bộ sao lưu, khôi phục và diễn tập nằm ở runbook riêng
[sao-luu-va-khoi-phuc.md](sao-luu-va-khoi-phuc.md): tạo khóa `age` (giữ trong password
manager, không đặt trên VPS), bucket `procv-backups` + `procv-backups-files` +
`procv-backups-public-media` có Bucket Lock, ba remote rclone, healthchecks.io và cron:

```cron
0 3 * * * /srv/procv/scripts/deploy/backup_db.sh >/dev/null 2>>/srv/procv/backups/cron-errors.log
30 3 * * * /srv/procv/scripts/deploy/backup_files.sh >/dev/null 2>>/srv/procv/backups/cron-errors.log
```

Sau mỗi lần sửa `backend/.env`, `frontend/.env` hoặc `deploy/certs`: cập nhật password
manager và chạy `scripts/deploy/backup_secrets.sh`.

## 8. Cập nhật và rollback

```bash
scripts/deploy/deploy.sh
```

- `deploy.sh` build trong worktree tạm (code đang chạy chưa đổi), gắn tag image
  `procv-*:<12 ký tự sha>` + `:prod`, giữ 3 tag gần nhất. Chỉ khi build xong mới
  checkout commit mới; build lỗi thì stack cũ nguyên vẹn. Có khóa `flock`: hai lần
  deploy không chạy chồng nhau. `--dry-run` chỉ in kế hoạch.
- Image mới có migration chưa áp (`migrate --check`) thì tự chạy
  `backup_db.sh --label pre-deploy-<sha>` trước (`--no-backup` để bỏ qua).
- Rollback **không build lại**: `scripts/deploy/deploy.sh --skip-build <sha>` (sha lấy
  từ `deploy/history.log`; mỗi dòng ghi `ok` hoặc `FAIL:<bước>`). Commit cũ hơn 3 bản:
  `scripts/deploy/deploy.sh <commit>` (build lại).
- Migration lỗi: `up` dừng trước khi tạo lại backend/worker, bản cũ vẫn chạy.
- Rollback code **không** lùi migration: khôi phục bản `pre-deploy-<sha>` bằng
  `restore_db.sh` — xem kịch bản "Migration hỏng" trong
  [sao-luu-va-khoi-phuc.md](sao-luu-va-khoi-phuc.md#migration-hỏng).
- Sửa `backend/.env`: `scripts/deploy/compose.sh up -d` (tạo lại container).
  Sửa `frontend/.env`: `scripts/deploy/deploy.sh` (phải build lại `web`).

Lệnh vận hành thường dùng:

```bash
scripts/deploy/compose.sh ps
```

```bash
scripts/deploy/compose.sh logs -f --tail 100 backend worker
```

```bash
scripts/deploy/compose.sh exec backend python manage.py shell
```

Dải IP Cloudflare trong `frontend/docker/nginx/snippets/cloudflare-realip.conf`
và `scripts/deploy/bootstrap_vps.sh` lấy từ `https://www.cloudflare.com/ips-v4` và
`ips-v6`; soát lại mỗi lần nâng cấp.

## 9. Giám sát, log và chịu lỗi

- **Log:** mọi process Django/Celery ghi một dòng JSON ra stdout (`LOGGING` ở
  `backend/config/settings/components/observability.py`; `django.request` chỉ từ
  ERROR, gunicorn không ghi access log vì nginx đã ghi). Lọc lỗi:

  ```bash
  scripts/deploy/compose.sh logs --no-log-prefix --since 1h backend | grep '"level": "ERROR"'
  ```
- **Sentry** (free): hai project backend/frontend; DSN ở `SENTRY_DSN` và
  `VITE_SENTRY_DSN`. Báo cáo vi phạm CSP đi vào project **frontend** (mục *Security* /
  issue loại *CSP*): `frontend/docker/nginx/render-csp.sh` đổi DSN
  `https://KEY@HOST/PROJECT` thành `https://HOST/api/PROJECT/security/?sentry_key=KEY&sentry_environment=ENV`
  lúc build image `web` (DSN trống thì không có `report-uri`). Mỗi lượt xem trang vi
  phạm gửi một báo cáo, tính vào quota lỗi của gói free (Developer: 5k lỗi/tháng,
  dùng chung với lỗi JS). Trước rehearsal, trong project frontend: *Project Settings →
  Security Headers → CSP* bật *Use default ignored sources* (bỏ báo cáo do extension
  trình duyệt) và thêm nguồn rác khác gặp phải vào *Additional ignored sources*;
  *Inbound Filters* bật lọc *browser extensions*, *web crawlers*, *legacy browsers*;
  *Client Keys (DSN) → Rate limiting* đặt trần (ví dụ 300 sự kiện/giờ) để một trang vi
  phạm hàng loạt không đốt hết quota; giữ *Spike Protection* của tổ chức. Khi CSP đã
  chuyển sang chặn và hết vi phạm thật, giữ `report-uri` để phát hiện hồi quy. Thử sau
  deploy rồi xem sự kiện trên Sentry:

  ```bash
  scripts/deploy/compose.sh exec backend python -c "import django; django.setup(); import sentry_sdk; sentry_sdk.capture_message('procv smoke'); sentry_sdk.flush()"
  ```
- **UptimeRobot** (free): monitor `https://procv.site/api/health/ready/` (từ khóa
  `"status": "ok"`) và `https://procv.site/`, báo qua email/Telegram.
- **Trang bảo trì:** backend không trả lời thì nginx trả trang tĩnh `50x.html`
  (502/503/504) cho trang HTML và JSON `service_unavailable` (503) cho `/api/`,
  kèm `Retry-After: 60`. 503 do chính Django trả (readiness) đi thẳng tới client.
- **Deploy không làm nginx trỏ IP cũ:** upstream dùng `resolve` qua DNS của Docker
  (`127.0.0.11`, 10 giây), container backend/realtime tạo lại với IP mới vẫn nhận
  request mà không cần khởi động lại `web`.
- **Beat:** job dọn dữ liệu hằng ngày chạy 01:00–02:35 và 05:15 giờ Việt Nam (lệch
  nhau 5–15 phút; tránh backup 03:00 và khởi động lại 04:30), gồm
  `flushexpiredtokens`, `clearsessions`, xóa `AuthSession` kết thúc quá 90 ngày
  (`AUTH_SESSION_RETENTION_DAYS`, trừ phiên là bằng chứng DPA), outbox
  `AuthEmailJob` xong quá 30 ngày (`AUTH_EMAIL_JOB_RETENTION_DAYS`, trừ email chào
  mừng). Mọi lịch có `expires`: worker dừng lâu thì lượt cũ bị bỏ, không dồn hàng
  trăm lượt chạy trùng khi lên lại.
- **Tắt khóa origin khẩn cấp** (ví dụ Cloudflare đổi CA, mọi request nhận 403): bỏ
  hai dòng `include /etc/nginx/snippets/origin-pull.conf;` trong `procv.conf`
  rồi deploy lại; rule DOCKER-USER vẫn giữ chỉ IP Cloudflare vào được.

## Yêu cầu dữ liệu cá nhân (Nghị định 13/2023)

- Ứng viên (Cài đặt bảo mật) và NTD (Đăng nhập & bảo mật) tự gửi yêu cầu **xuất
  dữ liệu** hoặc **xóa tài khoản**; mỗi loại chỉ một yêu cầu chờ xử lý.
- Admin xử lý ở `Quản trị → Yêu cầu dữ liệu cá nhân` (có badge trong hàng chờ
  dashboard). Mục tiêu phản hồi: **72 giờ** như đã ghi trong Chính sách quyền riêng tư.
- Duyệt xuất dữ liệu: người dùng tải bản JSON trong 7 ngày. Duyệt xóa: CV trong thư
  viện bị xóa cứng, hồ sơ ứng viên bị xóa, tài khoản ẩn danh hóa
  (`deleted+<mã>@deleted.invalid`, thu hồi mọi phiên); bản chụp CV đã nộp vẫn thuộc
  hồ sơ tuyển dụng của NTD. Chủ công ty còn thành viên khác phải chuyển quyền trước.
- Nội dung Điều khoản sử dụng / Chính sách quyền riêng tư nằm trong Trung tâm trợ
  giúp (chuyên mục "Điều khoản và chính sách"); rà soát pháp lý trước go-live.

## Static và storage media tách quyền

- Asset cố định của frontend (logo hệ thống, favicon, icon) đặt trong `frontend/public/`, ví dụ `/images/logo/logo_proCV_2000_600.png`, `/favicon-32.png`, `/apple-touch-icon.png`. Image `web` phục vụ trực tiếp các file này.
- Presentation media công khai (avatar, logo/cover/gallery, knowledgebase,
  template) dùng `public_media`. Production lưu trên bucket R2
  `procv-public-media`, URL qua `R2_PUBLIC_BASE_URL=https://media.procv.site`;
  nginx của VPS **không** phục vụ `/media/`.
- CV, export, tài liệu pháp lý và candidate asset dùng `default`/
  `private_media` (bucket `procv-private-files`). Upload chưa được scanner quyết
  định dùng `quarantine`. Hai backend này cố ý từ chối `.url()`; browser chỉ tải
  qua API đã kiểm quyền.
- Database tiếp tục chỉ lưu **storage key**, không lưu filesystem path,
  credential hoặc signed URL. `MEDIA_PUBLIC_BASE_URL` chỉ áp dụng cho public
  media; không được dùng để tạo URL private.
- Làm theo [ER-3 storage-boundary runbook](employer-upload-storage-boundary-runbook.md)
  trước khi bật upload session (cần ClamAV) ở môi trường mới.

## Route SEO do Django phục vụ

Nginx (`frontend/docker/nginx/procv.conf`) phải chuyển các route SEO shell về
Django thay vì trả thẳng `index.html`, nếu không crawler không nhận được meta,
JSON-LD và HTTP 404/410 thật. Danh sách khớp từng mẫu trong
`backend/config/urls.py` và `backend/apps/*/seo/urls.py`: `/`, `/viec-lam…`,
`/brand/<công ty>/tuyen-dung/<slug>`, `/cong-ty…`, `/tuyendung` và các trang
marketing NTD, `/blog…`, `/tro-giup…`, `/mau-cv…`, `/cv-templates…`,
`/tuyen-dung/<slug>`, `/chinh-sach-cookie`, `/robots.txt`, `/sitemap.xml`,
`/sitemaps/*.xml`, cùng `/api/` và link theo dõi `/r/<mã>[/<đích>]`.

**Thêm route SEO mới ở Django thì thêm `location` tương ứng trong `procv.conf`.**

Ghi chú theo tính năng:

- Trang công ty (ADR-0017): `/cong-ty`, `/cong-ty/tim-kiem`, `/cong-ty/<slug>`
  và `/sitemaps/companies.xml`.
- Chiến dịch tuyển dụng (2026-11-18): `/tuyen-dung/<slug>` trả 404 khi không
  công khai, 410 khi chiến dịch đã kết thúc; `/r/<code>` và
  `/r/<code>/<mã tin hoặc cong-ty>` đếm lượt bấm rồi trả 302 kèm `?ref=` có ký.
  Khi dev, Vite proxy `/r/...` xuống backend; `/tuyen-dung/<slug>` do SPA hiển thị.
