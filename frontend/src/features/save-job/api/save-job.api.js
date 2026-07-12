import api from '@/shared/api/client'
import { dedupeRequest, invalidateRequestCache } from '@/shared/api/requestDeduplication'

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
