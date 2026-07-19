// Nơi DUY NHẤT đọc/ghi/xóa JWT theo portal (main/employer/admin).
// JWT vẫn nằm trong localStorage của từng origin. Cookie dùng chung bên dưới chỉ
// là marker logout — và marker được TÁCH THEO PORTAL: đăng xuất cổng ứng viên
// không được xóa phiên cổng nhà tuyển dụng ở tab/subdomain khác.
import {
  AUTH_SYNC_COOKIE_DOMAIN,
  getAuthStorageKeys,
  getCurrentPortal,
} from '@/shared/config/portals'

const AUTH_PORTALS = ['main', 'employer', 'admin']
const LEGACY_KEYS = ['access_token', 'refresh_token']
const LOGOUT_EVENT_NAME = 'procv:auth-logout'
const LOGOUT_POLL_INTERVAL_MS = 1000

function markerStorageKey(portal) {
  return `auth_logout_marker_${portal}`
}

function logoutCookieName(portal) {
  return `procv_auth_logout_${portal}`
}

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : ''
}

function writeLogoutCookie(name, marker) {
  const domain = AUTH_SYNC_COOKIE_DOMAIN
    && (window.location.hostname === AUTH_SYNC_COOKIE_DOMAIN
      || window.location.hostname.endsWith(`.${AUTH_SYNC_COOKIE_DOMAIN}`))
    ? `; Domain=${AUTH_SYNC_COOKIE_DOMAIN}`
    : ''
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(marker)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`
}

function createLogoutMarker() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function clearPortalTokens(portal) {
  const keys = getAuthStorageKeys(portal)
  localStorage.removeItem(keys.access)
  localStorage.removeItem(keys.refresh)
}

// Đồng bộ marker logout của MỘT portal. Lần chạy đầu tiên chỉ ghi nhận marker để
// không làm người dùng đang đăng nhập bị văng sau deploy. Từ lần logout kế tiếp,
// marker đổi sẽ xóa token của đúng portal đó ngay khi trang được mở/gửi request.
function synchronizeLogoutMarker(portal) {
  let sharedMarker = readCookie(logoutCookieName(portal))
  const localMarker = localStorage.getItem(markerStorageKey(portal))

  if (!sharedMarker) {
    sharedMarker = localMarker || createLogoutMarker()
    writeLogoutCookie(logoutCookieName(portal), sharedMarker)
  }

  if (!localMarker) {
    localStorage.setItem(markerStorageKey(portal), sharedMarker)
  } else if (localMarker !== sharedMarker) {
    clearPortalTokens(portal)
    localStorage.setItem(markerStorageKey(portal), sharedMarker)
  }

  return sharedMarker
}

export function getAccessToken(portal = getCurrentPortal()) {
  synchronizeLogoutMarker(portal)
  return localStorage.getItem(getAuthStorageKeys(portal).access)
}

export function getRefreshToken(portal = getCurrentPortal()) {
  synchronizeLogoutMarker(portal)
  return localStorage.getItem(getAuthStorageKeys(portal).refresh)
}

// Ghi token; chỉ set refresh khi có (giữ nguyên hành vi interceptor cũ: refresh
// mới có thể vắng mặt trong phản hồi refresh).
export function setTokens({ access, refresh } = {}, portal = getCurrentPortal()) {
  synchronizeLogoutMarker(portal)
  const keys = getAuthStorageKeys(portal)
  if (access) localStorage.setItem(keys.access, access)
  if (refresh) localStorage.setItem(keys.refresh, refresh)
}

// Xóa token theo portal. Dùng bởi interceptor khi refresh thất bại — CHỈ key
// portal, không phát marker: đây là sự cố cục bộ của tab hiện tại, không phải
// hành động đăng xuất chủ động.
export function clearTokens(portal = getCurrentPortal()) {
  clearPortalTokens(portal)
}

// Đăng xuất CHỦ ĐỘNG khỏi MỘT cổng: xóa token cổng đó trên origin hiện tại và
// đổi marker của chính cổng đó để các tab/subdomain cùng cổng tự xóa phiên. Cổng
// khác trên cùng thiết bị KHÔNG bị ảnh hưởng.
export function clearCurrentPortalSession(portal = getCurrentPortal()) {
  clearPortalTokens(portal)
  const marker = createLogoutMarker()
  writeLogoutCookie(logoutCookieName(portal), marker)
  localStorage.setItem(markerStorageKey(portal), marker)
  window.dispatchEvent(new CustomEvent(LOGOUT_EVENT_NAME, { detail: { portal, marker } }))
}

// Đăng xuất khỏi TẤT CẢ cổng trên thiết bị này (hành động toàn cục, chủ động).
export function clearAllPortalSessions() {
  AUTH_PORTALS.forEach((portal) => clearCurrentPortalSession(portal))
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
}

// Refresh token đang lưu của mọi cổng (để logout toàn thiết bị gọi blacklist BE).
export function getStoredRefreshTokens() {
  return AUTH_PORTALS
    .map((portal) => localStorage.getItem(getAuthStorageKeys(portal).refresh))
    .filter(Boolean)
}

// Lắng nghe logout của CỔNG HIỆN TẠI phát ra từ tab/subdomain khác cùng cổng.
export function subscribeToSessionLogout(onLogout) {
  const portal = getCurrentPortal()
  let observedMarker = synchronizeLogoutMarker(portal)

  function applyMarker(marker) {
    if (!marker || marker === observedMarker) return
    observedMarker = marker
    clearPortalTokens(portal)
    localStorage.setItem(markerStorageKey(portal), marker)
    onLogout()
  }

  function handleLogoutEvent(event) {
    if (event.detail?.portal === portal) applyMarker(event.detail?.marker)
  }

  function handleStorageEvent(event) {
    if (event.key === markerStorageKey(portal)) applyMarker(event.newValue)
  }

  window.addEventListener(LOGOUT_EVENT_NAME, handleLogoutEvent)
  window.addEventListener('storage', handleStorageEvent)
  const pollId = window.setInterval(() => {
    applyMarker(readCookie(logoutCookieName(portal)))
  }, LOGOUT_POLL_INTERVAL_MS)

  return () => {
    window.removeEventListener(LOGOUT_EVENT_NAME, handleLogoutEvent)
    window.removeEventListener('storage', handleStorageEvent)
    window.clearInterval(pollId)
  }
}
