import api from '@/shared/api/client'
import { dedupeRequest } from '@/shared/api/request-deduplication'
import { getAccessToken } from '@/shared/api/token-store'
import { getCurrentPortal } from '@/shared/config/portals'

export async function getCurrentSessionUser() {
  const token = getAccessToken()
  return dedupeRequest(`session-me:${token || 'anonymous'}`, async () => {
    const { data } = await api.get('/auth/me/')
    return data
  })
}

// Backend đọc refresh token từ HttpOnly cookie của đúng portal.
export async function logoutCurrentPortal(portal = getCurrentPortal()) {
  await api.post('/auth/logout/', { portal }, { headers: { 'X-Auth-Portal': portal } })
}

// Đăng xuất khỏi mọi thiết bị của tài khoản (cổng) đang đăng nhập.
export async function logoutAllDevices() {
  await api.post('/auth/logout-all/', {})
}
