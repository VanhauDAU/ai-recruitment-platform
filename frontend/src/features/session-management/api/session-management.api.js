import api from '@/shared/api/client'

export async function listSessions() {
  const { data } = await api.get('/auth/sessions/')
  return data
}

export async function revokeSession(sessionId) {
  await api.delete(`/auth/sessions/${sessionId}/`)
}

export async function revokeOtherSessions() {
  await api.post('/auth/sessions/revoke-others/', {})
}
