// Public entrypoint dành riêng cho app router, giữ màn thiết lập 2FA lazy.
export const loadTwoFactorAuthenticationPage = () => import('./pages/TwoFactorAuthentication')
