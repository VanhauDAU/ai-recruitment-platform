import api from '@/shared/api/client'

// Dedupe/cache do TanStack Query đảm nhiệm (use-saved-jobs-query),
// api layer chỉ còn HTTP contract thuần.
export async function getSavedJobs() {
  const { data } = await api.get('/jobs/saved/')
  return data
}

export async function getSavedJobRecommendations(limit = 12) {
  const { data } = await api.get('/jobs/recommendations/by-saved/', {
    params: { limit },
  })
  return data
}

export async function saveJob(publicId) {
  const { data } = await api.post('/jobs/saved/', { job: publicId })
  return data
}

export async function unsaveJob(publicId) {
  await api.delete(`/jobs/saved/${publicId}/`)
}
