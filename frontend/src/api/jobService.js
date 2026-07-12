import api from './api'
import { fetchAllPages } from './pagination'
import { cachedRequest, dedupeRequest, invalidateRequestCache } from './requestDeduplication'

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

export async function getJobCategories() {
  return cachedRequest('job-categories', CATALOG_CACHE_TTL, () => fetchAllPages('/jobs/categories/', { all: '1' }))
}

export async function getJobStats() {
  return cachedRequest('job-stats', STATS_CACHE_TTL, async () => {
    const { data } = await api.get('/jobs/stats/')
    return data
  })
}

// Lĩnh vực công ty (distinct) cho bộ lọc "Lĩnh vực công ty".
export async function getIndustries() {
  return cachedRequest('industries', CATALOG_CACHE_TTL, async () => {
    const { data } = await api.get('/employer/industries/')
    return data
  })
}

// Việc làm đã lưu (ứng viên). Trả về [{ job_detail, created_at }] — không phân trang.
export async function getSavedJobs() {
  return dedupeRequest('saved-jobs', async () => {
    const { data } = await api.get('/jobs/saved/')
    return data
  })
}

export async function saveJob(publicId) {
  const { data } = await api.post('/jobs/saved/', { job: publicId })
  invalidateRequestCache('saved-jobs')
  return data
}

export async function unsaveJob(publicId) {
  await api.delete(`/jobs/saved/${publicId}/`)
  invalidateRequestCache('saved-jobs')
}

// Autocomplete từ khóa theo nội dung nhập (tên việc làm / tên công ty).
export async function getJobSuggestions(q, searchBy = 'title') {
  const params = { q }
  if (searchBy === 'company') params.search_by = 'company'
  const { data } = await api.get('/jobs/suggest/', { params })
  return data.suggestions || []
}
