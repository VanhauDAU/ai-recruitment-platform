import client from '@/shared/api/client'

export async function createConsultationLead(payload) {
  const { data } = await client.post('/services/consultations/', payload)
  return data
}

export async function getAdminConsultationLeads(params = {}, { signal } = {}) {
  const { data } = await client.get('/services/admin/consultations/', { params, signal })
  return data
}

export async function exportAdminConsultationLeads(params = {}, { signal } = {}) {
  const { data, headers } = await client.get('/services/admin/consultations/export/', {
    params,
    responseType: 'blob',
    signal,
  })
  const disposition = headers['content-disposition'] || ''
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    || `consultation-leads-${new Date().toISOString().slice(0, 10)}.csv`
  return {
    blob: data,
    filename,
    rowLimit: Number(headers['x-export-row-limit']) || null,
    truncated: headers['x-export-truncated'] === 'true',
  }
}

export async function updateAdminConsultationLead(id, payload) {
  const { data } = await client.patch(`/services/admin/consultations/${id}/`, payload)
  return data
}
