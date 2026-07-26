import api from '@/shared/api/client'

export async function listSessions() {
  const { data } = await api.get('/auth/sessions/')
  return data
}

// Gồm cả phiên đã thu hồi/hết hạn (tối đa 50 bản ghi gần nhất) — dùng cho màn
// hình nhật ký đăng nhập, khác với `listSessions` chỉ trả phiên còn hiệu lực.
export async function listSessionHistory() {
  const { data } = await api.get('/auth/sessions/', { params: { scope: 'history' } })
  return data
}

export async function revokeSession(sessionId) {
  await api.delete(`/auth/sessions/${sessionId}/`)
}

export async function revokeOtherSessions() {
  await api.post('/auth/sessions/revoke-others/', {})
}
