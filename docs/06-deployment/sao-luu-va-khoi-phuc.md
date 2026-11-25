# Sao lưu và khôi phục production (procv.site)

Runbook sao lưu và khôi phục (GĐ3 của [kế hoạch chuẩn bị deploy](../archive/ke-hoach/ke-hoach-chuan-bi-deploy.md), đã lưu trữ). Triển khai
chung xem [huong-dan-deployment.md](huong-dan-deployment.md). Mọi lệnh chạy trên VPS
bằng user `deploy` trong `/srv/procv`, trừ khi ghi "máy cá nhân".

> **Không có khóa = không khôi phục được.** Bản sao lưu DB và gói bí mật được mã hóa
> bằng `age`; khóa riêng **không bao giờ** nằm thường trực trên VPS. Password manager
> của chủ dự án phải giữ: khóa riêng `age`, `backend/.env` (đặc biệt `SECRET_KEY`,
> `JWT_SIGNING_KEY`, `CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY`,
> `EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY`), `frontend/.env`, chứng chỉ origin
> `deploy/certs/origin.{pem,key}`. Thêm một bản khóa `age` ngoại tuyến (giấy/USB trong két).

## Mục tiêu

| Dữ liệu | Cách sao lưu | Tần suất | RPO | Nơi lưu |
| --- | --- | --- | --- | --- |
| PostgreSQL | `backup_db.sh`: `pg_dump -Fc` → kiểm tra → `age` | 03:00 hằng ngày + trước mỗi deploy có migration | 24 h | VPS (7 ngày + 4 tuần + 6 tháng, chỉ bản mã hóa) và R2 `procv-backups` |
| File riêng tư (CV, tài liệu công ty, bản xuất) | `backup_files.sh`: `rclone copy` không xóa | 03:30 hằng ngày | 24 h | R2 `procv-backups-files` |
| Bí mật trên VPS | `backup_secrets.sh` → `age` | Chạy tay mỗi lần sửa `.env`/cert | Lần sửa gần nhất | Password manager (chính) + R2 `procv-backups/secrets/` |
| Media công khai (avatar, logo, banner, ảnh bài đăng) | `backup_files.sh` (cùng lượt): `rclone copy` không xóa | 03:30 hằng ngày | 24 h | R2 `procv-backups-public-media` |

**RTO mục tiêu: 2 giờ** cho khôi phục toàn phần lên VPS mới (đo lại ở mỗi lần diễn tập).
Cần RPO DB < 24 h thì bật WAL archiving (wal-g → R2) — để sau go-live.

## Cách bảo vệ bản sao lưu trên R2

R2 không có token "chỉ ghi": token *Object Read & Write* luôn đọc được và về lý thuyết
xóa được. Lớp bảo vệ thật là **Bucket Lock**: object không xóa/ghi đè được trước hết
thời hạn khóa, kể cả bằng token của VPS bị lộ. Vì vậy:

- Script **không bao giờ xóa trên R2** (bỏ `rclone delete` của bản cũ); tên file có
  giây nên không ghi đè. Thời hạn lưu do **lifecycle rule** của bucket quyết định.
- Token trên VPS chỉ có quyền trên ba bucket sao lưu (mỗi bucket một token), tách khỏi
  token ứng dụng. Nguồn của `backup_files.sh` đọc bằng token ứng dụng `R2_PRIVATE_*` /
  `R2_PUBLIC_*` sẵn có trong `backend/.env`.

| Bucket | Tiền tố | Bucket Lock | Lifecycle (xóa sau) |
| --- | --- | --- | --- |
| `procv-backups` | `daily/` | 30 ngày | 30 ngày |
| | `weekly/` (bản đầu tiên mỗi tuần ISO) | 30 ngày | 35 ngày |
| | `monthly/` (bản đầu tiên mỗi tháng) | 30 ngày | 185 ngày |
| | `adhoc/` (pre-deploy, pre-restore) | 30 ngày | 30 ngày |
| | `secrets/` | 30 ngày | 400 ngày |
| `procv-backups-files` | (gương của bucket private) | 30 ngày | 45 ngày |
| `procv-backups-public-media` | (gương của bucket `procv-public-media`) | 30 ngày | 45 ngày |

Hai bucket file: lifecycle xóa object sau 45 ngày kể cả khi file còn sống ở nguồn; lần
chạy kế tiếp `backup_files.sh` tải lại nó (cửa sổ hở ≤ 24 h). File người dùng đã xóa
(CV, avatar…) biến mất khỏi bản sao lưu sau tối đa 45 ngày — ghi vào chính sách quyền
riêng tư. `--ignore-existing` an toàn cho media công khai vì storage không ghi đè key
(`file_overwrite=False`, tên file là uuid/checksum): ảnh mới luôn là object mới.

## Cài đặt một lần

1. **Khóa age** (máy cá nhân, không làm trên VPS):

   ```bash
   age-keygen -o procv-backup.key
   ```

   Lưu toàn bộ nội dung file vào password manager (mục "ProCV — khóa giải mã
   backup"), in một bản giấy, rồi `shred -u procv-backup.key`. Dòng
   `# public key: age1...` là khóa công khai dùng ở bước 4.

2. **Công cụ trên VPS**: `bootstrap_vps.sh` đã cài `rclone`; cài thêm `age`:

   ```bash
   sudo apt-get install -y age
   ```

3. **R2** (dashboard Cloudflare): tạo bucket `procv-backups-files` và
   `procv-backups-public-media` (bucket `procv-backups` đã có ở bước 1.6 của runbook
   deploy). Mỗi bucket: *Settings* → *Bucket lock rules* thêm rule toàn bucket 30 ngày;
   *Object lifecycle rules* theo bảng trên (hai bucket file: xóa sau 45 ngày). Tạo ba API
   token *Object Read & Write*, mỗi token chỉ áp cho **một** bucket sao lưu (*Apply to
   specific buckets only*), không cấp quyền trên bucket ứng dụng. Bucket sao lưu media
   **không** gắn custom domain/public access: chỉ bucket gốc được phục vụ công khai.

4. **`backend/.env`** (mẫu có sẵn, đang comment ở cuối `backend/.env.example`):

   | Khóa | Giá trị |
   | --- | --- |
   | `BACKUP_AGE_RECIPIENT` | Khóa công khai `age1...` (nhiều khóa cách nhau dấu phẩy) |
   | `BACKUP_RCLONE_REMOTE` | `r2-backup:procv-backups` |
   | `BACKUP_FILES_REMOTE` | `r2-backup-files:procv-backups-files` |
   | `BACKUP_PUBLIC_FILES_REMOTE` | `r2-backup-public:procv-backups-public-media` (trống = `backup_files.sh` cảnh báo và bỏ qua media công khai) |
   | `HC_BACKUP_DB_URL`, `HC_BACKUP_FILES_URL` | URL ping của hai check healthchecks.io |

   Nguồn của `backup_files.sh` dựng từ `R2_ENDPOINT_URL` + `R2_PRIVATE_*` / `R2_PUBLIC_*`
   sẵn có (qua biến `RCLONE_CONFIG_*`, khóa không lên dòng lệnh), không cần remote riêng.

5. **rclone** — ba remote, mỗi remote một token. Đặt dấu cách đầu dòng để lệnh chứa
   secret không vào lịch sử shell (`HISTCONTROL=ignoreboth` mặc định của Ubuntu):

   ```bash
    rclone config create r2-backup s3 provider=Cloudflare access_key_id=<id> secret_access_key=<secret> endpoint=https://<account-id>.r2.cloudflarestorage.com no_check_bucket=true
   ```

   ```bash
    rclone config create r2-backup-files s3 provider=Cloudflare access_key_id=<id> secret_access_key=<secret> endpoint=https://<account-id>.r2.cloudflarestorage.com no_check_bucket=true
   ```

   ```bash
    rclone config create r2-backup-public s3 provider=Cloudflare access_key_id=<id> secret_access_key=<secret> endpoint=https://<account-id>.r2.cloudflarestorage.com no_check_bucket=true
   ```

6. **healthchecks.io**: hai check `procv-backup-db`, `procv-backup-files`, chu kỳ 1 ngày,
   grace 2 giờ, báo qua email/Telegram. Script ping `/start` khi bắt đầu, URL gốc khi
   xong, `/fail` kèm bước lỗi khi thất bại; không ping (cron không chạy, VPS chết) thì
   healthchecks tự báo sau grace.

7. **Cron** của user `deploy` (`crontab -e`; VPS đặt múi giờ Việt Nam). Script tự ghi
   `backups/backup.log`, `backups/backup-files.log` (xoay ở 5 MB, giữ 3 bản); file
   `cron-errors.log` chỉ nhận lỗi xảy ra trước khi script mở log (khóa, tham số):

   ```cron
   0 3 * * * /srv/procv/scripts/deploy/backup_db.sh >/dev/null 2>>/srv/procv/backups/cron-errors.log
   30 3 * * * /srv/procv/scripts/deploy/backup_files.sh >/dev/null 2>>/srv/procv/backups/cron-errors.log
   ```

8. **Chạy thử** từng script một lần, kiểm healthchecks xanh và có object trên R2:

   ```bash
   scripts/deploy/backup_db.sh && scripts/deploy/backup_files.sh && scripts/deploy/backup_secrets.sh
   ```

## Các script

| Script | Việc làm | Ghi chú |
| --- | --- | --- |
| `backup_db.sh [--label TÊN]` | `flock`; kiểm dung lượng trống (cỡ DB + 1 GB); `pg_dump -Fc`; từ chối bản < 100 KB hoặc `pg_restore --list` lỗi/thiếu `django_migrations`; mã hóa `age`; đẩy `daily/` (+`weekly/`, `monthly/`); xoay vòng cục bộ 7/4/6 | `--label` (vd `pre-deploy-<sha>`): bản đột xuất, vào `adhoc/`, giữ 5 bản cục bộ, không ping healthchecks |
| `backup_files.sh` | `rclone copy --ignore-existing --metadata` bucket private → `procv-backups-files`, rồi `procv-public-media` → `procv-backups-public-media` | Không `sync`: xóa nhầm ở prod không lan sang bản sao lưu; không ghi đè object đã khóa. Thiếu `BACKUP_PUBLIC_FILES_REMOTE` thì cảnh báo, bỏ qua media công khai (ping healthchecks vẫn xanh, nội dung ping ghi "BỎ QUA"); một bucket lỗi không chặn bucket kia nhưng script thoát lỗi, ping `/fail` |
| `backup_secrets.sh [--output FILE]` | `tar` `backend/.env`, `frontend/.env`, `deploy/certs` → `age` → `secrets/` | Chạy sau **mỗi** lần sửa các file đó |
| `restore_db.sh` | Giải mã → kiểm tra → xác nhận → dump an toàn → dừng app (giữ `web` trả trang bảo trì) → `dropdb`/`createdb` → `pg_restore --exit-on-error --single-transaction` → `FLUSHALL` mọi redis → `up -d` → chờ `/api/health/ready/` → `reconcile_account_status_holds` | `--from-dev` chạy thêm `purge_demo_accounts --confirm`; `--skip-safety-dump`; `--yes` |
| `restore_files.sh` | `rclone copy` ngược từ bucket sao lưu về bucket private (mặc định) hoặc media công khai, không xóa ở đích | `--bucket private\|public`, `--dry-run`, `--prefix`, `--from` |
| `deploy.sh` | Tự chạy `backup_db.sh --label pre-deploy-<sha>` khi `migrate --check` của image mới báo có migration chưa áp | `--no-backup` để bỏ (không khuyến nghị) |

Danh sách service (dừng/flush) lấy từ `compose.sh config --services`: mọi `redis*`
được flush, mọi service trừ `db`, `redis*`, `web` bị dừng khi khôi phục — tách
`redis-broker`/`redis-cache` hay thêm worker không cần sửa script.

## Đưa khóa riêng lên VPS khi cần giải mã

Chỉ lúc khôi phục, chép khóa vào RAM (`/dev/shm` mất khi reboot), xóa ngay sau đó:

```bash
install -m 600 /dev/null /dev/shm/procv-backup.key && nano /dev/shm/procv-backup.key
```

Dán nội dung từ password manager, lưu. Xong việc:

```bash
shred -u /dev/shm/procv-backup.key
```

## Khôi phục toàn phần lên VPS mới

Ước lượng thời gian cho RTO 2 giờ; ghi thời gian thật vào [nhật ký diễn tập](#nhật-ký-diễn-tập).

1. **VPS + bootstrap** (~20 phút): tạo VPS Ubuntu 24.04, chạy `bootstrap_vps.sh` theo
   mục 2 của [runbook deploy](huong-dan-deployment.md#2-khởi-tạo-vps), clone repo vào
   `/srv/procv`, checkout bản đang chạy trước sự cố (`deploy/history.log` mất theo VPS
   cũ: dùng commit mới nhất của `main` đã deploy, hoặc tag release).
2. **Bí mật** (~10 phút) — chọn một:
   - từ password manager: tạo `backend/.env`, `frontend/.env`, `deploy/certs/origin.pem`,
     `origin.key`, `chmod 600`;
   - từ gói `backup_secrets.sh`: tạo remote `r2-backup` (bước cài đặt 5, token mới), đưa
     khóa lên `/dev/shm`, rồi

     ```bash
     rclone lsf r2-backup:procv-backups/secrets/ | tail -n 3
     ```

     ```bash
     rclone cat r2-backup:procv-backups/secrets/<file> | age -d -i /dev/shm/procv-backup.key | tar -xzf - -C /srv/procv
     ```
3. **Token & rclone** (~10 phút): VPS cũ mất thì coi mọi token trên đó đã lộ — thu hồi
   trên dashboard, tạo token mới cho bucket ứng dụng (sửa `R2_*` trong `backend/.env`)
   và ba bucket sao lưu (`rclone config create` như bước cài đặt 5).
4. **Mô hình đối sánh** (máy dev): `scripts/deploy/sync_ml_models.sh deploy@<ip-mới>`.
5. **Build image** (~20 phút): `scripts/deploy/compose.sh build`.
6. **DB** (~15 phút): lấy bản mới nhất rồi khôi phục (DB trống nên không có dump an toàn):

   ```bash
   rclone lsf r2-backup:procv-backups/daily/ | tail -n 3
   ```

   ```bash
   rclone copy r2-backup:procv-backups/daily/<file> backups/
   ```

   ```bash
   scripts/deploy/restore_db.sh --identity /dev/shm/procv-backup.key backups/<file>
   ```
7. **File riêng tư và media công khai**: bucket R2 độc lập với VPS nên thường còn
   nguyên. Chỉ khi bucket private bị xóa/hỏng: `scripts/deploy/restore_files.sh --dry-run`
   rồi chạy thật. Bucket `procv-public-media` bị xóa/hỏng (avatar, logo trả 404):

   ```bash
   scripts/deploy/restore_files.sh --bucket public --dry-run
   ```

   rồi chạy lại không có `--dry-run`. Bucket tạo lại phải gắn lại custom domain
   `media.procv.site`; `--metadata` giữ `Cache-Control` của object.
8. **Kiểm tra** (~15 phút): checklist mục 6 của runbook deploy qua
   `curl --resolve procv.site:443:127.0.0.1 -k`; tính lại embedding
   (`compose.sh exec ml-worker python manage.py matching_backfill`).
9. **DNS** (~5 phút): Cloudflare → bản ghi `A @`, `A www` trỏ IP mới (vẫn *Proxied*).
10. **Sau khôi phục**: cài cron, `backup_secrets.sh`, `backup_db.sh` thử, `shred -u` khóa.

## Diễn tập hằng quý

Mỗi quý (và trước go-live — GĐ 6) khôi phục bản sao lưu thật lên **VPS tạm** theo đúng
mục trên. **Không** kéo dump hay file CV về laptop: đó là dữ liệu cá nhân của ứng viên.

- VPS tạm cùng nhà cung cấp, xóa ngay sau buổi diễn tập; không trỏ DNS, truy cập qua
  `ssh -L 8443:127.0.0.1:443 deploy@<ip-tạm>` và `curl --resolve procv.site:8443:127.0.0.1 -k`.
- Bản sao chạy job thật nên **chặn tác dụng ra ngoài** trong `backend/.env` của VPS tạm:
  `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`,
  `CAMPAIGN_SOCIAL_LIVE_NETWORKS=` (trống), `EMPLOYER_SMS_OTP_ENABLED=False`.
- R2 của VPS tạm dùng token **chỉ đọc** (*Object Read only*) cho bucket ứng dụng — app
  không ghi/xóa được dữ liệu production. Thử `restore_files.sh` vào một bucket tạm
  (`R2_PRIVATE_BUCKET=procv-drill-files` + token riêng; media công khai:
  `R2_PUBLIC_BUCKET=procv-drill-public` + `--bucket public`), xóa bucket sau đó.
- Đo: thời gian từ lúc tạo VPS tới khi `/api/health/ready/` trả 200; so số dòng các
  bảng chính với production; mở thử một CV (tải từ R2) qua cổng NTD.
- Xong: xóa VPS, thu hồi token tạm, `shred -u` khóa, ghi kết quả vào bảng dưới.

### Nhật ký diễn tập

| Ngày | Bản sao lưu | RTO thực tế | Kết quả / việc cần sửa |
| --- | --- | --- | --- |
| _chưa diễn tập_ | | | |

## Kịch bản sự cố

### Xóa nhầm dữ liệu

Không khôi phục đè cả DB khi sự cố chỉ chạm vài bản ghi — sẽ mất mọi thay đổi từ
03:00. Nạp bản sao lưu vào DB phụ trong cùng container rồi chép dòng cần lấy lại:

```bash
age -d -i /dev/shm/procv-backup.key backups/<file>.dump.age > /dev/shm/recover.dump
```

```bash
scripts/deploy/compose.sh exec -T db sh -c 'createdb -U "$POSTGRES_USER" procv_recover && pg_restore -U "$POSTGRES_USER" -d procv_recover --no-owner --no-privileges' < /dev/shm/recover.dump
```

So sánh/chép bằng `psql` (`\copy (SELECT ...) TO STDOUT` ở `procv_recover` →
`\copy ... FROM STDIN` ở DB chính, trong transaction), rồi `dropdb procv_recover` và
`shred -u /dev/shm/recover.dump`. Hỏng diện rộng thì `restore_db.sh` bản gần nhất.
File bị xóa: `restore_files.sh --prefix <thư mục> --dry-run`, rồi chạy thật (thêm
`--bucket public` cho avatar/logo/banner).

### Migration hỏng

- Migration lỗi trong `up`: service `migrate` dừng, backend/worker cũ vẫn chạy (mỗi
  migration Postgres là một transaction nên migration lỗi tự lùi). `deploy.sh` ghi
  `FAIL` vào `deploy/history.log` và in lệnh rollback.
- Rollback code bằng image cũ, không build: `scripts/deploy/deploy.sh --skip-build <sha cũ>`.
- Migration đã áp nhưng phá dữ liệu/không tương thích code cũ: rollback code như trên,
  rồi khôi phục bản `deploy.sh` tự tạo trước migration:

  ```bash
  scripts/deploy/restore_db.sh --identity /dev/shm/procv-backup.key backups/procv-pre-deploy-<sha>-<thời điểm>.dump.age
  ```

  Dữ liệu ghi giữa lúc sao lưu và lúc khôi phục bị mất — báo người dùng nếu cần.

### Mất VPS

Làm theo [khôi phục toàn phần](#khôi-phục-toàn-phần-lên-vps-mới). Mất tối đa dữ liệu
từ 03:00 hôm đó (DB) và file tải lên sau 03:30. Thu hồi mọi token/khóa từng nằm trên VPS
cũ (R2, SMTP app password, OAuth secret, Gemini key).

### Lộ key R2

1. Xác định token: `R2_*` trong `backend/.env` (bucket ứng dụng) hay token trong
   `~/.config/rclone/rclone.conf` (bucket sao lưu).
2. Dashboard → R2 → *Manage API tokens*: thu hồi token đó ngay, tạo token mới cùng phạm vi.
3. Cập nhật `backend/.env` rồi `scripts/deploy/compose.sh up -d`, hoặc `rclone config
   update <remote> access_key_id=... secret_access_key=...`; chạy `backup_secrets.sh`.
4. Kiểm tra thiệt hại: liệt kê object mới/lạ (`rclone lsl --max-age 7d`). Bucket Lock
   bảo đảm bản sao lưu không bị xóa trong 30 ngày; file CV trong bản sao lưu không mã
   hóa nên lộ token `procv-backups-files` = lộ CV → đánh giá nghĩa vụ thông báo theo
   Nghị định 13/2023. Lộ token `procv-backups-public-media` chỉ lộ ảnh vốn đã công khai,
   vẫn thu hồi như trên.

### Mất khóa age

**Không có khóa = không khôi phục được**: mọi bản `.dump.age` và gói bí mật hiện có
trở thành vô dụng. Việc cần làm ngay khi phát hiện (khi DB còn sống):

1. Tạo cặp khóa mới (bước cài đặt 1), cất vào password manager + bản giấy.
2. Đổi `BACKUP_AGE_RECIPIENT`, chạy ngay `backup_db.sh` và `backup_secrets.sh` để có
   bản đọc được; bản cũ tự hết hạn theo lifecycle.

Phòng ngừa: hai recipient (khóa chính trong password manager + khóa dự phòng ngoại
tuyến), kiểm bằng buổi diễn tập hằng quý rằng khóa trong password manager giải mã được.
Khóa bị **lộ** (không mất): cũng xoay như trên; kẻ có cả khóa lẫn token R2 đọc được các
bản cũ cho tới khi hết hạn lifecycle.

### Mất `backend/.env`

Lấy lại từ password manager hoặc gói `secrets/`. Mất hẳn: `SECRET_KEY`/`JWT_SIGNING_KEY`
mới chỉ làm mọi phiên đăng nhập hết hiệu lực; mất `CAMPAIGN_SOCIAL_TOKEN_ENCRYPTION_KEY`
thì token mạng xã hội đã mã hóa không đọc được (NTD phải kết nối lại), mất
`EMPLOYER_SMS_PAYLOAD_ENCRYPTION_KEY` thì payload SMS đã mã hóa không đọc được.
