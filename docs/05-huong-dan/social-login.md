# Hướng dẫn cấu hình Social Login (Google / Facebook / LinkedIn)

Đăng nhập mạng xã hội dùng **OAuth Authorization Code Flow** qua backend callback.
App **chạy được ngay cả khi chưa cấu hình** — nút social chỉ báo "chưa được cấu
hình" khi bấm. Điền client id/secret vào `backend/.env` để bật.

Phạm vi theo cổng:

| Cổng | Provider hỗ trợ |
|---|---|
| Ứng viên (`main`) | Google, Facebook, LinkedIn |
| Nhà tuyển dụng (`employer`) | Chỉ Google |
| Admin | Không có social login |

## Redirect URI cần khai báo với provider

Mỗi provider yêu cầu khai báo trước "Redirect URI" (nơi provider gọi lại backend).
Dùng đúng các URL sau (khi lên production đổi `localhost:8000` thành domain backend thật):

```
http://localhost:8000/api/auth/oauth/google/callback/
http://localhost:8000/api/auth/oauth/facebook/callback/
http://localhost:8000/api/auth/oauth/linkedin/callback/
```

> Lưu ý: đây là URL của **backend** (cổng 8000), không phải frontend. Sau khi
> backend xử lý xong nó tự redirect về trang frontend cấu hình ở
> `OAUTH_MAIN_CALLBACK_URL` / `OAUTH_EMPLOYER_CALLBACK_URL`.

---

## 1. Google

1. Vào **Google Cloud Console**: https://console.cloud.google.com/
2. Tạo project mới (hoặc chọn project có sẵn) ở thanh trên cùng.
3. Menu trái → **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - Điền App name (ví dụ `ProCV`), User support email, Developer contact email → Save.
   - Ở mục **Scopes** không cần thêm gì (email/profile mặc định là đủ).
   - Ở **Test users** thêm email Google bạn sẽ dùng để test (khi app còn ở chế độ Testing).
4. Menu trái → **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: `ProCV Web`.
   - **Authorized redirect URIs** → Add URI:
     `http://localhost:8000/api/auth/oauth/google/callback/`
   - Create.
5. Copy **Client ID** và **Client secret** vào `.env`:
   ```
   OAUTH_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   OAUTH_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
   ```

---

## 2. Facebook

1. Vào **Meta for Developers**: https://developers.facebook.com/apps/
2. **Create App** → Use case chọn **Authenticate and request data from users with
   Facebook Login** → điền tên app → Create.
3. Trong app, thêm sản phẩm **Facebook Login → Settings**:
   - **Valid OAuth Redirect URIs**:
     `http://localhost:8000/api/auth/oauth/facebook/callback/`
   - Save changes.
4. Menu **App settings → Basic**: copy **App ID** và **App Secret** (bấm Show).
5. Điền vào `.env`:
   ```
   OAUTH_FACEBOOK_CLIENT_ID=<App ID>
   OAUTH_FACEBOOK_CLIENT_SECRET=<App Secret>
   OAUTH_FACEBOOK_GRAPH_VERSION=v21.0
   ```

> Khi app Facebook còn ở chế độ **Development**, chỉ tài khoản có vai trò
> (Admin/Developer/Tester) trong app mới đăng nhập được. Muốn công khai phải
> submit review quyền `email`, `public_profile` và chuyển app sang **Live**.

---

## 3. LinkedIn

1. Vào **LinkedIn Developers**: https://www.linkedin.com/developers/apps → **Create app**.
   - Cần gắn với một **LinkedIn Company Page** (tạo trước nếu chưa có).
2. Tab **Products** → thêm **Sign In with LinkedIn using OpenID Connect** (Request access).
3. Tab **Auth**:
   - **Authorized redirect URLs for your app**:
     `http://localhost:8000/api/auth/oauth/linkedin/callback/`
   - Copy **Client ID** và **Client Secret**.
4. Điền vào `.env`:
   ```
   OAUTH_LINKEDIN_CLIENT_ID=<Client ID>
   OAUTH_LINKEDIN_CLIENT_SECRET=<Client Secret>
   ```

---

## Sau khi điền key

1. **Khởi động lại backend** (Django đọc `.env` lúc start, không hot-reload biến môi trường):
   ```bash
   # Ctrl+C rồi chạy lại
   backend/venv/bin/python backend/manage.py runserver 8000
   ```
2. Mở trang đăng nhập ứng viên `/login` (hoặc NTD `/tuyendung/app/login`), bấm nút provider.
3. Luồng: chọn tài khoản ở provider → quay lại app đã đăng nhập.

## Kiểm tra nhanh không cần điền key

Chưa có key vẫn test được cơ chế: bấm nút Google → app quay về form đăng nhập kèm
thông báo *"Phương thức đăng nhập này chưa được cấu hình trên hệ thống."* — đúng
nghĩa là luồng redirect đang hoạt động, chỉ thiếu credential.

## Cơ chế tài khoản (tóm tắt)

- Email từ social **trùng** tài khoản hiện có **cùng vai trò** → tự động liên kết
  (giữ nguyên mật khẩu cũ, đánh dấu email đã xác thực).
- Email trùng nhưng **khác vai trò** (vd email đã là NTD mà đăng nhập cổng ứng
  viên) → bị chặn với thông báo "Tài khoản không thuộc cổng này".
- Tài khoản social mới → tạo với vai trò theo cổng, `email_verified=True`, không có
  mật khẩu (chỉ đăng nhập qua social). Muốn đăng nhập bằng mật khẩu thì dùng
  "Quên mật khẩu?" (`/forgot-password`) để đặt mật khẩu lần đầu — luồng này chấp
  nhận cả tài khoản chưa từng có mật khẩu (`has_usable_password() == False`).

## Lên production

- Đổi mọi `localhost:8000` (redirect URI khai báo với provider) thành domain backend thật.
- Cập nhật `OAUTH_MAIN_CALLBACK_URL` / `OAUTH_EMPLOYER_CALLBACK_URL` sang domain frontend thật.
- Google: chuyển OAuth consent screen sang **In production**. Facebook: chuyển app sang **Live**.
