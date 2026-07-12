import api from '@/shared/api/client'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachedRequest, dedupeRequest, invalidateRequestCache } from '@/shared/api/requestDeduplication'

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

// Employer CRUD giữ nguyên contract `/jobs/mine/`; UI employer sẽ dùng các
// command này khi được đưa vào feature ở lát cắt tiếp theo.
export async function getEmployerJobs(params = {}) {
  const { data } = await api.get('/jobs/mine/', { params })
  return data
}

export async function getEmployerJob(publicId) {
  const { data } = await api.get(`/jobs/mine/${publicId}/`)
  return data
}

export async function createEmployerJob(payload) {
  const { data } = await api.post('/jobs/mine/', payload)
  return data
}

export async function updateEmployerJob(publicId, payload) {
  const { data } = await api.patch(`/jobs/mine/${publicId}/`, payload)
  return data
}

export async function deleteEmployerJob(publicId) {
  await api.delete(`/jobs/mine/${publicId}/`)
}

// Autocomplete từ khóa theo nội dung nhập (tên việc làm / tên công ty).
export async function getJobSuggestions(q, searchBy = 'title') {
  const params = { q }
  if (searchBy === 'company') params.search_by = 'company'
  const { data } = await api.get('/jobs/suggest/', { params })
  return data.suggestions || []
}
