import api from '@/shared/api/client'

export * from '@/entities/job'
export { getSavedJobs, saveJob, unsaveJob } from '@/features/save-job'

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
