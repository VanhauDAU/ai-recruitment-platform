import { ANNOUNCEMENT_SURFACES } from '@/entities/announcement'

const SURFACE_CONFIG = Object.freeze({
  [ANNOUNCEMENT_SURFACES.CANDIDATE]: {
    label: 'Ứng viên',
    host: import.meta.env.VITE_MAIN_HOST,
    localBase: '',
    deployedBase: '',
  },
  [ANNOUNCEMENT_SURFACES.EMPLOYER_MARKETING]: {
    label: 'Marketing NTD',
    host: import.meta.env.VITE_EMPLOYER_HOST,
    localBase: '/tuyendung',
    deployedBase: '',
  },
  [ANNOUNCEMENT_SURFACES.EMPLOYER_WORKSPACE]: {
    label: 'Workspace NTD',
    host: import.meta.env.VITE_EMPLOYER_HOST,
    localBase: '/tuyendung/app',
    deployedBase: '/app',
  },
  [ANNOUNCEMENT_SURFACES.ADMIN_WORKSPACE]: {
    label: 'Workspace quản trị',
    host: import.meta.env.VITE_ADMIN_HOST,
    localBase: '/admin/app',
    deployedBase: '/app',
  },
})

export const ANNOUNCEMENT_ROUTE_ACCESS = Object.freeze({
  PUBLIC: 'public',
  AUTHENTICATED: 'authenticated',
})

const ACCESS_LABELS = Object.freeze({
  [ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC]: 'Công khai',
  [ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED]: 'Cần đăng nhập',
})

// Metadata tên hiển thị/quyền truy cập không thể suy ra an toàn từ JSX router.
// Khi thêm route có thể dùng làm CTA/target, đăng ký đúng một lần tại đây.
// Announcement đã publish không bị tự đổi URL vì revision phải giữ bất biến.
const ROUTES = Object.freeze({
  [ANNOUNCEMENT_SURFACES.CANDIDATE]: [
    ['Trang chủ', '', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Danh sách việc làm', '/viec-lam', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Danh sách công ty', '/cong-ty', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Việc làm đã lưu', '/viec-lam-da-luu', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Việc làm phù hợp', '/tai-khoan/viec-lam-phu-hop', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Cài đặt gợi ý việc làm', '/tai-khoan/cai-dat-goi-y-viec-lam', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Thông tin cá nhân', '/tai-khoan/thong-tin-ca-nhan', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['CV của tôi', '/tai-khoan/cv-cua-toi', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Kho mẫu CV', '/mau-cv', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Cẩm nang nghề nghiệp', '/blog', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Xác thực email', '/tai-khoan/xac-thuc-email', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
  ],
  [ANNOUNCEMENT_SURFACES.EMPLOYER_MARKETING]: [
    ['Trang chủ nhà tuyển dụng', '', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Giới thiệu', '/gioi-thieu', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Dịch vụ', '/dich-vu', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Báo giá', '/bao-gia', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Liên hệ', '/lien-he', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
  ],
  [ANNOUNCEMENT_SURFACES.EMPLOYER_WORKSPACE]: [
    ['Bảng điều khiển NTD', '/dashboard', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Tin tuyển dụng', '/jobs', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Tạo tin tuyển dụng', '/jobs/new', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Hồ sơ ứng tuyển', '/applications', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Chiến dịch tuyển dụng', '/campaigns', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Thông tin công ty', '/account/settings/company', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Giấy phép kinh doanh', '/account/settings/gpkd', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Bảo vệ dữ liệu cá nhân', '/account/settings/personal-data-protection', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Nhu cầu tuyển dụng', '/account/settings/recruitment-demand', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Nhu cầu tư vấn', '/consulting-need', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Xác thực email NTD', '/account/verify', ANNOUNCEMENT_ROUTE_ACCESS.PUBLIC],
    ['Xác thực nhà tuyển dụng', '/employer-verify', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
  ],
  [ANNOUNCEMENT_SURFACES.ADMIN_WORKSPACE]: [
    ['Bảng điều khiển quản trị', '/dashboard', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Trung tâm thông báo', '/announcements', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Công ty', '/companies', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Duyệt tin tuyển dụng', '/job-moderation', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Tài khoản', '/accounts', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Nhà tuyển dụng', '/recruiters', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Phân quyền', '/access-control', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Cài đặt hệ thống', '/settings', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
    ['Tài khoản của tôi', '/account', ANNOUNCEMENT_ROUTE_ACCESS.AUTHENTICATED],
  ],
})

function joinPath(base, suffix) {
  const path = `${base}${suffix}`
  return path || '/'
}

function routePath(surface, suffix) {
  const config = SURFACE_CONFIG[surface]
  const base = config.host ? config.deployedBase : config.localBase
  return joinPath(base, suffix)
}

function routeUrl(surface, suffix) {
  const config = SURFACE_CONFIG[surface]
  const path = routePath(surface, suffix)
  return config.host ? `https://${config.host}${path}` : path
}

function selectedSurfaces(surfaces) {
  const selected = new Set(surfaces || [])
  const values = Object.keys(SURFACE_CONFIG)
  return selected.size ? values.filter((surface) => selected.has(surface)) : values
}

function routeGroups(surfaces, valueForRoute) {
  return selectedSurfaces(surfaces).map((surface) => ({
    label: SURFACE_CONFIG[surface].label,
    options: ROUTES[surface].map(([label, suffix, access]) => {
      const value = valueForRoute(surface, suffix)
      return {
        access,
        label: `${label} · ${ACCESS_LABELS[access]} — ${value}`,
        search: `${label} ${ACCESS_LABELS[access]} ${value} ${SURFACE_CONFIG[surface].label}`
          .toLocaleLowerCase('vi'),
        surface,
        value,
      }
    }),
  }))
}

export function announcementCtaRouteGroups() {
  return routeGroups([], routeUrl)
}

export function announcementPrefixRouteGroups(surfaces) {
  return routeGroups(surfaces, routePath)
}

export function announcementCtaRouteInfo(value) {
  for (const group of announcementCtaRouteGroups()) {
    const route = group.options.find((option) => option.value === value)
    if (route) return { ...route, surfaceLabel: SURFACE_CONFIG[route.surface].label }
  }
  return null
}

export function inferAnnouncementCtaMode(value) {
  if (!value) return 'none'
  if (value.startsWith('/') && !value.startsWith('//')) return 'internal'

  try {
    const hostname = new URL(value).hostname
    const platformHosts = Object.values(SURFACE_CONFIG)
      .map(({ host }) => host)
      .filter(Boolean)
    return platformHosts.includes(hostname) ? 'internal' : 'external'
  } catch {
    return 'external'
  }
}

export function isValidAnnouncementPathPrefix(value) {
  return (
    typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('?')
    && !value.includes('#')
    && value.length <= 500
  )
}
