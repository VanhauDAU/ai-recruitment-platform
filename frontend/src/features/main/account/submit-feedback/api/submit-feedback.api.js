import api from '@/shared/api/client'

export async function submitFeedback(payload) {
  const { data } = await api.post('/public/site/feedback/', payload)
  return data
}
