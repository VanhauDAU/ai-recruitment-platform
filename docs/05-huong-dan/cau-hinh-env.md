# Cấu hình biến môi trường ProCV

Mỗi service sở hữu đúng một cặp file env. Không có file env nào ở root
repository; Docker Compose không đọc `.env` ở root.

| File | Vai trò | Commit |
| --- | --- | --- |
| `backend/.env.example` | Mẫu đầy đủ mọi biến backend, nhóm theo miền, giá trị mặc định local an toàn | Có |
| `backend/.env` | Giá trị local của bạn; Django chỉ đọc file này | Không |
| `frontend/.env.example` | Mẫu đầy đủ biến `VITE_*` và cấu hình Vite dev server | Có |
| `frontend/.env` | Giá trị local của bạn; Vite tự nạp | Không |

Thứ tự ưu tiên: process environment (CI, Docker, lệnh chạy tạm) > `.env` >
default trong code. `backend/.env.example` không bao giờ được tự động nạp.

## Bắt đầu

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Khi `.env.example` thay đổi (thêm/xóa/sắp lại biến), đồng bộ file local mà vẫn
giữ nguyên giá trị đang có:

```bash
python3 scripts/sync_local_env.py           # ghi lại backend/.env và frontend/.env
python3 scripts/sync_local_env.py --check   # chỉ báo, exit 1 nếu lệch
```

Script dựng lại `.env` theo bố cục và comment của mẫu, giữ giá trị local, thêm
key mới với giá trị mặc định của mẫu và bỏ key mẫu không còn khai báo. Script
chỉ in tên key, không in giá trị.

## Quy tắc

- Biến `VITE_*` được bundle vào JavaScript công khai: không đặt secret trong
  `frontend/.env`. Gate từ chối tên `VITE_*` chứa `SECRET`, `PASSWORD`,
  `PRIVATE_KEY`, `ACCESS_KEY`, `API_TOKEN`.
- decouple không cắt comment cuối dòng: `EMAIL_VERIFICATION_TTL=86400  # 24h`
  làm `cast=int` lỗi. Comment luôn đặt ở dòng riêng.
- Giá trị trong `backend/.env.example` phải bằng default trong
  `config/settings/base.py`, trừ các override có lý do trong
  `DOCUMENTED_DEFAULT_OVERRIDES` (`scripts/check_env_sync.py`).
- Docker Compose chỉ override địa chỉ hạ tầng nội bộ (`DB_HOST`, `REDIS_URL`,
  `CELERY_BROKER_URL`, media root, `CLAMAV_HOST`); mọi giá trị khác lấy từ
  `backend/.env`. Tài nguyên container (PID, log, concurrency) cố định trong
  `docker-compose.yml`.

## Biến do process cấp

Các biến sau không nằm trong `.env.example` vì runner/CLI sở hữu chúng:

| Phạm vi | Biến | Nguồn |
| --- | --- | --- |
| Backend | `DJANGO_SETTINGS_MODULE` | Entrypoint/CI; phải có trước khi Django nạp settings. Production đặt `config.settings.production` cùng `ENVIRONMENT=production` |
| Backend | `USER` | Shell; nhãn actor dự phòng của management command |
| Frontend | `ANALYZE` | `ANALYZE=1 npm run build` sinh treemap bundle (`json` sinh `dist/stats.json`) |
| Frontend | `PORT` | Tool preview cấp khi 5173 bận |
| Frontend | `PLAYWRIGHT_PORT`, `PLAYWRIGHT_WEB_SERVER` | Playwright chỉ đọc process env; CI đặt `PLAYWRIGHT_WEB_SERVER=preview` |
| Frontend | `CI`, `import.meta.env.PROD` | CI runner / Vite |

## Ma trận chạy

| Bối cảnh | Django settings | DB/Redis | Frontend |
| --- | --- | --- | --- |
| Native local | `config.settings.development`, `backend/.env` | PostgreSQL 5432, Redis 6379 theo mẫu | Vite 5173, proxy `/api` tới `API_PROXY_TARGET` |
| Docker local | Service nhận `backend/.env` qua `env_file` | Compose override sang `db`/`redis`; host expose Postgres 5433 | Compose đặt `VITE_API_BASE_URL=/api`, proxy `backend:8000` |
| CI backend | `DJANGO_SETTINGS_MODULE=config.settings.test` | Service PostgreSQL của job | — |
| CI frontend | — | — | `VITE_API_BASE_URL` do job cấp; không có `frontend/.env` |

## Thêm hoặc đổi biến

1. Đọc biến bằng `config(...)` (backend) hoặc `import.meta.env.VITE_*`
   (frontend) với default an toàn.
2. Khai báo cùng tên, đúng nhóm trong `.env.example` của service đó, giá trị
   bằng default trong code.
3. Không đổi tên biến đang dùng nếu không có fallback có thời hạn.
4. Khi xóa tính năng, xóa luôn biến khỏi code và `.env.example`.
5. Chạy `bash scripts/check_env_sync.sh`. Gate kiểm: biến đọc mà chưa khai báo,
   khai báo mà không ai đọc, trùng tên, kiểu/default, lookup động `env_var` của
   Site Settings, secret trong `VITE_*`, file env đặt sai chỗ và interpolation
   `${...}` trong `docker-compose.yml`. Nếu có `.env` local, gate báo thêm key
   thiếu/thừa/trùng/sai kiểu (chỉ tên key).
6. Chạy `python3 scripts/sync_local_env.py` để cập nhật `.env` của bạn.
