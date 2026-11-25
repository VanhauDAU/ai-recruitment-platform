# Kiểm thử tải ProCV (k6)

Mục tiêu đã chốt cho go-live: **200 người dùng đồng thời, p95 < 800 ms, lỗi < 1 %**.
Kịch bản [`procv.js`](procv.js) trộn ba nhóm chạy song song:

| Nhóm | Tỉ lệ VU | Hành vi mỗi vòng (nghỉ 1–4 s giữa các vòng) |
| --- | --- | --- |
| Khách vãng lai | 80 % | trang chủ + thống kê, danh sách/tìm kiếm, gợi ý theo từng ký tự, chi tiết việc (HTML SEO + API), việc gần tôi (danh sách + bản đồ), gửi impression theo lô |
| Ứng viên đã đăng nhập | 15 % | đăng nhập một lần, refresh sau 10 phút, `/auth/me/`, gợi ý việc làm, tìm kiếm/chi tiết, 1/10 vòng mở WebSocket thông báo 15–30 s |
| Nhà tuyển dụng | 5 % | đăng nhập, danh sách hồ sơ ứng tuyển, danh sách tin, WebSocket như trên |

Ngưỡng áp cho toàn bộ request và cho từng luồng (`flow:home`, `flow:search`,
`flow:detail`, …) để biết luồng nào kéo p95 lên. k6 trả mã thoát khác 0 khi trượt ngưỡng.

## Chuẩn bị

1. **Cài k6** trên máy đo (không chạy trên chính VPS — k6 ăn CPU của máy chủ):
   `brew install k6` hoặc xem <https://grafana.com/docs/k6/latest/set-up/install-k6/>.
2. **Dữ liệu**: môi trường phải có tin công khai (setup lấy 60 slug đầu; không có thì dừng).
   Rehearsal dùng DB thật đã nạp ở GĐ6 bước 2.
3. **Hai tài khoản thử** (một ứng viên, một NTD đã xác thực email) tạo riêng cho buổi đo,
   mật khẩu mạnh; xóa/khóa sau khi đo. Không dùng tài khoản demo `@demo.local`.
4. **Nới throttle + reCAPTCHA thử** (mọi VU đi ra từ một IP nên throttle theo IP sẽ chặn
   trước khi máy chủ chịu tải). File [`docker-compose.loadtest.yml`](docker-compose.loadtest.yml)
   ghi đè cho riêng service `backend`: `PUBLIC_API_THROTTLE_RATE`, `THROTTLE_RATE_OVERRIDES`,
   secret reCAPTCHA thử của Google và thêm `testkey.google.com` vào `ALLOWED_HOSTS` (token
   từ khóa thử trả về hostname đó). Secret thử công khai nằm trong
   [FAQ reCAPTCHA của Google](https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do).

   ```bash
   cd /opt/procv
   LOADTEST_RECAPTCHA_SECRET_KEY='<secret thử của Google>' \
     scripts/deploy/compose.sh -f scripts/loadtest/docker-compose.loadtest.yml up -d backend
   ```

   Trong lúc override còn bật, **ai cũng đăng nhập được không cần captcha** — chỉ làm khi
   DNS chưa mở công khai hoặc site còn sau Cloudflare Access.
5. **Cloudflare**: nếu đo qua Cloudflare (nên làm, đúng đường đi thật), tạo
   *Access → Service Auth → Service Token* rồi thêm policy *Service Auth* cho token đó;
   thêm WAF *Skip* rule cho IP máy đo để rate-limit rule `/api/` không chặn.
6. **pg_stat_statements** (đã nạp sẵn trong compose prod): reset trước khi đo.

   ```bash
   scripts/deploy/compose.sh exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements; SELECT pg_stat_statements_reset();"'
   ```

## Chạy

```bash
k6 run \
  -e BASE_URL=https://procv.site \
  -e CANDIDATE_EMAIL=loadtest-candidate@example.com -e CANDIDATE_PASSWORD='...' \
  -e EMPLOYER_EMAIL=loadtest-employer@example.com -e EMPLOYER_PASSWORD='...' \
  -e CF_ACCESS_CLIENT_ID=... -e CF_ACCESS_CLIENT_SECRET=... \
  --summary-export loadtest-summary.json \
  scripts/loadtest/procv.js
```

| Biến | Mặc định | Ghi chú |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:8080` | Gốc site (nginx), không có `/api` |
| `VUS` | `200` | Tổng VU, chia 80/15/5 |
| `RAMP` / `DURATION` | `2m` / `10m` | Thời gian tăng tải / giữ tải; hạ tải luôn 1 phút |
| `CAPTCHA_TOKEN` | `loadtest` | Chuỗi bất kỳ khi backend dùng secret thử |
| `CF_ACCESS_CLIENT_ID/SECRET` | trống | Service token khi site còn sau Access |

Chạy thử nhỏ trước để soát cấu hình: `-e VUS=10 -e RAMP=30s -e DURATION=1m`.

## Đọc kết quả

Trong lúc chạy, trên VPS:

```bash
docker stats --no-stream                                   # CPU/RAM từng service
scripts/deploy/compose.sh exec redis-cache redis-cli info memory | grep used_memory_human
scripts/deploy/compose.sh logs --since 10m backend | grep -c ' 50[0-9] '
```

Sau khi chạy, 10 câu tốn thời gian nhất:

```bash
scripts/deploy/compose.sh exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  SELECT calls, round(mean_exec_time::numeric, 1) AS mean_ms,
         round(total_exec_time::numeric) AS total_ms, left(query, 120) AS query
  FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"'
```

- p95 vượt ngưỡng ở một `flow` → xem câu SQL của luồng đó, `docker stats` xem gunicorn
  có chạm 100 % CPU (thiếu worker) hay chờ DB.
- `http_req_failed` > 1 % → lọc theo mã: 429 là throttle chưa nới, 502/504 là gunicorn quá
  tải hoặc timeout, 500 kèm `canceling statement due to statement timeout` trong log là câu SQL
  vượt 15 s.
- RAM còn dư nhiều ở `backend` → tăng `--workers` của gunicorn trong `docker-compose.prod.yml`
  (hiện 4 worker × 2 thread = 8 slot) và `mem_limit`, đo lại.

Ghi số đo (p95 từng luồng, lỗi, CPU/RAM đỉnh, top SQL) vào
`docs/06-deployment/huong-dan-deployment.md` mục kiểm tra sau deploy.

## Dọn dẹp

```bash
scripts/deploy/compose.sh up -d backend     # bỏ override throttle/captcha
```

Xóa hoặc khóa hai tài khoản thử, xóa service token Access và WAF Skip rule.
Impression/lượt xem do k6 tạo làm lệch thống kê tin: đo trước khi mở công khai, hoặc
chấp nhận số liệu tuần đầu bị cộng thêm.
