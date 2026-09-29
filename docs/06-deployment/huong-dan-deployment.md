# 06 - Deployment

Phạm vi (theo PRD mục 8.4 — Docker chỉ đưa vào ở giai đoạn cuối, sau khi các chức năng chính chạy ổn local):
- Dockerfile cho backend, docker-compose cho backend + PostgreSQL
- Biến môi trường production (SECRET_KEY, ALLOWED_HOSTS, DB, CORS, Redis, EMAIL_*, RECAPTCHA_*, OAUTH_* + callback URL, MEDIA_PUBLIC_BASE_URL) — đối chiếu `backend/.env.example`; đặt `ENVIRONMENT=production` và `DJANGO_SETTINGS_MODULE=config.settings.production`
- Gợi ý hosting: Vercel (frontend) + Render/Railway (backend) hoặc Docker Compose tự host

Chưa triển khai — sẽ làm sau khi các module chính (CV, jobs, applications, AI) hoàn thiện.

## Static và storage media tách quyền

- Asset cố định của frontend (logo hệ thống, favicon, icon) đặt trong `frontend/public/`, ví dụ `/images/logo/logo_proCV_2000_600.png`, `/favicon-32.png`, `/apple-touch-icon.png`. Khi build frontend, web server/CDN có thể serve trực tiếp các file này với cache dài.
- Presentation media công khai (avatar, logo/cover/gallery, knowledgebase,
  template) dùng `public_media` tại `PUBLIC_MEDIA_ROOT`, mặc định
  `backend/public-media/`. Chỉ root này được phép resolve URL `/media/` hoặc
  public R2 URL.
- CV, export, tài liệu pháp lý và candidate asset dùng `default`/
  `private_media` tại `PRIVATE_MEDIA_ROOT`. Upload chưa được scanner quyết định
  dùng `quarantine` tại `UPLOAD_QUARANTINE_ROOT`. Hai backend này cố ý từ chối
  `.url()`; browser chỉ tải qua API đã kiểm quyền.
- Database tiếp tục chỉ lưu **storage key**, không lưu filesystem path,
  credential hoặc signed URL. `MEDIA_PUBLIC_BASE_URL` chỉ áp dụng cho public
  media; không được dùng để tạo URL private.
- `LEGACY_MEDIA_ROOT` là nguồn copy/checksum read-only của layout cũ, không phải
  active storage và không được Django/Vite/nginx phục vụ. Làm theo
  [ER-3 storage-boundary runbook](employer-upload-storage-boundary-runbook.md)
  trước khi chuyển traffic.
- Với dữ liệu legacy, chạy `python manage.py normalize_media_references` để xem trước và thêm `--apply` để chuyển các URL localhost cũ sang storage key.
- Nếu self-host bằng Nginx, chỉ mount và serve public volume:

```nginx
location /media/ {
    alias /srv/backend-public-media/;
    expires 30d;
    add_header Cache-Control "public";
}
```
