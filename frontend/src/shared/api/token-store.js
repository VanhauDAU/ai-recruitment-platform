// Nơi DUY NHẤT đọc/ghi/xóa JWT theo portal (main/employer/admin).
// JWT vẫn nằm trong localStorage của từng origin. Cookie dùng chung bên dưới
// chỉ là marker logout, không chứa access/refresh token.
import {
  AUTH_SYNC_COOKIE_DOMAIN,
  getAuthStorageKeys,
  getCurrentPortal,
} from '@/shared/config/portals'

const AUTH_PORTALS = ['main', 'employer', 'admin']
const LEGACY_KEYS = ['access_token', 'refresh_token']
const LOGOUT_MARKER_KEY = 'auth_logout_marker'
const LOGOUT_COOKIE_NAME = 'procv_auth_logout'
const LOGOUT_EVENT_NAME = 'procv:auth-logout'
const LOGOUT_POLL_INTERVAL_MS = 1000

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : ''
}

function writeLogoutCookie(marker) {
  const domain = AUTH_SYNC_COOKIE_DOMAIN
    && (window.location.hostname === AUTH_SYNC_COOKIE_DOMAIN
      || window.location.hostname.endsWith(`.${AUTH_SYNC_COOKIE_DOMAIN}`))
    ? `; Domain=${AUTH_SYNC_COOKIE_DOMAIN}`
    : ''
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''

  document.cookie = `${encodeURIComponent(LOGOUT_COOKIE_NAME)}=${encodeURIComponent(marker)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`
}

function createLogoutMarker() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function clearAllStoredTokens() {
  AUTH_PORTALS.forEach((portal) => {
    const keys = getAuthStorageKeys(portal)
    localStorage.removeItem(keys.access)
    localStorage.removeItem(keys.refresh)
  })
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
}

function synchronizeLogoutMarker() {
  let sharedMarker = readCookie(LOGOUT_COOKIE_NAME)
  const localMarker = localStorage.getItem(LOGOUT_MARKER_KEY)

  if (!sharedMarker) {
    sharedMarker = localMarker || createLogoutMarker()
    writeLogoutCookie(sharedMarker)
  }

  // Lần chạy đầu tiên chỉ ghi nhận marker để không làm người dùng đang đăng
  // nhập bị văng sau deploy. Từ lần logout kế tiếp, marker đổi sẽ xóa mọi token
  // trên origin này ngay khi trang được mở/gửi request.
  if (!localMarker) {
    localStorage.setItem(LOGOUT_MARKER_KEY, sharedMarker)
  } else if (localMarker !== sharedMarker) {
    clearAllStoredTokens()
    localStorage.setItem(LOGOUT_MARKER_KEY, sharedMarker)
  }

  return sharedMarker
}

export function getAccessToken(portal = getCurrentPortal()) {
  synchronizeLogoutMarker()
  return localStorage.getItem(getAuthStorageKeys(portal).access)
}

export function getRefreshToken(portal = getCurrentPortal()) {
  synchronizeLogoutMarker()
  return localStorage.getItem(getAuthStorageKeys(portal).refresh)
}

// Ghi token; chỉ set refresh khi có (giữ nguyên hành vi interceptor cũ: refresh
// mới có thể vắng mặt trong phản hồi refresh).
export function setTokens({ access, refresh } = {}, portal = getCurrentPortal()) {
  synchronizeLogoutMarker()
  const keys = getAuthStorageKeys(portal)
  if (access) localStorage.setItem(keys.access, access)
  if (refresh) localStorage.setItem(keys.refresh, refresh)
}

// Xóa token theo portal. Dùng bởi interceptor khi refresh thất bại — CHỈ key
// portal, không đụng legacy (giữ đúng hành vi cũ).
export function clearTokens(portal = getCurrentPortal()) {
  const keys = getAuthStorageKeys(portal)
  localStorage.removeItem(keys.access)
  localStorage.removeItem(keys.refresh)
}

// Đăng xuất chủ động là logout toàn cục trong trình duyệt: xóa mọi namespace
// trên origin hiện tại và đổi marker để các subdomain/tab còn lại tự xóa phiên.
export function clearSession() {
  clearAllStoredTokens()
  const marker = createLogoutMarker()
  writeLogoutCookie(marker)
  localStorage.setItem(LOGOUT_MARKER_KEY, marker)
  window.dispatchEvent(new CustomEvent(LOGOUT_EVENT_NAME, { detail: { marker } }))
}

export function subscribeToSessionLogout(onLogout) {
  let observedMarker = synchronizeLogoutMarker()

  function applyMarker(marker) {
    if (!marker || marker === observedMarker) return
    observedMarker = marker
    clearAllStoredTokens()
    localStorage.setItem(LOGOUT_MARKER_KEY, marker)
    onLogout()
  }

  function handleLogoutEvent(event) {
    applyMarker(event.detail?.marker)
  }

  function handleStorageEvent(event) {
    if (event.key === LOGOUT_MARKER_KEY) applyMarker(event.newValue)
  }

  window.addEventListener(LOGOUT_EVENT_NAME, handleLogoutEvent)
  window.addEventListener('storage', handleStorageEvent)
  const pollId = window.setInterval(() => {
    applyMarker(readCookie(LOGOUT_COOKIE_NAME))
  }, LOGOUT_POLL_INTERVAL_MS)

  return () => {
    window.removeEventListener(LOGOUT_EVENT_NAME, handleLogoutEvent)
    window.removeEventListener('storage', handleStorageEvent)
    window.clearInterval(pollId)
  }
}
