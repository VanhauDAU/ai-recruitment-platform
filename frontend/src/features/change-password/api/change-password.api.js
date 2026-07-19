import api from '@/shared/api/client'

// Refresh token được gửi tự động bằng HttpOnly cookie; JavaScript không đọc nó.
export async function changeCurrentPassword(payload) {
  const { data } = await api.post('/auth/password/', payload)
  return data
}
