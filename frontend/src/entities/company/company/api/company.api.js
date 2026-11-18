import api from '@/shared/api/client'

export async function getPublicCompanies(params = {}, { signal } = {}) {
  const { data } = await api.get('/companies/', { params, signal })
  return data
}

export async function getPublicCompany(slug, { signal } = {}) {
  const { data } = await api.get(`/companies/${encodeURIComponent(slug)}/`, { signal })
  return data
}

export async function getSimilarCompanies(publicId, { signal } = {}) {
  const { data } = await api.get(`/companies/${publicId}/similar/`, { signal })
  return data
}

export async function getCompanyJobFacets(publicId, { signal } = {}) {
  const { data } = await api.get(`/companies/${publicId}/job-facets/`, { signal })
  return data
}
