# 06 - Deployment production (procv.site)

Runbook triển khai ProCV lên **một VPS** (BKNS MMO7: 8 vCPU, 8 GB RAM, 80 GB SSD,
Ubuntu 24.04) bằng Docker Compose, sau Cloudflare, media trên Cloudflare R2.
Dev vẫn dùng `docker-compose.yml` ([docker-compose.md](docker-compose.md)); file
này chỉ nói về production.

## Kiến trúc

```text
Trình duyệt ──https──> Cloudflare (proxied, SSL Full strict)
                         │ media.procv.site ──> R2 bucket procv-public-media
                         ▼ procv.site :443
                 web (nginx, IP nội bộ 172.28.0.10)
                   ├─ /api, /r/*, route SEO, robots, sitemap ──> backend (gunicorn :8000)
                   ├─ /assets/* (cache 1 năm), còn lại ──> SPA index.html
                   └─ :8080 nội bộ: dist thuần cho Django lấy SEO shell
                       và Chromium của worker mở cv-print.html
   backend · worker · ai-worker · ml-worker · beat ──> db (pgvector) · redis
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
| `scripts/deploy/backup_db.sh`, `restore_db.sh` | Sao lưu/khôi phục PostgreSQL (local + R2) |
| `scripts/deploy/bootstrap_vps.sh` | Khởi tạo VPS mới (Docker, user, firewall, swap) |
| `scripts/deploy/sync_ml_models.sh` | Đẩy mô hình đối sánh từ máy dev lên VPS |

### Ngân sách tài nguyên

| Service | Giới hạn RAM | Ghi chú |
| --- | --- | --- |
| `db` | 1,5 GB | `shared_buffers=512MB` |
| `redis` | 384 MB | `maxmemory 256mb`, AOF |
| `backend` | 1,5 GB | gunicorn 4 worker × 2 thread |
| `worker` | 1,5 GB | concurrency 3, Chromium xuất PDF |
| `ai-worker` | 512 MB | queue `ai-generation` |
| `ml-worker` | 3 GB | mô hình e5-base ~1,1 GB nằm sẵn trong RAM |
| `beat`, `web` | 256 MB, 128 MB | |

Tổng trần ~8,3 GB nhưng các service không cùng lúc chạm trần; bootstrap tạo thêm
4 GB swap. ClamAV (3–4 GB) **không chạy**: `UPLOAD_QUARANTINE_ENABLED=False`.
Ổ đĩa: image backend + ml ~6 GB, mô hình 1,1 GB, còn lại cho DB và 7 bản backup.

## 1. Chuẩn bị Cloudflare và R2

1. **DNS** (zone `procv.site`): bản ghi `A @` và `A www` trỏ IP VPS, bật
   *Proxied* (đám mây cam). Không cần `AAAA`: Cloudflare nối origin qua IPv4.
2. **SSL/TLS** → *Full (strict)*; *Edge Certificates* → bật *Always Use HTTPS*.
3. **Origin Certificate**: SSL/TLS → Origin Server → Create Certificate
   (`procv.site`, `*.procv.site`, 15 năm). Lưu certificate thành
   `deploy/certs/origin.pem`, private key thành `deploy/certs/origin.key` trên VPS.
4. **R2**: ba bucket `procv-public-media` (custom domain `media.procv.site`),
   `procv-private-files`, `procv-upload-quarantine`, mỗi bucket một API token
   riêng chỉ có quyền trên bucket đó — production từ chối khởi động nếu dùng chung
   bucket hoặc credential ([cloudflare-r2-media.md](cloudflare-r2-media.md)).
   Bucket quarantine bắt buộc có dù chưa bật ClamAV.
5. **Backup**: thêm bucket `procv-backups` + token *Object Read & Write* chỉ cho
   bucket này (dùng ở bước 7).
6. Đăng ký domain `procv.site` ở reCAPTCHA admin; thêm callback OAuth:
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

Script cài Docker + Compose, tạo user `deploy` (chép SSH key của root), tắt
đăng nhập mật khẩu khi đã có key, mở firewall 22/80/443, bật fail2ban, tự cập
nhật bảo mật, swap 4 GB, múi giờ Việt Nam. Sau đó đăng nhập bằng `deploy`:

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
`TRUSTED_PROXY_IPS`, `DB_HOST`, `REDIS_URL`, `R2_PUBLIC_BASE_URL`, media root,
`UPLOAD_QUARANTINE_ENABLED`, `MATCHING_*`): compose ghi đè giá trị trong `.env`.

**Phải điền trong `backend/.env`:**

| Khóa | Giá trị |
| --- | --- |
| `SECRET_KEY`, `JWT_SIGNING_KEY` | Hai chuỗi khác nhau: `openssl rand -base64 48` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Ví dụ `procv` / `procv` / `openssl rand -hex 24` (không dùng `postgres`, tránh ký tự `$`) |
| `EMAIL_HOST*`, `EMAIL_FROM_ADDRESS`, `DEFAULT_FROM_EMAIL` | SMTP thật (ví dụ Gmail app password) |
| `RECAPTCHA_SECRET_KEY` | Secret key của site đã đăng ký `procv.site` |
| `R2_ENDPOINT_URL`, 3 cặp `R2_*_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, 3 `R2_*_BUCKET` | Theo bước 1.4 |
| `GEMINI_API_KEY`, `AI_JOB_GENERATION_MODEL*` | Key AI Studio |
| `AI_MODEL_PRICING_USD` | **Giá thật** của model đang bật — mẫu `0/0` làm production từ chối khởi động |
| `EMPLOYER_DPA_POLICY_VERSION`, `EMPLOYER_DPA_DOCUMENT_URL`, `EMPLOYER_DPA_DOCUMENT_SHA256` | Văn bản DPA **của ProCV** (không dùng mẫu TopCV trong `frontend/public/documents`), URL HTTPS, `sha256sum` lowercase của đúng file ([employer-dpa-evidence-rollout.md](employer-dpa-evidence-rollout.md)) |
| `EMPLOYER_SMS_OTP_ENABLED` | Giữ `False` khi chưa có nhà cung cấp SMS — bật lên thì production đòi đủ `EMPLOYER_SMS_*` |
| `REQUIRE_APPROVED_EMPLOYER_VERIFICATION` | Mẫu đặt `False`; đặt `True` nếu muốn NTD phải được admin xác thực mới dùng đủ tính năng |
| `OAUTH_*_CLIENT_ID/SECRET` | Nếu bật đăng nhập mạng xã hội |
| `CAMPAIGN_SOCIAL_*`, `FACEBOOK_APP_*`, `THREADS_*`, `LINKEDIN_SOCIAL_*` | Nếu bật đăng bài; `CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY` là Fernet key riêng |

Sinh Fernet key (chạy sau khi đã build image ở bước 5, hoặc trên máy dev):

```bash
scripts/deploy/compose.sh run --rm --no-deps backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Phải điền trong `frontend/.env`:** `VITE_RECAPTCHA_SITE_KEY` (site key public).
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
`procv-web`), chạy service `migrate`, khởi động stack, chờ `backend` và `web`
healthy rồi gọi thử `/api/health/` và `/viec-lam` qua nginx. `production.py` gom
mọi lỗi cấu hình thành một thông báo — xem bằng
`scripts/deploy/compose.sh logs migrate`.

**Dữ liệu ban đầu** — chọn một:

- *Mang dữ liệu từ dev*: trên máy dev dump DB trong container (không chạy
  `pg_dump` trên host, sẽ vào nhầm Postgres local):

  ```bash
  docker compose exec -T db pg_dump -U postgres -d ai_career_coach -Fc > procv-initial.dump
  ```

  chép lên VPS rồi `scripts/deploy/restore_db.sh procv-initial.dump`. Media
  public đã nằm sẵn trên R2 nên không cần chép.
- *DB trống*: chạy lần lượt các seed nền giống `scripts/reset_local_db.sh`:

  ```bash
  for cmd in seed_skills seed_locations seed_province_merges seed_job_categories seed_sitecontent seed_cv_catalog seed_cv_templates; do scripts/deploy/compose.sh exec backend python manage.py "$cmd"; done
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

## 7. Sao lưu

Cấu hình rclone một lần (trên VPS, user `deploy`), dùng token của bucket
`procv-backups`:

```bash
rclone config create r2-backup s3 provider=Cloudflare access_key_id=<id> secret_access_key=<secret> endpoint=https://<account-id>.r2.cloudflarestorage.com
```

Cài cron chạy 03:00 hằng ngày (giữ 7 bản trên VPS, 30 ngày trên R2):

```bash
(crontab -l 2>/dev/null; echo '0 3 * * * RCLONE_REMOTE=r2-backup:procv-backups /srv/procv/scripts/deploy/backup_db.sh >> /srv/procv/backups/backup.log 2>&1') | crontab -
```

Thử khôi phục định kỳ trên máy dev để chắc bản sao lưu dùng được.

## 8. Cập nhật và rollback

```bash
scripts/deploy/deploy.sh
```

- Deploy một commit/tag cụ thể (rollback): `scripts/deploy/deploy.sh <commit>`.
  `deploy/history.log` ghi các commit đã deploy.
- Migration lỗi: `up` dừng trước khi tạo lại backend/worker, bản cũ vẫn chạy.
- Rollback code **không** lùi migration. Trước khi deploy migration phá dữ liệu,
  chạy `scripts/deploy/backup_db.sh`; cần thì `restore_db.sh` bản đó rồi deploy
  commit cũ.
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
lấy từ `https://www.cloudflare.com/ips-v4` và `ips-v6`; soát lại mỗi lần nâng cấp.

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
