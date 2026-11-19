import api from '@/shared/api/client'

export async function getCandidateJobPreferences() {
  const { data } = await api.get('/candidate/job-preferences/')
  return data
}

export async function updateCandidateJobPreferences(preferences) {
  const { data } = await api.put('/candidate/job-preferences/', preferences)
  return data
}

/** Đồng ý cấp hồ sơ; tắt nó thì backend cũng gỡ mọi CV khỏi tìm kiếm của NTD. */
export const RECRUITER_VISIBILITY_QUERY_KEY = ['candidate', 'recruiter-visibility']

export async function getRecruiterVisibility() {
  const { data } = await api.get('/candidate/recruiter-visibility/')
  return data
}

export async function updateRecruiterVisibility(payload) {
  const { data } = await api.patch('/candidate/recruiter-visibility/', payload)
  return data
}
