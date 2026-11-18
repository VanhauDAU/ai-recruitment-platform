import api from '@/shared/api/client'

export async function submitJobReport(jobPublicId, payload) {
  const { data } = await api.post(`/candidate/jobs/${jobPublicId}/report/`, payload)
  return data
}

export async function getAdminJobReports(params = {}, config = {}) {
  const { data } = await api.get('/admin/jobs/reports/', { ...config, params })
  return data
}

export async function resolveAdminJobReport(reportPublicId, payload) {
  const { data } = await api.post(
    `/admin/jobs/reports/${reportPublicId}/resolve/`,
    payload,
  )
  return data
}

export async function reverseAdminJobReport(reportPublicId, note) {
  const { data } = await api.post(
    `/admin/jobs/reports/${reportPublicId}/reverse/`,
    { note },
  )
  return data
}
