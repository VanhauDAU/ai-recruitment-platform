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
  → /employer-verify
  → /dashboard

Đăng ký Google (email đã được provider xác thực)
  → /account/complete-profile
  → /consulting-need
  → /employer-verify
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
| Nơi làm việc | Location đang hoạt động ở cấp tỉnh/thành phố |
| Điều khoản + quyền riêng tư | Bắt buộc, lưu thời điểm và phiên bản chính sách |
| Nhận tư vấn/marketing | Tùy chọn, lưu quyết định độc lập |
| Captcha | reCAPTCHA v3 action `register`, kiểm tra ở backend |

`POST /api/employer/register/` chạy trong một transaction: tạo `User` role
`employer`, `RecruiterProfile`, ghi consent; gửi email xác thực; trả `user`,
`recruiter`, JWT access/refresh. Đăng ký không tự tạo công ty. Nhà tuyển dụng chỉ
liên kết công ty khi chủ động tìm công ty có sẵn hoặc tạo hồ sơ mới trong phần
cài đặt tài khoản.
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
provider đã xác thực email, tài khoản mới chỉ cần bổ sung người liên hệ, địa
điểm và consent tại `/account/complete-profile`, sau đó đi thẳng tới
`/consulting-need`.

Tài khoản OAuth chưa có mật khẩu phải đặt mật khẩu lần đầu tại
`/account/settings/password-login` trước khi bắt đầu xác thực số điện thoại.

## State machine và điều hướng

Backend trả `employer_onboarding_step`; frontend không tự suy diễn từ nhiều
field rời rạc.

| `employer_onboarding_step` | Điều kiện | Route bắt buộc |
| --- | --- | --- |
| `registration` | Thiếu hồ sơ người liên hệ bắt buộc | `/account/complete-profile` |
| `email_verification` | Hồ sơ đủ nhưng email chưa xác thực | `/account/verify` |
| `consulting_need` | Email đã xác thực nhưng chưa khai báo nhu cầu | `/consulting-need` |
| `complete` | Đã có nhu cầu tuyển dụng hợp lệ | `/dashboard` hoặc `returnUrl` an toàn |

`employer_onboarding_required` chỉ bằng `false` ở trạng thái `complete`.
`EmployerOnboardingGuard` bảo vệ direct navigation vào dashboard. API khai báo
nhu cầu cũng chặn email chưa xác thực hoặc hồ sơ chưa hoàn tất; redirect
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

`POST /api/employer/consulting-need/` chỉ tạo dữ liệu đúng một lần và đặt
`completed_at`. Request POST tiếp theo bị từ chối `400`; khi state đã là
`complete`, direct navigation về `/consulting-need` cũng bị chuyển sang
dashboard. Sau lần lưu đầu tiên, frontend refresh session rồi điều hướng tới
`/employer-verify`.

## Checklist xác thực và dashboard

`/employer-verify` là checklist bảo mật/tuân thủ có thể hoàn thiện dần, không
phải state thứ năm của onboarding. Email không xuất hiện trong checklist vì đây
là điều kiện bắt buộc để tới được trang. Sáu mốc theo thứ tự là:

1. xác thực số điện thoại;
2. chọn công ty có sẵn hoặc tạo công ty mới;
3. cập nhật giấy đăng ký doanh nghiệp;
4. tải lên thỏa thuận xử lý DLCN với ứng viên;
5. đồng ý thỏa thuận xử lý DLCN với ProCV;
6. đăng tin tuyển dụng đầu tiên.

Mỗi action mở một route account nội bộ, không rời workspace. Tài khoản Google
chưa có mật khẩu sẽ thấy hộp thoại an toàn và liên kết đặt mật khẩu trước khi
tới bước OTP. Trang công ty có hai tab độc lập: tìm theo tên/tên thương mại/MST
để gửi yêu cầu liên kết kèm giấy tờ chứng minh, hoặc tạo hồ sơ công ty mới.
Company chỉ được tính hoàn tất sau một hành động liên kết rõ ràng; hồ sơ company
rỗng do luồng đăng ký cũ không được tính là đã hoàn tất.

Hai mốc DLCN dùng cùng trang nhưng có trạng thái và hành động độc lập: một mốc
là tài liệu ứng viên–nhà tuyển dụng (`candidate_dpa`), mốc còn lại là việc chấp
nhận thỏa thuận nền tảng–nhà tuyển dụng. Nút đăng tin đầu tiên bị khóa tới khi
đủ năm điều kiện trước và workflow đăng tin sẽ được triển khai ở giai đoạn sau.
Người dùng vẫn có thể chọn “xác thực thêm sau” để vào dashboard.

Dashboard dùng shell quản trị riêng, responsive desktop/mobile, gồm số tin đang
tuyển, tổng hồ sơ, hồ sơ mới, lượt xem, biểu đồ 7 ngày, pipeline ứng viên, tin và
hồ sơ gần đây, nhu cầu tuyển dụng ưu tiên, hồ sơ công ty và tiến độ xác thực.
Toàn bộ số liệu đọc từ `GET /api/dashboard/employer/`; frontend không tự cộng
trên response phân trang. Workspace chiếm đúng `100dvh`, chỉ vùng nội dung cuộn
để header/sidebar không bị cắt. Menu dịch vụ/bảng giá và các workflow chưa làm
được hiển thị disabled “Sắp mở”, không điều hướng sang landing marketing.

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
| `/tuyendung/app/employer-verify` | Checklist bảo mật sau consulting, có thể bỏ qua | `AuthGuard → RoleGuard → EmployerOnboardingGuard`, `EmployerWorkspaceLayout` |
| `/tuyendung/app/account/phone-verify` | Gửi và xác nhận OTP số điện thoại | Cùng guard, `EmployerWorkspaceLayout` |
| `/tuyendung/app/account/settings/password-login` | Đổi hoặc đặt mật khẩu đầu tiên cho tài khoản OAuth | Cùng guard, `EmployerWorkspaceLayout` |
| `/tuyendung/app/account/settings/company?update=true` | Tìm/liên kết hoặc tạo công ty mới | Cùng guard, `EmployerWorkspaceLayout` |
| `/tuyendung/app/account/settings/gpkd` | Tải lên giấy đăng ký doanh nghiệp | Cùng guard, `EmployerWorkspaceLayout` |
| `/tuyendung/app/account/settings/personal-data-protection` | Hai bước DLCN ứng viên–NTD và ProCV–NTD | Cùng guard, `EmployerWorkspaceLayout` |
| `/tuyendung/app/oauth/callback` | Đổi one-time code lấy JWT | Public callback |
| `/tuyendung/app/dashboard` | Workspace và read-model tuyển dụng | `AuthGuard → RoleGuard → EmployerOnboardingGuard`, `EmployerWorkspaceLayout` |

`/xac-thuc-email` và `/onboarding` chỉ là route tương thích cũ; luồng mới không
điều hướng người dùng tới hai URL này.

## API và dữ liệu

- `POST /api/employer/register/`: đăng ký email, trả JWT.
- `POST /api/auth/password/`: đổi mật khẩu; tài khoản OAuth không có mật khẩu
  được đặt lần đầu mà không cần `current_password`.
- `POST /api/employer/onboarding/registration/`: hoàn tất profile OAuth.
- `GET /api/employer/me/`: recruiter/company và trạng thái chi tiết.
- `GET|POST /api/employer/consulting-need/`: đọc/tạo một lần nhu cầu ưu tiên.
- `GET /api/dashboard/employer/`: summary, activity 7 ngày, nhu cầu, tin và hồ sơ gần đây.
- `POST /api/auth/verify/send/`, `POST /api/auth/verify/confirm/`: email.
- `POST /api/employer/phone/send-otp/`, `POST /api/employer/phone/verify/`: OTP.
- `GET /api/employer/company/search/`, `POST /api/employer/company/create/`,
  `POST /api/employer/company/join/`: hai luồng liên kết công ty rõ ràng.
- `GET|POST /api/employer/company/documents/`: ĐKDN chấp nhận JPG/PNG/PDF;
  `candidate_dpa` chấp nhận PDF/DOC/DOCX và được theo dõi riêng.
- `POST /api/employer/dpa/accept/`: đồng ý thỏa thuận ProCV–nhà tuyển dụng.
- `POST /api/auth/password-reset/`, validate và confirm: recovery dùng chung
  backend nhưng URL email/route frontend tách theo role.

Consent nằm trên `RecruiterProfile`: `terms_accepted_at`,
`terms_policy_version`, `marketing_opt_in`, `marketing_decided_at`. Phiên bản
hiện tại lấy từ `EMPLOYER_TERMS_POLICY_VERSION`.

## Kiểm thử bắt buộc

1. Backend: transaction đăng ký không tạo company, email/link employer, token
   một lần, đặt mật khẩu OAuth, OTP, company explicit-link và hai trạng thái
   DLCN độc lập.
2. Frontend unit: endpoint, namespace token, destination theo từng state và
   contract account settings.
3. E2E desktop/mobile: register consent gate, `/consulting-need →
   /employer-verify`, modal tài khoản chưa có mật khẩu, hai tab company, workspace
   đúng chiều cao viewport và không có link thoát sang bảng giá.
4. Browser thật: keyboard/focus, internal overflow, mobile layout,
   console/network và không gửi form thật trên website tham chiếu.
