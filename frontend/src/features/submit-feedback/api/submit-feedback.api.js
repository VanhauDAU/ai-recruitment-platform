import api from '@/shared/api/client'

export async function submitFeedback(payload) {
  const { data } = await api.post('/site/feedback/', payload)
  return data
}
