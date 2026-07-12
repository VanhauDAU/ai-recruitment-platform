// Nơi DUY NHẤT đọc/ghi/xóa JWT theo portal (main/employer/admin).
// Key namespace lấy từ config/portals (getAuthStorageKeys) — hạ tầng token
// không tự chế key để tránh ghi sai portal. Xem ADR 0002.
import { getAuthStorageKeys, getCurrentPortal } from '@/shared/config/portals'

// Key phiên cũ trước khi tách namespace theo portal — dọn ở logout thủ công.
const LEGACY_KEYS = ['access_token', 'refresh_token']

export function getAccessToken(portal = getCurrentPortal()) {
  return localStorage.getItem(getAuthStorageKeys(portal).access)
}

export function getRefreshToken(portal = getCurrentPortal()) {
  return localStorage.getItem(getAuthStorageKeys(portal).refresh)
}

// Ghi token; chỉ set refresh khi có (giữ nguyên hành vi interceptor cũ: refresh
// mới có thể vắng mặt trong phản hồi refresh).
export function setTokens({ access, refresh } = {}, portal = getCurrentPortal()) {
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

// Đăng xuất chủ động: xóa cả key portal lẫn key phiên cũ mồ côi.
export function clearSession(portal = getCurrentPortal()) {
  clearTokens(portal)
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key))
}
