# Chứng chỉ origin (không commit)

Đặt Cloudflare Origin Certificate của `procv.site` tại đây trên VPS:

- `origin.pem` — certificate
- `origin.key` — private key (`chmod 600`)

Container `web` mount thư mục này vào `/etc/nginx/certs`. Cách tạo: Cloudflare
Dashboard → SSL/TLS → Origin Server → Create Certificate (hostname
`procv.site`, `*.procv.site`), xem
[hướng dẫn deployment](../../docs/06-deployment/huong-dan-deployment.md).
