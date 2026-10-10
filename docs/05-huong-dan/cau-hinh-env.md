# Cấu hình biến môi trường ProCV

ProCV dùng mẫu tối thiểu để khởi động local và catalog tùy chọn để tra cứu từng
tích hợp. Backend chỉ đọc `backend/.env`; catalog optional không được tự động
nạp. Biến của process luôn ưu tiên giá trị trong file. Frontend chỉ đưa biến
`VITE_*` vào bundle, vì vậy không đặt secret backend trong các file frontend.
Inventory đầy đủ tên, consumer, kiểu, default đã công bố, owner, độ nhạy và
bằng chứng nằm tại [p4-env-inventory.csv](../99-tien-do/p4-env-inventory.csv).

## Các file và chủ sở hữu

| File hoặc nguồn | Vai trò | Tự động nạp |
| --- | --- | --- |
| `backend/.env.example` | Cấu hình tối thiểu cho Django, PostgreSQL, ba URL cổng và Redis/Celery local | Chỉ sau khi sao chép thành `backend/.env` |
| `backend/.env.optional.example` | Catalog AI, OAuth/email/SMS, storage/upload, policy, feature flag và tuning | Không |
| `backend/.env` | Giá trị cá nhân; không commit | Có, chỉ file này |
| Process environment | Override cho CI, Docker và lệnh chạy tạm thời | Có, ưu tiên cao nhất |
| `frontend/.env.example` | Hai biến public tối thiểu cho API và reCAPTCHA local | Theo cơ chế Vite sau khi sao chép |
| `frontend/.env.optional.example` | Branding, asset, consent, rollout, host ba cổng và tooling Node/Vite | Không |
| `frontend/.env.local` | Override cá nhân; không commit | Có theo cơ chế Vite |
| `.env.example` ở root | Catalog tùy chọn chỉ dành cho Docker Compose local | Chỉ sau khi sao chép thành `.env` ở root |

Không tạo `.env` ở root repository để cấp biến cho backend. Compose interpolation
`${NAME}` đọc process environment hoặc `.env` của Compose ở root theo cơ chế
Docker, không đọc `backend/.env`. Các service backend vẫn nhận `backend/.env`
qua `env_file` và các override hostname nội bộ trong `docker-compose.yml`.
Compose chỉ ghi đè hostname/cổng hạ tầng nội bộ. `AI_RUNTIME_ENABLED` tiếp tục
thuộc `backend/.env`; `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES` tiếp tục thuộc file
env của frontend, nên Compose không được cấp một giá trị mặc định thứ hai.

## Mẫu backend tối thiểu

| Nhóm | Biến | Kiểu | Mặc định local | Khi bắt buộc | Nhạy cảm | Hành động và gate |
| --- | --- | --- | --- | --- | --- | --- |
| Django | `ENVIRONMENT` | enum | `development` | Luôn có trong mẫu | Không | Giữ minimal; test entrypoint development/production |
| Django | `SECRET_KEY` | string | khóa local mẫu | Production phải thay bằng khóa riêng | Có | Giữ minimal; production fail-fast |
| Django | `DEBUG`, `DJANGO_ADMIN_ENABLED` | boolean | `True` | Local | Không | Giữ minimal; production từ chối `True` |
| Database | `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | string/port | PostgreSQL local cổng 5432 | Khi giá trị local khác mặc định | `DB_PASSWORD` | Giữ minimal; native và Docker matrix |
| Cổng | `CORS_ALLOWED_ORIGINS` | CSV URL | hai origin local 5173 | Khi frontend khác origin | Không | Giữ minimal; CORS regression |
| Cổng | `FRONTEND_URL`, `EMPLOYER_FRONTEND_URL`, `ADMIN_FRONTEND_URL` | URL | `http://localhost:5173` | Khi tách host | Không | Giữ minimal; email/OAuth redirect regression |
| Queue/cache | `REDIS_URL`, `CELERY_BROKER_URL` | Redis URL | `127.0.0.1:6379/1` | Khi Redis không chạy native local | Có thể chứa credential | Giữ minimal; worker/health smoke |

Mọi biến backend còn lại nằm trong catalog optional theo nhóm và giữ default
hiện hành. Biến không có consumer bị gate từ chối. Lookup động qua `env_var`
trong Site Settings cũng được kiểm kê, gồm `EMAIL_HOST_PASSWORD`,
`VNPAY_HASH_SECRET` và `GEMINI_API_KEY`.

## Mẫu frontend và tooling

| Nhóm | Biến | Kiểu/default | Công khai | Hành động và gate |
| --- | --- | --- | --- | --- |
| Runtime | `VITE_API_BASE_URL` | URL path, `/api` | Có | Giữ minimal; production build fail nếu thiếu |
| Runtime | `VITE_RECAPTCHA_SITE_KEY` | public site key, rỗng local | Có | Giữ minimal; không phải secret reCAPTCHA backend |
| Portal/branding | `VITE_MAIN_HOST`, `VITE_EMPLOYER_HOST`, `VITE_ADMIN_HOST`, `VITE_AUTH_SYNC_COOKIE_DOMAIN`, `VITE_SITE_*`, `VITE_PUBLIC_ASSET_BASE_URL` | rỗng hoặc fallback trong code | Có | Chuyển optional; route/asset tests |
| Consent/rollout | `VITE_COOKIE_CONSENT_ENABLED`, `VITE_ANNOUNCEMENT_ROLLOUT_SURFACES` | `true`/rỗng | Có | Chuyển optional; unit/E2E hiện hành |
| Node tooling | `API_PROXY_TARGET`, `PORT`, `PLAYWRIGHT_PORT`, `ANALYZE` | có default local | Không bundle | Chuyển optional, không đổi thành `VITE_*` |

Gate từ chối tên `VITE_*` có dấu hiệu chứa secret, password, private key, access
key hoặc API token. `CI` và `import.meta.env.PROD` thuộc runner/Vite nên được ghi
rõ là ngoại lệ có chủ sở hữu, không khai trong catalog ứng dụng.
`vite.config.js` dùng `loadEnv` để đọc `API_PROXY_TARGET`, `PORT` và `ANALYZE`
từ `.env.local`; các giá trị này chỉ cấu hình Vite và không được đưa vào bundle.
`PLAYWRIGHT_PORT` tiếp tục do process/runner cấp cho Playwright.

`OAUTH_CODE_TTL=120` là override local đã có trước P4; fallback khi biến vắng
mặt vẫn là 60 giây. Sai lệch này được inventory ghi nhận và không tự thay đổi
trong nhánh tổ chức env vì đó là thay đổi hành vi xác thực.

## Ma trận chạy

| Bối cảnh | Django settings | Nguồn DB/Redis | Frontend | Ghi chú |
| --- | --- | --- | --- | --- |
| Native local | mặc định `config.settings.development`; `ENVIRONMENT=development` từ `backend/.env` | host 5432 và Redis 6379 trong mẫu minimal | Vite 5173, proxy API tới 8000 | Không cần root `.env` |
| Docker local | entrypoint development; service nhận `backend/.env` | Compose override host `db`/`redis`, DB nội bộ 5432; host expose 5433 | Compose đặt `/api` và proxy `backend:8000` | Không đổi tên project/volume |
| CI backend | `DJANGO_SETTINGS_MODULE=config.settings.test` từ job env | job env và PostgreSQL service | Không áp dụng | Test settings khóa cache/email/Celery, không dựa secret local |
| CI frontend | Vite test/build | Không áp dụng | `VITE_API_BASE_URL` do job hoặc mẫu public cung cấp | Không đọc backend `.env` |

`DJANGO_SETTINGS_MODULE` phải do entrypoint hoặc process environment đặt trước
khi Django import settings; đặt tên này trong `backend/.env` là quá muộn và không
được hỗ trợ. `ENVIRONMENT` vẫn nằm trong `backend/.env` để settings kiểm tra đúng
chế độ. Production cần đặt cả hai nhất quán qua process environment.

## Thêm hoặc đổi biến

1. Xác định owner và consumer trước khi thêm tên mới.
2. Chỉ đặt biến cần cho local phổ biến vào `.env.example`; tuning, integration,
   feature flag và policy vào `.env.optional.example`.
3. Không đổi tên biến đang dùng nếu không có migration/fallback có thời hạn.
4. Chạy `python3 scripts/check_env_sync.py`. Gate kiểm union hai catalog, tên
   trùng, khai thiếu/thừa, kiểu/default, lookup động, Compose interpolation và
   secret frontend. Nếu `.env` local tồn tại, lệnh chỉ báo tên key thiếu, lạ,
   hết dùng, trùng hoặc rỗng sai; không in giá trị và không tự sửa file.
5. Chạy test domain bị ảnh hưởng và matrix native/Docker/CI tương ứng. Không ghi
   giá trị secret thật vào tài liệu, log, fixture hoặc Git.
