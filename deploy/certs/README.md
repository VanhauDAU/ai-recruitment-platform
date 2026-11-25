# Chứng chỉ origin (không commit)

Đặt trên VPS, trong thư mục này:

- `origin.pem` — Cloudflare Origin Certificate của `procv.site`
- `origin.key` — private key (`chmod 600`)
- `cloudflare-origin-pull-ca.pem` — CA công khai của Authenticated Origin Pulls;
  nginx chỉ nhận request trình chứng chỉ client do CA này ký (chỉ Cloudflare có).
  Thiếu file này thì container `web` không khởi động.

Container `web` mount thư mục này vào `/etc/nginx/certs`. Cách tạo/tải: Cloudflare
Dashboard → SSL/TLS → Origin Server (Create Certificate cho `procv.site`,
`*.procv.site`; bật Authenticated Origin Pulls), xem bước 1.3–1.4 của
[hướng dẫn deployment](../../docs/06-deployment/huong-dan-deployment.md).
