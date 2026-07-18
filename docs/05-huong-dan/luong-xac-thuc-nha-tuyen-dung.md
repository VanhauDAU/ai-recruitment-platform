# Luồng đăng ký và đăng nhập nhà tuyển dụng

Tài liệu này là nguồn chuẩn cho cổng nhà tuyển dụng tại `/tuyendung/app`. Luồng
được đối chiếu với sản phẩm TopCV nhưng dùng đúng mô hình dữ liệu, phân quyền,
thương hiệu và chính sách bảo mật của dự án.

Tham khảo sản phẩm:

- [TopCV — đăng nhập nhà tuyển dụng](https://tuyendung.topcv.vn/app/login)
- [TopCV — đăng ký nhà tuyển dụng](https://tuyendung.topcv.vn/app/register)
- [TopCV — xử lý lỗi xác thực tài khoản](https://www.topcv.vn/faqs/account-setting/toi-gap-loi-khi-xac-thuc-tai-khoan.html)
- [TopCV — điều khoản dịch vụ](https://tuyendung.topcv.vn/term-of-services)

## Luồng chuẩn

```text
Đăng ký email
  → /account/verify
  → nhấn liên kết trong email
  → /consulting-need
  → /dashboard

Đăng ký Google (email đã được provider xác thực)
  → /account/complete-profile
  → /consulting-need
  → /dashboard
```

Không dùng checklist email/phone/DPA làm onboarding chính. Xác thực số điện
thoại, DPA và giấy phép doanh nghiệp vẫn là workflow bảo mật/tuân thủ độc lập,
nhưng không thay thế bước khai báo nhu cầu tuyển dụng.

## Điều kiện đăng ký bằng email

| Trường | Điều kiện |
| --- | --- |
| Email | Đúng định dạng, chuẩn hóa, chưa tồn tại không phân biệt hoa/thường |
| Mật khẩu | Theo validator Django, 8–25 ký tự, có chữ hoa, chữ thường và số |
| Nhập lại mật khẩu | Khớp ở frontend; không gửi xuống API |
| Họ tên, giới tính | Bắt buộc; họ tên tối thiểu 2 ký tự |
| Số điện thoại | `0` hoặc `+84`, 10–11 chữ số; chưa thuộc recruiter khác |
| Công ty | Tên tối thiểu 2 ký tự; tạo hồ sơ công ty ở trạng thái `unverified` |
| Nơi làm việc | Location đang hoạt động ở cấp tỉnh/thành phố |
| Điều khoản + quyền riêng tư | Bắt buộc, lưu thời điểm và phiên bản chính sách |
| Nhận tư vấn/marketing | Tùy chọn, lưu quyết định độc lập |
| Captcha | reCAPTCHA v3 action `register`, kiểm tra ở backend |

`POST /api/employer/register/` chạy trong một transaction: tạo `User` role
`employer`, `RecruiterProfile`, công ty ban đầu và membership owner/approved;
ghi consent; gửi email xác thực; trả `user`, `recruiter`, JWT access/refresh.
Frontend giữ session rồi chuyển đến
`/tuyendung/app/account/verify?registered=1`, không yêu cầu đăng nhập lại.

## Email xác thực nhà tuyển dụng

Email dùng template riêng cho employer, không dùng nội dung ứng viên. Thư gồm:

- tên người liên hệ và mã nhà tuyển dụng;
- email vừa đăng ký;
- CTA “Xác thực tài khoản” trỏ đến
  `/tuyendung/app/account/verify?token=...`;
- thời hạn liên kết, cảnh báo không chia sẻ mật khẩu/link và không chuyển khoản
  vào tài khoản cá nhân;
- hotline/email hỗ trợ lấy từ site settings.

Token dùng một lần, có TTL và cooldown gửi lại. Link xác thực có thể mở khi chưa
đăng nhập vì chính token là bằng chứng. Nếu tab vẫn giữ session đăng ký, sau khi
xác thực người dùng tiếp tục thẳng tới `/consulting-need`; nếu mở ở trình duyệt
khác, hệ thống yêu cầu đăng nhập rồi áp dụng lại state machine.

## Đăng ký bằng Google

Nút Google chỉ bật sau khi người dùng đồng ý điều khoản bắt buộc. OAuth dùng
Authorization Code Flow qua backend và trả token theo namespace employer. Vì
provider đã xác thực email, tài khoản mới chỉ cần bổ sung người liên hệ, công ty,
địa điểm và consent tại `/account/complete-profile`, sau đó đi thẳng tới
`/consulting-need`.

Tài khoản OAuth chưa có mật khẩu có thể dùng “Quên mật khẩu” của employer để
thiết lập mật khẩu lần đầu.

## State machine và điều hướng

Backend trả `employer_onboarding_step`; frontend không tự suy diễn từ nhiều
field rời rạc.

| `employer_onboarding_step` | Điều kiện | Route bắt buộc |
| --- | --- | --- |
| `registration` | Thiếu hồ sơ bắt buộc hoặc chưa liên kết công ty | `/account/complete-profile` |
| `email_verification` | Hồ sơ đủ nhưng email chưa xác thực | `/account/verify` |
| `consulting_need` | Email đã xác thực nhưng chưa khai báo nhu cầu | `/consulting-need` |
| `complete` | Đã có nhu cầu tuyển dụng hợp lệ | `/dashboard` hoặc `returnUrl` an toàn |

`employer_onboarding_required` chỉ bằng `false` ở trạng thái `complete`.
`EmployerOnboardingGuard` bảo vệ direct navigation vào dashboard. API khai báo
nhu cầu cũng chặn email chưa xác thực hoặc hồ sơ/công ty chưa hoàn tất; redirect
frontend không phải lớp bảo vệ duy nhất.

## Bước khai báo nhu cầu tuyển dụng

`/consulting-need` ghi một nhu cầu ưu tiên cho mỗi recruiter:

- vị trí chuyên môn đang active trong taxonomy việc làm;
- cấp bậc;
- ngày cần tuyển xong hoặc “Tuyển liên tục”;
- số lượng cần tuyển từ 1 đến 10.000;
- khoảng ngân sách tùy chọn; nếu nhập phải có cả min/max và `max >= min`;
- nguồn ngân sách công ty/cá nhân;
- một chủ đề cần tư vấn, có thể bỏ trống.

`POST /api/employer/consulting-need/` upsert dữ liệu và đặt `completed_at`. Sau
khi lưu, frontend refresh session; state chuyển sang `complete` và điều hướng
vào dashboard.

## Route frontend

| Route | Mục đích | Guard/layout |
| --- | --- | --- |
| `/tuyendung/app/login` | Login email/Google | `EmployerAuthLayout`, public |
| `/tuyendung/app/register` | Đăng ký đầy đủ | `EmployerAuthLayout`, public |
| `/tuyendung/app/forgot-password` | Yêu cầu link đặt/đổi mật khẩu | `EmployerAuthLayout`, public |
| `/tuyendung/app/reset-password` | Xác nhận token và đặt mật khẩu | `EmployerAuthLayout`, public |
| `/tuyendung/app/account/verify` | Gửi/xác nhận email | `EmployerSetupLayout`, token-aware |
| `/tuyendung/app/account/complete-profile` | Bổ sung hồ sơ Google | `AuthGuard → RoleGuard` |
| `/tuyendung/app/consulting-need` | Khai báo nhu cầu ưu tiên | `AuthGuard → RoleGuard` |
| `/tuyendung/app/oauth/callback` | Đổi one-time code lấy JWT | Public callback |
| `/tuyendung/app/dashboard` | Workspace nhà tuyển dụng | `AuthGuard → RoleGuard → EmployerOnboardingGuard` |

`/xac-thuc-email` và `/onboarding` chỉ là route tương thích cũ; luồng mới không
điều hướng người dùng tới hai URL này.

## API và dữ liệu

- `POST /api/employer/register/`: đăng ký email, trả JWT.
- `POST /api/employer/onboarding/registration/`: hoàn tất profile OAuth.
- `GET /api/employer/me/`: recruiter/company và trạng thái chi tiết.
- `GET|POST /api/employer/consulting-need/`: đọc/ghi nhu cầu ưu tiên.
- `POST /api/auth/verify/send/`, `POST /api/auth/verify/confirm/`: email.
- `POST /api/auth/password-reset/`, validate và confirm: recovery dùng chung
  backend nhưng URL email/route frontend tách theo role.

Consent nằm trên `RecruiterProfile`: `terms_accepted_at`,
`terms_policy_version`, `marketing_opt_in`, `marketing_decided_at`. Phiên bản
hiện tại lấy từ `EMPLOYER_TERMS_POLICY_VERSION`.

## Kiểm thử bắt buộc

1. Backend: transaction đăng ký, email/link employer, token một lần, session
   trả đúng bốn state, chặn khai báo trước xác thực và validate toàn bộ payload.
2. Frontend unit: endpoint, namespace token và destination theo từng state.
3. E2E desktop/mobile: register consent gate, dashboard redirect về
   `/account/verify`, rồi `/consulting-need`, cùng đầy đủ field responsive.
4. Browser thật: keyboard/focus, overflow, mobile layout, console/network và
   không gửi form thật trên website tham chiếu.
