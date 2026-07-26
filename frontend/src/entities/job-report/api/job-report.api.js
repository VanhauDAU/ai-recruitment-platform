import api from '@/shared/api/client'

export async function submitJobReport(jobPublicId, payload) {
  const { data } = await api.post(`/jobs/${jobPublicId}/report/`, payload)
  return data
}

export async function getAdminJobReports(params = {}) {
  const { data } = await api.get('/jobs/admin/reports/', { params })
  return data
}

export async function resolveAdminJobReport(reportPublicId, payload) {
  const { data } = await api.post(
    `/jobs/admin/reports/${reportPublicId}/resolve/`,
    payload,
  )
  return data
}

export async function reverseAdminJobReport(reportPublicId, note) {
  const { data } = await api.post(
    `/jobs/admin/reports/${reportPublicId}/reverse/`,
    { note },
  )
  return data
}
