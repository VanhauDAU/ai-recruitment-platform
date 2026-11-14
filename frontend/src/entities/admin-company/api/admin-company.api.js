import client from '@/shared/api/client'

async function data(request) {
  const response = await request
  return response.data
}

export function getAdminCompanies(params = {}, { signal } = {}) {
  return data(client.get('/admin/companies/', { params, signal }))
}

export function getAdminCompanySummary({ signal } = {}) {
  return data(client.get('/admin/companies/summary/', { signal }))
}

export function getAdminCompany(publicId, { signal } = {}) {
  return data(client.get(`/admin/companies/${publicId}/`, { signal }))
}

export function getAdminCompanyRecruiters(publicId, params = {}, { signal } = {}) {
  return data(client.get(`/admin/companies/${publicId}/recruiters/`, {
    params,
    signal,
  }))
}

export function getAdminCompanyPublicPage(publicId, { signal } = {}) {
  return data(client.get(`/admin/companies/${publicId}/public-page/`, { signal }))
}

/** `action` là `apply` (tạm ẩn) hoặc `release` (khôi phục); response cùng dạng với public-page. */
export function setAdminCompanyPolicyHold(publicId, { action, reason }) {
  return data(client.post(`/admin/companies/${publicId}/policy-hold/`, { action, reason }))
}
