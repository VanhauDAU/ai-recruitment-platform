import api from '@/shared/api/client'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachedRequest, dedupeRequest, invalidateRequestCache } from '@/shared/api/request-deduplication'

const CATALOG_CACHE_TTL = 5 * 60 * 1000
const STATS_CACHE_TTL = 60 * 1000

export async function getJobs(params = {}) {
  const { data } = await api.get('/jobs/', { params })
  return data
}

export async function getCvJobRecommendations(publicId) {
  const { data } = await api.get(`/jobs/recommendations/by-cv/${publicId}/`)
  return data
}

export async function getJobDetail(slug) {
  return dedupeRequest(`job-detail:${slug}`, async () => {
    const { data } = await api.get(`/jobs/${slug}/`)
    return data
  })
}

export async function recordJobView(slug) {
  const { data } = await api.post(`/jobs/${slug}/views/`, null, { withCredentials: true })
  return data
}

export async function recordJobImpressions(slugs) {
  const { data } = await api.post('/jobs/impressions/', { slugs }, { withCredentials: true })
  return data
}

export async function getJobCategories(params = {}) {
  const cacheKey = `job-categories:${JSON.stringify(params)}`
  return cachedRequest(cacheKey, CATALOG_CACHE_TTL, () => fetchAllPages('/jobs/categories/', { all: '1', ...params }))
}

export async function getJobBenefits() {
  return cachedRequest('job-benefits', CATALOG_CACHE_TTL, async () => {
    const { data } = await api.get('/jobs/benefits/')
    return data.results || data
  })
}

export async function getJobLanguages() {
  return cachedRequest('job-languages', CATALOG_CACHE_TTL, async () => {
    const { data } = await api.get('/jobs/languages/')
    return data.results || data
  })
}

export async function getSkills(params = {}) {
  if (Object.keys(params).length) {
    const { data } = await api.get('/skills/', { params })
    return data.results || data
  }

  return cachedRequest('skills', CATALOG_CACHE_TTL, async () => {
    const { data } = await api.get('/skills/')
    return data.results || data
  })
}

export async function createSkill(name) {
  const { data } = await api.post('/skills/', { name })
  invalidateRequestCache('skills')
  return data
}

export async function getJobStats() {
  return cachedRequest('job-stats', STATS_CACHE_TTL, async () => {
    const { data } = await api.get('/jobs/stats/')
    return data
  })
}

export async function getIndustries() {
  return cachedRequest('industries', CATALOG_CACHE_TTL, async () => {
    const { data } = await api.get('/employer/industries/')
    return data
  })
}

export async function getJobSuggestions(q, searchBy = 'title') {
  const params = { q }
  if (searchBy === 'company') params.search_by = 'company'
  const { data } = await api.get('/jobs/suggest/', { params })
  return data.suggestions || []
}

export async function getEmployerJobs(params = {}) {
  const { data } = await api.get('/jobs/mine/', { params })
  return data.results || data
}

export async function getEmployerJob(publicId) {
  const { data } = await api.get(`/jobs/mine/${publicId}/`)
  return data
}

export async function getJobPostingContext() {
  const { data } = await api.get('/jobs/mine/posting-context/')
  return data
}

export async function saveEmployerJob(payload, publicId) {
  if (publicId) {
    const { data } = await api.patch(`/jobs/mine/${publicId}/`, payload)
    return data
  }
  const { data } = await api.post('/jobs/mine/?as=draft', payload)
  return data
}

export async function publishEmployerJob(payload, publicId) {
  if (publicId) {
    await api.patch(`/jobs/mine/${publicId}/`, payload)
    const { data } = await api.post(`/jobs/mine/${publicId}/submit/`)
    return data
  }
  const { data } = await api.post('/jobs/mine/', payload)
  return data
}

export async function closeEmployerJob(publicId) {
  const { data } = await api.post(`/jobs/mine/${publicId}/close/`)
  return data
}

export async function reopenEmployerJob(publicId, deadline) {
  const { data } = await api.post(`/jobs/mine/${publicId}/reopen/`, { deadline })
  return data
}

export async function extendEmployerJob(publicId, deadline) {
  const { data } = await api.post(`/jobs/mine/${publicId}/extend/`, { deadline })
  return data
}

export async function duplicateEmployerJob(publicId) {
  const { data } = await api.post(`/jobs/mine/${publicId}/duplicate/`)
  return data
}

export async function getAdminJobModeration(params = {}) {
  const { data } = await api.get('/jobs/admin/moderation/', { params })
  return data.results || data
}

export async function reviewAdminJob(publicId, payload) {
  const { data } = await api.post(`/jobs/admin/moderation/${publicId}/review/`, payload)
  return data
}
