import api from '@/shared/api/client'

export async function hideJobRecommendation(jobPublicId, source) {
  const { data } = await api.post('/jobs/recommendations/hidden/', {
    job_public_id: jobPublicId,
    source,
  })
  return data
}

export async function restoreJobRecommendation(jobPublicId) {
  const { data } = await api.delete(`/jobs/recommendations/hidden/${jobPublicId}/`)
  return data
}
