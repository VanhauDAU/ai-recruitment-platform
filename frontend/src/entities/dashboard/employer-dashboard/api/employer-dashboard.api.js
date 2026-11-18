import api from '@/shared/api/client'

export async function getEmployerDashboard() {
  const { data } = await api.get('/dashboard/employer/')
  return data
}
