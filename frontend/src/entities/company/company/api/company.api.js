import api from '@/shared/api/client'

export async function getPublicCompanies(params = {}, { signal } = {}) {
  const { data } = await api.get('/public/companies/', { params, signal })
  return data
}

export async function getPublicCompany(slug, { signal } = {}) {
  const { data } = await api.get(`/public/companies/${encodeURIComponent(slug)}/`, { signal })
  return data
}

export async function getSimilarCompanies(publicId, { signal } = {}) {
  const { data } = await api.get(`/public/companies/${publicId}/similar/`, { signal })
  return data
}

export async function getCompanyJobFacets(publicId, { signal } = {}) {
  const { data } = await api.get(`/public/companies/${publicId}/job-facets/`, { signal })
  return data
}
