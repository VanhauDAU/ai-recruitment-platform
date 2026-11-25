# Checklist go-live procv.site (VPS ngày 2/12/2026)

Danh sách việc theo ngày, đánh dấu khi xong. Chi tiết từng bước ở
[huong-dan-deployment.md](huong-dan-deployment.md) (runbook),
[sao-luu-va-khoi-phuc.md](sao-luu-va-khoi-phuc.md) và kế hoạch
[ke-hoach-chuan-bi-deploy.md](ke-hoach-chuan-bi-deploy.md) (GĐ0, GĐ6).

Code đã sẵn (dev @ 25/11): compose prod, nginx, script deploy/backup/restore,
Sentry, `/api/health/ready/`, throttle, CSP (Report-Only), khóa Access cho đăng
nhập admin. Phần còn lại là **tài khoản và cấu hình bên ngoài** dưới đây.

## Trước 2/12: code và tài khoản (làm song song)

**Code**
- [ ] Gộp các PR đang mở vào `dev`, chạy xanh CI, rồi gộp PR "Dev" vào `main`
  (`deploy.sh` chỉ lấy `origin/main`).

**Cloudflare: zone `procv.site`**
- [ ] Domain đã dùng nameserver Cloudflare (Registrar → đổi NS theo Cloudflare).
- [ ] SSL/TLS: *Full (strict)* + *Always Use HTTPS*.
- [ ] Tạo Origin Certificate (`procv.site`, `*.procv.site`, 15 năm) → lưu
  `origin.pem` / `origin.key` vào password manager (chép lên VPS ngày 2/12).
- [ ] Tắt Rocket Loader, tắt Email Address Obfuscation. *Browser Cache TTL* =
  *Respect Existing Headers*. Không tạo rule *Cache Everything*.
- [ ] Rate limiting rule (gói Free chỉ một rule): `/api/auth/*`, 60 req/10 giây/IP → Block.
- [ ] **Chưa** tạo bản ghi `A @`/`A www`: làm ngày 2/12 khi đã có IP VPS.

**Cloudflare R2** ([cloudflare-r2-media.md](cloudflare-r2-media.md))
- [ ] 3 bucket ứng dụng: `procv-public-media` (custom domain `media.procv.site`),
  `procv-private-files`, `procv-upload-quarantine`. Mỗi bucket một API token riêng.
- [ ] 3 bucket backup: `procv-backups`, `procv-backups-files`,
  `procv-backups-public-media`. Bật Bucket Lock 30 ngày. Token VPS chỉ đọc+ghi
  (không xóa). Token đọc để giữ ngoài VPS.

**Email gửi OTP/xác thực**: Brevo kẹt bước xác minh SĐT → dùng Resend
- [ ] Tạo tài khoản Resend → Domains → Add `procv.site` → *Auto configure* với
  Cloudflare (hoặc thêm tay các bản ghi Resend hiển thị) → chờ trạng thái
  *Verified*.
- [ ] Tạo API key (quyền *Sending access*, domain `procv.site`).
- [ ] DMARC: `TXT _dmarc` = `v=DMARC1; p=none; rua=mailto:dmarc@procv.site`.
- [ ] Email Routing: `support@procv.site` và `dmarc@procv.site` → Gmail của bạn.
- [ ] Chuẩn bị env: `EMAIL_HOST=smtp.resend.com`, `EMAIL_PORT=587`,
  `EMAIL_HOST_USER=resend`, `EMAIL_HOST_PASSWORD=<API key>`,
  `EMAIL_FROM_ADDRESS=no-reply@procv.site`.
- [ ] (Tùy chọn) Nếu Brevo nhận được SMS: đổi 3 biến `EMAIL_HOST*` sang
  `smtp-relay.brevo.com` + SMTP login/key, authenticate domain trong Brevo.

**Google đăng nhập** (Cloud Console → APIs & Services)
- [ ] OAuth client loại *Web application*:
  - *Authorized JavaScript origins*: `https://procv.site`
  - *Authorized redirect URIs*: `https://procv.site/api/auth/oauth/google/callback/`
    (URI của **backend**, không phải `/oauth/callback`)
- [ ] OAuth consent screen: điền tên app, logo, link Điều khoản/Quyền riêng tư,
  chuyển sang *In production*.
- [ ] (Nếu dùng) Facebook / LinkedIn: redirect
  `https://procv.site/api/auth/oauth/{facebook,linkedin}/callback/`.

**reCAPTCHA v3**
- [ ] Thêm domain `procv.site` (và `www.procv.site`) vào site key → secret vào
  `backend/.env`, site key vào `frontend/.env` (`VITE_RECAPTCHA_SITE_KEY`).

**AI và bản đồ**
- [ ] Gemini: project đã bật thanh toán + key; `AI_MODEL_PRICING_USD` theo giá thật.
  Hoặc đặt `AI_RUNTIME_ENABLED=False` nếu chưa dùng.
- [ ] VietMap key + site setting `map_style_url` (nếu bật "Việc làm gần tôi").

**Giám sát và bí mật**
- [ ] Sentry: 2 project (backend, frontend) → `SENTRY_DSN`, `VITE_SENTRY_DSN`.
- [ ] UptimeRobot: monitor `https://procv.site/api/health/ready/` và `https://procv.site/`.
- [ ] healthchecks.io: 2 check (backup DB, backup file) → `HC_BACKUP_*_URL`.
- [ ] Tạo cặp khóa `age` (giải mã backup). Khóa riêng chỉ giữ ngoài VPS.
- [ ] Sinh `SECRET_KEY`, `JWT_SIGNING_KEY`, `DB_PASSWORD` (`openssl rand`). Không
  dùng giá trị `django-insecure…` của file mẫu: production từ chối khởi động.
- [ ] Lưu toàn bộ `backend/.env`, `frontend/.env`, origin cert, khóa `age` vào
  password manager.

**Pháp lý**
- [ ] Rà soát nội dung Điều khoản, Chính sách quyền riêng tư, DPA NTD.

## Ngày 2/12: lên VPS

1. [ ] Mua VPS (Ubuntu 24.04, 8 GB), thêm SSH key → chạy `bootstrap_vps.sh` (runbook mục 2).
2. [ ] Clone repo nhánh `main` vào `/srv/procv`. Điền `backend/.env` + `frontend/.env`
   (runbook mục 3). Chép `deploy/certs/origin.{pem,key}`. Tải CA Authenticated
   Origin Pulls (runbook bước 1.4).
3. [ ] Đồng bộ mô hình: `scripts/deploy/sync_ml_models.sh` (runbook mục 4).
4. [ ] `scripts/deploy/deploy.sh` → mọi service healthy (`compose.sh ps`).
5. [ ] Nạp dữ liệu: DB trống + seed nền, hoặc dump dev → `restore_db.sh` →
   `purge_demo_accounts`. Tạo superuser mới, mật khẩu mạnh. Chạy `seed_sitecontent`.
6. [ ] Cloudflare: tạo `A @` + `A www` → IP VPS, *Proxied*. Bật Authenticated
   Origin Pulls.
7. [ ] Cloudflare Access: application *Self-hosted* cho `procv.site/admin*` +
   `procv.site/api/admin/*`, policy email quản trị, One-time PIN. Sau khi vào được
   admin qua Access, đặt `CLOUDFLARE_ACCESS_TEAM_DOMAIN` + `CLOUDFLARE_ACCESS_AUD`
   rồi `deploy.sh --skip-build` (runbook bước 1.7).
8. [ ] Kiểm sau deploy (runbook mục 6):
   - [ ] Đăng ký ứng viên → nhận email xác thực (xem `AuthEmailJob` nếu không
     thấy thư: `compose.sh logs email-worker`). Quên mật khẩu → nhận link.
   - [ ] Đăng nhập Google ở cổng ứng viên và NTD.
   - [ ] Upload CV, xuất PDF, thông báo realtime (`wss://procv.site/ws/notifications/` → 101).
   - [ ] `curl -sI https://procv.site` có CSP + HSTS. `/.vite/manifest.json` trả 404.
   - [ ] Gọi thẳng IP VPS (`curl -k https://<ip>`) bị chặn hoặc nhận 403.
   - [ ] POST `/api/auth/login/` với `portal=admin` từ ngoài Access nhận 403.
   - [ ] Sentry nhận lỗi thử. UptimeRobot xanh.
9. [ ] Backup: cài cron `backup_db.sh` + `backup_files.sh`; healthchecks nhận ping lần đầu.
10. [ ] k6 200 VU từ máy ngoài (`scripts/loadtest/README.md`). Diễn tập khôi phục,
    ghi RTO vào `sao-luu-va-khoi-phuc.md`.

## Sau go-live
- [ ] Theo dõi Sentry/log 48 giờ đầu. Đóng băng tính năng mới 1 tuần.
- [ ] Khi Sentry hết vi phạm CSP thật: chuyển CSP từ Report-Only sang chặn (runbook mục 9).
- [ ] DMARC `p=none` → `p=quarantine` khi báo cáo sạch vài tuần.
- [ ] Việc để sau: MFA TOTP trong app, cache bảo mật tách Redis không eviction,
  gia cố container (`cap_drop`, `no-new-privileges`), WAL archiving
  ([ke-hoach-chuan-bi-deploy.md](ke-hoach-chuan-bi-deploy.md) mục "Để sau go-live").
