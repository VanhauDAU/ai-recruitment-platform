import api from '@/shared/api/client'
import { getRefreshToken } from '@/shared/api/token-store'

// Gửi kèm refresh token của phiên hiện tại để backend xoay đúng phiên này (đổi
// mật khẩu = thao tác nhạy cảm) và trả về cặp token mới cho thiết bị hiện tại.
export async function changeCurrentPassword(payload) {
  const { data } = await api.post('/auth/password/', { ...payload, refresh: getRefreshToken() })
  return data
}
