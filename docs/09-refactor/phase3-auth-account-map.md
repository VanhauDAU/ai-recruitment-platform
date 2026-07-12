# Giai đoạn 3 — Bản đồ flow & ma trận file (auth / account / 2FA)

**Ngày:** 2026-07-13 · **Mục đích:** khảo sát và triển khai gom về `features/*`.

## Kết quả rà soát và triển khai (hoàn tất R3)

| Hạng mục | Kết quả |
|---|---|
| 3.1 — Bản đồ flow | Hoàn tất với 8 flow bên dưới. |
| 3.2 + 3.5 — Auth | `api`, `model`, toàn bộ auth component và page nằm trong `features/auth`; `AuthProvider`/`useAuth` giữ nguyên session contract. |
| 3.3 — Account | Layout, sidebar, profile sidebar, menu, profile API và Personal Info nằm trong `features/account`. |
| 3.4 — 2FA | API setup/verify/disable/challenge, OTP modal và trang cấu hình nằm trong `features/two-factor`. |
| 3.6 — Backend accounts | Đã có services/selectors/views tách lớp; suite `apps.accounts` xác nhận 37/37 test xanh. |
| 3.7 — Tương thích | `api/authService`, `hooks/useAuth`, `components/auth`, `config/candidateMenu` và page cũ chỉ còn re-export. Xóa các lớp này ở R10 theo kế hoạch. |

`index.js` là public API runtime của mỗi feature. `routes.js` là public entrypoint riêng
cho router, chỉ export dynamic loader nên vẫn giữ code-splitting từng page. URL, endpoint,
token key và payload không thay đổi.

Đã kiểm tra: frontend unit **34/34**, Playwright **12/12** (bao gồm profile save và bật 2FA
trên desktop/mobile), frontend lint/build xanh, backend `apps.accounts` **37/37**.

## Kết luận khảo sát

- **Backend `apps/accounts` ĐÃ được layer sẵn** (services/ + selectors/ + views/ tách 6 file).
  Task 3.6 phần lớn đã đạt; chỉ rà view còn logic dày (vd `MeView.update`) nếu cần.
- **Trọng tâm là frontend:** auth/account/2FA đang trải trên `api/`, `components/auth/`,
  `pages/main/{auth,account,candidate}/`, `contexts/`, `hooks/`, `config/`.
- Auth dùng chung **cả 3 portal** (main/employer/admin) → khi gom phải giữ `features/auth`
  không phụ thuộc portal; `authService.test.js` là hợp đồng phải giữ xanh.

## 8 flow và file liên quan

| # | Flow | Frontend | Backend (accounts) |
|---|---|---|---|
| 1 | **Login** (email/mật khẩu, theo portal) | `pages/main/auth/Login.jsx`, `components/auth/{LoginForm,LoginModalContent,SocialLoginButtons}.jsx`, `authService.login`, `contexts/LoginPromptProvider` | `views/auth.py` (LoginView), `serializers` (LoginCredentials/RoleTokenObtainPair), `services/{access,captcha,tokens}` |
| 2 | **Register** | `pages/main/auth/Register.jsx`, `pages/employer/app/Register.jsx`, `components/auth/{PasswordRequirements,passwordValidation}`, `authService.register` | `views/auth.py` (RegisterView), `serializers.RegisterSerializer`, `services/tokens`, verification email |
| 3 | **Session** (logout/refresh/me) | `contexts/AuthProvider.jsx`, `hooks/useAuth.js`, `authService.{me,logout,getAccessToken}`, `shared/api/{client,tokenStore}` | `views/auth.py` (MeView), `views/tokens.py` (refresh), `authentication.py` |
| 4 | **Email verification** | `pages/main/account/VerifyEmail.jsx`, `components/auth/EmailVerificationBanner.jsx`, `authService.{sendVerificationEmail,confirmVerification,changeEmail}` | `views/verification.py`, `services/email_verification`, `tasks/auth_email` |
| 5 | **Password reset** | `pages/main/auth/{ForgotPassword,ResetPassword}.jsx`, `authService.{requestPasswordReset,validatePasswordResetToken,confirmPasswordReset}` | `views/password_reset.py`, `services/password_reset` |
| 6 | **OAuth (social login)** | `pages/main/auth/OAuthCallback.jsx`, `authService.{oauthStartUrl,completeOAuth}`, `shared/api/errorMapper.getOAuthErrorMessage` | `views/oauth.py`, `oauth.py` |
| 7 | **2FA** (setup/verify/disable/challenge) | `components/auth/TwoFactorCodeModal.jsx`, `pages/main/candidate/pages/TwoFactorAuthentication.jsx`, `authService.{verifyTwoFactorLogin,resendTwoFactorLogin,sendTwoFactorSetupCode,confirmTwoFactorSetup,sendTwoFactorDisableCode,confirmTwoFactorDisable}` | `views/two_factor.py`, `services/two_factor` |
| 8 | **Account / profile** | `pages/main/candidate/{CandidateAccountLayout,components/*,pages/PersonalInfo}.jsx`, `config/candidateMenu.jsx`, `authService.updateProfile` | `views/auth.py` (MeView.update), `serializers.ProfileUpdateSerializer` |

## Điểm coupling cần giữ khi di chuyển

- `authService` được import ở **12 nơi**; `useAuth` ở **23 nơi** → dùng re-export tương thích, không sửa consumer trong PR này.
- `config/portals.js` (getCurrentPortal/getAuthStorageKeys) là hạ tầng portal — **giữ nguyên vị trí**, `features/auth` import từ đó.
- `authService.test.js` mock `./api`; giữ đường dẫn re-export để test không vỡ.
- Route auth/account nằm trong `routes/MainRoutes.jsx` + `lazyPages.jsx` → cập nhật đường import lazy sang feature, giữ path URL.

## Kiến trúc đích (frontend)

```
features/
  auth/
    api/authService.js          # (chuyển từ src/api/authService.js)
    components/                  # LoginForm, SocialLoginButtons, PasswordRequirements, EmailVerificationBanner...
    pages/                       # Login, Register, ForgotPassword, ResetPassword, OAuthCallback, VerifyEmail
    model/                       # AuthProvider, authContext, useAuth, tokenStore-facing session
    index.js                     # public API của feature
    routes.js                    # dynamic page loaders cho app router
  account/
    api/                         # updateProfile (hoặc dùng chung auth)
    components/                  # AccountSidebar, ProfileSidebar, AccountPlaceholder
    config/candidateMenu.jsx
    pages/                       # CandidateAccountLayout, PersonalInfo
    index.js
    routes.js
  two-factor/
    components/TwoFactorCodeModal.jsx
    pages/TwoFactorAuthentication.jsx
    api/                         # 6 hàm 2FA (tách khỏi authService dần)
    index.js
    routes.js
```

Chiến lược: **di chuyển file (git mv) + để lại re-export** ở vị trí cũ; cập nhật route lazy import;
giữ mọi contract (URL, token key, endpoint, test). Cleanup re-export ở Giai đoạn 10.
