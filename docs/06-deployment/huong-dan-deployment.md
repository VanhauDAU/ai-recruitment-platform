# 06 - Deployment

Phạm vi (theo PRD mục 8.4 — Docker chỉ đưa vào ở giai đoạn cuối, sau khi các chức năng chính chạy ổn local):
- Dockerfile cho backend, docker-compose cho backend + PostgreSQL
- Biến môi trường production (SECRET_KEY, ALLOWED_HOSTS, DB, CORS, Redis, EMAIL_*, RECAPTCHA_*, OAUTH_* + callback URL, MEDIA_PUBLIC_BASE_URL) — đối chiếu `backend/.env.example`; đặt `ENVIRONMENT=production` và `DJANGO_SETTINGS_MODULE=config.settings.production`
- Gợi ý hosting: Vercel (frontend) + Render/Railway (backend) hoặc Docker Compose tự host

Chưa triển khai — sẽ làm sau khi các module chính (CV, jobs, applications, AI) hoàn thiện.

## Static/media storage nội bộ

- Asset cố định của frontend (logo hệ thống, favicon, icon) đặt trong `frontend/public/`, ví dụ `/images/logo/logo_proCV_2000_600.png`, `/favicon-32.png`, `/apple-touch-icon.png`. Khi build frontend, web server/CDN có thể serve trực tiếp các file này với cache dài.
- File người dùng upload (CV, avatar, logo/cover công ty) lưu qua Django `default_storage` vào `MEDIA_ROOT`, mặc định là `backend/media/`. Database chỉ lưu **storage key** như `users/avatars/<uuid>.png`, không lưu `http://localhost...` hay domain production.
- API resolve storage key thành URL dưới `MEDIA_URL` (`/media/`) ở thời điểm trả response. Vì vậy đổi domain/CDN không cần sửa database.
- Biến `MEDIA_PUBLIC_BASE_URL` dùng khi production có domain static/media riêng. Ví dụ `https://static.example.com` khiến API trả `https://static.example.com/media/...`.
- Với dữ liệu legacy, chạy `python manage.py normalize_media_references` để xem trước và thêm `--apply` để chuyển các URL localhost cũ sang storage key.
- Nếu self-host bằng Nginx, cần serve media trực tiếp:

```nginx
location /media/ {
    alias /app/backend/media/;
    expires 30d;
    add_header Cache-Control "public";
}
```
