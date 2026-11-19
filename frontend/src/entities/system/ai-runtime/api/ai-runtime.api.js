import api from '@/shared/api/client'

export async function getAiRuntimeOverview({ signal } = {}) {
  const { data } = await api.get('/admin/ai/overview/?days=30', { signal })
  return data
}
