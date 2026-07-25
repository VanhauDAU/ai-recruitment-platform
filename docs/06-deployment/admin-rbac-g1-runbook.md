# Runbook phát hành RBAC admin G1

RBAC G1 phải phát hành hai lần. Không gộp migration, gán dữ liệu và siết endpoint
vào một lần vì backend mới sẽ bắt quyền trước khi operator có thể gán membership.

## G1.1 — nền tảng

Sau khi deploy migration `accounts.0013` và code nền tảng:

```bash
cd backend
python manage.py sync_admin_permissions --actor-email root@example.com
python manage.py seed_admin_access --actor-email root@example.com \
  --assign content@example.com:content-cv:manager \
  --assign moderation@example.com:job-moderation:staff
```

Superuser mới tạo cần bootstrap MFA:

```bash
python manage.py createsuperuser
python manage.py bootstrap_admin_mfa root@example.com \
  --mark-email-verified --actor-email root@example.com
```

`--mark-email-verified` chỉ dùng khi operator kiểm soát hộp thư. Command hỏi xác
nhận ở terminal; automation phải truyền thêm `--no-input`.

## Readiness gate bắt buộc

```bash
python manage.py check_admin_access_readiness
```

Không deploy G1.2 nếu command exit khác 0. Hard error gồm:

- admin thường không có active membership hiệu lực;
- membership không sinh permission active;
- primary trỏ vào role/department bị khoá;
- một user có nhiều primary active.

Permission deprecated còn gắn role chỉ là warning có chủ ý để rollback code phục
hồi grant. Command luôn nhắc site settings sẽ chỉ dành cho superuser.

## G1.2 — siết endpoint

Deploy code `HasAdminPermission`, rồi smoke test không phá dữ liệu:

1. đăng nhập từng vai, xác nhận sidebar và `/admin/app/my-access`;
2. gọi một endpoint chỉ-đọc không thuộc phòng ban và xác nhận `403`:

   ```json
   {
     "code": "admin_permission_denied",
     "message": "Bạn không có quyền thực hiện hành động này."
   }
   ```

3. xác nhận superuser vẫn qua RBAC và nhận business status thật;
4. chạy lại readiness gate.

Các endpoint được siết: site locales/settings/upload, service category/package,
consultation lead, toàn bộ admin CV catalogue và job moderation. Dashboard vẫn
`IsAdmin`; blog vẫn dùng legacy `CanEditBlog` + Django Groups cho tới G2.

## Rollback

Rollback riêng G1.2 nếu phân quyền vận hành sai. Không rollback migration hoặc
xoá dữ liệu G1.1. Permission bị bỏ khỏi registry được deprecate và giữ M2M; đưa
code trở lại rồi chạy `sync_admin_permissions` sẽ phục hồi grant.

Các thử nghiệm phá trạng thái (deactivate role/department, sửa registry, purge)
chỉ chạy trên staging, không chạy production.
