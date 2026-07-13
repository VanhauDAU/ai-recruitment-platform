import api from '@/shared/api/client'

export async function getCandidateJobPreferences() {
  const { data } = await api.get('/candidate/job-preferences/')
  return data
}

export async function updateCandidateJobPreferences(preferences) {
  const { data } = await api.put('/candidate/job-preferences/', preferences)
  return data
}
