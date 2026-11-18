import api from '@/shared/api/client'

const JOB_ALERTS_PATH = '/jobs/alerts/'

export function normalizeCandidateJobAlertList(data) {
  const results = Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : []
  const limit = Number.isInteger(data?.limit) ? data.limit : 5
  const remaining = Number.isInteger(data?.remaining)
    ? data.remaining
    : Math.max(0, limit - results.length)

  return { results, limit, remaining }
}

export async function getCandidateJobAlerts() {
  const { data } = await api.get(JOB_ALERTS_PATH)
  return normalizeCandidateJobAlertList(data)
}

export async function createCandidateJobAlert(payload) {
  const { data } = await api.post(JOB_ALERTS_PATH, payload)
  return data
}

export async function updateCandidateJobAlert(publicId, payload) {
  const { data } = await api.patch(`${JOB_ALERTS_PATH}${publicId}/`, payload)
  return data
}

export async function deleteCandidateJobAlert(publicId) {
  await api.delete(`${JOB_ALERTS_PATH}${publicId}/`)
  return publicId
}
