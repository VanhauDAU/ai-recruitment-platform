import api from '@/shared/api/client'

export async function submitCompanyReport(companyPublicId, payload) {
  const { data } = await api.post(`/companies/${companyPublicId}/reports/`, payload)
  return data
}

export async function getAdminCompanyReports(params = {}, config = {}) {
  const { data } = await api.get('/admin/company-reports/', { ...config, params })
  return data
}

export async function resolveAdminCompanyReport(reportPublicId, payload) {
  const { data } = await api.post(
    `/admin/company-reports/${reportPublicId}/resolve/`,
    payload,
  )
  return data
}

export async function reverseAdminCompanyReport(reportPublicId, note) {
  const { data } = await api.post(
    `/admin/company-reports/${reportPublicId}/reverse/`,
    { note },
  )
  return data
}
