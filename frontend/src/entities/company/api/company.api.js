import api from '@/shared/api/client'

export async function getPublicCompanies(params = {}, { signal } = {}) {
  const { data } = await api.get('/companies/', { params, signal })
  return data
}
