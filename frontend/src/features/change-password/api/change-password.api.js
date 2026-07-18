import api from '@/shared/api/client'

export async function changeCurrentPassword(payload) {
  const { data } = await api.post('/auth/password/', payload)
  return data
}
