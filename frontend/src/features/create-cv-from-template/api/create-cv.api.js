import api from '@/shared/api/client'

export async function createCvFromTemplate(payload) {
  const { data } = await api.post('/v2/cvs/', payload)
  return data
}
