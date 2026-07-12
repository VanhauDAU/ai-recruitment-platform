// Public entrypoint dành riêng cho app router. Các loader giữ page tách chunk
// thay vì đưa toàn bộ màn auth vào public runtime API của feature.
export const loadForgotPasswordPage = () => import('./pages/ForgotPassword')
export const loadLoginPage = () => import('./pages/Login')
export const loadOAuthCallbackPage = () => import('./pages/OAuthCallback')
export const loadRegisterPage = () => import('./pages/Register')
export const loadResetPasswordPage = () => import('./pages/ResetPassword')
export const loadVerifyEmailPage = () => import('./pages/VerifyEmail')
