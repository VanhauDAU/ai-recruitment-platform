// Cấu hình 3 cổng (main / tuyendung / admin) — nguồn sự thật duy nhất cho
// base path, app path và điều hướng theo role.
//
// Dev cùng host:
//   /tuyendung      -> landing nhà tuyển dụng
//   /tuyendung/app  -> vùng app nhà tuyển dụng
//   /admin/app      -> vùng app quản trị
//
// Production subdomain:
//   tuyendung.domain.vn/      -> landing nhà tuyển dụng
//   tuyendung.domain.vn/app   -> vùng app nhà tuyển dụng
//   admin.domain.vn/app       -> vùng app quản trị
const host = window.location.hostname

export const IS_EMPLOYER_HOST = !!import.meta.env.VITE_EMPLOYER_HOST && host === import.meta.env.VITE_EMPLOYER_HOST
export const IS_ADMIN_HOST = !!import.meta.env.VITE_ADMIN_HOST && host === import.meta.env.VITE_ADMIN_HOST
export const IS_MAIN_HOST = !IS_EMPLOYER_HOST && !IS_ADMIN_HOST

const EMPLOYER_MARKETING_BASE = IS_EMPLOYER_HOST ? '' : '/tuyendung'
const EMPLOYER_APP_BASE = `${EMPLOYER_MARKETING_BASE}/app`
const ADMIN_APP_BASE = IS_ADMIN_HOST ? '/app' : '/admin/app'

export const employerMarketingPath = (p = '') => `${EMPLOYER_MARKETING_BASE}${p}` || '/'
export const employerAppPath = (p = '') => `${EMPLOYER_APP_BASE}${p}` || '/'
export const adminPath = (p = '') => `${ADMIN_APP_BASE}${p}` || '/'

// Link từ site chính sang cổng NTD: absolute URL khi đã có subdomain, path nội bộ khi dev.
export const EMPLOYER_PORTAL_URL = import.meta.env.VITE_EMPLOYER_HOST
  ? `https://${import.meta.env.VITE_EMPLOYER_HOST}/`
  : employerMarketingPath('')

export const EMPLOYER_LOGIN_URL = import.meta.env.VITE_EMPLOYER_HOST
  ? `https://${import.meta.env.VITE_EMPLOYER_HOST}/app/login`
  : employerAppPath('/login')

export const EMPLOYER_FORGOT_PASSWORD_URL = employerAppPath('/forgot-password')
export const EMPLOYER_RESET_PASSWORD_URL = employerAppPath('/reset-password')
export const EMPLOYER_ACCOUNT_VERIFY_URL = employerAppPath('/account/verify')
export const EMPLOYER_COMPLETE_PROFILE_URL = employerAppPath('/account/complete-profile')
export const EMPLOYER_CONSULTING_NEED_URL = employerAppPath('/consulting-need')
export const EMPLOYER_VERIFY_URL = employerAppPath('/employer-verify')
export const EMPLOYER_PHONE_VERIFY_URL = employerAppPath('/account/phone-verify')
export const EMPLOYER_PASSWORD_SETTINGS_URL = employerAppPath('/account/settings/password-login')
export const EMPLOYER_COMPANY_SETTINGS_URL = employerAppPath('/account/settings/company')
export const EMPLOYER_BUSINESS_LICENSE_URL = employerAppPath('/account/settings/gpkd')
export const EMPLOYER_DATA_PROTECTION_URL = employerAppPath('/account/settings/personal-data-protection')

export const MAIN_LOGIN_URL = import.meta.env.VITE_MAIN_HOST
  ? `https://${import.meta.env.VITE_MAIN_HOST}/login`
  : '/login'

// Link từ cổng NTD về trang ứng viên (trang chủ main).
export const MAIN_PORTAL_URL = import.meta.env.VITE_MAIN_HOST
  ? `https://${import.meta.env.VITE_MAIN_HOST}/`
  : '/'

// Link recovery của ứng viên. Employer có route và template email riêng ở trên.
export const MAIN_FORGOT_PASSWORD_URL = import.meta.env.VITE_MAIN_HOST
  ? `https://${import.meta.env.VITE_MAIN_HOST}/forgot-password`
  : '/forgot-password'

export const HOME_BY_ROLE = {
  candidate: '/',
  employer: employerAppPath('/dashboard'),
  admin: adminPath('/dashboard'),
}

export function getCurrentPortal() {
  const path = window.location.pathname
  if (IS_EMPLOYER_HOST || path === EMPLOYER_MARKETING_BASE || path.startsWith(`${EMPLOYER_MARKETING_BASE}/`)) {
    return 'employer'
  }
  if (IS_ADMIN_HOST || path === '/admin' || path.startsWith('/admin/')) {
    return 'admin'
  }
  return 'main'
}

export function getAuthStorageKeys(portal = getCurrentPortal()) {
  const prefix = portal === 'employer' || portal === 'admin' ? portal : 'main'
  return {
    access: `${prefix}_access_token`,
    refresh: `${prefix}_refresh_token`,
  }
}
