import api from '@/shared/api/client'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachedRequest, dedupeRequest } from '@/shared/api/request-deduplication'

const CATALOG_CACHE_TTL = 5 * 60 * 1000
const STATS_CACHE_TTL = 60 * 1000

export async function getJobs(params = {}) {
  const { data } = await api.get('/jobs/', { params })
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

export async function getJobCategories() {
  return cachedRequest('job-categories', CATALOG_CACHE_TTL, () => fetchAllPages('/jobs/categories/', { all: '1' }))
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
