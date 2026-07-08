# 06 - Deployment

Phạm vi (theo PRD mục 8.4 — Docker chỉ đưa vào ở giai đoạn cuối, sau khi các chức năng chính chạy ổn local):
- Dockerfile cho backend, docker-compose cho backend + PostgreSQL
- Biến môi trường production (SECRET_KEY, ALLOWED_HOSTS, DB, CORS)
- Gợi ý hosting: Vercel (frontend) + Render/Railway (backend) hoặc Docker Compose tự host

Chưa triển khai — sẽ làm sau khi các module chính (CV, jobs, applications, AI) hoàn thiện.

## Static/media storage nội bộ

- Asset cố định của frontend (logo hệ thống, favicon, icon) đặt trong `frontend/public/`, ví dụ `/images/logo/aicareer-logo.svg`. Khi build frontend, web server/CDN có thể serve trực tiếp các file này với cache dài.
- File người dùng upload (CV, avatar, logo/cover công ty) lưu qua Django `default_storage` vào `MEDIA_ROOT`, mặc định là `backend/media/`, và trả URL dưới `MEDIA_URL`, mặc định `/media/`.
- Biến `MEDIA_PUBLIC_BASE_URL` dùng khi production có domain static/media riêng. Ví dụ `https://static.example.com` sẽ làm URL upload trả về `https://static.example.com/media/...`.
- Nếu self-host bằng Nginx, cần serve media trực tiếp:

```nginx
location /media/ {
    alias /app/backend/media/;
    expires 30d;
    add_header Cache-Control "public";
}
```
