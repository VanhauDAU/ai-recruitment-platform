import api from './api'
import { fetchAllPages } from './pagination'

export async function getJobs(params = {}) {
  const { data } = await api.get('/jobs/', { params })
  return data
}

export async function getJobDetail(slug) {
  const { data } = await api.get(`/jobs/${slug}/`)
  return data
}

export async function getJobCategories() {
  return fetchAllPages('/jobs/categories/')
}

export async function getJobStats() {
  const { data } = await api.get('/jobs/stats/')
  return data
}

// Lĩnh vực công ty (distinct) cho bộ lọc "Lĩnh vực công ty".
export async function getIndustries() {
  const { data } = await api.get('/employer/industries/')
  return data
}

// Autocomplete từ khóa theo nội dung nhập (tên việc làm / tên công ty).
export async function getJobSuggestions(q, searchBy = 'title') {
  const params = { q }
  if (searchBy === 'company') params.search_by = 'company'
  const { data } = await api.get('/jobs/suggest/', { params })
  return data.suggestions || []
}
