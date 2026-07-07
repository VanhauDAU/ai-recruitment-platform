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
