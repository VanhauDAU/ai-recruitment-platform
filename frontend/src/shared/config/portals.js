// Cấu hình 3 cổng (main / tuyendung / admin) — nguồn sự thật duy nhất cho
// base path, app path và điều hướng theo role.
//
// Dev cùng host:
//   /tuyendung      -> landing nhà tuyển dụng
//   /tuyendung/app  -> vùng app nhà tuyển dụng
//   /quan-tri       -> vùng app quản trị (URL cũ /admin/app/... chuyển hướng về đây)
//
// Production subdomain (đặt VITE_EMPLOYER_HOST / VITE_ADMIN_HOST, khớp
// EMPLOYER_FRONTEND_URL / ADMIN_FRONTEND_URL của backend):
//   tuyendung.procv.site/      -> landing nhà tuyển dụng
//   tuyendung.procv.site/app   -> vùng app nhà tuyển dụng
//   quantri.procv.site/        -> vùng app quản trị
// Mỗi host chỉ dựng route của cổng nó phục vụ; link sang cổng khác là URL tuyệt đối.
const host = window.location.hostname
const EMPLOYER_HOST = import.meta.env.VITE_EMPLOYER_HOST
const ADMIN_HOST = import.meta.env.VITE_ADMIN_HOST
const MAIN_HOST = import.meta.env.VITE_MAIN_HOST

export const IS_EMPLOYER_HOST = !!EMPLOYER_HOST && host === EMPLOYER_HOST
export const IS_ADMIN_HOST = !!ADMIN_HOST && host === ADMIN_HOST
export const IS_MAIN_HOST = !IS_EMPLOYER_HOST && !IS_ADMIN_HOST

// Cổng nào được dựng route trên host hiện tại: cổng có subdomain riêng chỉ chạy ở đó,
// cổng không có subdomain chạy theo đường dẫn trên host chính.
export const SERVES_EMPLOYER = EMPLOYER_HOST ? IS_EMPLOYER_HOST : !IS_ADMIN_HOST
export const SERVES_ADMIN = ADMIN_HOST ? IS_ADMIN_HOST : !IS_EMPLOYER_HOST

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

// Bản build không đặt VITE_*_HOST gấp phần subdomain thành hằng số và loại bỏ:
// viết thẳng điều kiện vào từng hàm, không qua biến/hàm phụ.
const EMPLOYER_MARKETING_BASE = EMPLOYER_HOST ? '' : '/tuyendung'
const EMPLOYER_APP_BASE = `${EMPLOYER_MARKETING_BASE}/app`
const ADMIN_APP_BASE = ADMIN_HOST ? '' : '/quan-tri'

export const employerMarketingPath = (p = '') => (
  (EMPLOYER_HOST && !IS_EMPLOYER_HOST ? `https://${EMPLOYER_HOST}` : '') + `${EMPLOYER_MARKETING_BASE}${p}` || '/'
)
export const employerAppPath = (p = '') => (
  (EMPLOYER_HOST && !IS_EMPLOYER_HOST ? `https://${EMPLOYER_HOST}` : '') + `${EMPLOYER_APP_BASE}${p}`
)
export const adminPath = (p = '') => (
  (ADMIN_HOST && !IS_ADMIN_HOST ? `https://${ADMIN_HOST}` : '') + `${ADMIN_APP_BASE}${p}` || '/'
)
/** Trang của site ứng viên; tuyệt đối khi đang ở subdomain của cổng khác. */
export const mainSitePath = (p) => (MAIN_HOST && !IS_MAIN_HOST ? `https://${MAIN_HOST}` : '') + p

// `/admin/...` là URL cũ của cổng quản trị (email, bookmark): vẫn tính là cổng admin
// để trang chuyển hướng dùng đúng token và không bị màn bảo trì chặn. Khi cổng quản
// trị có subdomain riêng, nginx đã chuyển các URL này sang đó.
const ADMIN_PATH_PREFIXES = [ADMIN_APP_BASE, '/admin']
export const isAdminPath = (path) => IS_ADMIN_HOST
  || (!ADMIN_HOST && ADMIN_PATH_PREFIXES.some((base) => path === base || path.startsWith(`${base}/`)))

// Link từ site chính sang cổng NTD: absolute URL khi đã có subdomain, path nội bộ khi dev.
export const EMPLOYER_PORTAL_URL = employerMarketingPath()
export const EMPLOYER_LOGIN_URL = employerAppPath('/dang-nhap')

export const EMPLOYER_FORGOT_PASSWORD_URL = employerAppPath('/quen-mat-khau')
export const EMPLOYER_ACCOUNT_VERIFY_URL = employerAppPath('/xac-thuc-email')
export const EMPLOYER_COMPLETE_PROFILE_URL = employerAppPath('/hoan-thien-ho-so')
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

export const MAIN_LOGIN_URL = mainSitePath('/dang-nhap')

// Link từ cổng NTD/quản trị về trang ứng viên (trang chủ main).
export const MAIN_PORTAL_URL = mainSitePath('/')

// Link recovery của ứng viên. Employer có route và template email riêng ở trên.
export const MAIN_FORGOT_PASSWORD_URL = mainSitePath('/quen-mat-khau')

export const HOME_BY_ROLE = {
  candidate: '/',
  employer: employerAppPath('/tong-quan'),
  admin: adminPath('/tong-quan'),
}

export function getCurrentPortal() {
  const path = window.location.pathname
  if (IS_EMPLOYER_HOST || (!EMPLOYER_HOST && (path === EMPLOYER_MARKETING_BASE || path.startsWith(`${EMPLOYER_MARKETING_BASE}/`)))) {
    return 'employer'
  }
  if (isAdminPath(path)) {
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
