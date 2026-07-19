import api from '@/shared/api/client'
import { dedupeRequest } from '@/shared/api/request-deduplication'
import { getAccessToken } from '@/shared/api/token-store'

export async function getCurrentSessionUser() {
  const token = getAccessToken()
  return dedupeRequest(`session-me:${token || 'anonymous'}`, async () => {
    const { data } = await api.get('/auth/me/')
    return data
  })
}

// Đăng xuất phiên hiện tại: refresh token là bằng chứng để backend blacklist nó.
export async function logoutCurrentPortal(refresh) {
  await api.post('/auth/logout/', refresh ? { refresh } : {})
}

// Đăng xuất khỏi mọi thiết bị của tài khoản (cổng) đang đăng nhập.
export async function logoutAllDevices() {
  await api.post('/auth/logout-all/', {})
}
