# Luồng đăng ký và đăng nhập nhà tuyển dụng

Tài liệu này là nguồn chuẩn cho cổng nhà tuyển dụng tại `/tuyendung/app`. Luồng
được đối chiếu với sản phẩm TopCV nhưng dùng đúng mô hình dữ liệu, phân quyền,
thương hiệu và chính sách bảo mật của dự án.

Tham khảo sản phẩm:

- [TopCV — đăng nhập nhà tuyển dụng](https://tuyendung.topcv.vn/app/login)
- [TopCV — đăng ký nhà tuyển dụng](https://tuyendung.topcv.vn/app/register)
- [TopCV — hướng dẫn tạo tài khoản nhà tuyển dụng](https://tuyendung.topcv.vn/help/huong-dan-su-dung/tao-tai-khoan-nha-tuyen-dung/)
- [TopCV — hướng dẫn cài đặt tài khoản](https://tuyendung.topcv.vn/help/huong-dan-su-dung/cai-dat-tai-khoan/)
- [TopCV — xử lý lỗi xác thực tài khoản](https://www.topcv.vn/faqs/account-setting/toi-gap-loi-khi-xac-thuc-tai-khoan.html)
- [TopCV — điều khoản dịch vụ](https://tuyendung.topcv.vn/term-of-services)

## Luồng chuẩn

```text
Đăng ký email
  → /account/verify
  → nhấn liên kết trong email
  → gửi email chào mừng nhà tuyển dụng
  → /consulting-need
  → /employer-verify
  → /dashboard

Đăng ký Google (email đã được provider xác thực)
  → gửi email chào mừng nhà tuyển dụng
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

Sau khi token được chấp nhận và `email_verified` chuyển từ `false` sang `true`,
backend mới ghi welcome job vào transactional outbox. Vì vậy đăng ký bằng email
không nhận thư chào mừng trước thư xác thực. Token đã dùng, request confirm lặp
lại và thao tác gửi lại link không tạo thêm thư chào mừng.

## Đăng ký bằng Google

Nút Google chỉ bật sau khi người dùng đồng ý điều khoản bắt buộc. OAuth dùng
Authorization Code Flow qua backend và trả token theo namespace employer. Vì
provider đã xác thực email, tài khoản mới chỉ cần bổ sung người liên hệ, địa
điểm và consent tại `/account/complete-profile`, sau đó đi thẳng tới
`/consulting-need`.

Tài khoản employer được tạo mới qua Google ghi welcome job ngay tại callback vì
email đã được provider xác thực. Việc đăng nhập lại bằng Google hoặc liên kết
Google với tài khoản đã tồn tại không được coi là đăng ký mới và không gửi lại
email này.

## Email chào mừng nhà tuyển dụng

Email chào mừng dùng template riêng, không dùng nội dung onboarding ứng viên.
Thư gồm tên người liên hệ, mã NTD (ưu tiên `RecruiterProfile.public_id`, fallback
`User.public_id` khi hồ sơ Google chưa được tạo), xác nhận nguồn xác thực email,
CTA “Tiếp tục thiết lập tài khoản” và khối hotline/email/Zalo lấy từ site
settings. CTA trỏ vào `/tuyendung/app/employer-verify`; các guard hiện có tự đưa người
dùng về đúng bước còn thiếu (`complete-profile`, `consulting-need` hoặc
checklist xác thực) thay vì đóng cứng một bước có thể đã hoàn tất.

Không đưa cam kết điểm thưởng, thời hạn đăng tin miễn phí hoặc CTA đăng tin đầu
tiên vào email khi các chính sách/tính năng đó chưa được triển khai. Mỗi user có
tối đa một `AuthEmailJob(kind=welcome)` bằng idempotent enqueue và partial unique
constraint ở database; worker vẫn dùng retry policy chung nếu SMTP tạm lỗi.

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
| `complete` | Đã có nhu cầu tuyển dụng hợp lệ | Nếu checklist xác thực chưa đủ thì `/employer-verify`; nếu đã đủ thì `/dashboard` hoặc `returnUrl` an toàn |

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

### Trang giấy đăng ký doanh nghiệp

Trang `/tuyendung/app/account/settings/gpkd` hiển thị hai cách cung cấp hồ sơ
theo thứ tự cố định: (1) giấy đăng ký doanh nghiệp hoặc giấy tờ tương đương;
(2) giấy ủy quyền kèm CCCD/hộ chiếu. Khi đổi lựa chọn, chỉ các ô tài liệu của
cách đó hiển thị bên dưới radio đã chọn; radio còn lại không đổi vị trí. Mỗi ô
nhận JPEG/JPG/PNG/PDF tối đa 5 MB, có minh họa local tại
`frontend/public/images/employer/` và liên kết tới tài liệu hướng dẫn/mẫu giấy
ủy quyền.

Ở giai đoạn hiện tại, việc chọn file chỉ phục vụ xem trước UI cục bộ. Nút **Lưu**
luôn disabled, không gọi API upload hoặc tạo trạng thái xác thực giả. Workflow
persist tài liệu chỉ được mở sau khi thông tin công ty đã được cập nhật và API
cho đầy đủ hai phương thức hồ sơ được chốt.

### Trang văn bản xử lý Dữ liệu cá nhân

Trang `/tuyendung/app/account/settings/personal-data-protection` có hai mốc
độc lập. Khối đầu là văn bản thỏa thuận **Ứng viên – Nhà tuyển dụng**: có link
hướng dẫn, link tải mẫu DOCX tại
`frontend/public/documents/topcv-mau-van-ban-thong-bao-dong-y-xu-ly-dlcn.docx`,
ô tải lên DOC/DOCX/PDF tối đa 5 MB và cam đoan trước khi bấm **Lưu**. Mỗi lần
chỉ có một tệp cục bộ; chọn tệp mới để thay thế tệp cũ. Backend lưu văn bản này
theo `RecruiterProfile` (không bắt buộc company), reset trạng thái duyệt khi
thay tệp, và vẫn đọc văn bản DLCN lịch sử đã từng gắn company. Việc nộp hoặc
thay thế tài liệu chỉ cần phiên đăng nhập nhà tuyển dụng còn hợp lệ, không bắt
MFA hoặc xác thực lại; tệp mới luôn chờ admin duyệt.

Sau khi lưu, trang hiển thị nhãn **Hệ thống đang xử lý**, toast xác nhận đã
nhận giấy tờ và nút **Chỉnh sửa**. Form thay tệp chỉ mở khi chọn nút này, có
**Lưu** và **Hủy** cạnh nhau. Khi cả bản DLCN lịch sử của company và bản mới
của recruiter cùng tồn tại, API luôn ưu tiên bản recruiter mới nhất. DOC/DOCX
qua URL HTTPS storage công khai/S3 có chữ ký mở bằng Google Docs Viewer; PDF
và URL localhost mở trực tiếp theo định dạng.
Khối **Văn bản mẫu** và nút tải mẫu vẫn hiện cạnh tệp đã nộp; trạng thái chỉ hiển thị một lần tại tiêu đề. Khi thỏa thuận nền tảng được chấp nhận, trang
hiển thị chính xác giờ-phút-giây và ngày xác nhận theo múi giờ Việt Nam.

Khi chọn **Chỉnh sửa**, liên kết **Tệp hiện tại: Thỏa thuận xử lý DLCN** vẫn cho
phép xem tệp đang chờ duyệt; tên tệp thay thế được hiển thị bên trong ô tải lên.
Sau khi lưu, backend chuẩn hóa tên hiển thị của văn bản DLCN thành **Thỏa thuận
xử lý DLCN**.

Khối thứ hai là thỏa thuận **nền tảng – Nhà tuyển dụng**: người dùng mở nội dung
đầy đủ ở `/data-processing-agreement`, tích xác nhận rồi bấm **Xác nhận** ngay
trên trang. Cả Lưu và Xác nhận đều hoạt động khi nhà tuyển dụng chưa cập nhật
thông tin công ty; hai trạng thái `candidate_dpa_submitted` và `dpa_accepted`
vẫn được tính độc lập. Nút đăng tin đầu tiên bị khóa tới khi đủ năm điều kiện
trước và workflow đăng tin sẽ được triển khai ở giai đoạn sau. Người dùng vẫn
có thể chọn “xác thực thêm sau” để vào dashboard.

### Cấp xác thực trên sidebar

Sidebar không hiển thị tiến độ của sáu mốc checklist. Nó dùng thang **Cấp 0/3 →
Cấp 3/3** theo ba điều kiện được tham khảo từ mẫu quản trị: xác thực số điện
thoại, cập nhật/liên kết thông tin công ty và nộp Giấy đăng ký doanh nghiệp.
Hover hoặc focus vào dấu `?` cạnh nhãn “Tài khoản xác thực” mở popover, hiển thị
phần trăm hoàn thành, trạng thái từng điều kiện và liên kết đi thẳng tới action
phù hợp. DLCN và đăng tin đầu tiên vẫn hiển thị riêng ở checklist đầy đủ, không
làm thay đổi cấp sidebar.

Backend trả thêm `employer_verification_completed` trong session. Trạng thái này
bằng `true` khi đã xác thực điện thoại, liên kết công ty với membership được
duyệt, nộp ĐKDN, nộp thỏa thuận DLCN ứng viên và chấp nhận thỏa thuận nền tảng.
Nó không phụ thuộc bước đăng tin đầu tiên vì workflow đó chưa triển khai. Sau
đăng nhập, tài khoản có trạng thái `false` vào `/employer-verify`; trạng thái
`true` vào thẳng dashboard hoặc deep-link an toàn.

Dashboard dùng shell quản trị riêng, responsive desktop/mobile. Cấu trúc shell
gồm dải cảnh báo tuân thủ theo trạng thái DLCN, topbar tối chứa hành động nhanh,
sidebar trắng chứa hồ sơ/mã NTD/cấp xác thực 0–3 kèm popover chi tiết và menu nghiệp vụ phân nhóm. Trên desktop, nút hamburger thu sidebar từ 216px thành rail 64px còn icon lớn, căn giữa; hover vào rail mở tạm menu/hồ sơ và rời chuột sẽ tự thu lại. Nếu người dùng không thu gọn, sidebar luôn mở. Avatar/trạng thái an toàn và item menu có tooltip để vẫn thao tác được. Trên mobile sidebar vẫn ẩn hoàn toàn khi đóng.
header tên trang và vùng nội dung cuộn độc lập. Bảng tin ưu tiên thông báo quan
trọng, banner thông tin, hành trình xác thực ngang, khu khám phá và CV đề xuất;
phía dưới vẫn gồm số tin đang tuyển, tổng hồ sơ, hồ sơ mới, lượt xem, biểu đồ 7
ngày, pipeline ứng viên, tin/hồ sơ gần đây, nhu cầu ưu tiên và hồ sơ công ty.
Toàn bộ số liệu đọc từ `GET /api/dashboard/employer/`; frontend không tự cộng
trên response phân trang. Workspace chiếm đúng `100dvh`, chỉ vùng nội dung cuộn
để header/sidebar không bị cắt. Menu dịch vụ/bảng giá và các workflow chưa làm
được hiển thị disabled “Sắp mở”, không điều hướng sang landing marketing và
không mô phỏng thao tác thành công khi backend chưa tồn tại.

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
