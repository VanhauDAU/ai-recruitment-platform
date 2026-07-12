# Giai đoạn 3 — Bản đồ flow & ma trận file (auth / account / 2FA)

**Ngày:** 2026-07-13 · **Mục đích:** khảo sát trước khi gom về `features/*`.

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
  account/
    api/                         # updateProfile (hoặc dùng chung auth)
    components/                  # AccountSidebar, ProfileSidebar, AccountPlaceholder
    config/candidateMenu.jsx
    pages/                       # CandidateAccountLayout, PersonalInfo
    index.js
  two-factor/
    components/TwoFactorCodeModal.jsx
    pages/TwoFactorAuthentication.jsx
    api/                         # 6 hàm 2FA (tách khỏi authService dần)
    index.js
```

Chiến lược: **di chuyển file (git mv) + để lại re-export** ở vị trí cũ; cập nhật route lazy import;
giữ mọi contract (URL, token key, endpoint, test). Cleanup re-export ở Giai đoạn 10.
