// Nơi DUY NHẤT giữ access JWT theo portal (main/employer/admin).
// Access token chỉ tồn tại trong memory; refresh token do backend giữ trong
// HttpOnly cookie nên JavaScript không thể đọc. Cookie marker bên dưới chỉ
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
const accessTokens = new Map()

// One-time migration cleanup: no JWT from an older release may remain readable
// through localStorage after this bundle starts.
AUTH_PORTALS.forEach((portal) => {
  const keys = getAuthStorageKeys(portal)
  localStorage.removeItem(keys.access)
  localStorage.removeItem(keys.refresh)
})
LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))

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
  accessTokens.delete(portal)
  // Dọn token của các phiên bản cũ ngay khi người dùng chạy frontend mới.
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
  return accessTokens.get(portal) || null
}

export function setTokens({ access } = {}, portal = getCurrentPortal()) {
  synchronizeLogoutMarker(portal)
  if (access) accessTokens.set(portal, access)
  // Never persist a refresh token returned by an obsolete/backend-compatible
  // response. Also purge old localStorage values during the migration.
  const keys = getAuthStorageKeys(portal)
  localStorage.removeItem(keys.access)
  localStorage.removeItem(keys.refresh)
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
