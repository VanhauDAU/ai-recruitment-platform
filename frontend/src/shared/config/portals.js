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

function commonPortalDomain() {
  const configuredHosts = [
    import.meta.env.VITE_MAIN_HOST,
    import.meta.env.VITE_EMPLOYER_HOST,
    import.meta.env.VITE_ADMIN_HOST,
  ]
    .filter(Boolean)
    .map((configuredHost) => configuredHost.toLowerCase().split('.').reverse())

  if (configuredHosts.length < 2) return ''

  const commonLabels = configuredHosts[0].filter((label, index) => (
    configuredHosts.every((labels) => labels[index] === label)
  ))

  // Không tự suy ra cookie domain chỉ có một nhãn như `com`/`localhost`.
  return commonLabels.length >= 2 ? commonLabels.reverse().join('.') : ''
}

// Cookie này chỉ chứa marker đăng xuất (không chứa JWT). Domain dùng chung giúp
// main/employer/admin phát hiện logout của nhau khi production chạy subdomain.
export const AUTH_SYNC_COOKIE_DOMAIN = (
  import.meta.env.VITE_AUTH_SYNC_COOKIE_DOMAIN || commonPortalDomain()
).replace(/^\./, '')

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
  ? `https://${import.meta.env.VITE_EMPLOYER_HOST}/app/dang-nhap`
  : employerAppPath('/dang-nhap')

export const EMPLOYER_FORGOT_PASSWORD_URL = employerAppPath('/quen-mat-khau')
export const EMPLOYER_ACCOUNT_VERIFY_URL = employerAppPath('/xac-thuc-email')
export const EMPLOYER_COMPLETE_PROFILE_URL = employerAppPath('/hoan-thien-ho-so')
export const EMPLOYER_CONSULTING_NEED_URL = employerAppPath('/khai-bao-nhu-cau')
export const EMPLOYER_VERIFY_URL = employerAppPath('/xac-thuc-tai-khoan')
export const EMPLOYER_PHONE_VERIFY_URL = employerAppPath('/xac-thuc-so-dien-thoai')
export const EMPLOYER_ACCOUNT_SETTINGS_URL = employerAppPath('/cai-dat/thong-tin-tai-khoan')
export const EMPLOYER_PASSWORD_SETTINGS_URL = employerAppPath('/cai-dat/mat-khau')
export const EMPLOYER_COMPANY_SETTINGS_URL = employerAppPath('/cai-dat/cong-ty')
export const EMPLOYER_BUSINESS_LICENSE_URL = employerAppPath('/cai-dat/giay-phep-kinh-doanh')
export const EMPLOYER_DATA_PROTECTION_URL = employerAppPath('/cai-dat/bao-ve-du-lieu-ca-nhan')
export const EMPLOYER_RECRUITMENT_DEMAND_URL = employerAppPath('/cai-dat/nhu-cau-tuyen-dung')
export const EMPLOYER_GENERAL_SETTINGS_URL = employerAppPath('/cai-dat/chung')
export const EMPLOYER_INTEGRATIONS_URL = employerAppPath('/cai-dat/tich-hop')

export const MAIN_LOGIN_URL = import.meta.env.VITE_MAIN_HOST
  ? `https://${import.meta.env.VITE_MAIN_HOST}/dang-nhap`
  : '/dang-nhap'

// Link từ cổng NTD về trang ứng viên (trang chủ main).
export const MAIN_PORTAL_URL = import.meta.env.VITE_MAIN_HOST
  ? `https://${import.meta.env.VITE_MAIN_HOST}/`
  : '/'

// Link recovery của ứng viên. Employer có route và template email riêng ở trên.
export const MAIN_FORGOT_PASSWORD_URL = import.meta.env.VITE_MAIN_HOST
  ? `https://${import.meta.env.VITE_MAIN_HOST}/quen-mat-khau`
  : '/quen-mat-khau'

export const HOME_BY_ROLE = {
  candidate: '/',
  employer: employerAppPath('/tong-quan'),
  admin: adminPath('/tong-quan'),
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
