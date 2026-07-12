import api from '@/shared/api/client'

// Candidate application endpoints. Payload uses existing public_id contracts
// for `job` and `cv`; no endpoint or response shape changes in this feature.
export async function getCandidateApplications(params = {}) {
  const { data } = await api.get('/applications/', { params })
  return data
}

export async function createApplication(payload) {
  const { data } = await api.post('/applications/', payload)
  return data
}

export async function getEmployerApplications(params = {}) {
  const { data } = await api.get('/applications/employer/', { params })
  return data
}

export async function updateEmployerApplication(publicId, payload) {
  const { data } = await api.patch(`/applications/employer/${publicId}/`, payload)
  return data
}
