import client from '@/shared/api/client'

export async function createConsultationLead(payload) {
  const { data } = await client.post('/services/consultations/', payload)
  return data
}

export async function getAdminConsultationLeads(params = {}) {
  const { data } = await client.get('/services/admin/consultations/', { params })
  return data
}

export async function updateAdminConsultationLead(id, payload) {
  const { data } = await client.patch(`/services/admin/consultations/${id}/`, payload)
  return data
}
