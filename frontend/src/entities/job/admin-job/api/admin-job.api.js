import client from '@/shared/api/client'

async function data(request) {
  const response = await request
  return response.data
}

export function getAdminJobs(params = {}, { signal } = {}) {
  return data(client.get('/jobs/admin/moderation/', { params, signal }))
}

export function getAdminJobSummary({ signal } = {}) {
  return data(client.get('/jobs/admin/moderation/summary/', { signal }))
}

export function getAdminJob(publicId, { signal } = {}) {
  return data(client.get(`/jobs/admin/moderation/${publicId}/`, { signal }))
}

export function decideAdminJob(publicId, payload) {
  return data(client.post(`/jobs/admin/moderation/${publicId}/decisions/`, payload))
}
